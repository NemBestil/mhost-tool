import { createHmac, createHash } from 'node:crypto'

const AMAZON_SES_API_VERSION = '2010-12-01'
const AMAZON_SES_SERVICE = 'ses'
const AMAZON_SES_IDENTITIES_CACHE_TTL_MS = 10 * 60 * 1000

export type AmazonSesIdentity = {
  identity: string
  type: 'domain' | 'email'
  verificationStatus: string | null
  dkimVerificationStatus: string | null
  dnsVerified: boolean | null
}

export type AmazonSesValidationResult = {
  checkedAt: string
  credentialsValid: boolean
  errorMessage: string | null
  identities: AmazonSesIdentity[]
}

export type AmazonSesCredentials = {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

type AmazonSesVerificationAttributes = {
  verificationStatus: string | null
}

type AmazonSesDkimAttributes = {
  dkimVerificationStatus: string | null
}

type AmazonSesIdentitiesCacheEntry = {
  expiresAt: number
  promise: Promise<AmazonSesIdentity[]>
}

const amazonSesIdentitiesCache = new Map<string, AmazonSesIdentitiesCacheEntry>()

export async function validateAmazonSesCredentials(
  credentials: AmazonSesCredentials
): Promise<AmazonSesValidationResult> {
  const checkedAt = new Date().toISOString()

  try {
    const identities = await listAmazonSesIdentities(credentials)

    return {
      checkedAt,
      credentialsValid: true,
      errorMessage: null,
      identities
    }
  } catch (error: any) {
    return {
      checkedAt,
      credentialsValid: false,
      errorMessage: getAmazonSesErrorMessage(error),
      identities: []
    }
  }
}

async function listAmazonSesIdentities(credentials: AmazonSesCredentials): Promise<AmazonSesIdentity[]> {
  const cacheKey = getAmazonSesCredentialsCacheKey(credentials)
  const cached = amazonSesIdentitiesCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return await cached.promise
  }

  const promise = fetchAmazonSesIdentities(credentials).catch((error) => {
    amazonSesIdentitiesCache.delete(cacheKey)
    throw error
  })

  amazonSesIdentitiesCache.set(cacheKey, {
    expiresAt: Date.now() + AMAZON_SES_IDENTITIES_CACHE_TTL_MS,
    promise
  })

  return await promise
}

async function fetchAmazonSesIdentities(credentials: AmazonSesCredentials): Promise<AmazonSesIdentity[]> {
  const identities: string[] = []
  let nextToken: string | null = null

  do {
    const responseXml = await sendAmazonSesAction(credentials, 'ListIdentities', {
      MaxItems: '1000',
      ...(nextToken ? { NextToken: nextToken } : {})
    })

    identities.push(...extractXmlTagValues(extractXmlSection(responseXml, 'Identities'), 'member'))
    nextToken = extractXmlTagValue(responseXml, 'NextToken')
  } while (nextToken)

  if (identities.length === 0) {
    return []
  }

  const verificationMap = await getAmazonSesVerificationMap(credentials, identities)
  const dkimMap = await getAmazonSesDkimMap(credentials, identities)

  return identities.map((identity) => {
    const verification = verificationMap.get(identity)
    const dkim = dkimMap.get(identity)
    const type = identity.includes('@') ? 'email' as const : 'domain' as const
    const finalStatus = getAmazonSesIdentityStatus(
      verification?.verificationStatus ?? null,
      dkim?.dkimVerificationStatus ?? null
    )

    return {
      identity,
      type,
      verificationStatus: finalStatus,
      dkimVerificationStatus: dkim?.dkimVerificationStatus ?? null,
      dnsVerified: type === 'domain'
        ? (finalStatus === null ? null : finalStatus === 'Success')
        : null
    }
  })
}

async function getAmazonSesVerificationMap(
  credentials: AmazonSesCredentials,
  identities: string[]
) {
  const result = new Map<string, AmazonSesVerificationAttributes>()

  for (const chunk of chunkArray(identities, 100)) {
    const responseXml = await sendAmazonSesAction(
      credentials,
      'GetIdentityVerificationAttributes',
      buildIdentityMembers(chunk)
    )

    const section = extractXmlSection(responseXml, 'VerificationAttributes')
    for (const entry of extractXmlEntryMap(section)) {
      result.set(entry.key, {
        verificationStatus: extractXmlTagValue(entry.value, 'VerificationStatus')
      })
    }
  }

  return result
}

async function getAmazonSesDkimMap(
  credentials: AmazonSesCredentials,
  identities: string[]
) {
  const result = new Map<string, AmazonSesDkimAttributes>()

  for (const chunk of chunkArray(identities, 100)) {
    const responseXml = await sendAmazonSesAction(
      credentials,
      'GetIdentityDkimAttributes',
      buildIdentityMembers(chunk)
    )

    const section = extractXmlSection(responseXml, 'DkimAttributes')
    for (const entry of extractXmlEntryMap(section)) {
      result.set(entry.key, {
        dkimVerificationStatus: extractXmlTagValue(entry.value, 'DkimVerificationStatus')
      })
    }
  }

  return result
}

async function sendAmazonSesAction(
  credentials: AmazonSesCredentials,
  action: string,
  params: Record<string, string>
) {
  const endpoint = `https://email.${credentials.region}.amazonaws.com/`
  const url = new URL(endpoint)
  const body = new URLSearchParams([
    ['Action', action],
    ['Version', AMAZON_SES_API_VERSION],
    ...Object.entries(params)
  ]).toString()
  const payloadHash = sha256Hex(body)
  const amzDate = createAmzDate(new Date())
  const dateStamp = amzDate.slice(0, 8)
  const canonicalHeaders = [
    'content-type:application/x-www-form-urlencoded; charset=utf-8',
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n'
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')
  const credentialScope = `${dateStamp}/${credentials.region}/${AMAZON_SES_SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n')
  const signingKey = getSignatureKey(credentials.secretAccessKey, dateStamp, credentials.region, AMAZON_SES_SERVICE)
  const signature = hmacHex(signingKey, stringToSign)
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    },
    body
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(parseAmazonSesError(responseText) || `AWS SES request failed with ${response.status}`)
  }

  return responseText
}

function buildIdentityMembers(identities: string[]) {
  return Object.fromEntries(
    identities.map((identity, index) => [`Identities.member.${index + 1}`, identity])
  )
}

function extractXmlEntryMap(xml: string | null) {
  if (!xml) {
    return []
  }

  const entries: Array<{ key: string, value: string }> = []
  const regex = /<entry>([\s\S]*?)<\/entry>/g

  for (const match of xml.matchAll(regex)) {
    const entryXml = match[1] || ''
    const key = extractXmlTagValue(entryXml, 'key')
    const value = extractXmlSection(entryXml, 'value')

    if (key && value !== null) {
      entries.push({ key, value })
    }
  }

  return entries
}

function extractXmlSection(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:>|\\s[^>]*>)([\\s\\S]*?)</${tag}>`))
  return match?.[1] ?? null
}

function extractXmlTagValue(xml: string | null, tag: string) {
  if (!xml) {
    return null
  }

  const match = xml.match(new RegExp(`<${tag}(?:>|\\s[^>]*>)([\\s\\S]*?)</${tag}>`))
  return match?.[1] ? decodeXml(match[1].trim()) : null
}

function extractXmlTagValues(xml: string | null, tag: string) {
  if (!xml) {
    return []
  }

  const values: string[] = []
  const regex = new RegExp(`<${tag}(?:>|\\s[^>]*>)([\\s\\S]*?)</${tag}>`, 'g')

  for (const match of xml.matchAll(regex)) {
    if (match[1]) {
      values.push(decodeXml(match[1].trim()))
    }
  }

  return values
}

function getAmazonSesIdentityStatus(verificationStatus: string | null, dkimStatus: string | null) {
  if (verificationStatus !== 'Success' && dkimStatus) {
    return dkimStatus
  }

  return verificationStatus
}

function parseAmazonSesError(xml: string) {
  const message = extractXmlTagValue(xml, 'Message')
  const code = extractXmlTagValue(xml, 'Code')

  if (code && message) {
    return `${code}: ${message}`
  }

  return message || code
}

function getAmazonSesErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown AWS SES error'
}

function decodeXml(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', '\'')
    .replaceAll('&amp;', '&')
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function createAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function getAmazonSesCredentialsCacheKey(credentials: AmazonSesCredentials) {
  return [
    credentials.region,
    credentials.accessKeyId,
    sha256Hex(credentials.secretAccessKey)
  ].join(':')
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex')
}

function getSignatureKey(secretAccessKey: string, dateStamp: string, region: string, service: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

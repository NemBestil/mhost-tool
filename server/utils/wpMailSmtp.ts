import type { AmazonSesIdentity, AmazonSesValidationResult } from '#server/utils/amazonSes'
import type { WpMailSmtpProConfiguration } from '#server/utils/setup'

export type WpMailSmtpPluginInfo = {
  slug: string
  version: string | null
  isActive: boolean
}

export type WpMailSmtpScanRecord = {
  pluginInstalled: boolean
  pluginIsActive: boolean
  pluginSlug: string | null
  pluginVersion: string | null
  provider: string | null
  fromEmail: string | null
  fromName: string | null
  smtpHost: string | null
  smtpEncryption: string | null
  smtpPort: number | null
  smtpAuthentication: boolean | null
  smtpUsername: string | null
  amazonSesAccessKeyId: string | null
  amazonSesRegion: string | null
  amazonSesCredentialsValid: boolean | null
  amazonSesLastCheckedAt: Date | null
  amazonSesErrorMessage: string | null
  amazonSesDnsVerified: boolean | null
  amazonSesIdentity: string | null
  amazonSesIdentityStatus: string | null
  logEmails: boolean | null
  logRetentionPeriod: string | null
  logEmailContent: boolean | null
  hideAnnouncements: boolean | null
  disableEmailSummaries: boolean | null
}

type RawWpMailSmtpOptions = {
  mail?: {
    mailer?: unknown
    from_email?: unknown
    from_name?: unknown
  }
  smtp?: {
    host?: unknown
    encryption?: unknown
    port?: unknown
    auth?: unknown
    user?: unknown
  }
  amazonses?: {
    client_id?: unknown
    client_secret?: unknown
    region?: unknown
  }
  logs?: {
    enabled?: unknown
    log_retention_period?: unknown
    log_email_content?: unknown
  }
  general?: {
    am_notifications_hidden?: unknown
    summary_report_email_disabled?: unknown
  }
}

export function createEmptyWpMailSmtpScanRecord(): WpMailSmtpScanRecord {
  return {
    pluginInstalled: false,
    pluginIsActive: false,
    pluginSlug: null,
    pluginVersion: null,
    provider: null,
    fromEmail: null,
    fromName: null,
    smtpHost: null,
    smtpEncryption: null,
    smtpPort: null,
    smtpAuthentication: null,
    smtpUsername: null,
    amazonSesAccessKeyId: null,
    amazonSesRegion: null,
    amazonSesCredentialsValid: null,
    amazonSesLastCheckedAt: null,
    amazonSesErrorMessage: null,
    amazonSesDnsVerified: null,
    amazonSesIdentity: null,
    amazonSesIdentityStatus: null,
    logEmails: null,
    logRetentionPeriod: null,
    logEmailContent: null,
    hideAnnouncements: null,
    disableEmailSummaries: null
  }
}

export function isWpMailSmtpPluginSlug(slug: string | null | undefined) {
  return slug === 'wp-mail-smtp' || slug === 'wp-mail-smtp-pro'
}

export function pickWpMailSmtpPlugin(
  plugins: Array<{ slug?: string | null, version?: string | null, isEnabled?: boolean | null }>
): WpMailSmtpPluginInfo | null {
  const matches = plugins.filter((plugin) => isWpMailSmtpPluginSlug(plugin.slug || null))

  if (matches.length === 0) {
    return null
  }

  const preferred = matches.find((plugin) => plugin.slug === 'wp-mail-smtp-pro') ?? matches[0]!

  return {
    slug: preferred.slug || 'wp-mail-smtp',
    version: preferred.version || null,
    isActive: Boolean(preferred.isEnabled)
  }
}

export function normalizeWpMailSmtpScanRecord(
  rawOptions: unknown,
  plugin: WpMailSmtpPluginInfo | null,
  sesValidation?: AmazonSesValidationResult | null
): WpMailSmtpScanRecord {
  const defaults = createEmptyWpMailSmtpScanRecord()
  const options = isPlainObject(rawOptions) ? rawOptions as RawWpMailSmtpOptions : {}
  const fromEmail = toNullableString(options.mail?.from_email)
  const provider = toNullableString(options.mail?.mailer)
  const matchedAmazonSesIdentity = findAmazonSesIdentityMatch(sesValidation?.identities ?? [], fromEmail)

  const record: WpMailSmtpScanRecord = {
    ...defaults,
    pluginInstalled: Boolean(plugin),
    pluginIsActive: plugin?.isActive ?? false,
    pluginSlug: plugin?.slug ?? null,
    pluginVersion: plugin?.version ?? null,
    provider,
    fromEmail,
    fromName: toNullableString(options.mail?.from_name),
    smtpHost: toNullableString(options.smtp?.host),
    smtpEncryption: toNullableString(options.smtp?.encryption),
    smtpPort: toNullableInteger(options.smtp?.port),
    smtpAuthentication: toNullableBoolean(options.smtp?.auth, true),
    smtpUsername: toNullableString(options.smtp?.user),
    amazonSesAccessKeyId: toNullableString(options.amazonses?.client_id),
    amazonSesRegion: toNullableString(options.amazonses?.region),
    amazonSesCredentialsValid: sesValidation?.credentialsValid ?? null,
    amazonSesLastCheckedAt: sesValidation?.checkedAt ? new Date(sesValidation.checkedAt) : null,
    amazonSesErrorMessage: sesValidation?.errorMessage ?? null,
    amazonSesDnsVerified: matchedAmazonSesIdentity?.dnsVerified ?? null,
    amazonSesIdentity: matchedAmazonSesIdentity?.identity ?? null,
    amazonSesIdentityStatus: matchedAmazonSesIdentity?.verificationStatus ?? null,
    logEmails: toNullableBoolean(options.logs?.enabled, false),
    logRetentionPeriod: toNullableRetention(options.logs?.log_retention_period),
    logEmailContent: toNullableBoolean(options.logs?.log_email_content, false),
    hideAnnouncements: toNullableBoolean(options.general?.am_notifications_hidden, false),
    disableEmailSummaries: toNullableBoolean(options.general?.summary_report_email_disabled, false)
  }

  if (record.provider !== 'smtp') {
    record.smtpHost = null
    record.smtpEncryption = null
    record.smtpPort = null
    record.smtpAuthentication = null
    record.smtpUsername = null
  }

  if (record.provider !== 'amazonses') {
    record.amazonSesAccessKeyId = null
    record.amazonSesRegion = null
    record.amazonSesCredentialsValid = null
    record.amazonSesLastCheckedAt = null
    record.amazonSesErrorMessage = null
    record.amazonSesDnsVerified = null
    record.amazonSesIdentity = null
    record.amazonSesIdentityStatus = null
  }

  if (!record.logEmails) {
    record.logRetentionPeriod = ''
    record.logEmailContent = false
  }

  return record
}

export function getWpMailSmtpConfigurationMatch(
  scan: Pick<
    WpMailSmtpScanRecord,
    | 'provider'
    | 'smtpHost'
    | 'smtpEncryption'
    | 'smtpPort'
    | 'smtpAuthentication'
    | 'smtpUsername'
    | 'amazonSesAccessKeyId'
    | 'amazonSesRegion'
    | 'logEmails'
    | 'logRetentionPeriod'
    | 'logEmailContent'
    | 'hideAnnouncements'
    | 'disableEmailSummaries'
  > | null | undefined,
  configurations: WpMailSmtpProConfiguration[]
): WpMailSmtpProConfiguration | null {
  if (!scan) {
    return null
  }

  const mailer = mapPluginProviderToSetupMailer(scan.provider)
  if (!mailer) {
    return null
  }

  for (const configuration of configurations) {
    if (configuration.mailer !== mailer) {
      continue
    }

    const commonMatch =
      configuration.logEmails === Boolean(scan.logEmails) &&
      configuration.logRetentionPeriod === (scan.logRetentionPeriod ?? '') &&
      configuration.logEmailContent === Boolean(scan.logEmailContent) &&
      configuration.hideAnnouncements === Boolean(scan.hideAnnouncements) &&
      configuration.disableEmailSummaries === Boolean(scan.disableEmailSummaries)

    if (!commonMatch) {
      continue
    }

    if (mailer === 'other_smtp') {
      const smtpMatch =
        configuration.otherSmtpHost === (scan.smtpHost ?? '') &&
        configuration.otherSmtpEncryption === normalizeSetupEncryption(scan.smtpEncryption) &&
        configuration.otherSmtpPort === scan.smtpPort &&
        configuration.otherSmtpAuthentication === Boolean(scan.smtpAuthentication) &&
        configuration.otherSmtpUsername === (scan.smtpUsername ?? '')

      if (smtpMatch) {
        return configuration
      }

      continue
    }

    const sesMatch =
      configuration.amazonSesAccessKeyId === (scan.amazonSesAccessKeyId ?? '') &&
      configuration.amazonSesRegion === scan.amazonSesRegion

    if (sesMatch) {
      return configuration
    }
  }

  return null
}

export function mapPluginProviderToSetupMailer(provider: string | null | undefined) {
  if (provider === 'smtp') {
    return 'other_smtp' as const
  }

  if (provider === 'amazonses') {
    return 'amazon_ses' as const
  }

  return null
}

function findAmazonSesIdentityMatch(identities: AmazonSesIdentity[], fromEmail: string | null) {
  const candidates = new Set<string>()

  if (fromEmail) {
    const normalizedEmail = fromEmail.toLowerCase()
    candidates.add(normalizedEmail)

    const atIndex = normalizedEmail.lastIndexOf('@')
    if (atIndex >= 0) {
      candidates.add(normalizedEmail.slice(atIndex + 1))
    }
  }

  for (const identity of identities) {
    const normalizedIdentity = identity.identity.toLowerCase()

    for (const candidate of candidates) {
      if (candidate === normalizedIdentity) {
        return identity
      }

      if (
        identity.type === 'domain' &&
        candidate.length > normalizedIdentity.length &&
        candidate.endsWith(`.${normalizedIdentity}`)
      ) {
        return identity
      }
    }
  }

  return identities.find((identity) => identity.type === 'domain') || identities[0] || null
}

function normalizeSetupEncryption(value: string | null | undefined) {
  if (value === 'ssl' || value === 'tls') {
    return value
  }

  return 'none'
}

function toNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized ? normalized : null
}

function toNullableInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }

  return null
}

function toNullableRetention(value: unknown) {
  if (value === '') {
    return ''
  }

  return toNullableString(value)
}

function toNullableBoolean(value: unknown, fallback: boolean | null = null) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) {
      return true
    }

    if (['0', 'false', 'no', 'off', ''].includes(value.toLowerCase())) {
      return false
    }
  }

  return fallback
}

function isPlainObject(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type WpMailSmtpProMailer = 'other_smtp' | 'amazon_ses'
export type WpMailSmtpProEncryption = 'none' | 'ssl' | 'tls'
export type WpMailSmtpProLogRetentionValue = '' | '86400' | '604800' | '2628000' | '15770000' | '31540000'
export type WpMailSmtpProAmazonSesIdentity = {
  identity: string
  type: 'domain' | 'email'
  verificationStatus: string | null
  dkimVerificationStatus: string | null
  dnsVerified: boolean | null
}
export type WpMailSmtpProAmazonSesValidation = {
  checkedAt: string
  credentialsValid: boolean
  errorMessage: string | null
  identities: WpMailSmtpProAmazonSesIdentity[]
}

export type WpMailSmtpProConfiguration = {
  id: string
  name: string
  mailer: WpMailSmtpProMailer
  otherSmtpHost: string
  otherSmtpEncryption: WpMailSmtpProEncryption
  otherSmtpPort: number
  otherSmtpAuthentication: boolean
  otherSmtpUsername: string
  otherSmtpPassword: string
  amazonSesAccessKeyId: string
  amazonSesSecretAccessKey: string
  amazonSesRegion: string
  logEmails: boolean
  logRetentionPeriod: WpMailSmtpProLogRetentionValue
  logEmailContent: boolean
  hideAnnouncements: boolean
  disableEmailSummaries: boolean
  amazonSesValidation: WpMailSmtpProAmazonSesValidation | null
}

export type WpMailSmtpProSettingsResponse = {
  configurations: WpMailSmtpProConfiguration[]
}

export const wpMailSmtpProMailerOptions = [
  { label: 'Other SMTP', value: 'other_smtp' },
  { label: 'Amazon SES', value: 'amazon_ses' }
]

export const wpMailSmtpProEncryptionOptions = [
  { label: 'None', value: 'none' },
  { label: 'SSL', value: 'ssl' },
  { label: 'TLS', value: 'tls' }
]

export const wpMailSmtpProAwsRegionOptions = [
  { label: 'US East (N. Virginia)', value: 'us-east-1' },
  { label: 'US East (Ohio)', value: 'us-east-2' },
  { label: 'US West (N. California)', value: 'us-west-1' },
  { label: 'US West (Oregon)', value: 'us-west-2' },
  { label: 'EU (Ireland)', value: 'eu-west-1' },
  { label: 'EU (London)', value: 'eu-west-2' },
  { label: 'EU (Paris)', value: 'eu-west-3' },
  { label: 'EU (Frankfurt)', value: 'eu-central-1' },
  { label: 'EU (Stockholm)', value: 'eu-north-1' },
  { label: 'EU (Milan)', value: 'eu-south-1' },
  { label: 'Asia Pacific (Mumbai)', value: 'ap-south-1' },
  { label: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
  { label: 'Asia Pacific (Seoul)', value: 'ap-northeast-2' },
  { label: 'Asia Pacific (Osaka)', value: 'ap-northeast-3' },
  { label: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
  { label: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' },
  { label: 'Africa (Cape Town)', value: 'af-south-1' },
  { label: 'Canada (Central)', value: 'ca-central-1' },
  { label: 'Middle East (Bahrain)', value: 'me-south-1' },
  { label: 'South America (Sao Paulo)', value: 'sa-east-1' },
  { label: 'GovCloud (US-West)', value: 'us-gov-west-1' }
]

export const wpMailSmtpProLogRetentionOptions = [
  { label: 'Forever', value: '' },
  { label: '1 Day', value: '86400' },
  { label: '1 Week', value: '604800' },
  { label: '1 Month', value: '2628000' },
  { label: '6 Months', value: '15770000' },
  { label: '1 Year', value: '31540000' }
]

export function createWpMailSmtpProConfigurationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `wp-mail-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyWpMailSmtpProConfiguration(): WpMailSmtpProConfiguration {
  return {
    id: createWpMailSmtpProConfigurationId(),
    name: '',
    mailer: 'other_smtp',
    otherSmtpHost: '',
    otherSmtpEncryption: 'tls',
    otherSmtpPort: 587,
    otherSmtpAuthentication: true,
    otherSmtpUsername: '',
    otherSmtpPassword: '',
    amazonSesAccessKeyId: '',
    amazonSesSecretAccessKey: '',
    amazonSesRegion: 'eu-west-3',
    logEmails: false,
    logRetentionPeriod: '',
    logEmailContent: false,
    hideAnnouncements: false,
    disableEmailSummaries: false,
    amazonSesValidation: null
  }
}

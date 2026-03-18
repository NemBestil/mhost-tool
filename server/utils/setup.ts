import { getOption } from '#server/utils/db'

export const SETUP_OPTION_KEY = 'main.setup'
export const WP_MAIL_SMTP_PRO_OPTION_KEY = 'main.wpMailSmtpPro'

export const WP_MAIL_SMTP_PRO_MAILERS = ['other_smtp', 'amazon_ses'] as const
export const WP_MAIL_SMTP_PRO_ENCRYPTIONS = ['none', 'ssl', 'tls'] as const
export const WP_MAIL_SMTP_PRO_LOG_RETENTION_VALUES = [
  '',
  '86400',
  '604800',
  '2628000',
  '15770000',
  '31540000'
] as const
export const WP_MAIL_SMTP_PRO_AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'eu-south-1',
  'ap-south-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-southeast-1',
  'ap-southeast-2',
  'af-south-1',
  'ca-central-1',
  'me-south-1',
  'sa-east-1',
  'us-gov-west-1'
] as const

export type SetupSettings = {
  features: {
    wpMailSmtpPro: boolean
    wpRocketCache: boolean
  }
}

export type WpMailSmtpProMailer = typeof WP_MAIL_SMTP_PRO_MAILERS[number]
export type WpMailSmtpProEncryption = typeof WP_MAIL_SMTP_PRO_ENCRYPTIONS[number]
export type WpMailSmtpProLogRetentionValue = typeof WP_MAIL_SMTP_PRO_LOG_RETENTION_VALUES[number]
export type WpMailSmtpProAwsRegion = typeof WP_MAIL_SMTP_PRO_AWS_REGIONS[number]
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
  amazonSesRegion: WpMailSmtpProAwsRegion
  logEmails: boolean
  logRetentionPeriod: WpMailSmtpProLogRetentionValue
  logEmailContent: boolean
  hideAnnouncements: boolean
  disableEmailSummaries: boolean
  amazonSesValidation: WpMailSmtpProAmazonSesValidation | null
}

export type WpMailSmtpProSettings = {
  configurations: WpMailSmtpProConfiguration[]
}

export type StoredWpMailSmtpProConfiguration = Omit<WpMailSmtpProConfiguration, 'amazonSesValidation'>
export type StoredWpMailSmtpProSettings = {
  configurations: StoredWpMailSmtpProConfiguration[]
}

export function getDefaultSetupSettings(): SetupSettings {
  return {
    features: {
      wpMailSmtpPro: false,
      wpRocketCache: false
    }
  }
}

export async function getSetupSettings(): Promise<SetupSettings> {
  const settings = await getOption<SetupSettings>(SETUP_OPTION_KEY, getDefaultSetupSettings())
  return normalizeSetupSettings(settings)
}

export function normalizeSetupSettings(settings: Partial<SetupSettings> | null | undefined): SetupSettings {
  return {
    features: {
      wpMailSmtpPro: Boolean(settings?.features?.wpMailSmtpPro),
      wpRocketCache: Boolean(settings?.features?.wpRocketCache)
    }
  }
}

export function createWpMailSmtpProConfigurationId() {
  return crypto.randomUUID()
}

export function createEmptyWpMailSmtpProConfiguration(
  overrides: Partial<WpMailSmtpProConfiguration> = {}
): WpMailSmtpProConfiguration {
  return {
    id: overrides.id?.trim() || createWpMailSmtpProConfigurationId(),
    name: String(overrides.name || '').trim(),
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
    amazonSesValidation: null,
    ...overrides
  }
}

export function getDefaultWpMailSmtpProSettings(): WpMailSmtpProSettings {
  return {
    configurations: []
  }
}

export function getStoredWpMailSmtpProSettings(settings: WpMailSmtpProSettings): StoredWpMailSmtpProSettings {
  return {
    configurations: settings.configurations.map(({ amazonSesValidation: _amazonSesValidation, ...configuration }) => configuration)
  }
}

export async function getWpMailSmtpProSettings(): Promise<WpMailSmtpProSettings> {
  const settings = await getOption<StoredWpMailSmtpProSettings | WpMailSmtpProSettings | Partial<WpMailSmtpProConfiguration>>(
    WP_MAIL_SMTP_PRO_OPTION_KEY,
    getDefaultWpMailSmtpProSettings()
  )

  return normalizeWpMailSmtpProSettings(settings)
}

export function normalizeWpMailSmtpProSettings(
  settings: StoredWpMailSmtpProSettings | WpMailSmtpProSettings | Partial<WpMailSmtpProConfiguration> | null | undefined
): WpMailSmtpProSettings {
  if (Array.isArray((settings as StoredWpMailSmtpProSettings | WpMailSmtpProSettings | undefined)?.configurations)) {
    return {
      configurations: (settings as StoredWpMailSmtpProSettings | WpMailSmtpProSettings).configurations.map((configuration, index) =>
        normalizeWpMailSmtpProConfiguration(configuration, index)
      )
    }
  }

  if (settings && typeof settings === 'object' && 'mailer' in settings) {
    return {
      configurations: [
        normalizeWpMailSmtpProConfiguration({
          ...settings,
          id: 'imported-configuration',
          name: String((settings as Partial<WpMailSmtpProConfiguration>).name || 'Imported configuration')
        }, 0)
      ]
    }
  }

  return getDefaultWpMailSmtpProSettings()
}

export function normalizeWpMailSmtpProConfiguration(
  configuration: Partial<WpMailSmtpProConfiguration> | null | undefined,
  index = 0
): WpMailSmtpProConfiguration {
  const defaults = createEmptyWpMailSmtpProConfiguration()
  const mailer = WP_MAIL_SMTP_PRO_MAILERS.includes(configuration?.mailer as WpMailSmtpProMailer)
    ? configuration!.mailer as WpMailSmtpProMailer
    : defaults.mailer
  const otherSmtpEncryption = WP_MAIL_SMTP_PRO_ENCRYPTIONS.includes(
    configuration?.otherSmtpEncryption as WpMailSmtpProEncryption
  )
    ? configuration!.otherSmtpEncryption as WpMailSmtpProEncryption
    : defaults.otherSmtpEncryption
  const amazonSesRegion = WP_MAIL_SMTP_PRO_AWS_REGIONS.includes(
    configuration?.amazonSesRegion as WpMailSmtpProAwsRegion
  )
    ? configuration!.amazonSesRegion as WpMailSmtpProAwsRegion
    : defaults.amazonSesRegion
  const logRetentionPeriod = WP_MAIL_SMTP_PRO_LOG_RETENTION_VALUES.includes(
    configuration?.logRetentionPeriod as WpMailSmtpProLogRetentionValue
  )
    ? configuration!.logRetentionPeriod as WpMailSmtpProLogRetentionValue
    : defaults.logRetentionPeriod

  const normalized: WpMailSmtpProConfiguration = {
    id: String(configuration?.id || `configuration-${index + 1}`).trim() || `configuration-${index + 1}`,
    name: String(configuration?.name || '').trim(),
    mailer,
    otherSmtpHost: String(configuration?.otherSmtpHost || '').trim(),
    otherSmtpEncryption,
    otherSmtpPort: Number(configuration?.otherSmtpPort || defaults.otherSmtpPort),
    otherSmtpAuthentication: configuration?.otherSmtpAuthentication === undefined
      ? defaults.otherSmtpAuthentication
      : Boolean(configuration.otherSmtpAuthentication),
    otherSmtpUsername: String(configuration?.otherSmtpUsername || '').trim(),
    otherSmtpPassword: String(configuration?.otherSmtpPassword || ''),
    amazonSesAccessKeyId: String(configuration?.amazonSesAccessKeyId || '').trim(),
    amazonSesSecretAccessKey: String(configuration?.amazonSesSecretAccessKey || ''),
    amazonSesRegion,
    logEmails: Boolean(configuration?.logEmails),
    logRetentionPeriod,
    logEmailContent: Boolean(configuration?.logEmailContent),
    hideAnnouncements: Boolean(configuration?.hideAnnouncements),
    disableEmailSummaries: Boolean(configuration?.disableEmailSummaries),
    amazonSesValidation: null
  }

  if (!Number.isInteger(normalized.otherSmtpPort) || normalized.otherSmtpPort < 1 || normalized.otherSmtpPort > 65535) {
    normalized.otherSmtpPort = defaults.otherSmtpPort
  }

  if (normalized.mailer !== 'other_smtp') {
    normalized.otherSmtpHost = ''
    normalized.otherSmtpEncryption = defaults.otherSmtpEncryption
    normalized.otherSmtpPort = defaults.otherSmtpPort
    normalized.otherSmtpAuthentication = defaults.otherSmtpAuthentication
    normalized.otherSmtpUsername = ''
    normalized.otherSmtpPassword = ''
  }

  if (!normalized.otherSmtpAuthentication) {
    normalized.otherSmtpUsername = ''
    normalized.otherSmtpPassword = ''
  }

  if (normalized.mailer !== 'amazon_ses') {
    normalized.amazonSesAccessKeyId = ''
    normalized.amazonSesSecretAccessKey = ''
    normalized.amazonSesRegion = defaults.amazonSesRegion
    normalized.amazonSesValidation = null
  }

  if (!normalized.logEmails) {
    normalized.logRetentionPeriod = defaults.logRetentionPeriod
    normalized.logEmailContent = false
  }

  return normalized
}

import { validateAmazonSesCredentials } from '#server/utils/amazonSes'
import {
  type WpMailSmtpProConfiguration,
  type WpMailSmtpProSettings
} from '#server/utils/setup'

type RefreshOptions = {
  force?: boolean
  minAgeMs?: number
}

export async function enrichWpMailSmtpProSettingsWithAmazonSesValidation(
  settings: WpMailSmtpProSettings,
  options: RefreshOptions = {}
): Promise<WpMailSmtpProSettings> {
  const configurations = await Promise.all(
    settings.configurations.map((configuration) => refreshWpMailSmtpProConfiguration(configuration, options))
  )

  return {
    configurations
  }
}

async function refreshWpMailSmtpProConfiguration(
  configuration: WpMailSmtpProConfiguration,
  options: RefreshOptions
): Promise<WpMailSmtpProConfiguration> {
  if (configuration.mailer !== 'amazon_ses') {
    return {
      ...configuration,
      amazonSesValidation: null
    }
  }

  if (!shouldRefreshAmazonSesValidation(configuration, options)) {
    return configuration
  }

  const amazonSesValidation = await validateAmazonSesCredentials({
    accessKeyId: configuration.amazonSesAccessKeyId,
    secretAccessKey: configuration.amazonSesSecretAccessKey,
    region: configuration.amazonSesRegion
  })

  return {
    ...configuration,
    amazonSesValidation
  }
}

function shouldRefreshAmazonSesValidation(
  configuration: WpMailSmtpProConfiguration,
  options: RefreshOptions
) {
  if (options.force) {
    return true
  }

  if (!configuration.amazonSesValidation?.checkedAt) {
    return true
  }

  const minAgeMs = options.minAgeMs ?? 0
  if (minAgeMs <= 0) {
    return true
  }

  const checkedAt = Date.parse(configuration.amazonSesValidation.checkedAt)
  if (Number.isNaN(checkedAt)) {
    return true
  }

  return Date.now() - checkedAt >= minAgeMs
}

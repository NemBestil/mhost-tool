import { setOption } from '#server/utils/db'
import {
  getStoredWpMailSmtpProSettings,
  getSetupSettings,
  normalizeWpMailSmtpProSettings,
  WP_MAIL_SMTP_PRO_AWS_REGIONS,
  WP_MAIL_SMTP_PRO_ENCRYPTIONS,
  WP_MAIL_SMTP_PRO_LOG_RETENTION_VALUES,
  WP_MAIL_SMTP_PRO_MAILERS,
  WP_MAIL_SMTP_PRO_OPTION_KEY
} from '#server/utils/setup'
import { enrichWpMailSmtpProSettingsWithAmazonSesValidation } from '#server/utils/wpMailSmtpProValidation'
import { z } from 'zod'

const configurationSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  mailer: z.enum(WP_MAIL_SMTP_PRO_MAILERS),
  otherSmtpHost: z.string(),
  otherSmtpEncryption: z.enum(WP_MAIL_SMTP_PRO_ENCRYPTIONS),
  otherSmtpPort: z.number().int().min(1).max(65535),
  otherSmtpAuthentication: z.boolean(),
  otherSmtpUsername: z.string(),
  otherSmtpPassword: z.string(),
  amazonSesAccessKeyId: z.string(),
  amazonSesSecretAccessKey: z.string(),
  amazonSesRegion: z.enum(WP_MAIL_SMTP_PRO_AWS_REGIONS),
  logEmails: z.boolean(),
  logRetentionPeriod: z.enum(WP_MAIL_SMTP_PRO_LOG_RETENTION_VALUES),
  logEmailContent: z.boolean(),
  hideAnnouncements: z.boolean(),
  disableEmailSummaries: z.boolean()
}).superRefine((value, ctx) => {
  if (value.mailer === 'other_smtp') {
    if (!value.otherSmtpHost.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otherSmtpHost'],
        message: 'SMTP host is required.'
      })
    }

    if (value.otherSmtpAuthentication && !value.otherSmtpUsername.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otherSmtpUsername'],
        message: 'SMTP username is required when authentication is enabled.'
      })
    }

    if (value.otherSmtpAuthentication && !value.otherSmtpPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otherSmtpPassword'],
        message: 'SMTP password is required when authentication is enabled.'
      })
    }
  }

  if (value.mailer === 'amazon_ses') {
    if (!value.amazonSesAccessKeyId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amazonSesAccessKeyId'],
        message: 'Access key ID is required.'
      })
    }

    if (!value.amazonSesSecretAccessKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amazonSesSecretAccessKey'],
        message: 'Secret access key is required.'
      })
    }
  }
})

const bodySchema = z.object({
  configurations: z.array(configurationSchema)
}).superRefine((value, ctx) => {
  const seenIds = new Set<string>()

  value.configurations.forEach((configuration, index) => {
    if (seenIds.has(configuration.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['configurations', index, 'id'],
        message: 'Configuration ID must be unique.'
      })
      return
    }

    seenIds.add(configuration.id)
  })
})

export default defineEventHandler(async (event) => {
  const setupSettings = await getSetupSettings()

  if (!setupSettings.features.wpMailSmtpPro) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Feature disabled',
      message: 'Enable WP Mail SMTP Pro config on the Setup overview page first.'
    })
  }

  const parsedBody = bodySchema.safeParse(await readBody(event))

  if (!parsedBody.success) {
    const fieldErrors: Record<string, string> = {}

    for (const issue of parsedBody.error.issues) {
      const field = [...issue.path].reverse().find((segment) => typeof segment === 'string')
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }

    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'Validation error',
      data: {
        fieldErrors
      }
    })
  }

  const settings = normalizeWpMailSmtpProSettings(parsedBody.data)

  await setOption(WP_MAIL_SMTP_PRO_OPTION_KEY, getStoredWpMailSmtpProSettings(settings))

  return await enrichWpMailSmtpProSettingsWithAmazonSesValidation(settings, { force: true })
})

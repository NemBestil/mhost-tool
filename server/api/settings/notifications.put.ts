import { setOption } from '#server/utils/db'
import { normalizeSmtpSettings, isValidSmtpSettings, SMTP_AUTH_METHODS, SMTP_OPTION_KEY } from '#server/utils/smtp'
import {
  normalizeNotificationReportsSettings,
  NOTIFICATION_REPORTS_OPTION_KEY,
  parseNotificationReportRecipients
} from '#server/utils/notificationReports'
import { z } from 'zod'

const bodySchema = z.object({
  smtp: z.object({
    host: z.string().trim().min(1),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    authMethod: z.enum(SMTP_AUTH_METHODS).optional().default('PLAIN'),
    authUser: z.string().trim().min(1),
    authPass: z.string().min(1),
    fromName: z.string().trim().min(1),
    fromEmail: z.string().trim().email()
  }),
  reports: z.object({
    recipients: z.array(z.string()).default([]),
    newSitesFound: z.boolean().default(false),
    cveAlert: z.boolean().default(false),
    cveAlertMinScore: z.number().min(0).max(10).default(7.0)
  })
})

export default defineEventHandler(async (event) => {
  const parsedBody = bodySchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    const fieldErrors: Record<string, string> = {}

    for (const issue of parsedBody.error.issues) {
      const [scope, field] = issue.path
      if (scope === 'smtp' && typeof field === 'string' && !fieldErrors[field]) {
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

  const body = parsedBody.data
  const smtp = normalizeSmtpSettings(body.smtp)
  let recipients: string[] = []

  try {
    recipients = parseNotificationReportRecipients(body.reports.recipients)
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'Validation error',
      data: {
        fieldErrors: {
          reportRecipients: error?.message || 'Invalid report recipient list.'
        }
      }
    })
  }

  if (!isValidSmtpSettings(smtp)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'SMTP configuration is invalid.'
    })
  }

  if ((body.reports.newSitesFound || body.reports.cveAlert) && recipients.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'Validation error',
      data: {
        fieldErrors: {
          reportRecipients: 'Add at least one e-mail address to enable reports.'
        }
      }
    })
  }

  const reports = normalizeNotificationReportsSettings({
    recipients,
    reports: {
      newSitesFound: body.reports.newSitesFound,
      cveAlert: body.reports.cveAlert,
      cveAlertMinScore: body.reports.cveAlertMinScore
    }
  })

  await Promise.all([
    setOption(SMTP_OPTION_KEY, smtp),
    setOption(NOTIFICATION_REPORTS_OPTION_KEY, reports)
  ])

  return {
    smtp,
    smtpConfigured: true,
    reports: {
      recipients: reports.recipients,
      ...reports.reports
    }
  }
})

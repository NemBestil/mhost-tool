import { getSmtpSettings, isValidSmtpSettings } from '#server/utils/smtp'
import { getNotificationReportsSettings } from '#server/utils/notificationReports'

export default defineEventHandler(async () => {
  const [smtp, reports] = await Promise.all([
    getSmtpSettings(),
    getNotificationReportsSettings()
  ])

  return {
    smtp,
    smtpConfigured: isValidSmtpSettings(smtp),
    reports: {
      recipients: reports.recipients,
      ... reports.reports
    }
  }
})

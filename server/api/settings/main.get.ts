import { getSmtpSettings, isValidSmtpSettings } from '#server/utils/smtp'

export default defineEventHandler(async () => {
  const smtp = await getSmtpSettings()

  return {
    smtp,
    smtpConfigured: isValidSmtpSettings(smtp)
  }
})

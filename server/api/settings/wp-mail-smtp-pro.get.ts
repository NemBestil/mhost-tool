import { getWpMailSmtpProSettings } from '#server/utils/setup'
import { enrichWpMailSmtpProSettingsWithAmazonSesValidation } from '#server/utils/wpMailSmtpProValidation'

export default defineEventHandler(async () => {
  return await enrichWpMailSmtpProSettingsWithAmazonSesValidation(
    await getWpMailSmtpProSettings(),
    { force: true }
  )
})

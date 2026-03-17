import { getSetupSettings } from '#server/utils/setup'

export default defineEventHandler(async () => {
  return await getSetupSettings()
})

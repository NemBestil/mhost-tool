import { readMonitoringConfig } from '#server/utils/monitoring'

export default defineEventHandler(async () => {
  return readMonitoringConfig()
})

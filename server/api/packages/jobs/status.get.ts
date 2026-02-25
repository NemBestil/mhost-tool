import { getPackageQueueSnapshot } from '#server/utils/packageJobQueue'

export default defineEventHandler(async () => {
  return getPackageQueueSnapshot()
})

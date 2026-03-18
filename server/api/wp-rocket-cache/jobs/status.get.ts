import { getWpRocketCacheQueueSnapshot } from '#server/utils/wpRocketCacheJobQueue'

export default defineEventHandler(async () => {
  return getWpRocketCacheQueueSnapshot()
})

import { getCustomFileQueueSnapshot } from '#server/utils/customFileJobQueue'

export default defineEventHandler(async () => {
  return getCustomFileQueueSnapshot()
})

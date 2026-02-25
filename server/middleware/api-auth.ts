import { requireValidSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) {
    return
  }

  if (event.path.startsWith('/api/auth/')) {
    return
  }

  await requireValidSession(event)
})

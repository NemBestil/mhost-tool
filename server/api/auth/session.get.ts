import { getValidSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await getValidSession(event)

  if (!session) {
    return {
      authenticated: false,
    }
  }

  return {
    authenticated: true,
    expiresAt: session.expiresAt,
  }
})

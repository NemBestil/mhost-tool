import { prisma } from '#server/utils/db'
import { AUTH_SESSION_COOKIE, clearSessionCookie } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, AUTH_SESSION_COOKIE)

  if (token) {
    await prisma.userSession.deleteMany({
      where: { token },
    })
  }

  clearSessionCookie(event)

  return {
    success: true,
  }
})

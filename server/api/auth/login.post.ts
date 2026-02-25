import { z } from 'zod'
import { prisma } from '#server/utils/db'
import {
  assertAdminCredentialsConfigured,
  createSessionToken,
  getRequestIp,
  getSessionExpiresAt,
  setSessionCookie,
} from '#server/utils/auth'

const loginBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const parsedBody = loginBodySchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'Username and password are required.',
    })
  }

  const { username, password } = parsedBody.data
  const credentials = assertAdminCredentialsConfigured()

  if (username !== credentials.username || password !== credentials.password) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid credentials.',
    })
  }

  const token = createSessionToken()
  const expiresAt = getSessionExpiresAt()

  await prisma.userSession.create({
    data: {
      token,
      ipAddress: getRequestIp(event),
      expiresAt,
    },
  })

  setSessionCookie(event, token)

  return {
    success: true,
    expiresAt,
  }
})

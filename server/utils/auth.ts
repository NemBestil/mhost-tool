import { createError, deleteCookie, getCookie, getHeader, setCookie, type H3Event } from 'h3'
import type { UserSession } from '@@/prisma/generated/client'
import { nanoid } from 'nanoid'
import { prisma } from '#server/utils/db'

export const AUTH_SESSION_COOKIE = 'mhost_session'
export const SESSION_TTL_DAYS = 1

const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000

function getRequiredEnvValue(name: 'ADMIN_USERNAME' | 'ADMIN_PASSWORD'): string {
  return String(process.env[name] || '').trim()
}

export function assertAdminCredentialsConfigured() {
  const username = getRequiredEnvValue('ADMIN_USERNAME')
  const password = getRequiredEnvValue('ADMIN_PASSWORD')

  if (username && password) {
    return { username, password }
  }

  console.error('[Auth] Missing required environment variables.')
  console.error('[Auth] Please set ADMIN_USERNAME and ADMIN_PASSWORD before starting the server.')
  throw new Error('Missing ADMIN_USERNAME and/or ADMIN_PASSWORD environment variables.')
}

export function createSessionToken() {
  return nanoid(32)
}

export function getSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + SESSION_TTL_MS)
}

export function getRequestIp(event: H3Event): string {
  const xForwardedFor = getHeader(event, 'x-forwarded-for')
  if (xForwardedFor) {
    const [firstIp] = xForwardedFor.split(',')
    if (firstIp?.trim()) {
      return firstIp.trim()
    }
  }

  const xRealIp = getHeader(event, 'x-real-ip')
  if (xRealIp?.trim()) {
    return xRealIp.trim()
  }

  return event.node.req.socket.remoteAddress || 'unknown'
}

export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, AUTH_SESSION_COOKIE, { path: '/' })
}

export async function getValidSession(event: H3Event): Promise<UserSession | null> {
  const token = getCookie(event, AUTH_SESSION_COOKIE)
  if (!token) {
    return null
  }

  const session = await prisma.userSession.findUnique({
    where: { token },
  })

  if (!session) {
    clearSessionCookie(event)
    return null
  }

  const now = new Date()
  const requestIp = getRequestIp(event)
  const isExpired = session.expiresAt <= now
  const isWrongIp = session.ipAddress !== requestIp

  if (isExpired || isWrongIp) {
    await prisma.userSession.deleteMany({
      where: { token },
    })
    clearSessionCookie(event)
    return null
  }

  return session
}

export async function requireValidSession(event: H3Event): Promise<UserSession> {
  const session = await getValidSession(event)
  if (session) {
    return session
  }

  throw createError({
    statusCode: 401,
    statusMessage: 'Unauthorized',
    message: 'Authentication required.',
  })
}

import {
  ensureWpCliOnServer,
  getSiteInstallationContext,
  parseJsonArray,
  runWpCliCommand
} from '#server/utils/siteWpCli'
import { requireSiteId } from '#server/utils/siteUserInput'

type RawWpUser = {
  ID?: string | number
  user_login?: string
  display_name?: string
  user_email?: string
  roles?: string | string[]
}

type SiteUser = {
  id: number
  user_login: string
  display_name: string
  user_email: string
  roles: string[]
}

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))
  const query = getQuery(event)

  const installation = await getSiteInstallationContext(installationId)
  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  await ensureWpCliOnServer(installation.serverId)

  const result = await runWpCliCommand(installation, [
    'user',
    'list',
    '--fields=ID,user_login,display_name,user_email,roles',
    '--format=json'
  ])

  const users = parseJsonArray<RawWpUser>(result.stdout)
    .map(normalizeUser)
    .filter((user): user is SiteUser => Boolean(user))
    .sort((a, b) => a.user_login.localeCompare(b.user_login))

  const requestedRoles = parseRoleFilter(query.role)
  const filteredUsers = requestedRoles.length > 0
    ? users.filter(user => user.roles.some(role => requestedRoles.includes(role)))
    : users

  const page = parsePositiveInteger(query.page, 1)
  const limit = parseLimit(query.limit)
  const start = limit === null ? 0 : (page - 1) * limit
  const pagedUsers = limit === null ? filteredUsers : filteredUsers.slice(start, start + limit)

  const roleSet = new Set<string>()
  for (const user of users) {
    for (const role of user.roles) {
      if (role) {
        roleSet.add(role)
      }
    }
  }

  return {
    users: pagedUsers,
    roles: [...roleSet].sort((a, b) => a.localeCompare(b)),
    pagination: {
      page,
      limit,
      total: filteredUsers.length,
      totalPages: limit === null ? 1 : Math.max(1, Math.ceil(filteredUsers.length / limit))
    },
    autoLoginUser: installation.autoLoginUser
  }
})

function normalizeUser(raw: RawWpUser): SiteUser | null {
  const user_login = typeof raw.user_login === 'string' ? raw.user_login.trim() : ''
  if (!user_login) {
    return null
  }

  const display_name = typeof raw.display_name === 'string' ? raw.display_name : user_login
  const user_email = typeof raw.user_email === 'string' ? raw.user_email : ''
  const id = Number(raw.ID)

  const roles = Array.isArray(raw.roles)
    ? raw.roles
    : typeof raw.roles === 'string'
      ? raw.roles.split(',').map(role => role.trim()).filter(Boolean)
      : []

  return {
    id: Number.isFinite(id) ? id : 0,
    user_login,
    display_name,
    user_email,
    roles
  }
}

function parseRoleFilter(input: unknown): string[] {
  const values = Array.isArray(input) ? input : typeof input === 'string' ? [input] : []

  return values
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)
}

function parsePositiveInteger(input: unknown, fallback: number): number {
  if (typeof input !== 'string') {
    return fallback
  }

  const parsed = Number.parseInt(input, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseLimit(input: unknown): number | null {
  if (typeof input !== 'string' || !input.trim()) {
    return null
  }

  const parsed = Number.parseInt(input, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.min(parsed, 500)
}

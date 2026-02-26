import {
  ensureWpCliOnServer,
  getSiteInstallationContext,
  runWpCliCommand, shellEscape
} from '#server/utils/siteWpCli'
import { requirePassword, requireSiteId, requireUserLogin } from '#server/utils/siteUserInput'

type Body = {
  userLogin?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))

  const body = await readBody<Body>(event)
  const userLogin = requireUserLogin(body?.userLogin)
  const password = requirePassword(body?.password)

  const installation = await getSiteInstallationContext(installationId)
  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  await ensureWpCliOnServer(installation.serverId)

  await runWpCliCommand(installation, [
    'user',
    'update',
    userLogin,
    `--user_pass=${password}`
  ])

  return {
    status: 'ok'
  }
})

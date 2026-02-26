import {
  ensureWpCliOnServer,
  getSiteInstallationContext,
  runWpCliCommand
} from '#server/utils/siteWpCli'
import { requireSiteId, requireUserLogin } from '#server/utils/siteUserInput'

type Body = {
  userLogin?: string
}

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))

  const body = await readBody<Body>(event)
  const userLogin = requireUserLogin(body?.userLogin)

  const installation = await getSiteInstallationContext(installationId)
  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  await ensureWpCliOnServer(installation.serverId)
  await runWpCliCommand(installation, ['user', 'reset-password', userLogin])

  return {
    status: 'ok'
  }
})

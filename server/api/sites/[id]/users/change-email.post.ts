import {ensureWpCliOnServer, getSiteInstallationContext, runWpCliCommand} from '#server/utils/siteWpCli'
import {requireEmail, requireSiteId, requireUserLogin} from '#server/utils/siteUserInput'

type Body = {
  userLogin?: string
  email?: string
}

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))

  const body = await readBody<Body>(event)
  const userLogin = requireUserLogin(body?.userLogin)
  const email = requireEmail(body?.email)

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
    `--user_email=${email}`
  ])

  return {
    status: 'ok'
  }
})

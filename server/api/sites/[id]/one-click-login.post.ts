import {
  ensureWpCliOnServer,
  extractFirstUrl,
  getSiteInstallationContext,
  runWpCliCommand,
  trimWpCliError
} from '#server/utils/siteWpCli'
import { requireSiteId, requireUserLogin } from '#server/utils/siteUserInput'

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))

  const installation = await getSiteInstallationContext(installationId)
  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  if (!installation.autoLoginUser) {
    throw createError({
      statusCode: 400,
      message: 'Auto-login user is not configured for this site'
    })
  }
  const autoLoginUser = requireUserLogin(installation.autoLoginUser, 'autoLoginUser')

  await ensureWpCliOnServer(installation.serverId)

  const pluginIsActive = await runWpCliCommand(
    installation,
    ['plugin', 'is-active', 'one-time-login'],
    { allowFailure: true }
  )

  if (pluginIsActive.code !== 0) {
    await runWpCliCommand(installation, [
      'plugin',
      'install',
      'one-time-login',
      '--activate'
    ])
  }

  const loginUrlResult = await runWpCliCommand(
    installation,
    ['user', 'one-time-login', autoLoginUser, '--count=1'],
    { skipPlugins: false }
  )

  const loginUrl = extractFirstUrl(loginUrlResult.stdout)
  if (!loginUrl) {
    throw createError({
      statusCode: 500,
      message: `Failed to generate one-time login URL: ${trimWpCliError(loginUrlResult.stderr || loginUrlResult.stdout)}`
    })
  }

  return {
    loginUrl
  }
})

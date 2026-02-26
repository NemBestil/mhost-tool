import { prisma } from '#server/utils/db'
import {
  ensureWpCliOnServer,
  getSiteInstallationContext,
  runWpCliCommand
} from '#server/utils/siteWpCli'
import { optionalUserLogin, requireSiteId } from '#server/utils/siteUserInput'

type Body = {
  username?: string | null
}

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))

  const installation = await getSiteInstallationContext(installationId)
  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  const body = await readBody<Body>(event)
  const username = optionalUserLogin(body?.username)

  if (username) {
    await ensureWpCliOnServer(installation.serverId)
    const userCheck = await runWpCliCommand(
      installation,
      ['user', 'get', username, '--field=user_login'],
      { allowFailure: true }
    )

    if (userCheck.code !== 0) {
      throw createError({
        statusCode: 400,
        message: 'User does not exist on this site'
      })
    }
  }

  const updated = await prisma.wordPressInstallation.update({
    where: { id: installationId },
    data: {
      autoLoginUser: username
    },
    select: {
      autoLoginUser: true
    }
  })

  return {
    autoLoginUser: updated.autoLoginUser
  }
})

import { prisma } from '#server/utils/db'
import { ensureWpCliOnServer, getSiteInstallationContext, runWpCliCommand } from '#server/utils/siteWpCli'
import { requireEmail, requireSiteId } from '#server/utils/siteUserInput'

type Body = {
  email?: string
  fromName?: string
}

export default defineEventHandler(async (event) => {
  const installationId = requireSiteId(getRouterParam(event, 'id'))

  const body = await readBody<Body>(event)
  const email = requireEmail(body?.email)
  const fromName = (body?.fromName || '').trim() || null

  const installation = await getSiteInstallationContext(installationId)
  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  await ensureWpCliOnServer(installation.serverId)

  await runWpCliCommand(installation, [
    'option',
    'update',
    'admin_email',
    email
  ])

  if (fromName) {
    await runWpCliCommand(installation, [
      'option',
      'update',
      'blogname',
      fromName
    ])
  }

  await prisma.wordPressInstallation.update({
    where: { id: installationId },
    data: {
      adminEmail: email,
      adminEmailFromName: fromName
    }
  })

  return { adminEmail: email, adminEmailFromName: fromName }
})

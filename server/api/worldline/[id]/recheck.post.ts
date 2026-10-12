import { prisma } from '#server/utils/db'
import { getSiteInstallationContext } from '#server/utils/siteWpCli'
import { runWorldlineRecheck } from '#server/utils/worldlineRecheck'

export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Site id is required' })
  const site = await getSiteInstallationContext(id)
  if (!site) throw createError({ statusCode: 404, message: 'Site not found' })
  const plugin = await prisma.wordPressPlugin.findUnique({
    where: { installationId_slug: { installationId: id, slug: 'bambora-online-checkout' } }
  })
  if (!plugin?.isEnabled) throw createError({ statusCode: 400, message: 'Worldline must be active to recheck captures' })
  const nbCore = await prisma.wordPressPlugin.findFirst({
    where: { installationId: id, slug: { in: ['nembestil-core', 'nb-core'] }, isEnabled: true }
  })
  if (!nbCore) throw createError({ statusCode: 400, message: 'NemBestil Core must be installed and active to recheck captures' })
  setResponseStatus(event, 202)
  void runWorldlineRecheck(site).catch(error => console.error('Worldline recheck failed:', error))
  return { status: 'started', siteId: id, serverId: site.serverId }
})

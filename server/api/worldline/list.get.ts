import { prisma } from '#server/utils/db'
import { worldlineReportSchema } from '../../../shared/utils/siteHealth'

export default defineEventHandler(async () => {
  const sites = await prisma.wordPressInstallation.findMany({
    where: { plugins: { some: { slug: 'bambora-online-checkout' } } },
    select: {
      id: true, serverId: true, siteTitle: true, siteUrl: true,
      worldlineStats: true, worldlineCheckedAt: true, worldlineScanError: true,
      server: { select: { name: true } },
      plugins: { where: { slug: 'bambora-online-checkout' }, select: { version: true, isEnabled: true } }
    },
    orderBy: { siteUrl: 'asc' }
  })
  return sites.map(site => {
    const parsed = worldlineReportSchema.safeParse(site.worldlineStats)
    return { ...site, worldlineStats: parsed.success ? parsed.data : null, plugin: site.plugins[0] }
  })
})

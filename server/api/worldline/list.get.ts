import { prisma } from '#server/utils/db'
import { worldlineReportSchema } from '../../../shared/utils/siteHealth'

export default defineEventHandler(async () => {
  const sites = await prisma.wordPressInstallation.findMany({
    where: { plugins: { some: { slug: 'bambora-online-checkout' } } },
    select: {
      id: true, serverId: true, siteTitle: true, siteUrl: true,
      worldlineStats: true, worldlineCheckedAt: true, worldlineScanError: true,
      server: { select: { name: true } },
      plugins: {
        where: { slug: { in: ['bambora-online-checkout', 'nembestil-core', 'nb-core'] } },
        select: { slug: true, version: true, isEnabled: true }
      }
    },
    orderBy: { siteUrl: 'asc' }
  })
  return sites.map(site => {
    const parsed = worldlineReportSchema.safeParse(site.worldlineStats)
    const nbCore = site.plugins.find(plugin => ['nembestil-core', 'nb-core'].includes(plugin.slug))
    const nbCoreAvailable = Boolean(nbCore?.isEnabled)
    return {
      ...site,
      nbCoreAvailable,
      worldlineStats: nbCoreAvailable && parsed.success ? parsed.data : null,
      worldlineScanError: nbCoreAvailable
        ? site.worldlineScanError
        : nbCore ? 'NemBestil Core is inactive. Activate it to check captures.' : 'NemBestil Core is missing. Install and activate it to check captures.',
      plugin: site.plugins.find(plugin => plugin.slug === 'bambora-online-checkout')
    }
  })
})

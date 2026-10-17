import { prisma } from '#server/utils/db'
import { turnstileReportSchema } from '../../../shared/utils/turnstile'

export default defineEventHandler(async () => {
  const sites = await prisma.wordPressInstallation.findMany({
    select: {
      id: true, serverId: true, siteTitle: true, siteUrl: true,
      turnstileStats: true, turnstileCheckedAt: true, turnstileScanError: true,
      server: { select: { name: true } }
    },
    orderBy: { siteUrl: 'asc' }
  })
  return sites.map(site => {
    const parsed = turnstileReportSchema.safeParse(site.turnstileStats)
    return { ...site, turnstileStats: !site.turnstileScanError && parsed.success ? parsed.data : null }
  })
})

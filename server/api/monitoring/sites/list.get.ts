import { prisma } from '#server/utils/db'

export default defineEventHandler(async () => {
  const sites = await prisma.wordPressInstallation.findMany({
    select: {
      id: true,
      siteTitle: true,
      siteUrl: true,
      monitoringLevel: true,
      monitoringStatus: true,
      monitoringCurrentStatusSince: true,
      monitoringLastCheckedAt: true,
      monitoringTestWpLogin: true,
      monitoringFrontpageStatusMin: true,
      monitoringFrontpageStatusMax: true,
      monitoringFailedAttempts: true,
      server: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      siteUrl: 'asc'
    }
  })

  return sites
})

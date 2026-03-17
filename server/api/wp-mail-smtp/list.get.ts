import { prisma } from '#server/utils/db'
import { getWpMailSmtpProSettings } from '#server/utils/setup'
import { getWpMailSmtpConfigurationMatch } from '#server/utils/wpMailSmtp'

export default defineEventHandler(async () => {
  const [sites, settings] = await Promise.all([
    prisma.wordPressInstallation.findMany({
      select: {
        id: true,
        serverId: true,
        siteTitle: true,
        siteUrl: true,
        server: {
          select: {
            id: true,
            name: true
          }
        },
        wpMailSmtp: true
      },
      orderBy: {
        siteUrl: 'asc'
      }
    }),
    getWpMailSmtpProSettings()
  ])

  return sites.map((site) => {
    const matchedConfiguration = getWpMailSmtpConfigurationMatch(
      site.wpMailSmtp,
      settings.configurations
    )

    return {
      ...site,
      configuration: matchedConfiguration
        ? {
            id: matchedConfiguration.id,
            name: matchedConfiguration.name
          }
        : null
    }
  })
})

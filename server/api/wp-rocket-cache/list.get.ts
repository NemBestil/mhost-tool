import { prisma } from '#server/utils/db'
import { getWpRocketCacheStatus, WP_ROCKET_PLUGIN_SLUG } from '#server/utils/wpRocketCache'

export default defineEventHandler(async () => {
  const sites = await prisma.wordPressInstallation.findMany({
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
      plugins: {
        where: {
          slug: WP_ROCKET_PLUGIN_SLUG
        },
        select: {
          slug: true,
          version: true,
          isEnabled: true,
          mainFilePath: true
        },
        take: 1
      }
    },
    orderBy: {
      siteUrl: 'asc'
    }
  })

  return sites.map((site) => {
    const plugin = site.plugins[0]
    const wpRocket = plugin
      ? {
          pluginInstalled: true,
          pluginIsActive: Boolean(plugin.isEnabled),
          pluginSlug: plugin.slug,
          pluginVersion: plugin.version || null,
          pluginMainFilePath: plugin.mainFilePath || null,
          status: getWpRocketCacheStatus({
            slug: plugin.slug,
            version: plugin.version || null,
            isActive: Boolean(plugin.isEnabled),
            mainFilePath: plugin.mainFilePath || null
          })
        }
      : {
          pluginInstalled: false,
          pluginIsActive: false,
          pluginSlug: null,
          pluginVersion: null,
          pluginMainFilePath: null,
          status: getWpRocketCacheStatus(null)
        }

    return {
      id: site.id,
      serverId: site.serverId,
      siteTitle: site.siteTitle,
      siteUrl: site.siteUrl,
      server: site.server,
      wpRocket
    }
  })
})

import { prisma } from '#server/utils/db'
import { compareVersions, isVersionNewer } from '#server/utils/uploadedPackages'

type SiteWithVersion = {
  installationId: string
  siteTitle: string
  siteUrl: string
  serverName: string
  version: string
  isActive: boolean
  isUpToDate: boolean
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Plugin slug is required'
    })
  }

  // Get all plugins with this slug and their installation info, plus check uploaded plugins
  const [plugins, uploadedPlugin] = await Promise.all([
    prisma.wordPressPlugin.findMany({
      where: { slug },
      include: {
        installation: {
          select: {
            id: true,
            siteTitle: true,
            siteUrl: true,
            server: {
              select: {
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.uploadedWordPressPlugin.findFirst({
      where: { slug, isLatest: true },
      select: { version: true }
    })
  ])

  if (plugins.length === 0) {
    return { sites: [], latestVersion: null }
  }

  // Determine the latest version: use WordPress.org version if available,
  // otherwise fallback to uploaded plugin version
  let latestVersion = plugins[0]?.latestVersion ?? null
  if (!latestVersion && uploadedPlugin) {
    latestVersion = uploadedPlugin.version
  }

  // Map to site with version info
  const sites: SiteWithVersion[] = plugins.map(plugin => ({
    installationId: plugin.installation.id,
    siteTitle: plugin.installation.siteTitle,
    siteUrl: plugin.installation.siteUrl,
    serverName: plugin.installation.server.name,
    version: plugin.version,
    isActive: plugin.isEnabled,
    isUpToDate: !latestVersion || !isVersionNewer(latestVersion, plugin.version)
  }))

  // Sort by version (oldest first)
  sites.sort((a, b) => compareVersions(a.version, b.version))

  return { sites, latestVersion }
})

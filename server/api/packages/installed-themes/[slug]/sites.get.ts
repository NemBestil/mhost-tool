import { prisma } from '#server/utils/db'
import { compareVersions, isVersionNewer } from '#server/utils/uploadedPackages'

type SiteWithVersion = {
  installationId: string
  siteTitle: string
  siteUrl: string
  version: string
  isActive: boolean
  isUpToDate: boolean
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Theme slug is required'
    })
  }

  // Get all themes with this slug and their installation info, plus check uploaded themes
  const [themes, uploadedTheme] = await Promise.all([
    prisma.wordPressTheme.findMany({
      where: { slug },
      include: {
        installation: {
          select: {
            id: true,
            siteTitle: true,
            siteUrl: true
          }
        }
      }
    }),
    prisma.uploadedWordPressTheme.findFirst({
      where: { slug, isLatest: true },
      select: { version: true }
    })
  ])

  if (themes.length === 0) {
    return { sites: [], latestVersion: null }
  }

  // Determine the latest version: use WordPress.org version if available,
  // otherwise fallback to uploaded theme version
  let latestVersion = themes[0]?.latestVersion ?? null
  if (!latestVersion && uploadedTheme) {
    latestVersion = uploadedTheme.version
  }

  // Map to site with version info
  const sites: SiteWithVersion[] = themes.map(theme => ({
    installationId: theme.installation.id,
    siteTitle: theme.installation.siteTitle,
    siteUrl: theme.installation.siteUrl,
    version: theme.version,
    isActive: theme.isEnabled,
    isUpToDate: !latestVersion || !isVersionNewer(latestVersion, theme.version)
  }))

  // Sort by version (oldest first)
  sites.sort((a, b) => compareVersions(a.version, b.version))

  return { sites, latestVersion }
})

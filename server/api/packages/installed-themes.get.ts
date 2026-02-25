import { prisma } from '#server/utils/db'
import { runVersionChecksIfNeeded } from '#server/utils/wordpressOrgApi'
import { compareVersions, isVersionNewer } from '#server/utils/uploadedPackages'

type InstalledThemeRow = {
  slug: string
  name: string
  title: string | null
  versions: {
    version: string
    sitesCount: number
  }[]
  source: string
  latestVersion: string | null
  hasNewerVersion: boolean
  totalInstallations: number
  upToDateCount: number
  outdatedCount: number
  outdatedInstallationIds: string[]
}

export default defineEventHandler(async () => {
  // Run version checks if needed (respects the 1-hour interval)
  await runVersionChecksIfNeeded()

  // Get all themes with their installation info
  const [themes, uploadedThemes] = await Promise.all([
    prisma.wordPressTheme.findMany({
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
    prisma.uploadedWordPressTheme.findMany({
      where: { isLatest: true },
      select: { slug: true, version: true }
    })
  ])

  // Create a map of uploaded themes for quick lookup
  const uploadedLatestMap = new Map<string, string>()
  for (const ut of uploadedThemes) {
    uploadedLatestMap.set(ut.slug, ut.version)
  }

  // Group themes by slug and aggregate versions
  const themeMap = new Map<string, InstalledThemeRow>()

  for (const theme of themes) {
    const existing = themeMap.get(theme.slug)

    // Determine the latest version: use theme.latestVersion (from WP.org)
    // or fallback to uploadedLatestMap (from local uploads)
    let latestVersion = theme.latestVersion
    if (!latestVersion && uploadedLatestMap.has(theme.slug)) {
      latestVersion = uploadedLatestMap.get(theme.slug)!
    }

    const isOutdated = latestVersion ? isVersionNewer(latestVersion, theme.version) : false

    if (!existing) {
      themeMap.set(theme.slug, {
        slug: theme.slug,
        name: theme.name,
        title: theme.title,
        versions: [{
          version: theme.version,
          sitesCount: 1
        }],
        source: theme.source,
        latestVersion: latestVersion,
        hasNewerVersion: isOutdated,
        totalInstallations: 1,
        upToDateCount: isOutdated ? 0 : 1,
        outdatedCount: isOutdated ? 1 : 0,
        outdatedInstallationIds: isOutdated ? [theme.installation.id] : []
      })
      continue
    }

    // Update latestVersion if it's more complete (e.g. from WP.org if available, or just ensuring it's set)
    if (latestVersion && (!existing.latestVersion || isVersionNewer(latestVersion, existing.latestVersion))) {
      existing.latestVersion = latestVersion
    }

    // Re-evaluate isOutdated with the best known latestVersion
    const currentIsOutdated = existing.latestVersion ? isVersionNewer(existing.latestVersion, theme.version) : false

    // Update total installations
    existing.totalInstallations++

    // Update up-to-date and outdated counts
    if (currentIsOutdated) {
      existing.outdatedCount++
      existing.outdatedInstallationIds.push(theme.installation.id)
    } else {
      existing.upToDateCount++
    }

    // Check if this version already exists
    const versionEntry = existing.versions.find(v => v.version === theme.version)
    if (versionEntry) {
      versionEntry.sitesCount++
    } else {
      existing.versions.push({
        version: theme.version,
        sitesCount: 1
      })
    }

    // Update hasNewerVersion if any installation has an older version
    if (currentIsOutdated) {
      existing.hasNewerVersion = true
    }

    // Use the most recent source info
    if (theme.source !== 'unknown') {
      existing.source = theme.source
    }
  }

  // Sort versions within each theme (newest first)
  for (const theme of themeMap.values()) {
    theme.versions.sort((a, b) => compareVersions(b.version, a.version))
  }

  // Convert to array and sort by title/name
  const result = [...themeMap.values()].sort((a, b) => {
    const titleA = (a.title || a.slug).toLowerCase()
    const titleB = (b.title || b.slug).toLowerCase()
    return titleA.localeCompare(titleB)
  })

  return { themes: result }
})

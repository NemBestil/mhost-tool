import { prisma } from '#server/utils/db'
import { runVersionChecksIfNeeded } from '#server/utils/wordpressOrgApi'
import { compareVersions, isVersionNewer } from '#server/utils/uploadedPackages'

type InstalledPluginRow = {
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

  // Get all plugins with their installation info
  const [plugins, uploadedPlugins] = await Promise.all([
    prisma.wordPressPlugin.findMany({
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
    prisma.uploadedWordPressPlugin.findMany({
      where: { isLatest: true },
      select: { slug: true, version: true }
    })
  ])

  // Create a map of uploaded plugins for quick lookup
  const uploadedLatestMap = new Map<string, string>()
  for (const up of uploadedPlugins) {
    uploadedLatestMap.set(up.slug, up.version)
  }

  // Group plugins by slug and aggregate versions
  const pluginMap = new Map<string, InstalledPluginRow>()

  for (const plugin of plugins) {
    const existing = pluginMap.get(plugin.slug)

    // Determine the latest version: use plugin.latestVersion (from WP.org)
    // or fallback to uploadedLatestMap (from local uploads)
    let latestVersion = plugin.latestVersion
    if (!latestVersion && uploadedLatestMap.has(plugin.slug)) {
      latestVersion = uploadedLatestMap.get(plugin.slug)!
    }

    const isOutdated = latestVersion ? isVersionNewer(latestVersion, plugin.version) : false

    if (!existing) {
      pluginMap.set(plugin.slug, {
        slug: plugin.slug,
        name: plugin.name,
        title: plugin.title,
        versions: [{
          version: plugin.version,
          sitesCount: 1
        }],
        source: plugin.source,
        latestVersion: latestVersion,
        hasNewerVersion: isOutdated,
        totalInstallations: 1,
        upToDateCount: isOutdated ? 0 : 1,
        outdatedCount: isOutdated ? 1 : 0,
        outdatedInstallationIds: isOutdated ? [plugin.installation.id] : []
      })
      continue
    }

    // Update latestVersion if it's more complete (e.g. from WP.org if available, or just ensuring it's set)
    if (latestVersion && (!existing.latestVersion || isVersionNewer(latestVersion, existing.latestVersion))) {
      existing.latestVersion = latestVersion
    }

    // Re-evaluate isOutdated with the best known latestVersion
    const currentIsOutdated = existing.latestVersion ? isVersionNewer(existing.latestVersion, plugin.version) : false

    // Update total installations
    existing.totalInstallations++

    // Update up-to-date and outdated counts
    if (currentIsOutdated) {
      existing.outdatedCount++
      existing.outdatedInstallationIds.push(plugin.installation.id)
    } else {
      existing.upToDateCount++
    }

    // Check if this version already exists
    const versionEntry = existing.versions.find(v => v.version === plugin.version)
    if (versionEntry) {
      versionEntry.sitesCount++
    } else {
      existing.versions.push({
        version: plugin.version,
        sitesCount: 1
      })
    }

    // Update hasNewerVersion if any installation has an older version
    if (currentIsOutdated) {
      existing.hasNewerVersion = true
    }

    // Use the most recent source info
    if (plugin.source !== 'unknown') {
      existing.source = plugin.source
    }
  }

  // Sort versions within each plugin (newest first)
  for (const plugin of pluginMap.values()) {
    plugin.versions.sort((a, b) => compareVersions(b.version, a.version))
  }

  // Convert to array and sort by title/name
  const result = [...pluginMap.values()].sort((a, b) => {
    const titleA = (a.title || a.slug).toLowerCase()
    const titleB = (b.title || b.slug).toLowerCase()
    return titleA.localeCompare(titleB)
  })

  return { plugins: result }
})

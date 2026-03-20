import { prisma } from '#server/utils/db'
import { getSiteCveDetails } from '#server/utils/cveDatabase'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const site = await prisma.wordPressInstallation.findUnique({
    where: { id },
    include: {
      server: true,
      plugins: {
        orderBy: {
          name: 'asc'
        }
      },
      themes: {
        orderBy: {
          name: 'asc'
        }
      }
    }
  })

  if (!site) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Site not found'
    })
  }

  // Enrich external plugins/themes with latest uploaded version (using isLatest flag)
  const [latestUploadedPlugins, latestUploadedThemes] = await Promise.all([
    prisma.uploadedWordPressPlugin.findMany({
      where: {
        name: { in: site.plugins.filter(p => p.source === 'external').map(p => p.name) },
        isLatest: true
      },
      select: { name: true, version: true }
    }),
    prisma.uploadedWordPressTheme.findMany({
      where: {
        name: { in: site.themes.filter(t => t.source === 'external').map(t => t.name) },
        isLatest: true
      },
      select: { name: true, version: true }
    })
  ])

  // Create lookup maps for quick access
  const latestPluginVersions = new Map(latestUploadedPlugins.map(p => [p.name, p.version]))
  const latestThemeVersions = new Map(latestUploadedThemes.map(t => [t.name, t.version]))

  // Map latest versions for plugins
  site.plugins = site.plugins.map(plugin => {
    if (plugin.source === 'external') {
      const latestVersion = latestPluginVersions.get(plugin.name)
      if (latestVersion) {
        plugin.latestVersion = latestVersion
      }
    }
    return plugin
  })

  // Map latest versions for themes
  site.themes = site.themes.map(theme => {
    if (theme.source === 'external') {
      const latestVersion = latestThemeVersions.get(theme.name)
      if (latestVersion) {
        theme.latestVersion = latestVersion
      }
    }
    return theme
  })

  // Enrich with CVE scores
  const cveScores = await getSiteCveDetails(
    site.plugins.map(p => ({ slug: p.slug, version: p.version })),
    site.themes.map(t => ({ slug: t.slug, version: t.version }))
  )

  const enrichedPlugins = site.plugins.map(p => ({
    ...p,
    cveScore: cveScores.get(`plugin:${p.slug}`) ?? null
  }))

  const enrichedThemes = site.themes.map(t => ({
    ...t,
    cveScore: cveScores.get(`theme:${t.slug}`) ?? null
  }))

  return {
    ...site,
    plugins: enrichedPlugins,
    themes: enrichedThemes
  }
})

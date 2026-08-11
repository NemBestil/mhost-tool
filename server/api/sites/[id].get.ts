import { prisma } from '#server/utils/db'
import { getSiteCveDetails } from '#server/utils/cveDatabase'
import { resolveLatestKnownVersion } from '#server/utils/versions'

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

  // Enrich plugins/themes with the highest version known from WordPress.org or local uploads.
  const [latestUploadedPlugins, latestUploadedThemes] = await Promise.all([
    prisma.uploadedWordPressPlugin.findMany({
      where: {
        slug: { in: site.plugins.map(plugin => plugin.slug) },
        isLatest: true
      },
      select: { slug: true, version: true }
    }),
    prisma.uploadedWordPressTheme.findMany({
      where: {
        slug: { in: site.themes.map(theme => theme.slug) },
        isLatest: true
      },
      select: { slug: true, version: true }
    })
  ])

  // Create lookup maps for quick access
  const latestPluginVersions = new Map(latestUploadedPlugins.map(plugin => [plugin.slug, plugin.version]))
  const latestThemeVersions = new Map(latestUploadedThemes.map(theme => [theme.slug, theme.version]))

  // Map latest versions for plugins
  site.plugins = site.plugins.map(plugin => {
    plugin.latestVersion = resolveLatestKnownVersion(
      plugin.latestVersion,
      latestPluginVersions.get(plugin.slug)
    )
    return plugin
  })

  // Map latest versions for themes
  site.themes = site.themes.map(theme => {
    theme.latestVersion = resolveLatestKnownVersion(
      theme.latestVersion,
      latestThemeVersions.get(theme.slug)
    )
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

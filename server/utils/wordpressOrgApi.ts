import { prisma, getOption, setOption } from '#server/utils/db'

const PLUGINS_UPDATE_CHECK_URL = 'https://api.wordpress.org/plugins/update-check/1.1/'
const THEMES_UPDATE_CHECK_URL = 'https://api.wordpress.org/themes/update-check/1.1/'
const VERSION_CHECK_OPTION_KEY = 'wordpress_org_version_check_last'
const VERSION_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

type PluginUpdateResponse = {
  plugins?: Record<string, { new_version?: string; slug?: string }>
  no_update?: Record<string, { new_version?: string; slug?: string }>
}

type ThemeUpdateResponse = {
  themes?: Record<string, { new_version?: string }>
  no_update?: Record<string, { new_version?: string }>
}

/**
 * Check if we should run a version check based on the last check time
 * and whether there are any plugins/themes with unknown source.
 */
export async function shouldRunVersionCheck(): Promise<boolean> {
  // Check if there are any plugins or themes with unknown source
  const [unknownPlugins, unknownThemes] = await Promise.all([
    prisma.wordPressPlugin.count({ where: { source: 'unknown' } }),
    prisma.wordPressTheme.count({ where: { source: 'unknown' } })
  ])

  // If there are unknown items, always run the check
  if (unknownPlugins > 0 || unknownThemes > 0) {
    return true
  }

  // Otherwise, check if enough time has passed since the last check
  const lastCheck = await getOption<number>(VERSION_CHECK_OPTION_KEY)
  if (!lastCheck) {
    return true
  }

  const timeSinceLastCheck = Date.now() - lastCheck
  return timeSinceLastCheck >= VERSION_CHECK_INTERVAL_MS
}

/**
 * Update the last version check timestamp.
 */
export async function updateVersionCheckTimestamp(): Promise<void> {
  await setOption(VERSION_CHECK_OPTION_KEY, Date.now())
}

/**
 * Check WordPress.org for plugin updates and update the database.
 */
export async function checkPluginUpdates(): Promise<void> {
  // Get all unique plugin slugs with their mainFilePath
  const plugins = await prisma.wordPressPlugin.findMany({
    select: { slug: true, mainFilePath: true },
    distinct: ['slug']
  })

  if (plugins.length === 0) {
    return
  }

  // Build the plugins object for the API request
  // The API expects plugin file paths like "akismet/akismet.php"
  // Use mainFilePath if available, otherwise fall back to "slug/slug.php"
  const pluginsObj: Record<string, object> = {}
  const pathToSlug = new Map<string, string>()
  for (const plugin of plugins) {
    const pluginPath = plugin.mainFilePath || `${plugin.slug}/${plugin.slug}.php`
    pluginsObj[pluginPath] = {}
    pathToSlug.set(pluginPath, plugin.slug)
  }

  const body = new URLSearchParams()
  body.append('plugins', JSON.stringify({ plugins: pluginsObj, active: [] }))
  body.append('translations', '[]')
  body.append('locale', '["en_US"]')
  body.append('all', 'true')

  try {
    const response = await fetch(PLUGINS_UPDATE_CHECK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })

    if (!response.ok) {
      console.error('WordPress.org plugin update check failed:', response.status)
      return
    }

    const data = await response.json() as PluginUpdateResponse

    // Process plugins that have updates available
    const allPlugins = { ...data.plugins, ...data.no_update }

    // Track which slugs were found in the response
    const foundSlugs = new Set<string>()

    for (const [pluginPath, info] of Object.entries(allPlugins)) {
      // Get the slug from the path (e.g., "woocommerce/woocommerce.php" -> "woocommerce")
      const slug = pathToSlug.get(pluginPath)
      if (slug) {
        foundSlugs.add(slug)
        if (info.new_version) {
          // Update all plugins with this slug to wordpress.org source and set latest version
          await prisma.wordPressPlugin.updateMany({
            where: { slug },
            data: {
              source: 'wordpress.org',
              latestVersion: info.new_version
            }
          })
        }
      }
    }

    // Mark plugins not found in the response as external
    const notFoundPlugins = plugins.filter(p => !foundSlugs.has(p.slug))

    for (const plugin of notFoundPlugins) {
      await prisma.wordPressPlugin.updateMany({
        where: { slug: plugin.slug },
        data: { source: 'external' }
      })
    }
  } catch (error) {
    console.error('Error checking plugin updates:', error)
  }
}

/**
 * Check WordPress.org for theme updates and update the database.
 */
export async function checkThemeUpdates(): Promise<void> {
  // Get all unique theme slugs
  const themes = await prisma.wordPressTheme.findMany({
    select: { slug: true },
    distinct: ['slug']
  })

  if (themes.length === 0) {
    return
  }

  // Build the themes object for the API request
  const themesObj: Record<string, object> = {}
  for (const theme of themes) {
    themesObj[theme.slug] = {}
  }

  const body = new URLSearchParams()
  body.append('themes', JSON.stringify({ themes: themesObj, active: themes[0]?.slug || '' }))
  body.append('translations', '[]')
  body.append('locale', '["en_US"]')
  body.append('all', 'true')

  try {
    const response = await fetch(THEMES_UPDATE_CHECK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })

    if (!response.ok) {
      console.error('WordPress.org theme update check failed:', response.status)
      return
    }

    const data = await response.json() as ThemeUpdateResponse

    // Process themes that have updates available
    const allThemes = { ...data.themes, ...data.no_update }

    for (const [themeSlug, info] of Object.entries(allThemes)) {
      if (info.new_version) {
        // Update all themes with this slug to wordpress.org source and set latest version
        await prisma.wordPressTheme.updateMany({
          where: { slug: themeSlug },
          data: {
            source: 'wordpress.org',
            latestVersion: info.new_version
          }
        })
      }
    }

    // Mark themes not found in the response as external
    const foundThemeSlugs = new Set(Object.keys(allThemes))
    const notFoundThemes = themes.filter(t => !foundThemeSlugs.has(t.slug))

    for (const theme of notFoundThemes) {
      await prisma.wordPressTheme.updateMany({
        where: { slug: theme.slug },
        data: { source: 'external' }
      })
    }
  } catch (error) {
    console.error('Error checking theme updates:', error)
  }
}

/**
 * Run version checks for both plugins and themes if needed.
 */
export async function runVersionChecksIfNeeded(): Promise<void> {
  const shouldRun = await shouldRunVersionCheck()
  if (!shouldRun) {
    return
  }

  await Promise.all([
    checkPluginUpdates(),
    checkThemeUpdates()
  ])

  await updateVersionCheckTimestamp()
}

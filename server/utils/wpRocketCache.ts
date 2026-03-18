export const WP_ROCKET_PLUGIN_SLUG = 'wp-rocket'

export type WpRocketPluginInfo = {
  slug: string
  version: string | null
  isActive: boolean
  mainFilePath: string | null
}

export type WpRocketCacheStatus = 'missing' | 'inactive' | 'active'

export function getWpRocketCacheStatus(plugin: WpRocketPluginInfo | null | undefined): WpRocketCacheStatus {
  if (!plugin) {
    return 'missing'
  }

  return plugin.isActive ? 'active' : 'inactive'
}

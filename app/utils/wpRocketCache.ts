export type WpRocketCacheStatus = 'missing' | 'inactive' | 'active'

export type WpRocketCacheListItem = {
  id: string
  serverId: string
  siteTitle: string
  siteUrl: string
  server: {
    id: string
    name: string
  }
  wpRocket: {
    pluginInstalled: boolean
    pluginIsActive: boolean
    pluginSlug: string | null
    pluginVersion: string | null
    pluginMainFilePath: string | null
    status: WpRocketCacheStatus
  }
}

export function getWpRocketCacheStatusLabel(status: WpRocketCacheStatus) {
  if (status === 'active') {
    return 'Active'
  }

  if (status === 'inactive') {
    return 'Installed inactive'
  }

  return 'Not installed'
}

export function canClearWpRocketCache(site: WpRocketCacheListItem) {
  return site.wpRocket.status === 'active'
}

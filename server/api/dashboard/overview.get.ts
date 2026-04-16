import { MonitoringLevel, MonitoringStatus } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { readMonitoringConfig } from '#server/utils/monitoring'
import { isVersionNewer } from '#server/utils/uploadedPackages'
import { getSetupSettings } from '#server/utils/setup'

export default defineEventHandler(async () => {
  const [
    serversCount,
    installations,
    monitoringConfig,
    plugins,
    themes,
    uploadedPlugins,
    uploadedThemes,
    setupSettings
  ] = await Promise.all([
    prisma.server.count(),
    prisma.wordPressInstallation.findMany({
      select: {
        siteUrl: true,
        monitoringLevel: true,
        monitoringStatus: true
      }
    }),
    readMonitoringConfig(),
    prisma.wordPressPlugin.findMany({
      select: {
        installationId: true,
        slug: true,
        version: true,
        latestVersion: true
      }
    }),
    prisma.wordPressTheme.findMany({
      select: {
        installationId: true,
        slug: true,
        version: true,
        latestVersion: true
      }
    }),
    prisma.uploadedWordPressPlugin.findMany({
      where: { isLatest: true },
      select: { slug: true, version: true }
    }),
    prisma.uploadedWordPressTheme.findMany({
      where: { isLatest: true },
      select: { slug: true, version: true }
    }),
    getSetupSettings()
  ])

  const devPatterns = setupSettings.developmentSites.split(/\s+/).filter(Boolean)
  const isDevSite = (url: string) => devPatterns.some(p => url.toLowerCase().includes(p.toLowerCase()))

  let highPrioritySites = 0
  let normalPrioritySites = 0
  let disabledSites = 0
  let upSites = 0
  let downSites = 0
  let unknownSites = 0
  let totalDevSites = 0
  let upDevSites = 0
  let downDevSites = 0

  for (const site of installations) {
    const isDev = isDevSite(site.siteUrl)

    if (site.monitoringLevel === MonitoringLevel.HIGH) highPrioritySites++
    else if (site.monitoringLevel === MonitoringLevel.NORMAL) normalPrioritySites++
    else if (site.monitoringLevel === MonitoringLevel.NONE) disabledSites++

    if (site.monitoringStatus === MonitoringStatus.UP) {
      upSites++
      if (isDev) upDevSites++
    } else if (site.monitoringStatus === MonitoringStatus.DOWN) {
      downSites++
      if (isDev) downDevSites++
    } else if (site.monitoringStatus === MonitoringStatus.UNKNOWN) {
      unknownSites++
    }

    if (isDev) totalDevSites++
  }

  const totalSites = installations.length

  const uploadedPluginLatestMap = new Map(uploadedPlugins.map(item => [item.slug, item.version]))
  const uploadedThemeLatestMap = new Map(uploadedThemes.map(item => [item.slug, item.version]))

  const outdatedPluginSiteIds = new Set<string>()
  for (const plugin of plugins) {
    const latestVersion = plugin.latestVersion || uploadedPluginLatestMap.get(plugin.slug)
    if (latestVersion && isVersionNewer(latestVersion, plugin.version)) {
      outdatedPluginSiteIds.add(plugin.installationId)
    }
  }

  const outdatedThemeSiteIds = new Set<string>()
  for (const theme of themes) {
    const latestVersion = theme.latestVersion || uploadedThemeLatestMap.get(theme.slug)
    if (latestVersion && isVersionNewer(latestVersion, theme.version)) {
      outdatedThemeSiteIds.add(theme.installationId)
    }
  }

  const sitesWithOutdatedPlugins = outdatedPluginSiteIds.size
  const sitesWithOutdatedThemes = outdatedThemeSiteIds.size

  const siteIdsWithAnyOutdatedPackages = new Set<string>([
    ...outdatedPluginSiteIds,
    ...outdatedThemeSiteIds
  ])
  const upToDateSites = Math.max(0, totalSites - siteIdsWithAnyOutdatedPackages.size)

  const channels = [
    {
      key: 'email',
      label: 'E-mail',
      configuredTargets: monitoringConfig.emails.length,
      enabled: monitoringConfig.emails.length > 0 && monitoringConfig.smtpConfigured
    },
    {
      key: 'pushover',
      label: 'Pushover',
      configuredTargets: monitoringConfig.pushoverTokens.length,
      enabled: monitoringConfig.pushoverTokens.length > 0
    },
    {
      key: 'webhook',
      label: 'Webhook',
      configuredTargets: monitoringConfig.webhooks.length,
      enabled: monitoringConfig.webhooks.length > 0
    }
  ]

  return {
    serversCount,
    totalSites,
    totalDevSites,
    highPrioritySites,
    normalPrioritySites,
    disabledSites,
    upSites,
    upDevSites,
    downSites,
    downDevSites,
    unknownSites,
    sitesWithOutdatedPlugins,
    sitesWithOutdatedThemes,
    upToDateSites,
    smtpConfigured: monitoringConfig.smtpConfigured,
    notificationChannels: channels
  }
})

import { MonitoringLevel, MonitoringStatus } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { readMonitoringConfig } from '#server/utils/monitoring'
import { isVersionNewer } from '#server/utils/uploadedPackages'

export default defineEventHandler(async () => {
  const [
    serversCount,
    totalSites,
    highPrioritySites,
    normalPrioritySites,
    disabledSites,
    upSites,
    downSites,
    unknownSites,
    monitoringConfig,
    plugins,
    themes,
    uploadedPlugins,
    uploadedThemes
  ] = await Promise.all([
    prisma.server.count(),
    prisma.wordPressInstallation.count(),
    prisma.wordPressInstallation.count({
      where: {
        monitoringLevel: MonitoringLevel.HIGH
      }
    }),
    prisma.wordPressInstallation.count({
      where: {
        monitoringLevel: MonitoringLevel.NORMAL
      }
    }),
    prisma.wordPressInstallation.count({
      where: {
        monitoringLevel: MonitoringLevel.NONE
      }
    }),
    prisma.wordPressInstallation.count({
      where: {
        monitoringStatus: MonitoringStatus.UP
      }
    }),
    prisma.wordPressInstallation.count({
      where: {
        monitoringStatus: MonitoringStatus.DOWN
      }
    }),
    prisma.wordPressInstallation.count({
      where: {
        monitoringStatus: MonitoringStatus.UNKNOWN
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
    })
  ])

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
    highPrioritySites,
    normalPrioritySites,
    disabledSites,
    upSites,
    downSites,
    unknownSites,
    sitesWithOutdatedPlugins,
    sitesWithOutdatedThemes,
    upToDateSites,
    smtpConfigured: monitoringConfig.smtpConfigured,
    notificationChannels: channels
  }
})

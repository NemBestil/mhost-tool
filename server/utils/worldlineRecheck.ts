import { Prisma } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { broadcastScanEvent } from '#server/utils/scanBroadcast'
import { readWorldlineHealth } from '#server/utils/siteHealthScan'
import { ensureWpCliOnServer, runWpCliCommand, type SiteInstallationContext } from '#server/utils/siteWpCli'
import { sendSiteHealthAlertReport } from '#server/utils/notificationReports'

export async function runWorldlineRecheck(site: SiteInstallationContext) {
  const broadcast = (type: 'progress' | 'error' | 'complete', message: string, data?: unknown) =>
    broadcastScanEvent({ channel: 'scan', type, serverId: site.serverId, message, data })
  broadcast('progress', 'Rechecking Worldline samples...', { total: 1, current: 0, success: 0, failed: 0 })
  let success = false
  try {
    await ensureWpCliOnServer(site.serverId)
    const health = await readWorldlineHealth(
      (args, loadPlugins, timeoutMs) => runWpCliCommand(site, args, { skipPlugins: !loadPlugins, timeoutMs, allowFailure: true }),
      true
    )
    await prisma.wordPressInstallation.update({
      where: { id: site.id },
      data: { ...health, worldlineStats: health.worldlineStats ?? Prisma.DbNull }
    })
    success = !health.worldlineScanError
    if (health.worldlineScanError) broadcast('error', health.worldlineScanError)
    // This action only scans Worldline; avoid mailing an old cron snapshot.
    await sendSiteHealthAlertReport([site.id], { includeCron: false })
  } catch (error) {
    broadcast('error', error instanceof Error ? error.message : String(error))
  } finally {
    broadcast('complete', success ? 'Worldline recheck completed' : 'Worldline recheck failed', {
      success: success ? 1 : 0, failed: success ? 0 : 1
    })
  }
}

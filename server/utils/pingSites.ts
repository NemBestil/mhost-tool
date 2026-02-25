import Queue from 'better-queue'
import {
  MonitoringCriticality,
  MonitoringLevel,
  MonitoringStatus,
  type WordPressInstallation
} from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { readMonitoringConfig } from '#server/utils/monitoring'
import { getSmtpSettings, isValidSmtpSettings, sendPlainTextEmail } from '#server/utils/smtp'

type SiteToPing = Pick<WordPressInstallation,
  | 'id'
  | 'siteTitle'
  | 'siteUrl'
  | 'monitoringLevel'
  | 'monitoringStatus'
  | 'monitoringCurrentStatusSince'
  | 'monitoringTestWpLogin'
  | 'monitoringFrontpageStatusMin'
  | 'monitoringFrontpageStatusMax'
  | 'monitoringFailedAttempts'
> & {
  server: {
    id: string
    name: string
  }
}

type SiteTestResult = {
  siteId: string
  isUp: boolean
  details: string
  frontStatusCode: number | null
  wpLoginStatusCode: number | null
}

type SiteNotificationCandidate = {
  siteId: string
  siteTitle: string
  siteUrl: string
  serverName: string
  failedAttempts: number
  details: string
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function headRequest(url: string, timeoutMs: number): Promise<number> {
  const response = await fetch(url, {
    method: 'HEAD',
    signal: timeoutSignal(timeoutMs),
    redirect: 'manual'
  })

  return response.status
}

async function runSingleSiteTest(site: SiteToPing): Promise<SiteTestResult> {
  const result: SiteTestResult = {
    siteId: site.id,
    isUp: false,
    details: '',
    frontStatusCode: null,
    wpLoginStatusCode: null
  }

  try {
    result.frontStatusCode = await headRequest(site.siteUrl, 10_000)
  } catch (error: any) {
    result.details = `Frontpage check failed: ${error?.name === 'AbortError' ? 'timeout after 10s' : (error?.message || 'request error')}`
    return result
  }

  const min = site.monitoringFrontpageStatusMin
  const max = site.monitoringFrontpageStatusMax

  if (result.frontStatusCode < min || result.frontStatusCode > max) {
    result.details = `Frontpage returned status ${result.frontStatusCode}, expected ${min}-${max}.`
    return result
  }

  if (site.monitoringTestWpLogin) {
    let wpLoginUrl = site.siteUrl
    try {
      wpLoginUrl = new URL('/wp-login.php', site.siteUrl).toString()
    } catch {
      result.details = 'wp-login.php check failed: invalid site URL.'
      return result
    }

    try {
      result.wpLoginStatusCode = await headRequest(wpLoginUrl, 10_000)
    } catch (error: any) {
      result.details = `wp-login.php check failed: ${error?.name === 'AbortError' ? 'timeout after 10s' : (error?.message || 'request error')}`
      return result
    }

    if (result.wpLoginStatusCode !== 200) {
      result.details = `wp-login.php returned status ${result.wpLoginStatusCode}, expected 200.`
      return result
    }
  }

  result.isUp = true
  result.details = 'Checks passed.'
  return result
}

function createDownSummary(candidates: SiteNotificationCandidate[]): string {
  const uniqueSiteNames = Array.from(new Set(candidates.map(item => item.siteTitle)))
  const uniqueServerNames = Array.from(new Set(candidates.map(item => item.serverName)))

  const previewSiteNames = uniqueSiteNames.slice(0, 5).join(', ')
  const extraSites = uniqueSiteNames.length > 5 ? ` and ${uniqueSiteNames.length - 5} more` : ''
  const servers = uniqueServerNames.join(', ')

  return `${uniqueSiteNames.length} site(s) are down, including ${previewSiteNames}${extraSites}. It affects sites on ${servers}.`
}

function createEmailBody(candidates: SiteNotificationCandidate[], summary: string): string {
  const lines = candidates.map((site) => {
    return `- ${site.siteTitle} (${site.siteUrl}) on ${site.serverName} [attempt ${site.failedAttempts}] - ${site.details}`
  })

  return [
    'MHost monitoring alert',
    '',
    summary,
    '',
    'Down sites:',
    ...lines,
    '',
    `Generated at ${new Date().toISOString()}`
  ].join('\n')
}

async function sendTargetNotifications(candidates: SiteNotificationCandidate[]) {
  if (candidates.length === 0) {
    return
  }

  const config = await readMonitoringConfig()
  const smtpSettings = await getSmtpSettings()
  const smtpConfigured = isValidSmtpSettings(smtpSettings)

  for (const target of config.emails) {
    const eligibleSites = candidates.filter(site => site.failedAttempts === target.minAttempts)
    if (!eligibleSites.length || !smtpConfigured || !smtpSettings) {
      continue
    }

    const summary = createDownSummary(eligibleSites)
    const body = createEmailBody(eligibleSites, summary)

    try {
      await sendPlainTextEmail(
        smtpSettings,
        target.email,
        `MHost alert: ${eligibleSites.length} site(s) down`,
        body
      )
    } catch (error) {
      console.error('Failed to send email notification:', error)
    }
  }

  for (const target of config.pushoverTokens) {
    const eligibleSites = candidates.filter(site => site.failedAttempts === target.minAttempts)
    if (!eligibleSites.length) {
      continue
    }

    const appToken = target.token
    const userKey = target.userKey
    if (!appToken || !userKey) {
      continue
    }

    const summary = createDownSummary(eligibleSites)

    try {
      await $fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        body: {
          token: appToken,
          user: userKey,
          title: 'MHost monitoring alert',
          message: summary.slice(0, 1024),
          priority: target.criticality === MonitoringCriticality.CRITICAL ? 1 : 0
        }
      })
    } catch (error) {
      console.error('Failed to send Pushover notification:', error)
    }
  }

  for (const target of config.webhooks) {
    const eligibleSites = candidates.filter(site => site.failedAttempts === target.minAttempts)
    if (!eligibleSites.length) {
      continue
    }

    const summary = createDownSummary(eligibleSites)

    try {
      await $fetch(target.url, {
        method: 'POST',
        body: {
          event: 'monitoring.down',
          summary,
          downCount: eligibleSites.length,
          sites: eligibleSites.map(site => ({
            id: site.siteId,
            title: site.siteTitle,
            url: site.siteUrl,
            server: site.serverName,
            attempts: site.failedAttempts,
            details: site.details
          }))
        }
      })
    } catch (error) {
      console.error('Failed to send webhook notification:', error)
    }
  }
}

async function runQueue(sites: SiteToPing[]): Promise<SiteTestResult[]> {
  if (!sites.length) {
    return []
  }

  const queue = new Queue<SiteToPing, SiteTestResult>((site, cb) => {
    runSingleSiteTest(site)
      .then(result => cb(null, result))
      .catch((error: any) => {
        cb(null, {
          siteId: site.id,
          isUp: false,
          details: `Unexpected monitor error: ${error?.message || 'unknown error'}`,
          frontStatusCode: null,
          wpLoginStatusCode: null
        })
      })
  }, {
    concurrent: 5
  })

  const work = sites.map(site => new Promise<SiteTestResult>((resolve) => {
    queue.push(site, (_error, result) => {
      resolve(result || {
        siteId: site.id,
        isUp: false,
        details: 'Unexpected monitor queue error.',
        frontStatusCode: null,
        wpLoginStatusCode: null
      })
    })
  }))

  const results = await Promise.all(work)

  await new Promise<void>((resolve) => {
    queue.destroy(() => resolve())
  })

  return results
}

export async function pingSitesByLevel(level: MonitoringLevel) {
  const sites = await prisma.wordPressInstallation.findMany({
    where: {
      monitoringLevel: level
    },
    select: {
      id: true,
      siteTitle: true,
      siteUrl: true,
      monitoringLevel: true,
      monitoringStatus: true,
      monitoringCurrentStatusSince: true,
      monitoringTestWpLogin: true,
      monitoringFrontpageStatusMin: true,
      monitoringFrontpageStatusMax: true,
      monitoringFailedAttempts: true,
      server: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  const results = await runQueue(sites)
  const now = new Date()

  const siteMap = new Map(sites.map(site => [site.id, site]))
  const notificationCandidates: SiteNotificationCandidate[] = []

  for (const result of results) {
    const site = siteMap.get(result.siteId)
    if (!site) {
      continue
    }

    const nextStatus = result.isUp ? MonitoringStatus.UP : MonitoringStatus.DOWN
    const nextFailedAttempts = result.isUp ? 0 : (site.monitoringFailedAttempts + 1)

    const currentSince = site.monitoringCurrentStatusSince
    const nextSince = site.monitoringStatus === nextStatus
      ? (currentSince ?? now)
      : now

    await prisma.wordPressInstallation.update({
      where: { id: site.id },
      data: {
        monitoringStatus: nextStatus,
        monitoringCurrentStatusSince: nextSince,
        monitoringLastCheckedAt: now,
        monitoringFailedAttempts: nextFailedAttempts
      }
    })

    if (site.monitoringStatus !== nextStatus) {
      await prisma.monitoringEvent.create({
        data: {
          installationId: site.id,
          status: nextStatus,
          details: result.isUp ? 'Site is up again.' : result.details
        }
      })
    }

    if (!result.isUp) {
      notificationCandidates.push({
        siteId: site.id,
        siteTitle: site.siteTitle,
        siteUrl: site.siteUrl,
        serverName: site.server.name,
        failedAttempts: nextFailedAttempts,
        details: result.details
      })
    }
  }

  await sendTargetNotifications(notificationCandidates)

  return {
    checked: sites.length,
    up: results.filter(result => result.isUp).length,
    down: results.filter(result => !result.isUp).length
  }
}

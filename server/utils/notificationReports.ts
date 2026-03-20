import { getOption } from '#server/utils/db'
import { prisma } from '#server/utils/db'
import { requireEmail } from '#server/utils/siteUserInput'
import { getSmtpSettings, isValidSmtpSettings, sendPlainTextEmail } from '#server/utils/smtp'

export const NOTIFICATION_REPORTS_OPTION_KEY = 'main.notificationReports'

export type NotificationReportsSettings = {
  recipients: string[]
  reports: {
    newSitesFound: boolean
    cveAlert: boolean
    cveAlertMinScore: number
  }
}

export type NewSiteReportEntry = {
  siteTitle: string
  siteUrl: string
  installationPath: string
}

export function getDefaultNotificationReportsSettings(): NotificationReportsSettings {
  return {
    recipients: [],
    reports: {
      newSitesFound: false,
      cveAlert: false,
      cveAlertMinScore: 7.0
    }
  }
}

export function normalizeNotificationReportsSettings(
  settings: Partial<NotificationReportsSettings> | null | undefined
): NotificationReportsSettings {
  const recipients: string[] = []
  const seen = new Set<string>()

  for (const candidate of Array.isArray(settings?.recipients) ? settings.recipients : []) {
    if (typeof candidate !== 'string') {
      continue
    }

    try {
      const email = requireEmail(candidate, 'reportRecipients')
      if (!seen.has(email)) {
        seen.add(email)
        recipients.push(email)
      }
    } catch {
      // Ignore invalid stored entries when reading settings.
    }
  }

  const cveAlertMinScore = Number(settings?.reports?.cveAlertMinScore)

  return {
    recipients,
    reports: {
      newSitesFound: Boolean(settings?.reports?.newSitesFound),
      cveAlert: Boolean(settings?.reports?.cveAlert),
      cveAlertMinScore: Number.isFinite(cveAlertMinScore) && cveAlertMinScore >= 0 && cveAlertMinScore <= 10
        ? cveAlertMinScore
        : 7.0
    }
  }
}

export async function getNotificationReportsSettings(): Promise<NotificationReportsSettings> {
  const settings = await getOption<NotificationReportsSettings>(
    NOTIFICATION_REPORTS_OPTION_KEY,
    getDefaultNotificationReportsSettings()
  )

  return normalizeNotificationReportsSettings(settings)
}

export function parseNotificationReportRecipients(value: unknown): string[] {
  const recipients = Array.isArray(value) ? value : []
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const candidate of recipients) {
    const email = requireEmail(candidate, 'reportRecipients')

    if (seen.has(email)) {
      throw createError({
        statusCode: 400,
        message: `Duplicate e-mail address: ${email}`
      })
    }

    seen.add(email)
    normalized.push(email)
  }

  return normalized
}

function createNewSitesFoundBody(
  server: { name: string, hostname: string },
  sites: NewSiteReportEntry[]
) {
  const lines = sites.map((site) => {
    return `- ${site.siteTitle} (${site.siteUrl})\n  Path: ${site.installationPath}`
  })

  return [
    'MHost scan report',
    '',
    `${sites.length} new site(s) were found on ${server.name} (${server.hostname}).`,
    '',
    'New sites:',
    ...lines,
    '',
    `Generated at ${new Date().toISOString()}`
  ].join('\n')
}

export async function sendNewSitesFoundReport(
  server: { name: string, hostname: string },
  sites: NewSiteReportEntry[]
) {
  if (sites.length === 0) {
    return
  }

  const [settings, smtpSettings] = await Promise.all([
    getNotificationReportsSettings(),
    getSmtpSettings()
  ])

  if (!settings.reports.newSitesFound || settings.recipients.length === 0 || !isValidSmtpSettings(smtpSettings)) {
    return
  }

  const sortedSites = [...sites].sort((left, right) => {
    return left.siteUrl.localeCompare(right.siteUrl) || left.installationPath.localeCompare(right.installationPath)
  })
  const subject = `[MHost] ${sortedSites.length} new site(s) found on ${server.name}`
  const body = createNewSitesFoundBody(server, sortedSites)

  for (const recipient of settings.recipients) {
    try {
      await sendPlainTextEmail(smtpSettings, recipient, subject, body)
    } catch (error) {
      console.error(`Failed to send new-sites report to ${recipient}:`, error)
    }
  }
}

type CveAlertEntry = {
  cvssScore: number
  title: string
  cve: string | null
  softwareType: string
  softwareName: string
  softwareSlug: string
  affectedSites: { siteTitle: string; siteUrl: string }[]
  totalAffectedSites: number
}

export async function sendCveAlertReport() {
  const [settings, smtpSettings] = await Promise.all([
    getNotificationReportsSettings(),
    getSmtpSettings()
  ])

  if (!settings.reports.cveAlert || settings.recipients.length === 0 || !isValidSmtpSettings(smtpSettings)) {
    return
  }

  const minScore = settings.reports.cveAlertMinScore

  // Find all vulnerability software records with score >= minScore
  const vulnSoftware = await prisma.vulnerabilitySoftware.findMany({
    where: {
      vulnerability: {
        cvssScore: { gte: minScore }
      }
    },
    include: {
      vulnerability: {
        select: {
          id: true,
          title: true,
          cve: true,
          cvssScore: true
        }
      }
    }
  })

  if (vulnSoftware.length === 0) {
    return
  }

  // Load all sites with plugins and themes
  const sites = await prisma.wordPressInstallation.findMany({
    select: {
      id: true,
      siteTitle: true,
      siteUrl: true,
      plugins: { select: { slug: true, version: true } },
      themes: { select: { slug: true, version: true } }
    }
  })

  // For each vulnerability, find which sites are affected
  const alertEntries = new Map<string, CveAlertEntry>()

  for (const vs of vulnSoftware) {
    const score = vs.vulnerability.cvssScore!
    const vulnKey = `${vs.vulnerability.id}:${vs.type}:${vs.slug}`

    for (const site of sites) {
      const packages = vs.type === 'plugin' ? site.plugins : site.themes
      const pkg = packages.find(p => p.slug === vs.slug)
      if (!pkg) continue

      if (isVersionInRange(pkg.version, vs.fromVersion, vs.fromInclusive, vs.toVersion, vs.toInclusive)) {
        let entry = alertEntries.get(vulnKey)
        if (!entry) {
          entry = {
            cvssScore: score,
            title: vs.vulnerability.title,
            cve: vs.vulnerability.cve,
            softwareType: vs.type,
            softwareName: vs.name,
            softwareSlug: vs.slug,
            affectedSites: [],
            totalAffectedSites: 0
          }
          alertEntries.set(vulnKey, entry)
        }
        entry.totalAffectedSites++
        if (entry.affectedSites.length < 5) {
          entry.affectedSites.push({ siteTitle: site.siteTitle, siteUrl: site.siteUrl })
        }
      }
    }
  }

  // Filter to only entries that actually affect sites
  const alerts = [...alertEntries.values()]
    .filter(e => e.totalAffectedSites > 0)
    .sort((a, b) => b.cvssScore - a.cvssScore)

  if (alerts.length === 0) {
    return
  }

  const subject = `[MHost] ${alerts.length} CVE alert(s) found (score >= ${minScore})`
  const body = createCveAlertBody(alerts, minScore)

  for (const recipient of settings.recipients) {
    try {
      await sendPlainTextEmail(smtpSettings, recipient, subject, body)
    } catch (error) {
      console.error(`Failed to send CVE alert report to ${recipient}:`, error)
    }
  }
}

function isVersionInRange(
  version: string,
  fromVersion: string | null,
  fromInclusive: boolean,
  toVersion: string | null,
  toInclusive: boolean
): boolean {
  if (fromVersion) {
    const cmp = compareVersions(version, fromVersion)
    if (fromInclusive ? cmp < 0 : cmp <= 0) return false
  }

  if (toVersion) {
    const cmp = compareVersions(version, toVersion)
    if (toInclusive ? cmp > 0 : cmp >= 0) return false
  }

  return true
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(p => parseInt(p, 10) || 0)
  const partsB = b.split('.').map(p => parseInt(p, 10) || 0)
  const maxLen = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < maxLen; i++) {
    const partA = partsA[i] || 0
    const partB = partsB[i] || 0
    if (partA < partB) return -1
    if (partA > partB) return 1
  }

  return 0
}

function createCveAlertBody(alerts: CveAlertEntry[], minScore: number): string {
  const lines: string[] = [
    'MHost CVE Alert Report',
    '',
    `${alerts.length} vulnerability alert(s) found with CVSS score >= ${minScore}.`,
    ''
  ]

  for (const alert of alerts) {
    const cveLabel = alert.cve ? ` (${alert.cve})` : ''
    lines.push(`--- CVSS ${alert.cvssScore.toFixed(1)}${cveLabel} ---`)
    lines.push(`${alert.title}`)
    lines.push(`${alert.softwareType === 'plugin' ? 'Plugin' : 'Theme'}: ${alert.softwareName} (${alert.softwareSlug})`)
    lines.push('')
    lines.push('Affected sites:')

    for (const site of alert.affectedSites) {
      lines.push(`  - ${site.siteTitle} (${site.siteUrl})`)
    }

    if (alert.totalAffectedSites > 5) {
      lines.push(`  ... and ${alert.totalAffectedSites - 5} more`)
    }

    lines.push('')
  }

  lines.push(`Generated at ${new Date().toISOString()}`)

  return lines.join('\n')
}

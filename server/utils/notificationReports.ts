import { getOption } from '#server/utils/db'
import { requireEmail } from '#server/utils/siteUserInput'
import { getSmtpSettings, isValidSmtpSettings, sendPlainTextEmail } from '#server/utils/smtp'

export const NOTIFICATION_REPORTS_OPTION_KEY = 'main.notificationReports'

export type NotificationReportsSettings = {
  recipients: string[]
  reports: {
    newSitesFound: boolean
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
      newSitesFound: false
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

  return {
    recipients,
    reports: {
      newSitesFound: Boolean(settings?.reports?.newSitesFound)
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

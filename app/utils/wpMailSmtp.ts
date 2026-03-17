export type WpMailSmtpListItem = {
  id: string
  serverId: string
  siteTitle: string
  siteUrl: string
  server: {
    id: string
    name: string
  }
  wpMailSmtp: {
    pluginInstalled: boolean
    pluginIsActive: boolean
    pluginSlug: string | null
    pluginVersion: string | null
    provider: string | null
    fromEmail: string | null
    fromName: string | null
    smtpHost: string | null
    smtpEncryption: string | null
    smtpPort: number | null
    smtpAuthentication: boolean | null
    smtpUsername: string | null
    amazonSesAccessKeyId: string | null
    amazonSesRegion: string | null
    amazonSesCredentialsValid: boolean | null
    amazonSesLastCheckedAt: string | null
    amazonSesErrorMessage: string | null
    amazonSesDnsVerified: boolean | null
    amazonSesIdentity: string | null
    amazonSesIdentityStatus: string | null
    logEmails: boolean | null
    logRetentionPeriod: string | null
    logEmailContent: boolean | null
    hideAnnouncements: boolean | null
    disableEmailSummaries: boolean | null
    createdAt: string
    updatedAt: string
  } | null
  configuration: {
    id: string
    name: string
  } | null
}

export function getWpMailSmtpProviderLabel(provider: string | null | undefined) {
  if (provider === 'smtp') {
    return 'Other SMTP'
  }

  if (provider === 'amazonses') {
    return 'Amazon SES'
  }

  if (provider === 'mail') {
    return 'PHP mail()'
  }

  return provider || 'Not configured'
}

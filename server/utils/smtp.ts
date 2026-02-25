import nodemailer from 'nodemailer'
import { getOption } from '#server/utils/db'

export const SMTP_OPTION_KEY = 'main.smtp'
export const SMTP_AUTH_METHODS = ['PLAIN', 'LOGIN', 'CRAM-MD5'] as const
export type SmtpAuthMethod = typeof SMTP_AUTH_METHODS[number]

export type SmtpSettings = {
  host: string
  port: number
  secure: boolean
  authMethod: SmtpAuthMethod
  authUser: string
  authPass: string
  fromName: string
  fromEmail: string
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const settings = await getOption<SmtpSettings>(SMTP_OPTION_KEY, null)
  if (!settings) {
    return null
  }
  return normalizeSmtpSettings(settings)
}

export function normalizeSmtpSettings(settings: Partial<SmtpSettings>): SmtpSettings {
  const authMethod = String(settings.authMethod || 'PLAIN').trim().toUpperCase() as SmtpAuthMethod
  return {
    host: String(settings.host || '').trim(),
    port: Number(settings.port || 0),
    secure: Boolean(settings.secure),
    authMethod: SMTP_AUTH_METHODS.includes(authMethod) ? authMethod : 'PLAIN',
    authUser: String(settings.authUser || '').trim(),
    authPass: String(settings.authPass || ''),
    fromName: String(settings.fromName || '').trim(),
    fromEmail: String(settings.fromEmail || '').trim()
  }
}

export function isValidSmtpSettings(settings: SmtpSettings | null | undefined): settings is SmtpSettings {
  if (!settings) {
    return false
  }

  return (
    settings.host.length > 0 &&
    Number.isInteger(settings.port) &&
    settings.port > 0 &&
    settings.port <= 65535 &&
    SMTP_AUTH_METHODS.includes(settings.authMethod) &&
    settings.authUser.length > 0 &&
    settings.authPass.length > 0 &&
    settings.fromName.length > 0 &&
    settings.fromEmail.length > 0
  )
}

export function createSmtpTransport(settings: SmtpSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    authMethod: settings.authMethod,
    auth: {
      user: settings.authUser,
      pass: settings.authPass
    }
  })
}

export async function sendPlainTextEmail(
  settings: SmtpSettings,
  to: string,
  subject: string,
  text: string
) {
  const transport = createSmtpTransport(settings)
  await transport.sendMail({
    from: `"${settings.fromName}" <${settings.fromEmail}>`,
    to,
    subject,
    text
  })
}

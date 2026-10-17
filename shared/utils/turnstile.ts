import { z } from 'zod'

export const turnstileChecks = [
  { key: 'wordpressRegister', label: 'WordPress Register' },
  { key: 'wordpressResetPassword', label: 'WordPress Reset Password' },
  { key: 'woocommerceRegister', label: 'WooCommerce Register' },
  { key: 'woocommerceResetPassword', label: 'WooCommerce Reset Password' },
  { key: 'cf7AllForms', label: 'Enable on all CF7 Forms' }
] as const

export const turnstileReportSchema = z.object({
  pluginInstalled: z.boolean(),
  pluginIsActive: z.boolean(),
  hasSiteKey: z.boolean(),
  hasSecretKey: z.boolean(),
  tested: z.boolean(),
  retestRequired: z.boolean(),
  checks: z.object({
    wordpressRegister: z.boolean(),
    wordpressResetPassword: z.boolean(),
    woocommerceRegister: z.boolean(),
    woocommerceResetPassword: z.boolean(),
    cf7AllForms: z.boolean()
  })
})

export type TurnstileReport = z.infer<typeof turnstileReportSchema>

export type TurnstileSite = {
  id: string
  serverId: string
  siteTitle: string
  siteUrl: string
  server: { name: string }
  turnstileStats: TurnstileReport | null
  turnstileCheckedAt: string | null
  turnstileScanError: string | null
}

export function isTurnstileConfigured(report: TurnstileReport): boolean {
  return report.hasSiteKey && report.hasSecretKey && report.tested && !report.retestRequired
}

export function getTurnstileCheckCount(report: TurnstileReport): number {
  return turnstileChecks.filter(check => report.checks[check.key]).length
}

export function getTurnstileCheckColor(count: number): 'error' | 'warning' | 'success' {
  return count === 0 ? 'error' : count === turnstileChecks.length ? 'success' : 'warning'
}

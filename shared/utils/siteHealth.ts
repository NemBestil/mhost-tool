import { z } from 'zod'

const count = z.number().int().nonnegative()
export const worldlineReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  timezone: z.string(),
  days: z.array(z.object({
    daysAgo: z.number().int().min(1).max(7),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    total: count,
    eligible: count,
    captureStatus: z.enum(['captured', 'missing', 'unknown', 'no_orders']),
    sampled: count.max(5),
    unknown: count.max(5),
    checkedAt: z.string().datetime({ offset: true }),
    cached: z.boolean()
  }).refine(day => day.eligible <= day.total && day.unknown <= day.sampled
    && (day.captureStatus !== 'captured' || day.sampled > day.unknown)
    && (day.captureStatus !== 'missing' || (day.sampled > 0 && day.unknown === 0)),
  'Inconsistent capture sample')).length(7)
}).refine(report => report.days.every((day, index) => day.daysAgo === index + 1
  && Date.parse(`${day.date}T00:00:00Z`) === Date.parse(`${report.days[0]!.date}T00:00:00Z`) - index * 86_400_000),
'Expected seven consecutive days, starting with yesterday')

export type WorldlineReport = z.infer<typeof worldlineReportSchema>
export type WorldlineDay = WorldlineReport['days'][number]
export type WorldlineSite = {
  id: string
  serverId: string
  siteTitle: string
  siteUrl: string
  server: { name: string }
  plugin?: { version: string, isEnabled: boolean }
  worldlineStats: WorldlineReport | null
  worldlineCheckedAt: string | null
  worldlineScanError: string | null
}

type CronSnapshot = {
  cronMonitorStartedAt?: Date | string | null
  cronLastRunAt?: Date | string | null
  cronCheckedAt?: Date | string | null
  cronScanError?: string | null
}

export function getCronStatus(site: CronSnapshot, now = Date.now()): 'ok' | 'overdue' | 'pending' | 'unknown' {
  if (site.cronScanError || !site.cronCheckedAt || !site.cronMonitorStartedAt) return 'unknown'
  const started = new Date(site.cronMonitorStartedAt).getTime()
  if (!Number.isFinite(started) || started > now) return 'unknown'
  if (site.cronLastRunAt) {
    const lastRun = new Date(site.cronLastRunAt).getTime()
    if (!Number.isFinite(lastRun) || lastRun > now) return 'unknown'
    return now - lastRun <= 86_400_000 ? 'ok' : 'overdue'
  }
  return now - started <= 86_400_000 ? 'pending' : 'overdue'
}

export function hasMissingWorldlineCapture(report: WorldlineReport): boolean {
  const yesterday = report.days[0]
  return !!yesterday && yesterday.eligible >= 2 && yesterday.captureStatus === 'missing'
}

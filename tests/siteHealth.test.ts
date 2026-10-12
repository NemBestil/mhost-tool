import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCronStatus, hasMissingWorldlineCapture, worldlineReportSchema, type WorldlineReport } from '../shared/utils/siteHealth.ts'

const now = Date.parse('2026-10-12T12:00:00Z')
const cron = { cronMonitorStartedAt: '2026-10-01T00:00:00Z', cronCheckedAt: '2026-10-12T12:00:00Z' }
function report(): WorldlineReport {
  return {
    schemaVersion: 1, generatedAt: '2026-10-12T12:00:00Z', timezone: 'Europe/Copenhagen',
    days: Array.from({ length: 7 }, (_, index) => ({
      daysAgo: index + 1, date: `2026-10-${11 - index}`, total: 10, eligible: 2,
      captureStatus: 'missing', sampled: 2, unknown: 0, checkedAt: '2026-10-12T12:00:00Z', cached: true
    }))
  }
}

describe('cron heartbeat', () => {
  it('uses a strict 24-hour boundary', () => {
    assert.equal(getCronStatus({ ...cron, cronLastRunAt: '2026-10-11T12:00:00Z' }, now), 'ok')
    assert.equal(getCronStatus({ ...cron, cronLastRunAt: '2026-10-11T11:59:59Z' }, now), 'overdue')
  })
  it('allows a new installation to record its first heartbeat', () => {
    assert.equal(getCronStatus({ ...cron, cronMonitorStartedAt: '2026-10-12T11:00:00Z' }, now), 'pending')
    assert.equal(getCronStatus(cron, now), 'overdue')
  })
  it('does not alarm on unsupported plugins or failed reads', () => {
    assert.equal(getCronStatus({}, now), 'unknown')
    assert.equal(getCronStatus({ ...cron, cronScanError: 'SSH failed' }, now), 'unknown')
    assert.equal(getCronStatus({ ...cron, cronLastRunAt: 'invalid' }, now), 'unknown')
    assert.equal(getCronStatus({ ...cron, cronLastRunAt: '2026-10-13T12:00:00Z' }, now), 'unknown')
  })
})

describe('Worldline capture alarm', () => {
  it('alarms only for yesterday with at least two eligible orders and a confirmed negative sample', () => {
    const value = report()
    assert.equal(hasMissingWorldlineCapture(value), true)
    value.days[0]!.eligible = 1
    assert.equal(hasMissingWorldlineCapture(value), false)
    value.days[0]!.eligible = 2
    for (const status of ['captured', 'unknown', 'no_orders'] as const) {
      value.days[0]!.captureStatus = status
      assert.equal(hasMissingWorldlineCapture(value), false)
    }
  })
  it('rejects duplicate days, today and samples over five', () => {
    const value = report()
    // Pad dates in the fixture to ISO format.
    value.days.forEach(day => { day.date = day.date.replace(/-(\d)$/, '-0$1') })
    assert.ok(worldlineReportSchema.safeParse(value).success)
    value.days[0]!.daysAgo = 0
    assert.ok(!worldlineReportSchema.safeParse(value).success)
    value.days[0]!.daysAgo = 1
    value.days[1]!.date = value.days[0]!.date
    assert.ok(!worldlineReportSchema.safeParse(value).success)
    value.days[1]!.date = '2026-10-10'
    value.days[0]!.sampled = 6
    assert.ok(!worldlineReportSchema.safeParse(value).success)
  })
})

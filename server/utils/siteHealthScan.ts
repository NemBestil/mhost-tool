import { z } from 'zod'
import { worldlineReportSchema } from '../../shared/utils/siteHealth'
import type { SshExecResult } from '#server/utils/ssh'
import { trimWpCliError } from '#server/utils/siteWpCli'

type ExecuteWpCli = (args: string[], loadPlugins: boolean, timeoutMs: number) => Promise<SshExecResult>

export async function readCronHealth(exec: ExecuteWpCli) {
  const cronCheckedAt = new Date()
  try {
    const result = await exec(['eval', 'echo wp_json_encode(["started" => get_option("nbcore_cron_monitoring_since", null), "lastRun" => get_option("nbcore_cron_last_run", null)]);'], false, 30_000)
    if (result.code !== 0) throw new Error(trimWpCliError(result.stderr || result.stdout))
    const value = z.object({
      started: z.string().datetime({ offset: true }).nullable(),
      lastRun: z.string().datetime({ offset: true }).nullable()
    }).parse(JSON.parse(result.stdout.trim()))
    return {
      cronCheckedAt,
      cronMonitorStartedAt: value.started ? new Date(value.started) : null,
      cronLastRunAt: value.lastRun ? new Date(value.lastRun) : null,
      cronScanError: null
    }
  } catch (error) {
    return { cronCheckedAt, cronScanError: error instanceof Error ? error.message : String(error) }
  }
}

export async function readWorldlineHealth(exec: ExecuteWpCli, recheck = false) {
  try {
    const args = ['nb-core', 'worldline-stats', '--format=json']
    if (recheck) args.push('--recheck')
    // First scan can make up to 35 requests (7 x 5), each with the plugin's 30s timeout.
    const result = await exec(args, true, 20 * 60_000)
    if (result.code !== 0) throw new Error(trimWpCliError(result.stderr || result.stdout))
    const worldlineStats = worldlineReportSchema.parse(JSON.parse(result.stdout.trim()))
    return { worldlineCheckedAt: new Date(), worldlineStats, worldlineScanError: null }
  } catch (error) {
    return {
      worldlineCheckedAt: new Date(),
      worldlineStats: null,
      worldlineScanError: error instanceof Error ? error.message : String(error)
    }
  }
}

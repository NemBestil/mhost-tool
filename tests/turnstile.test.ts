import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getTurnstileCheckColor,
  getTurnstileCheckCount,
  isTurnstileConfigured,
  turnstileChecks,
  turnstileReportSchema,
  type TurnstileReport
} from '../shared/utils/turnstile.ts'
import { readTurnstileHealth, turnstileScanPhp } from '../server/utils/turnstileScan.ts'

function report(): TurnstileReport {
  return {
    pluginInstalled: true, pluginIsActive: true,
    hasSiteKey: true, hasSecretKey: true, tested: true, retestRequired: false,
    checks: {
      wordpressRegister: false, wordpressResetPassword: false,
      woocommerceRegister: false, woocommerceResetPassword: false, cf7AllForms: false
    }
  }
}

describe('Turnstile statuses', () => {
  it('requires both keys, a successful test and no request to retest', () => {
    assert.equal(isTurnstileConfigured(report()), true)
    for (const key of ['hasSiteKey', 'hasSecretKey', 'tested'] as const) {
      assert.equal(isTurnstileConfigured({ ...report(), [key]: false }), false)
    }
    assert.equal(isTurnstileConfigured({ ...report(), retestRequired: true }), false)
  })

  it('counts all five settings and uses error, warning and success at the requested boundaries', () => {
    const value = report()
    for (let count = 0; count <= 5; count++) {
      assert.equal(getTurnstileCheckCount(value), count)
      assert.equal(getTurnstileCheckColor(count), count === 0 ? 'error' : count === 5 ? 'success' : 'warning')
      if (count < 5) value.checks[turnstileChecks[count]!.key] = true
    }
  })

  it('does not confuse unreadable settings with unchecked settings', async () => {
    for (const stdout of ['', '{invalid', '{}', JSON.stringify({ ...report(), tested: 'yes' })]) {
      const result = await readTurnstileHealth(async () => ({ stdout, stderr: '', code: 0 }))
      assert.equal(result.turnstileStats, null)
      assert.ok(result.turnstileScanError)
    }
    const result = await readTurnstileHealth(async () => { throw new Error('SSH failed') })
    assert.equal(result.turnstileStats, null)
    assert.ok(result.turnstileCheckedAt instanceof Date)
  })

  it('reads with plugins skipped and accepts valid snapshots', async () => {
    const result = await readTurnstileHealth(async (args, loadPlugins, timeoutMs) => {
      assert.deepEqual(args, ['eval', turnstileScanPhp])
      assert.equal(loadPlugins, false)
      assert.equal(timeoutMs, 30_000)
      return { code: 0, stderr: '', stdout: JSON.stringify(report()) }
    })
    assert.deepEqual(result.turnstileStats, report())
    assert.equal(result.turnstileScanError, null)
  })

  it('clears previous results on command errors without persisting command output', async () => {
    const result = await readTurnstileHealth(async () => ({ code: 1, stdout: JSON.stringify(report()), stderr: 'sensitive diagnostic' }))
    assert.equal(result.turnstileStats, null)
    assert.ok(result.turnstileScanError)
    assert.ok(!JSON.stringify(result).includes('sensitive diagnostic'))
  })
})

// Exercise the actual PHP reader against WordPress API stubs when PHP is available.
const hasPhp = spawnSync('php', ['--version']).status === 0
describe('Turnstile WordPress reader', { skip: !hasPhp }, () => {
  function read(options: Record<string, unknown>, installed = true, active = true, constants = false) {
    const directory = mkdtempSync(join(tmpdir(), 'mhost-turnstile-'))
    mkdirSync(join(directory, 'wp-admin/includes'), { recursive: true })
    writeFileSync(join(directory, 'wp-admin/includes/plugin.php'), '<?php')
    const fixture = `<?php
      define('ABSPATH', ${JSON.stringify(directory + '/')});
      $options = json_decode(${JSON.stringify(JSON.stringify(options))}, true);
      function get_option($key) { global $options; return $options[$key] ?? false; }
      function get_plugins() { return ${installed ? "array('simple-cloudflare-turnstile/simple-cloudflare-turnstile.php' => array())" : 'array()'}; }
      function is_plugin_active($plugin) { return ${active ? 'true' : 'false'}; }
      function wp_json_encode($value) { return json_encode($value); }
      ${constants ? "define('CF_TURNSTILE_SITE_KEY', 'config-site-key'); define('CF_TURNSTILE_SECRET_KEY', 'config-secret-key');" : ''}
      ${turnstileScanPhp}
    `
    try {
      const result = spawnSync('php', [], { input: fixture, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
      return turnstileReportSchema.parse(JSON.parse(result.stdout))
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }

  it('maps the five options exactly and never returns key values', () => {
    const value = read({
      cfturnstile_key: 'private-site-key', cfturnstile_secret: 'private-secret-key', cfturnstile_tested: 'yes',
      cfturnstile_register: 'on', cfturnstile_reset: 'on', cfturnstile_woo_register: 'on',
      cfturnstile_woo_reset: 'on', cfturnstile_cf7_all: 'on'
    })
    assert.equal(getTurnstileCheckCount(value), 5)
    assert.ok(isTurnstileConfigured(value))
    assert.ok(!JSON.stringify(value).includes('private-'))
  })

  it('reads keys from wp-config and rejects a requested retest', () => {
    const value = read({ cfturnstile_tested: 'yes', cfturnstile_soft_tested: 'no' }, true, true, true)
    assert.ok(value.hasSiteKey && value.hasSecretKey)
    assert.equal(isTurnstileConfigured(value), false)
    assert.equal(getTurnstileCheckCount(value), 0)
  })

  it('counts WooCommerce reset password and ignores account details', () => {
    const accountOnly = read({ cfturnstile_woo_account: 'on' })
    assert.equal(accountOnly.checks.woocommerceResetPassword, false)
    assert.equal(getTurnstileCheckCount(accountOnly), 0)

    const resetOnly = read({ cfturnstile_woo_reset: 'on' })
    assert.equal(resetOnly.checks.woocommerceResetPassword, true)
    assert.equal(getTurnstileCheckCount(resetOnly), 1)
  })

  it('distinguishes missing and inactive plugins while still reading saved options', () => {
    const inactive = read({ cfturnstile_register: 'on' }, true, false)
    assert.ok(inactive.pluginInstalled)
    assert.equal(inactive.pluginIsActive, false)
    assert.equal(getTurnstileCheckCount(inactive), 1)
    const missing = read({}, false)
    assert.equal(missing.pluginInstalled, false)
    assert.equal(missing.pluginIsActive, false)
    assert.equal(missing.tested, false)
  })
})

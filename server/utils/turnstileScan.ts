import { turnstileReportSchema } from '../../shared/utils/turnstile'
import type { SshExecResult } from './ssh'

// Read without loading plugins, including when Turnstile is inactive. Match the
// plugin's wp-config key overrides and the truthiness used by its settings UI.
// Return only presence flags: key values never leave the WordPress server.
export const turnstileScanPhp = `
require_once ABSPATH . 'wp-admin/includes/plugin.php';
$plugin = 'simple-cloudflare-turnstile/simple-cloudflare-turnstile.php';
$installed = array_key_exists($plugin, get_plugins());
$site_key = defined('CF_TURNSTILE_SITE_KEY') && CF_TURNSTILE_SITE_KEY ? CF_TURNSTILE_SITE_KEY : get_option('cfturnstile_key');
$secret_key = defined('CF_TURNSTILE_SECRET_KEY') && CF_TURNSTILE_SECRET_KEY ? CF_TURNSTILE_SECRET_KEY : get_option('cfturnstile_secret');
echo wp_json_encode(array(
  'pluginInstalled' => $installed,
  'pluginIsActive' => $installed && is_plugin_active($plugin),
  'hasSiteKey' => !empty($site_key),
  'hasSecretKey' => !empty($secret_key),
  'tested' => get_option('cfturnstile_tested') === 'yes',
  'retestRequired' => get_option('cfturnstile_soft_tested') === 'no',
  'checks' => array(
    'wordpressRegister' => (bool) get_option('cfturnstile_register'),
    'wordpressResetPassword' => (bool) get_option('cfturnstile_reset'),
    'woocommerceRegister' => (bool) get_option('cfturnstile_woo_register'),
    'woocommerceResetPassword' => (bool) get_option('cfturnstile_woo_reset'),
    'cf7AllForms' => (bool) get_option('cfturnstile_cf7_all')
  )
));
`.trim()

type ExecuteWpCli = (args: string[], loadPlugins: boolean, timeoutMs: number) => Promise<SshExecResult>

export async function readTurnstileHealth(exec: ExecuteWpCli) {
  const turnstileCheckedAt = new Date()
  try {
    const result = await exec(['eval', turnstileScanPhp], false, 30_000)
    if (result.code !== 0) throw new Error('WP-CLI could not read Turnstile settings.')
    const turnstileStats = turnstileReportSchema.parse(JSON.parse(result.stdout.trim()))
    return { turnstileCheckedAt, turnstileStats, turnstileScanError: null }
  } catch {
    // Do not persist arbitrary command output, which could contain credentials.
    return {
      turnstileCheckedAt,
      turnstileStats: null,
      turnstileScanError: 'Could not read Turnstile settings. Scan the site again to retry.'
    }
  }
}

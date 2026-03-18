import { prisma } from '#server/utils/db'
import { ensureWpCliOnServer, getSiteInstallationContext, runWpCliCommand, trimWpCliError } from '#server/utils/siteWpCli'
import { WP_ROCKET_PLUGIN_SLUG } from '#server/utils/wpRocketCache'

export type WpRocketCacheOperationResult = {
  status: 'success' | 'failed' | 'skipped'
  message: string
}

const CLEAR_CACHE_EVAL = [
  '$notice_key = \'rocket_warning_plugin_modification\';',
  'if ( ! function_exists( \'rocket_clean_domain\' ) ) {',
  'fwrite( STDERR, \'WP Rocket purge function is unavailable.\' );',
  'exit( 1 );',
  '}',
  'rocket_clean_domain();',
  '$user_ids = get_users( array( \'fields\' => \'ids\' ) );',
  'foreach ( $user_ids as $user_id ) {',
  'if ( ! user_can( $user_id, \'rocket_manage_options\' ) ) {',
  'continue;',
  '}',
  '$boxes = get_user_meta( $user_id, \'rocket_boxes\', true );',
  '$boxes = array_merge( (array) $boxes, array( $notice_key ) );',
  '$boxes = array_filter( $boxes );',
  '$boxes = array_unique( $boxes );',
  'update_user_meta( $user_id, \'rocket_boxes\', $boxes );',
  '}',
  'delete_transient( $notice_key );',
  'echo \'WP Rocket cache cleared and notice dismissed\';'
].join(' ')

export async function executeWpRocketCacheClear(installationId: string): Promise<WpRocketCacheOperationResult> {
  const [installation, plugin] = await Promise.all([
    getSiteInstallationContext(installationId),
    prisma.wordPressPlugin.findUnique({
      where: {
        installationId_slug: {
          installationId,
          slug: WP_ROCKET_PLUGIN_SLUG
        }
      },
      select: {
        isEnabled: true
      }
    })
  ])

  if (!installation) {
    return {
      status: 'failed',
      message: `Site not found: ${installationId}`
    }
  }

  if (!plugin) {
    return {
      status: 'skipped',
      message: 'WP Rocket is not installed on this site'
    }
  }

  if (!plugin.isEnabled) {
    return {
      status: 'skipped',
      message: 'WP Rocket is installed but inactive on this site'
    }
  }

  await ensureWpCliOnServer(installation.serverId)

  try {
    await runWpCliCommand(
      installation,
      ['eval', CLEAR_CACHE_EVAL],
      {
        skipPlugins: false,
        skipThemes: true
      }
    )
  } catch (error: any) {
    return {
      status: 'failed',
      message: trimWpCliError(error?.message || 'Failed to clear WP Rocket cache')
    }
  }

  return {
    status: 'success',
    message: 'WP Rocket cache cleared and plugin modification notice dismissed'
  }
}

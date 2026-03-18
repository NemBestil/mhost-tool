import { getOption, prisma, setOption } from '#server/utils/db'
import { openSshConnection, type SshConnection, type SshSession } from '#server/utils/ssh'
import { broadcastScanEvent, type BroadcastEvent } from '#server/utils/scanBroadcast'
import { getOrCreateMonitoringConfig } from '#server/utils/monitoring'
import { sendNewSitesFoundReport, type NewSiteReportEntry } from '#server/utils/notificationReports'
import { validateAmazonSesCredentials } from '#server/utils/amazonSes'
import {
  normalizeWpMailSmtpScanRecord,
  pickWpMailSmtpPlugin,
  type WpMailSmtpPluginInfo
} from '#server/utils/wpMailSmtp'
import { shellEscape } from '#server/utils/siteWpCli'

type ServerForScan = {
  id: string
  name: string
  hostname: string
  sshPort: number
  sshPrivateKey: string
  serverType: 'PLESK' | 'CPANEL_WHM'
}

type ScanEventType = 'log' | 'progress' | 'error' | 'complete'

export type ServerScanResult = {
  success: number
  failed: number
}

type ServerScanState = {
  hasCompletedScan: boolean
  lastCompletedAt: string | null
}

function getServerScanStateOptionKey(serverId: string) {
  return `server.scanState.${serverId}`
}

function buildWpCliCommand(
  unixUser: string,
  wpDir: string,
  phpBinary: string,
  args: string[],
  options: {
    skipPlugins?: boolean
    skipThemes?: boolean
  } = {}
) {
  const commandArgs = [...args]

  if (options.skipPlugins !== false) {
    commandArgs.push('--skip-plugins')
  }

  if (options.skipThemes !== false) {
    commandArgs.push('--skip-themes')
  }

  const command = [phpBinary, '/opt/mhost-cli/wp-cli.phar', ...commandArgs]
    .map(shellEscape)
    .join(' ')

  return `su - ${unixUser} -s /bin/bash -c ${shellEscape(`cd ${wpDir} && ${command}`)}`
}

async function getWpMailSmtpOptions(
  session: SshSession,
  unixUser: string,
  wpDir: string,
  phpBinary: string
) {
  const command = buildWpCliCommand(
    unixUser,
    wpDir,
    phpBinary,
    ['eval', 'echo wp_json_encode( get_option( "wp_mail_smtp", [] ) );'],
    {
      skipPlugins: true,
      skipThemes: true
    }
  )

  const result = await session.exec(command, { timeoutMs: 30_000 })
  const raw = result.stdout.trim()

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function sendScanEvent(serverId: string, type: ScanEventType, message: string, data?: any) {
  const event: BroadcastEvent = {
    channel: 'scan',
    type,
    message,
    serverId,
    data
  }
  broadcastScanEvent(event)
}

export async function runServerScan(server: ServerForScan): Promise<ServerScanResult> {
  const serverId = server.id
  const sendEvent = (type: ScanEventType, message: string, data?: any) => sendScanEvent(serverId, type, message, data)

  const sshConn: SshConnection = {
    host: server.hostname,
    port: server.sshPort,
    privateKey: server.sshPrivateKey,
    username: 'root'
  }

  const ssh = await openSshConnection(sshConn)

  try {
    const [monitoringConfig, existingInstallations, scanState] = await Promise.all([
      getOrCreateMonitoringConfig(),
      prisma.wordPressInstallation.findMany({
        where: { serverId: server.id },
        select: { installationPath: true }
      }),
      getOption<ServerScanState>(getServerScanStateOptionKey(server.id), {
        hasCompletedScan: false,
        lastCompletedAt: null
      })
    ])
    const defaultNewSiteLevel = monitoringConfig.defaultNewSiteLevel
    const hadCompletedScan = Boolean(scanState?.hasCompletedScan)
    const knownInstallationPaths = new Set(existingInstallations.map((installation) => installation.installationPath))
    const newSitesFound: NewSiteReportEntry[] = []

    sendEvent('log', `Starting scan on ${server.name}...`)

    const searchPaths = server.serverType === 'CPANEL_WHM'
      ? '/home*/'
      : '/var/www/vhosts/'

    sendEvent('log', `Searching for WordPress® installations in ${searchPaths}...`)

    const findCmd = `find ${searchPaths} -xdev \\( -type d \\( -name ".*" -o -name "cache" -o -name "node_modules" -o -name "vendor" -o -name "tmp" -o -name "logs" \\) -prune \\) -o -name "wp-config.php" -type f -print`
    const findResult = await ssh.exec(findCmd, { timeoutMs: 120000 })

    if (findResult.code !== 0 && !findResult.stdout) {
      sendEvent('error', `Failed to search for WordPress® installations: ${findResult.stderr}`)
      sendEvent('complete', 'Scan failed', { success: 0, failed: 1 })
      return { success: 0, failed: 1 }
    }

    const wpConfigPaths = findResult.stdout.trim().split('\n').filter(Boolean)
    sendEvent('log', `Found ${wpConfigPaths.length} potential WordPress® installations`)

    const validInstallations: string[] = []
    for (const wpConfigPath of wpConfigPaths) {
      const wpDir = wpConfigPath.replace('/wp-config.php', '')

      const validateCmd = `test -d "${wpDir}/wp-admin" && test -d "${wpDir}/wp-content" && test -d "${wpDir}/wp-includes" && test -f "${wpDir}/wp-login.php" && echo "valid" || echo "invalid"`
      const validateResult = await ssh.exec(validateCmd, { timeoutMs: 10000 })

      if (validateResult.stdout.trim() === 'valid') {
        validInstallations.push(wpDir)
      } else {
        sendEvent('error', `Skipping invalid installation: ${wpDir}`)
      }
    }

    sendEvent('log', `${validInstallations.length} valid WordPress® installations found`)
    sendEvent('progress', 'Starting detailed scan', { total: validInstallations.length, current: 0, success: 0, failed: 0 })

    sendEvent('log', 'Checking wp-cli installation...')
    const wpCliSetupCmd = `
      mkdir -p /opt/mhost-cli && \\
      if [ ! -f /opt/mhost-cli/wp-cli.phar ] || [ $(find /opt/mhost-cli/wp-cli.phar -mtime +14 2>/dev/null | wc -l) -gt 0 ]; then
        curl -sS -o /opt/mhost-cli/wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \\
        chmod +x /opt/mhost-cli/wp-cli.phar && \\
        echo "downloaded"
      else
        echo "exists"
      fi
    `
    const wpCliResult = await ssh.exec(wpCliSetupCmd, { timeoutMs: 60000 })

    if (wpCliResult.stdout.trim() === 'downloaded') {
      sendEvent('log', 'wp-cli downloaded successfully')
    } else {
      sendEvent('log', 'wp-cli already up to date')
    }

    let phpBinary = '/usr/local/bin/php'

    if (server.serverType === 'PLESK') {
      sendEvent('log', 'Detecting latest PHP version for Plesk®...')
      const detectPhpCmd = 'ls -1 /opt/plesk/php/ 2>/dev/null | sort -V | tail -1'
      const phpVersionResult = await ssh.exec(detectPhpCmd, { timeoutMs: 10000 })
      const latestPhpVersion = phpVersionResult.stdout.trim()

      if (latestPhpVersion) {
        phpBinary = `/opt/plesk/php/${latestPhpVersion}/bin/php`
        sendEvent('log', `Using PHP binary: ${phpBinary}`)
      } else {
        sendEvent('error', 'Could not detect Plesk® PHP version, falling back to system php')
        phpBinary = 'php'
      }
    } else {
      sendEvent('log', `Using PHP binary: ${phpBinary}`)
    }

    const concurrency = 8

    let successCount = 0
    let failedCount = 0
    let currentCount = 0

    const processInstallation = async (wpDir: string, session: any) => {
      try {
        sendEvent('log', `Processing: ${wpDir}`)

        let unixUser: string
        if (server.serverType === 'CPANEL_WHM') {
          const userCmd = `stat -c '%U' $(echo "${wpDir}" | grep -oP '/home[^/]*/[^/]+')`
          const userResult = await session.exec(userCmd, { timeoutMs: 10000 })
          unixUser = userResult.stdout.trim()
        } else {
          const userCmd = `stat -c '%U' $(echo "${wpDir}" | grep -oP '/var/www/vhosts/[^/]+')`
          const userResult = await session.exec(userCmd, { timeoutMs: 10000 })
          unixUser = userResult.stdout.trim()
        }

        if (!unixUser) {
          sendEvent('error', `Could not determine user for ${wpDir}, skipping`)
          failedCount++
          return
        }

        sendEvent('log', `Detected user: ${unixUser}`)
        const isNewInstallation = !knownInstallationPaths.has(wpDir)

        const wpInfoCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar option get blogname --skip-plugins --skip-themes 2>/dev/null'`
        const siteTitle = (await session.exec(wpInfoCmd, { timeoutMs: 30000 })).stdout.trim() || 'Unknown'

        const wpDescCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar option get blogdescription --skip-plugins --skip-themes 2>/dev/null'`
        const siteDescription = (await session.exec(wpDescCmd, { timeoutMs: 30000 })).stdout.trim() || null

        const wpUrlCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar option get siteurl --skip-plugins --skip-themes 2>/dev/null'`
        const siteUrl = (await session.exec(wpUrlCmd, { timeoutMs: 30000 })).stdout.trim() || ''

        if (!siteUrl) {
          sendEvent('error', `Could not get site URL for ${wpDir}, skipping`)
          failedCount++
          return
        }

        const timezoneCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar option get timezone_string --skip-plugins --skip-themes 2>/dev/null'`
        const timezone = (await session.exec(timezoneCmd, { timeoutMs: 30000 })).stdout.trim() || ''

        const cronCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar config get DISABLE_WP_CRON --skip-plugins --skip-themes 2>/dev/null'`
        const cronResult = (await session.exec(cronCmd, { timeoutMs: 30000 })).stdout.trim()
        const usesServerCron = cronResult === 'true' || cronResult === '1'

        const adminEmailCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar option get admin_email --skip-plugins --skip-themes 2>/dev/null'`
        const adminEmail = (await session.exec(adminEmailCmd, { timeoutMs: 30000 })).stdout.trim() || ''

        const phpInfoFilename = `mhostinfo-${Math.random().toString(36).substring(2, 10)}.php`
        const phpInfoScript = '<?php echo json_encode([\'version\' => PHP_VERSION, \'memory_limit\' => ini_get(\'memory_limit\')]); ?>'
        const phpInfoCmd = `
          echo '${phpInfoScript.replace(/'/g, "'\\''")}' > "${wpDir}/${phpInfoFilename}" && \\
          curl -sS -k --resolve "$(echo "${siteUrl}" | sed 's|https\\?://||' | sed 's|/.*||'):443:127.0.0.1" --resolve "$(echo "${siteUrl}" | sed 's|https\\?://||' | sed 's|/.*||'):80:127.0.0.1" "${siteUrl}/${phpInfoFilename}" 2>/dev/null && \\
          rm -f "${wpDir}/${phpInfoFilename}"
        `
        let phpVersion = ''
        let phpMemoryLimit = ''
        try {
          const phpInfoResult = await session.exec(phpInfoCmd, { timeoutMs: 30000 })
          const phpInfo = JSON.parse(phpInfoResult.stdout.trim())
          phpVersion = phpInfo.version || ''
          phpMemoryLimit = phpInfo.memory_limit || ''
        } catch {
          await session.exec(`rm -f "${wpDir}/${phpInfoFilename}"`, { timeoutMs: 10000 }).catch(() => {})
        }

        const blogNameCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar option get blogname --skip-plugins --skip-themes 2>/dev/null'`
        const adminEmailFromName = (await session.exec(blogNameCmd, { timeoutMs: 30000 })).stdout.trim() || null

        // Hosting status check: create a temp file and try to fetch it from the public internet
        sendEvent('log', `Checking hosting status for ${siteTitle}...`)
        let hostingStatus: 'PUBLIC' | 'PRIVATE' | 'INACTIVE' | 'UNKNOWN' = 'UNKNOWN'
        const probeToken = `mhost-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
        const probeFileName = `${probeToken}.txt`
        const wellKnownDir = `${wpDir}/.well-known`
        const probeRemotePath = `${wellKnownDir}/${probeFileName}`
        try {
          // Create .well-known dir and probe file on the remote server
          const createProbeCmd = `mkdir -p "${wellKnownDir}" && echo -n "${probeToken}" > "${probeRemotePath}" && chmod 644 "${probeRemotePath}"`
          await session.exec(createProbeCmd, { timeoutMs: 10_000 })

          // Try to fetch the file from the public internet (from this API server, not via SSH)
          const probeUrl = `${siteUrl}/.well-known/${probeFileName}`
          try {
            const response = await fetch(probeUrl, {
              signal: AbortSignal.timeout(15_000),
              redirect: 'follow'
            })
            if (response.ok) {
              const body = await response.text()
              hostingStatus = body.trim() === probeToken ? 'PUBLIC' : 'INACTIVE'
            } else if (response.status === 401 || response.status === 403) {
              hostingStatus = 'PRIVATE'
            } else {
              hostingStatus = 'INACTIVE'
            }
          } catch {
            // Network error, DNS failure, timeout etc.
            hostingStatus = 'INACTIVE'
          }

          // Clean up the probe file
          await session.exec(`rm -f "${probeRemotePath}"`, { timeoutMs: 10_000 }).catch(() => {})
        } catch {
          // Could not create probe file, leave as UNKNOWN
          await session.exec(`rm -f "${probeRemotePath}"`, { timeoutMs: 10_000 }).catch(() => {})
        }
        sendEvent('log', `Hosting status for ${siteTitle}: ${hostingStatus}`)

        const installation = await prisma.wordPressInstallation.upsert({
          where: {
            serverId_installationPath: {
              serverId: server.id,
              installationPath: wpDir
            }
          },
          update: {
            unixUsername: unixUser,
            siteTitle,
            siteDescription,
            siteUrl,
            timezone,
            usesServerCron,
            adminEmail,
            adminEmailFromName,
            phpVersion,
            phpMemoryLimit,
            hostingStatus,
            lastScanAt: new Date()
          },
          create: {
            serverId: server.id,
            unixUsername: unixUser,
            installationPath: wpDir,
            siteTitle,
            siteDescription,
            siteUrl,
            timezone,
            usesServerCron,
            adminEmail,
            adminEmailFromName,
            phpVersion,
            phpMemoryLimit,
            hostingStatus,
            lastScanAt: new Date(),
            monitoringLevel: defaultNewSiteLevel
          }
        })
        knownInstallationPaths.add(wpDir)

        if (hadCompletedScan && isNewInstallation) {
          newSitesFound.push({
            siteTitle,
            siteUrl,
            installationPath: wpDir
          })
        }

        sendEvent('log', `Getting plugins for ${siteTitle}...`)
        const pluginsCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar plugin list --format=json --fields=name,title,status,update,version,update_version,auto_update --skip-plugins --skip-themes 2>/dev/null'`
        let wpMailSmtpPlugin: WpMailSmtpPluginInfo | null = null
        let hasWooCommerce = false
        try {
          const pluginsResult = await session.exec(pluginsCmd, { timeoutMs: 60000 })
          const plugins = JSON.parse(pluginsResult.stdout.trim() || '[]')
          wpMailSmtpPlugin = pickWpMailSmtpPlugin(
            plugins.map((plugin: any) => ({
              slug: plugin.name || null,
              version: plugin.version || null,
              isEnabled: plugin.status === 'active'
            }))
          )

          hasWooCommerce = plugins.some((plugin: any) => plugin.name === 'woocommerce' && plugin.status === 'active')

          await prisma.wordPressPlugin.deleteMany({
            where: { installationId: installation.id }
          })

          for (const plugin of plugins) {
            const pluginSlug = plugin.name || 'unknown'

            let mainFilePath: string | null = null

            try {
              const findMainFileCmd = `su - ${unixUser} -s /bin/bash -c '
                PLUGIN_DIR="${wpDir}/wp-content/plugins/${pluginSlug}"
                if [ -d "$PLUGIN_DIR" ]; then
                  MAIN_FILE="${pluginSlug}/${pluginSlug}.php"
                  if [ -f "$PLUGIN_DIR/${pluginSlug}.php" ] && head -100 "$PLUGIN_DIR/${pluginSlug}.php" 2>/dev/null | grep -qi "Plugin Name:"; then
                    echo "$MAIN_FILE"
                    exit 0
                  fi

                  for f in "$PLUGIN_DIR"/*.php; do
                    if [ -f "$f" ] && head -100 "$f" 2>/dev/null | grep -qi "Plugin Name:"; then
                      echo "${pluginSlug}/$(basename "$f")"
                      exit 0
                    fi
                  done
                fi
              '`

              const mainFileResult = await session.exec(findMainFileCmd, { timeoutMs: 30000 })
              const detectedPath = mainFileResult.stdout.trim()
              if (detectedPath) {
                mainFilePath = detectedPath
              }
            } catch {
              // Ignore main file detection errors.
            }

            await prisma.wordPressPlugin.create({
              data: {
                installationId: installation.id,
                name: plugin.name || 'unknown',
                title: plugin.title || plugin.name || 'Unknown',
                slug: pluginSlug,
                version: plugin.version || '',
                isEnabled: plugin.status === 'active',
                autoUpdate: plugin.auto_update === 'on',
                mainFilePath
              }
            })
          }
          sendEvent('log', `Saved ${plugins.length} plugins`)
        } catch (e) {
          sendEvent('error', `Failed to get plugins: ${e}`)
        }

        let wooCommerceEmail: string | null = null
        let wooCommerceEmailFromName: string | null = null
        if (hasWooCommerce) {
          sendEvent('log', `Detecting WooCommerce email for ${siteTitle}...`)
          try {
            const wooEmailCmd = buildWpCliCommand(
              unixUser,
              wpDir,
              phpBinary,
              ['option', 'get', 'woocommerce_email_from_address'],
              { skipPlugins: true, skipThemes: true }
            )
            const wooEmailResult = await session.exec(wooEmailCmd, { timeoutMs: 30_000 })
            const emailValue = wooEmailResult.stdout.trim()
            if (emailValue && emailValue.includes('@')) {
              wooCommerceEmail = emailValue
            }

            const wooFromNameCmd = buildWpCliCommand(
              unixUser,
              wpDir,
              phpBinary,
              ['option', 'get', 'woocommerce_email_from_name'],
              { skipPlugins: true, skipThemes: true }
            )
            const wooFromNameResult = await session.exec(wooFromNameCmd, { timeoutMs: 30_000 })
            const fromNameValue = wooFromNameResult.stdout.trim()
            if (fromNameValue) {
              wooCommerceEmailFromName = fromNameValue
            }
          } catch (e) {
            sendEvent('error', `Failed to get WooCommerce email: ${e}`)
          }
        }

        await prisma.wordPressInstallation.update({
          where: { id: installation.id },
          data: {
            hasWooCommerce,
            wooCommerceEmail,
            wooCommerceEmailFromName
          }
        })

        sendEvent('log', `Reading WP Mail SMTP settings for ${siteTitle}...`)
        try {
          const wpMailSmtpOptions = await getWpMailSmtpOptions(session, unixUser, wpDir, phpBinary)
          const wpMailSmtpProvider = typeof wpMailSmtpOptions?.mail?.mailer === 'string'
            ? wpMailSmtpOptions.mail.mailer
            : null
          const wpMailSmtpSesValidation = wpMailSmtpProvider === 'amazonses'
            && typeof wpMailSmtpOptions?.amazonses?.client_id === 'string'
            && typeof wpMailSmtpOptions?.amazonses?.client_secret === 'string'
            && typeof wpMailSmtpOptions?.amazonses?.region === 'string'
            ? await validateAmazonSesCredentials({
                accessKeyId: wpMailSmtpOptions.amazonses.client_id.trim(),
                secretAccessKey: wpMailSmtpOptions.amazonses.client_secret,
                region: wpMailSmtpOptions.amazonses.region.trim()
              })
            : null
          const wpMailSmtpScan = normalizeWpMailSmtpScanRecord(
            wpMailSmtpOptions,
            wpMailSmtpPlugin,
            wpMailSmtpSesValidation
          )

          await prisma.wordPressInstallationWpMailSmtp.upsert({
            where: {
              installationId: installation.id
            },
            update: wpMailSmtpScan,
            create: {
              installationId: installation.id,
              ...wpMailSmtpScan
            }
          })
        } catch (e) {
          sendEvent('error', `Failed to read WP Mail SMTP settings: ${e}`)
        }

        sendEvent('log', `Getting themes for ${siteTitle}...`)
        const themesCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar theme list --fields=name,title,status,update,version,update_version,auto_update --format=json --skip-plugins --skip-themes 2>/dev/null'`
        try {
          const themesResult = await session.exec(themesCmd, { timeoutMs: 60000 })
          const themes = JSON.parse(themesResult.stdout.trim() || '[]')

          const activeTheme = themes.find((t: any) => t.status === 'active')
          const parentThemeSlug = activeTheme?.parent || null

          await prisma.wordPressTheme.deleteMany({
            where: { installationId: installation.id }
          })

          for (const theme of themes) {
            await prisma.wordPressTheme.create({
              data: {
                installationId: installation.id,
                name: theme.name || 'unknown',
                title: theme.title || theme.name || 'Unknown',
                slug: theme.name || 'unknown',
                version: theme.version || '',
                isEnabled: theme.status === 'active',
                autoUpdate: theme.auto_update === 'on',
                isActiveChild: theme.name === parentThemeSlug
              }
            })
          }
          sendEvent('log', `Saved ${themes.length} themes`)
        } catch (e) {
          sendEvent('error', `Failed to get themes: ${e}`)
        }

        successCount++
      } catch (err: any) {
        sendEvent('error', `Error processing ${wpDir}: ${err.message}`)
        failedCount++
      } finally {
        currentCount++
        sendEvent('progress', `Processed ${wpDir}`, { total: validInstallations.length, current: currentCount, success: successCount, failed: failedCount })
      }
    }

    const queue = [...validInstallations]
    const workers = Array(Math.min(concurrency, validInstallations.length)).fill(null).map(async () => {
      const session = await openSshConnection(sshConn)
      try {
        while (queue.length > 0) {
          const wpDir = queue.shift()
          if (wpDir) {
            await processInstallation(wpDir, session)
          }
        }
      } finally {
        session.disconnect()
      }
    })

    await Promise.all(workers)

    try {
      await setOption(getServerScanStateOptionKey(server.id), {
        hasCompletedScan: true,
        lastCompletedAt: new Date().toISOString()
      } satisfies ServerScanState)

      if (hadCompletedScan && newSitesFound.length > 0) {
        await sendNewSitesFoundReport({
          name: server.name,
          hostname: server.hostname
        }, newSitesFound)
      }
    } catch (error) {
      console.error(`[serverScan] Post-scan reporting failed for ${server.id}:`, error)
    }

    sendEvent('complete', `Scan completed: ${successCount} successful, ${failedCount} failed`, { success: successCount, failed: failedCount })
    return { success: successCount, failed: failedCount }
  } catch (err: any) {
    sendEvent('error', `Scan error: ${err.message}`)
    sendEvent('complete', 'Scan failed', { success: 0, failed: 1 })
    return { success: 0, failed: 1 }
  } finally {
    ssh.disconnect()
  }
}

export async function runServerScanById(serverId: string): Promise<ServerScanResult> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: {
      id: true,
      name: true,
      hostname: true,
      sshPort: true,
      sshPrivateKey: true,
      serverType: true
    }
  })

  if (!server) {
    throw createError({
      statusCode: 404,
      message: 'Server not found'
    })
  }

  return runServerScan(server)
}

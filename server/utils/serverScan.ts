import { prisma } from '#server/utils/db'
import { openSshConnection, type SshConnection } from '#server/utils/ssh'
import { broadcastScanEvent, type BroadcastEvent } from '#server/utils/scanBroadcast'
import { getOrCreateMonitoringConfig } from '#server/utils/monitoring'

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
    const monitoringConfig = await getOrCreateMonitoringConfig()
    const defaultNewSiteLevel = monitoringConfig.defaultNewSiteLevel

    sendEvent('log', `Starting scan on ${server.name}...`)

    const searchPaths = server.serverType === 'CPANEL_WHM'
      ? '/home*/'
      : '/var/www/vhosts/'

    sendEvent('log', `Searching for WordPress installations in ${searchPaths}...`)

    const findCmd = `find ${searchPaths} -xdev \\( -type d \\( -name ".*" -o -name "cache" -o -name "node_modules" -o -name "vendor" -o -name "tmp" -o -name "logs" \\) -prune \\) -o -name "wp-config.php" -type f -print`
    const findResult = await ssh.exec(findCmd, { timeoutMs: 120000 })

    if (findResult.code !== 0 && !findResult.stdout) {
      sendEvent('error', `Failed to search for WordPress installations: ${findResult.stderr}`)
      sendEvent('complete', 'Scan failed', { success: 0, failed: 1 })
      return { success: 0, failed: 1 }
    }

    const wpConfigPaths = findResult.stdout.trim().split('\n').filter(Boolean)
    sendEvent('log', `Found ${wpConfigPaths.length} potential WordPress installations`)

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

    sendEvent('log', `${validInstallations.length} valid WordPress installations found`)
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
      sendEvent('log', 'Detecting latest PHP version for Plesk...')
      const detectPhpCmd = 'ls -1 /opt/plesk/php/ 2>/dev/null | sort -V | tail -1'
      const phpVersionResult = await ssh.exec(detectPhpCmd, { timeoutMs: 10000 })
      const latestPhpVersion = phpVersionResult.stdout.trim()

      if (latestPhpVersion) {
        phpBinary = `/opt/plesk/php/${latestPhpVersion}/bin/php`
        sendEvent('log', `Using PHP binary: ${phpBinary}`)
      } else {
        sendEvent('error', 'Could not detect Plesk PHP version, falling back to system php')
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
            phpVersion,
            phpMemoryLimit,
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
            phpVersion,
            phpMemoryLimit,
            lastScanAt: new Date(),
            monitoringLevel: defaultNewSiteLevel
          }
        })

        sendEvent('log', `Getting plugins for ${siteTitle}...`)
        const pluginsCmd = `su - ${unixUser} -s /bin/bash -c 'cd "${wpDir}" && ${phpBinary} /opt/mhost-cli/wp-cli.phar plugin list --format=json --fields=name,title,status,update,version,update_version,auto_update --skip-plugins --skip-themes 2>/dev/null'`
        try {
          const pluginsResult = await session.exec(pluginsCmd, { timeoutMs: 60000 })
          const plugins = JSON.parse(pluginsResult.stdout.trim() || '[]')

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

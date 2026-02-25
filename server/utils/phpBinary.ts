import { prisma } from '#server/utils/db'
import { execSshCommandByServerId } from '#server/utils/ssh'

export type PhpBinaryResult = {
  binary: string
  detected: boolean
}

/**
 * Detects the PHP binary path for a given server based on its type.
 * - For Plesk servers: detects the latest PHP version in /opt/plesk/php/
 * - For cPanel servers: uses /usr/local/bin/php
 * - Fallback: uses 'php' (system default)
 */
export async function detectPhpBinary(serverId: string): Promise<PhpBinaryResult> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { serverType: true }
  })

  if (!server) {
    return { binary: 'php', detected: false }
  }

  if (server.serverType === 'PLESK') {
    const detectPhpCmd = `ls -1 /opt/plesk/php/ 2>/dev/null | sort -V | tail -1`
    const result = await execSshCommandByServerId(serverId, detectPhpCmd, { timeoutMs: 10_000 })
    const latestPhpVersion = result.stdout.trim()

    if (latestPhpVersion && result.code === 0) {
      return {
        binary: `/opt/plesk/php/${latestPhpVersion}/bin/php`,
        detected: true
      }
    }

    return { binary: 'php', detected: false }
  }

  if (server.serverType === 'CPANEL_WHM') {
    return { binary: '/usr/local/bin/php', detected: true }
  }

  return { binary: 'php', detected: false }
}

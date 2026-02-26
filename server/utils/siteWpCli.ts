import type { SshExecResult } from '#server/utils/ssh'
import { execSshCommandByServerId } from '#server/utils/ssh'
import { prisma } from '#server/utils/db'
import { detectPhpBinary } from '#server/utils/phpBinary'

export type SiteInstallationContext = {
  id: string
  serverId: string
  unixUsername: string
  installationPath: string
  autoLoginUser: string | null
}

const ensuredWpCliServers = new Set<string>()
const wpCliEnsureInFlight = new Map<string, Promise<void>>()

export async function getSiteInstallationContext(installationId: string): Promise<SiteInstallationContext | null> {
  return await prisma.wordPressInstallation.findUnique({
    where: { id: installationId },
    select: {
      id: true,
      serverId: true,
      unixUsername: true,
      installationPath: true,
      autoLoginUser: true
    }
  })
}

export async function ensureWpCliOnServer(serverId: string): Promise<void> {
  if (ensuredWpCliServers.has(serverId)) {
    return
  }

  const existing = wpCliEnsureInFlight.get(serverId)
  if (existing) {
    await existing
    return
  }

  const promise = (async () => {
    const ensureCmd = `
      mkdir -p /opt/mhost-cli && \
      if [ ! -f /opt/mhost-cli/wp-cli.phar ] || [ $(find /opt/mhost-cli/wp-cli.phar -mtime +14 2>/dev/null | wc -l) -gt 0 ]; then
        curl -sS -o /opt/mhost-cli/wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && \
        chmod +x /opt/mhost-cli/wp-cli.phar
      fi
    `.trim()

    const result = await execSshCommandByServerId(serverId, ensureCmd, { timeoutMs: 120_000 })
    if (result.code !== 0) {
      throw new Error(`Failed to ensure wp-cli is available: ${trimWpCliError(result.stderr || result.stdout)}`)
    }

    ensuredWpCliServers.add(serverId)
  })()

  wpCliEnsureInFlight.set(serverId, promise)

  try {
    await promise
  } finally {
    wpCliEnsureInFlight.delete(serverId)
  }
}

export type RunWpCliOptions = {
  allowFailure?: boolean
  timeoutMs?: number
  skipPlugins?: boolean
  skipThemes?: boolean
}

export async function runWpCliCommand(
  installation: SiteInstallationContext,
  args: string[],
  opts?: RunWpCliOptions
): Promise<SshExecResult> {
  const username = installation.unixUsername.trim()
  if (!/^[a-z_][a-z0-9._-]*[$]?$/i.test(username)) {
    throw new Error(`Invalid unix username "${installation.unixUsername}"`)
  }

  const phpResult = await detectPhpBinary(installation.serverId)
  const commandArgs = [...args]

  if (opts?.skipPlugins !== false) {
    commandArgs.push('--skip-plugins')
  }
  if (opts?.skipThemes !== false) {
    commandArgs.push('--skip-themes')
  }

  const command = [
    phpResult.binary,
    '/opt/mhost-cli/wp-cli.phar',
    ...commandArgs
  ].map(shellEscape).join(' ')

  const wrapped = `cd ${shellEscape(installation.installationPath)} && ${command}`
  const fullCommand = `su - ${username} -s /bin/bash -c ${shellEscape(wrapped)}`

  const result = await execSshCommandByServerId(
    installation.serverId,
    fullCommand,
    { timeoutMs: opts?.timeoutMs ?? 180_000 }
  )

  if (!opts?.allowFailure && result.code !== 0) {
    throw new Error(trimWpCliError(result.stderr || result.stdout))
  }

  return result
}

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

export function trimWpCliError(message: string): string {
  return message.trim().split('\n').filter(Boolean)[0] || 'Unknown error'
}

export function extractFirstUrl(raw: string): string | null {
  const match = raw.match(/https?:\/\/[^\s]+/i)
  return match ? match[0] : null
}

export function toPhpStringLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

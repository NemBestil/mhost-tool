import { access } from 'node:fs/promises'
import { posix, resolve } from 'node:path'
import { prisma } from '#server/utils/db'
import { detectPhpBinary } from '#server/utils/phpBinary'
import { execSshCommandByServerId, uploadFileToServerByServerId } from '#server/utils/ssh'
import { normalizeCustomFileRelativePath } from '#server/utils/customFiles'
import { ensureWpCliOnServer, shellEscape } from '#server/utils/siteWpCli'

export type CustomFileJobInput = {
  installationId: string
  customFileId: string
}

export type CustomFileOperationResult = {
  status: 'success' | 'failed' | 'skipped'
  message: string
}

type InstallationContext = {
  id: string
  serverId: string
  unixUsername: string
  installationPath: string
}

export async function executeCustomFileDeployment(input: CustomFileJobInput): Promise<CustomFileOperationResult> {
  const [installation, customFile] = await Promise.all([
    prisma.wordPressInstallation.findUnique({
      where: { id: input.installationId },
      select: {
        id: true,
        serverId: true,
        unixUsername: true,
        installationPath: true
      }
    }),
    prisma.customFile.findUnique({
      where: { id: input.customFileId },
      select: {
        id: true,
        originalFilename: true,
        storagePath: true,
        relativePath: true
      }
    })
  ])

  if (!installation) {
    return {
      status: 'failed',
      message: `Site not found: ${input.installationId}`
    }
  }

  if (!customFile) {
    return {
      status: 'failed',
      message: `Custom file not found: ${input.customFileId}`
    }
  }

  try {
    const relativePath = normalizeCustomFileRelativePath(customFile.relativePath)
    const localPath = resolve(process.cwd(), customFile.storagePath)
    await access(localPath)
    const groupId = await resolveInstallationGroupId(installation)

    const remoteTargetPath = posix.join(installation.installationPath, relativePath)
    await ensureRemoteDirectory(installation, posix.dirname(remoteTargetPath), groupId)
    await uploadFileToServerByServerId(installation.serverId, localPath, remoteTargetPath)
    await finalizeRemoteFile(installation, remoteTargetPath, groupId)

    if (relativePath.toLowerCase().endsWith('.po')) {
      await generateMoFile(installation, remoteTargetPath)
    }

    await prisma.customFileDeployment.upsert({
      where: {
        customFileId_installationId: {
          customFileId: customFile.id,
          installationId: installation.id
        }
      },
      update: {
        deployedAt: new Date(),
        deployedRelativePath: relativePath
      },
      create: {
        customFileId: customFile.id,
        installationId: installation.id,
        deployedRelativePath: relativePath
      }
    })

    return {
      status: 'success',
      message: `Uploaded "${customFile.originalFilename}" to ${relativePath}`
    }
  } catch (error: any) {
    return {
      status: 'failed',
      message: error?.message || `Failed to upload "${customFile.originalFilename}"`
    }
  }
}

async function generateMoFile(installation: InstallationContext, remoteTargetPath: string): Promise<void> {
  const username = assertUnixUsername(installation.unixUsername)
  await ensureWpCliOnServer(installation.serverId)

  const phpResult = await detectPhpBinary(installation.serverId)
  const remoteDirectory = posix.dirname(remoteTargetPath)
  const remoteFilename = posix.basename(remoteTargetPath)
  const command = [
    'cd', shellEscape(remoteDirectory), '&&',
    phpResult.binary,
    '/opt/mhost-cli/wp-cli.phar',
    'i18n',
    'make-mo',
    shellEscape(remoteFilename)
  ].join(' ')

  const wrapped = `su - ${username} -s /bin/bash -c ${shellEscape(command)}`
  const result = await execSshCommandByServerId(installation.serverId, wrapped, { timeoutMs: 120_000 })

  if (result.code !== 0) {
    throw new Error((result.stderr || result.stdout || `Failed to generate .mo file for ${remoteFilename}`).trim())
  }
}

async function ensureRemoteDirectory(
  installation: InstallationContext,
  remoteDirectory: string,
  groupId: string
): Promise<void> {
  const username = assertUnixUsername(installation.unixUsername)
  const command = [
    'install -d',
    '-o', username,
    '-g', groupId,
    shellEscape(remoteDirectory)
  ].join(' ')

  const result = await execSshCommandByServerId(installation.serverId, command, { timeoutMs: 120_000 })
  if (result.code !== 0) {
    throw new Error((result.stderr || result.stdout || 'Failed to create remote directory').trim())
  }
}

async function finalizeRemoteFile(
  installation: InstallationContext,
  remoteTargetPath: string,
  groupId: string
): Promise<void> {
  const username = assertUnixUsername(installation.unixUsername)
  const command = [
    `chown ${username}:${groupId} ${shellEscape(remoteTargetPath)}`,
    `chmod 0644 ${shellEscape(remoteTargetPath)}`
  ].join(' && ')

  const result = await execSshCommandByServerId(installation.serverId, command, { timeoutMs: 120_000 })
  if (result.code !== 0) {
    throw new Error((result.stderr || result.stdout || 'Failed to finalize uploaded file').trim())
  }
}

async function resolveInstallationGroupId(installation: InstallationContext): Promise<string> {
  const command = `stat -c '%g' ${shellEscape(installation.installationPath)}`
  const result = await execSshCommandByServerId(installation.serverId, command, { timeoutMs: 30_000 })

  if (result.code !== 0) {
    throw new Error((result.stderr || result.stdout || 'Failed to resolve installation group').trim())
  }

  const groupId = result.stdout.trim()
  if (!/^\d+$/.test(groupId)) {
    throw new Error(`Invalid installation group id "${groupId}"`)
  }

  return groupId
}

function assertUnixUsername(username: string): string {
  const trimmed = username.trim()
  if (!/^[a-z_][a-z0-9._-]*[$]?$/i.test(trimmed)) {
    throw new Error(`Invalid unix username "${username}"`)
  }

  return trimmed
}

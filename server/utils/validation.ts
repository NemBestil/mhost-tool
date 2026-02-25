import { ServerType } from '@@/prisma/generated/client'
import { execSshCommand } from '#server/utils/ssh'

export type ServerBody = {
  name?: string
  hostname?: string
  sshPort?: string
  sshPrivateKey?: string
  serverType?: string
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export function throwValidationError(fieldErrors: Record<string, string>) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Validation error',
    message: 'Validation error',
    data: {
      fieldErrors,
    },
  })
}

export async function validateServerPayload(body: ServerBody, isUpdate = false) {
  const fieldErrors: Record<string, string> = {}

  if (!isNonEmptyString(body.name) || body.name.trim().length < 2) {
    fieldErrors.name = 'Name is required (min 2 characters).'
  }

  if (!isNonEmptyString(body.hostname)) {
    fieldErrors.hostname = 'Hostname is required.'
  }

  const sshPort = Number(body.sshPort)
  if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
    fieldErrors.sshPort = 'SSH port must be an integer between 1 and 65535.'
  }

  if (!isNonEmptyString(body.sshPrivateKey) && !isUpdate) {
    fieldErrors.sshPrivateKey = 'SSH private key is required.'
  }

  const serverType = body.serverType
  if (!serverType || !Object.values(ServerType).includes(serverType as ServerType)) {
    fieldErrors.serverType = 'Server type is required.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    throwValidationError(fieldErrors)
  }

  const hostname = body.hostname!.trim()
  const privateKey = body.sshPrivateKey?.trim()

  if (privateKey) {
    try {
      const res = await execSshCommand(
        {
          host: hostname,
          port: sshPort,
          privateKey,
          username: 'root',
        },
        'whoami',
        { timeoutMs: 5000 },
      )

      const who = res.stdout.trim()
      if (res.code !== 0 || who !== 'root') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Validation error',
          message: 'SSH validation failed',
          data: {
            ssh: `Expected whoami to return \"root\" but got \"${who || 'n/a'}\" (exit ${res.code ?? 'n/a'})`,
            stderr: res.stderr,
          },
        })
      }
    } catch (e: any) {
      if (e?.statusCode === 400) {
        // Already a formatted validation error above
        throw e
      }
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        message: 'SSH validation failed',
        data: {
          ssh: e?.message || 'Unable to establish SSH connection to the server',
        },
      })
    }
  }

  return {
    name: body.name!.trim(),
    hostname,
    sshPort,
    sshPrivateKey: privateKey || undefined,
    serverType: serverType as ServerType,
  }
}

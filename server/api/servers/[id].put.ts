import { prisma } from '#server/utils/db'
import { validateServerPayload, type ServerBody } from '#server/utils/validation'

type UpdateServerBody = ServerBody

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id', message: 'Missing id' })
  }

  const body = (await readBody(event)) as UpdateServerBody
  
  // Fetch existing server to compare hostname/sshPort and get the key if needed
  const existingServer = await prisma.server.findUnique({
    where: { id },
    select: {
      hostname: true,
      sshPort: true,
      sshPrivateKey: true,
    },
  })

  if (!existingServer) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Server not found' })
  }

  // If hostname or sshPort changed, but no new key is provided, we need the existing key for validation
  const hostnameChanged = body.hostname !== undefined && body.hostname !== existingServer.hostname
  const sshPortChanged = body.sshPort !== undefined && Number(body.sshPort) !== existingServer.sshPort
  
  if ((hostnameChanged || sshPortChanged) && !body.sshPrivateKey) {
    body.sshPrivateKey = existingServer.sshPrivateKey
  }

  const { name, hostname, sshPort, sshPrivateKey: validatedSshPrivateKey, serverType } = await validateServerPayload(body, true)

  try {
    const data: any = {
      name,
      hostname,
      sshPort,
      serverType,
    }

    // Only update the key in DB if a NEW key was provided in the original request
    if (body.sshPrivateKey && body.sshPrivateKey !== existingServer.sshPrivateKey) {
      data.sshPrivateKey = validatedSshPrivateKey
      data.sshIsValid = true
    } else if (hostnameChanged || sshPortChanged) {
      // If hostname/port changed, it was validated with existing key, so we mark it as valid
      data.sshIsValid = true
    }

    const server = await prisma.server.update({
      where: { id },
      data,
    })

    return server
  } catch (e: any) {
    // P2025 = record not found
    if (e?.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Server not found' })
    }
    throw e
  }
})

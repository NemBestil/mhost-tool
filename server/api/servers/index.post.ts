import { prisma } from '#server/utils/db'
import { validateServerPayload, type ServerBody } from '#server/utils/validation'

type CreateServerBody = ServerBody

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as CreateServerBody
  const { name, hostname, sshPort, sshPrivateKey, serverType } = await validateServerPayload(body)

  const server = await prisma.server.create({
    data: {
      name,
      hostname,
      sshPort,
      sshPrivateKey: sshPrivateKey!,
      serverType,
      sshIsValid: true
    },
  })

  return server
})

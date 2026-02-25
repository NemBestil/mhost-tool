import { prisma } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id', message: 'Missing id' })
  }

  const server = await prisma.server.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      hostname: true,
      sshPort: true,
      serverType: true
    },
  })

  if (!server) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Server not found' })
  }

  return server
})

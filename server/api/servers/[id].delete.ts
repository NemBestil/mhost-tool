import { prisma } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id', message: 'Missing id' })
  }

  try {
    await prisma.server.delete({
      where: { id },
    })
    return { ok: true }
  } catch (e: any) {
    // P2025 = record not found
    if (e?.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Server not found' })
    }
    throw e
  }
})

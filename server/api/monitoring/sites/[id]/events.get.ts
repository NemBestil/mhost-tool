import { prisma } from '#server/utils/db'
import { z } from 'zod'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing id',
      message: 'Missing id'
    })
  }

  const query = querySchema.parse(getQuery(event))

  const events = await prisma.monitoringEvent.findMany({
    where: {
      installationId: id
    },
    orderBy: {
      occurredAt: 'desc'
    },
    take: query.limit
  })

  return {
    events
  }
})

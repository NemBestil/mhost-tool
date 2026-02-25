import { MonitoringLevel } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { z } from 'zod'

const bodySchema = z.object({
  monitoringLevel: z.enum(MonitoringLevel)
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

  const body = bodySchema.parse(await readBody(event))

  try {
    const site = await prisma.wordPressInstallation.update({
      where: { id },
      data: {
        monitoringLevel: body.monitoringLevel
      },
      select: {
        id: true,
        monitoringLevel: true
      }
    })

    return site
  } catch (error: any) {
    if (error?.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not found',
        message: 'Site not found'
      })
    }
    throw error
  }
})

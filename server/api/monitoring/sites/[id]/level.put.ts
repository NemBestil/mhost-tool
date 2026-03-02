import { MonitoringLevel, MonitoringStatus } from '@@/prisma/generated/client'
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
  const resetMonitoringState = body.monitoringLevel === MonitoringLevel.NONE

  try {
    const site = await prisma.wordPressInstallation.update({
      where: { id },
      data: {
        monitoringLevel: body.monitoringLevel,
        ...(resetMonitoringState
          ? {
              monitoringStatus: MonitoringStatus.UNKNOWN,
              monitoringCurrentStatusSince: null,
              monitoringFailedAttempts: 0
            }
          : {})
      },
      select: {
        id: true,
        monitoringLevel: true,
        monitoringStatus: true,
        monitoringCurrentStatusSince: true,
        monitoringFailedAttempts: true
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

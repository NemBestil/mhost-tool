import { MonitoringLevel, MonitoringStatus } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { z } from 'zod'

const bodySchema = z.object({
  siteIds: z.array(z.string()).min(1, 'At least one site ID is required'),
  monitoringLevel: z.enum(MonitoringLevel)
})

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))
  const resetMonitoringState = body.monitoringLevel === MonitoringLevel.NONE

  const result = await prisma.wordPressInstallation.updateMany({
    where: {
      id: {
        in: body.siteIds
      }
    },
    data: {
      monitoringLevel: body.monitoringLevel,
      ...(resetMonitoringState
        ? {
            monitoringStatus: MonitoringStatus.UNKNOWN,
            monitoringCurrentStatusSince: null,
            monitoringFailedAttempts: 0
          }
        : {})
    }
  })

  return {
    updated: result.count,
    monitoringLevel: body.monitoringLevel
  }
})

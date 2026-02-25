import { MonitoringLevel } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { z } from 'zod'

const bodySchema = z.object({
  siteIds: z.array(z.string()).min(1, 'At least one site ID is required'),
  monitoringLevel: z.enum(MonitoringLevel)
})

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))

  const result = await prisma.wordPressInstallation.updateMany({
    where: {
      id: {
        in: body.siteIds
      }
    },
    data: {
      monitoringLevel: body.monitoringLevel
    }
  })

  return {
    updated: result.count,
    monitoringLevel: body.monitoringLevel
  }
})

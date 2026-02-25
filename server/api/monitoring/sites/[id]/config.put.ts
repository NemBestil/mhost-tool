import { prisma } from '#server/utils/db'
import { z } from 'zod'

const bodySchema = z.object({
  monitoringTestWpLogin: z.boolean(),
  monitoringFrontpageStatusMin: z.number().int().min(100).max(599),
  monitoringFrontpageStatusMax: z.number().int().min(100).max(599)
}).refine((value) => value.monitoringFrontpageStatusMin <= value.monitoringFrontpageStatusMax, {
  message: 'Frontpage status min must be less than or equal to max.',
  path: ['monitoringFrontpageStatusMin']
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
    return await prisma.wordPressInstallation.update({
      where: { id },
      data: {
        monitoringTestWpLogin: body.monitoringTestWpLogin,
        monitoringFrontpageStatusMin: body.monitoringFrontpageStatusMin,
        monitoringFrontpageStatusMax: body.monitoringFrontpageStatusMax
      },
      select: {
        id: true,
        monitoringTestWpLogin: true,
        monitoringFrontpageStatusMin: true,
        monitoringFrontpageStatusMax: true
      }
    })
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

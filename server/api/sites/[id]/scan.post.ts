import { runSiteScanById } from '#server/utils/serverScan'
import { broadcastScanEvent } from '#server/utils/scanBroadcast'
import { prisma } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Site id is required'
    })
  }

  const installation = await prisma.wordPressInstallation.findUnique({
    where: { id },
    select: { serverId: true }
  })

  if (!installation) {
    throw createError({
      statusCode: 404,
      message: 'Site not found'
    })
  }

  setResponseStatus(event, 202)

  void runSiteScanById(id).catch((err: any) => {
    console.error('Site scan error:', err)
    broadcastScanEvent({
      channel: 'scan',
      type: 'error',
      message: `Site scan error: ${err.message}`,
      serverId: installation.serverId
    })
    broadcastScanEvent({
      channel: 'scan',
      type: 'complete',
      message: 'Site scan failed',
      serverId: installation.serverId,
      data: { success: 0, failed: 1 }
    })
  })

  return { status: 'started', siteId: id, serverId: installation.serverId }
})

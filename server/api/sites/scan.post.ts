import { runServerScanById } from '#server/utils/serverScan'
import { broadcastScanEvent } from '#server/utils/scanBroadcast'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const serverId = body?.serverId as string

  if (!serverId) {
    throw createError({
      statusCode: 400,
      message: 'serverId is required'
    })
  }

  setResponseStatus(event, 202)

  void runServerScanById(serverId).catch((err: any) => {
    console.error('Scan error:', err)
    broadcastScanEvent({
      channel: 'scan',
      type: 'error',
      message: `Scan error: ${err.message}`,
      serverId
    })
    broadcastScanEvent({
      channel: 'scan',
      type: 'complete',
      message: 'Scan failed',
      serverId,
      data: { success: 0, failed: 1 }
    })
  })

  return { status: 'started', serverId }
})

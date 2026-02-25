import { z } from 'zod'

const bodySchema = z.object({
  token: z.string().trim().min(1),
  userKey: z.string().trim().min(1)
})

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))

  try {
    const response = await $fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      body: {
        token: body.token,
        user: body.userKey,
        message: 'This is a test notification from your WordPress Management tool.',
        title: 'Test Notification'
      }
    })

    return { success: true, data: response }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Pushover Error',
      message: error.data?.errors?.[0] || error.message || 'Failed to send Pushover notification'
    })
  }
})

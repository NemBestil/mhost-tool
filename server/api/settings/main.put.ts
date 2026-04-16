import { setOption } from '#server/utils/db'
import { normalizeSetupSettings, SETUP_OPTION_KEY } from '#server/utils/setup'
import { z } from 'zod'

const bodySchema = z.object({
  features: z.object({
    wpMailSmtpPro: z.boolean(),
    wpRocketCache: z.boolean()
  }),
  developmentSites: z.string().optional().default('')
})

export default defineEventHandler(async (event) => {
  const parsedBody = bodySchema.safeParse(await readBody(event))

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'Validation error'
    })
  }

  const settings = normalizeSetupSettings(parsedBody.data)

  await setOption(SETUP_OPTION_KEY, settings)

  return settings
})

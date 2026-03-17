import { setOption } from '#server/utils/db'
import { normalizeSmtpSettings, isValidSmtpSettings, SMTP_AUTH_METHODS, SMTP_OPTION_KEY } from '#server/utils/smtp'
import { z } from 'zod'

const bodySchema = z.object({
  smtp: z.object({
    host: z.string().trim().min(1),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    authMethod: z.enum(SMTP_AUTH_METHODS).optional().default('PLAIN'),
    authUser: z.string().trim().min(1),
    authPass: z.string().min(1),
    fromName: z.string().trim().min(1),
    fromEmail: z.string().trim().email()
  })
})

export default defineEventHandler(async (event) => {
  const parsedBody = bodySchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    const fieldErrors: Record<string, string> = {}

    for (const issue of parsedBody.error.issues) {
      const [scope, field] = issue.path
      if (scope === 'smtp' && typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }

    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'Validation error',
      data: {
        fieldErrors
      }
    })
  }

  const body = parsedBody.data
  const smtp = normalizeSmtpSettings(body.smtp)

  if (!isValidSmtpSettings(smtp)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'SMTP configuration is invalid.'
    })
  }

  await setOption(SMTP_OPTION_KEY, smtp)

  return {
    smtp,
    smtpConfigured: true
  }
})

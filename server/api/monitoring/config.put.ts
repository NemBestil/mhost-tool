import {
  MonitoringCriticality,
  MonitoringLevel,
  MonitoringNotificationType
} from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { readMonitoringConfig } from '#server/utils/monitoring'
import { getSmtpSettings, isValidSmtpSettings } from '#server/utils/smtp'
import { z } from 'zod'

const emailTargetSchema = z.object({
  email: z.string().trim().email(),
  minAttempts: z.number().int().min(1)
})

const pushoverTargetSchema = z.object({
  token: z.string().trim().min(1),
  userKey: z.string().trim().min(1),
  minAttempts: z.number().int().min(1),
  criticality: z.nativeEnum(MonitoringCriticality)
})

const webhookTargetSchema = z.object({
  url: z.string().trim().url(),
  minAttempts: z.number().int().min(1)
})

const bodySchema = z.object({
  defaultNewSiteLevel: z.nativeEnum(MonitoringLevel),
  emails: z.array(emailTargetSchema),
  pushoverTokens: z.array(pushoverTargetSchema),
  webhooks: z.array(webhookTargetSchema)
})

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))
  const smtpSettings = await getSmtpSettings()

  if (body.emails.length > 0 && !isValidSmtpSettings(smtpSettings)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      message: 'Configure valid SMTP settings before enabling e-mail notifications.'
    })
  }

  const emailKeys = new Set<string>()
  for (const emailEntry of body.emails) {
    const key = emailEntry.email.toLowerCase()
    if (emailKeys.has(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        message: `Duplicate e-mail address: ${emailEntry.email}`
      })
    }
    emailKeys.add(key)
  }

  const tokenKeys = new Set<string>()
  for (const tokenEntry of body.pushoverTokens) {
    const compositeKey = `${tokenEntry.token}:${tokenEntry.userKey}`
    if (tokenKeys.has(compositeKey)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        message: 'Duplicate pushover token and user key combination.'
      })
    }
    tokenKeys.add(compositeKey)
  }

  const webhookKeys = new Set<string>()
  for (const webhookEntry of body.webhooks) {
    if (webhookKeys.has(webhookEntry.url)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation error',
        message: 'Duplicate webhook URL.'
      })
    }
    webhookKeys.add(webhookEntry.url)
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.monitoringConfig.upsert({
      where: { id: 1 },
      update: {
        defaultNewSiteLevel: body.defaultNewSiteLevel
      },
      create: {
        id: 1,
        defaultNewSiteLevel: body.defaultNewSiteLevel
      }
    })

    await tx.monitoringNotificationTarget.deleteMany({
      where: { configId: 1 }
    })

    for (const emailEntry of body.emails) {
      await tx.monitoringNotificationTarget.create({
        data: {
          configId: 1,
          type: MonitoringNotificationType.EMAIL,
          value: emailEntry.email,
          minAttempts: emailEntry.minAttempts
        }
      })
    }

    for (const tokenEntry of body.pushoverTokens) {
      await tx.monitoringNotificationTarget.create({
        data: {
          configId: 1,
          type: MonitoringNotificationType.PUSHOVER,
          value: tokenEntry.token,
          pushoverUserKey: tokenEntry.userKey,
          minAttempts: tokenEntry.minAttempts,
          criticality: tokenEntry.criticality
        }
      })
    }

    for (const webhookEntry of body.webhooks) {
      await tx.monitoringNotificationTarget.create({
        data: {
          configId: 1,
          type: MonitoringNotificationType.WEBHOOK,
          value: webhookEntry.url,
          minAttempts: webhookEntry.minAttempts
        }
      })
    }

    return readMonitoringConfig(tx)
  })

  return result
})

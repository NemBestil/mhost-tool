import { MonitoringCriticality, MonitoringLevel, MonitoringNotificationType, type Prisma } from '@@/prisma/generated/client'
import { prisma } from '#server/utils/db'
import { getSmtpSettings, isValidSmtpSettings } from '#server/utils/smtp'

export type MonitoringConfigResponse = {
  defaultNewSiteLevel: MonitoringLevel
  smtpConfigured: boolean
  emails: {
    id: string
    email: string
    minAttempts: number
    notifyOnUp: boolean
    priorities: MonitoringLevel[]
  }[]
  pushoverTokens: {
    id: string
    token: string
    userKey: string | null
    minAttempts: number
    criticality: MonitoringCriticality
  }[]
  webhooks: {
    id: string
    url: string
    minAttempts: number
  }[]
}

export async function getOrCreateMonitoringConfig(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.monitoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      defaultNewSiteLevel: MonitoringLevel.NONE
    }
  })
}

export async function readMonitoringConfig(tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<MonitoringConfigResponse> {
  const config = await getOrCreateMonitoringConfig(tx)
  const smtpSettings = await getSmtpSettings()
  const targets = await tx.monitoringNotificationTarget.findMany({
    where: { configId: config.id },
    orderBy: { createdAt: 'asc' }
  })

  const emails = targets
    .filter(target => target.type === MonitoringNotificationType.EMAIL)
    .map(target => ({
      id: target.id,
      email: target.value,
      minAttempts: Math.max(1, target.minAttempts),
      notifyOnUp: target.emailNotifyOnUp,
      priorities: [
        ...(target.emailNotifyHigh ? [MonitoringLevel.HIGH] : []),
        ...(target.emailNotifyNormal ? [MonitoringLevel.NORMAL] : [])
      ]
    }))

  const pushoverTokens = targets
    .filter(target => target.type === MonitoringNotificationType.PUSHOVER)
    .map(target => ({
      id: target.id,
      token: target.value,
      userKey: target.pushoverUserKey,
      minAttempts: Math.max(1, target.minAttempts),
      criticality: target.criticality ?? MonitoringCriticality.NORMAL
    }))

  const webhooks = targets
    .filter(target => target.type === MonitoringNotificationType.WEBHOOK)
    .map(target => ({
      id: target.id,
      url: target.value,
      minAttempts: Math.max(1, target.minAttempts)
    }))

  return {
    defaultNewSiteLevel: config.defaultNewSiteLevel,
    smtpConfigured: isValidSmtpSettings(smtpSettings),
    emails,
    pushoverTokens,
    webhooks
  }
}

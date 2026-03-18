import { prisma } from '#server/utils/db'
import { enqueueWpRocketCacheJobs, type WpRocketCacheQueueJobInput } from '#server/utils/wpRocketCacheJobQueue'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobs = await normalizeJobs(body?.jobs)

  if (jobs.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid WP Rocket cache jobs were provided'
    })
  }

  return enqueueWpRocketCacheJobs(jobs)
})

async function normalizeJobs(input: unknown): Promise<WpRocketCacheQueueJobInput[]> {
  if (!Array.isArray(input)) {
    return []
  }

  const deduped = new Map<string, WpRocketCacheQueueJobInput>()

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') {
      continue
    }

    const item = raw as Record<string, unknown>
    const installationId = typeof item.installationId === 'string' ? item.installationId : ''

    if (!installationId || deduped.has(installationId)) {
      continue
    }

    deduped.set(installationId, { installationId })
  }

  const parsed = [...deduped.values()]
  const installations = await prisma.wordPressInstallation.findMany({
    where: {
      id: {
        in: parsed.map(job => job.installationId)
      }
    },
    select: {
      id: true,
      siteTitle: true
    }
  })

  const siteTitleById = new Map(installations.map(item => [item.id, item.siteTitle]))

  return parsed
    .filter(job => siteTitleById.has(job.installationId))
    .map(job => ({
      ...job,
      siteTitle: siteTitleById.get(job.installationId) || job.installationId
    }))
}

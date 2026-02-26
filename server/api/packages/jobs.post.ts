import {
  enqueuePackageJobs,
  type PackageQueueJobInput
} from '#server/utils/packageJobQueue'
import { prisma } from '#server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobs = await normalizeJobs(body?.jobs)

  if (jobs.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid package jobs were provided'
    })
  }

  return enqueuePackageJobs(jobs)
})

async function normalizeJobs(input: unknown): Promise<PackageQueueJobInput[]> {
  if (!Array.isArray(input)) {
    return []
  }

  const parsed = input
    .map((raw): PackageQueueJobInput | null => {
      if (!raw || typeof raw !== 'object') {
        return null
      }

      const item = raw as Record<string, unknown>
      const installationId = typeof item.installationId === 'string' ? item.installationId : ''
      const slug = typeof item.slug === 'string' ? item.slug : ''
      const kind = item.kind === 'plugin' || item.kind === 'theme' ? item.kind : null
      const operation = item.operation === 'update' || item.operation === 'install' || item.operation === 'install-activate'
        ? item.operation
        : null
      const source = item.source === 'wordpress.org' || item.source === 'external' ? item.source : undefined

      if (!installationId || !slug || !kind || !operation) {
        return null
      }

      return {
        installationId,
        slug,
        kind,
        operation,
        source
      }
    })
    .filter((job): job is PackageQueueJobInput => Boolean(job))

  const installationIds = [...new Set(parsed.map(job => job.installationId))]
  const installations = await prisma.wordPressInstallation.findMany({
    where: { id: { in: installationIds } },
    select: { id: true, siteTitle: true }
  })
  const siteTitleById = new Map(installations.map(item => [item.id, item.siteTitle]))

  return parsed.map(job => ({
    ...job,
    siteTitle: siteTitleById.get(job.installationId) || job.installationId
  }))
}

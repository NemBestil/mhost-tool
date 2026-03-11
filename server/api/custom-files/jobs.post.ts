import { prisma } from '#server/utils/db'
import { enqueueCustomFileJobs } from '#server/utils/customFileJobQueue'

type CustomFileJobInput = {
  installationId: string
  customFileId: string
  siteTitle?: string
  originalFilename?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobs = await normalizeJobs(body?.jobs)

  if (jobs.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No valid custom file jobs were provided'
    })
  }

  return enqueueCustomFileJobs(jobs)
})

async function normalizeJobs(input: unknown): Promise<CustomFileJobInput[]> {
  if (!Array.isArray(input)) {
    return []
  }

  const parsed = input
    .map((raw): CustomFileJobInput | null => {
      if (!raw || typeof raw !== 'object') {
        return null
      }

      const item = raw as Record<string, unknown>
      const installationId = typeof item.installationId === 'string' ? item.installationId : ''
      const customFileId = typeof item.customFileId === 'string' ? item.customFileId : ''

      if (!installationId || !customFileId) {
        return null
      }

      return {
        installationId,
        customFileId
      }
    })
    .filter((job): job is CustomFileJobInput => Boolean(job))

  const [installations, customFiles] = await Promise.all([
    prisma.wordPressInstallation.findMany({
      where: { id: { in: [...new Set(parsed.map(job => job.installationId))] } },
      select: { id: true, siteTitle: true }
    }),
    prisma.customFile.findMany({
      where: { id: { in: [...new Set(parsed.map(job => job.customFileId))] } },
      select: { id: true, originalFilename: true }
    })
  ])

  const siteTitleById = new Map(installations.map(item => [item.id, item.siteTitle]))
  const originalFilenameById = new Map(customFiles.map(item => [item.id, item.originalFilename]))

  return parsed
    .filter(job => siteTitleById.has(job.installationId) && originalFilenameById.has(job.customFileId))
    .map(job => ({
      ...job,
      siteTitle: siteTitleById.get(job.installationId) || job.installationId,
      originalFilename: originalFilenameById.get(job.customFileId) || job.customFileId
    }))
}

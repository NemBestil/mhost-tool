import { prisma } from '#server/utils/db'
import { z } from 'zod'

const bodySchema = z.object({
  siteIds: z.array(z.string()).min(1, 'At least one site ID is required')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { siteIds } = bodySchema.parse(body)

  // Delete the sites from the database
  // This only removes records from MHost, not the actual WordPress installations
  const result = await prisma.wordPressInstallation.deleteMany({
    where: {
      id: {
        in: siteIds
      }
    }
  })

  return {
    deleted: result.count,
    message: `${result.count} site(s) have been removed from MHost.`
  }
})

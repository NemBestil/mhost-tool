import { prisma } from '#server/utils/db'

export default defineEventHandler(async () => {
  const sites = await prisma.wordPressInstallation.findMany({
    include: {
      server: {
        select: {
          id: true,
          name: true,
          hostname: true,
          serverType: true
        }
      },
      _count: {
        select: {
          plugins: true,
          themes: true
        }
      }
    },
    orderBy: {
      siteUrl: 'asc'
    }
  })

  return sites
})

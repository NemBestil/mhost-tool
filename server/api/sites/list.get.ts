import { prisma } from '#server/utils/db'

export default defineEventHandler(async () => {
  const sites = await prisma.wordPressInstallation.findMany({
    include: {
      plugins: {
        where: { slug: { in: ['nembestil-core', 'nb-core'] } },
        select: { slug: true }
      },
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

  return sites.map(({ plugins, ...site }) => ({
    ...site,
    hasNbCore: plugins.length > 0
  }))
})

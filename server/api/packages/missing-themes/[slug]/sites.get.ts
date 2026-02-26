import { prisma } from '#server/utils/db'

type MissingSite = {
  installationId: string
  siteTitle: string
  siteUrl: string
  serverName: string
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Theme slug is required'
    })
  }

  const sites = await prisma.wordPressInstallation.findMany({
    where: {
      themes: {
        none: { slug }
      }
    },
    select: {
      id: true,
      siteTitle: true,
      siteUrl: true,
      server: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      siteTitle: 'asc'
    }
  })

  return {
    sites: sites.map((site): MissingSite => ({
      installationId: site.id,
      siteTitle: site.siteTitle,
      siteUrl: site.siteUrl,
      serverName: site.server.name
    }))
  }
})

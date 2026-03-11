import { prisma } from '#server/utils/db'

type SiteRow = {
  installationId: string
  siteTitle: string
  siteUrl: string
  serverName: string
  hasFile: boolean
  deployedAt: Date | null
  deployedRelativePath: string | null
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Custom file id is required'
    })
  }

  const customFile = await prisma.customFile.findUnique({
    where: { id },
    select: {
      id: true,
      originalFilename: true,
      relativePath: true
    }
  })

  if (!customFile) {
    throw createError({
      statusCode: 404,
      message: 'Custom file not found'
    })
  }

  const installations = await prisma.wordPressInstallation.findMany({
    select: {
      id: true,
      siteTitle: true,
      siteUrl: true,
      server: {
        select: {
          name: true
        }
      },
      customFileDeployments: {
        where: {
          customFileId: customFile.id
        },
        select: {
          deployedAt: true,
          deployedRelativePath: true
        }
      }
    },
    orderBy: {
      siteTitle: 'asc'
    }
  })

  const sites: SiteRow[] = installations.map((installation) => {
    const deployment = installation.customFileDeployments[0]

    return {
      installationId: installation.id,
      siteTitle: installation.siteTitle,
      siteUrl: installation.siteUrl,
      serverName: installation.server.name,
      hasFile: deployment?.deployedRelativePath === customFile.relativePath,
      deployedAt: deployment?.deployedAt ?? null,
      deployedRelativePath: deployment?.deployedRelativePath ?? null
    }
  })

  return {
    file: customFile,
    sites
  }
})

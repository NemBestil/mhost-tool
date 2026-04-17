import { prisma } from '#server/utils/db'

type SiteRow = {
  installationId: string
  siteTitle: string
  siteUrl: string
  serverName: string
  presentCount: number
  totalCount: number
  deployedAt: Date | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const fileIds = body?.fileIds
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Custom file ids are required'
    })
  }

  const customFiles = await prisma.customFile.findMany({
    where: { id: { in: fileIds } },
    select: {
      id: true,
      originalFilename: true,
      relativePath: true
    }
  })

  if (customFiles.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Custom files not found'
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
          customFileId: { in: customFiles.map(f => f.id) }
        },
        select: {
          customFileId: true,
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
    let presentCount = 0
    let latestDeployedAt: Date | null = null

    for (const customFile of customFiles) {
      const deployment = installation.customFileDeployments.find(d => d.customFileId === customFile.id)
      if (deployment && deployment.deployedRelativePath === customFile.relativePath) {
        presentCount++
      }
      
      if (deployment?.deployedAt) {
        if (!latestDeployedAt || deployment.deployedAt > latestDeployedAt) {
          latestDeployedAt = deployment.deployedAt
        }
      }
    }

    return {
      installationId: installation.id,
      siteTitle: installation.siteTitle,
      siteUrl: installation.siteUrl,
      serverName: installation.server.name,
      presentCount,
      totalCount: customFiles.length,
      deployedAt: latestDeployedAt
    }
  })

  return {
    files: customFiles,
    sites
  }
})

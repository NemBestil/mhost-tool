import { prisma } from '#server/utils/db'

export default defineEventHandler(async () => {
  const files = await prisma.customFile.findMany({
    include: {
      deployments: {
        select: {
          installationId: true,
          deployedRelativePath: true
        }
      }
    },
    orderBy: {
      uploadedAt: 'desc'
    }
  })

  return {
    files: files.map(file => {
      const currentDeploymentCount = file.deployments.filter(
        deployment => deployment.deployedRelativePath === file.relativePath
      ).length

      return {
        id: file.id,
        originalFilename: file.originalFilename,
        relativePath: file.relativePath,
        uploadedAt: file.uploadedAt,
        currentDeploymentCount,
        staleDeploymentCount: Math.max(0, file.deployments.length - currentDeploymentCount)
      }
    })
  }
})

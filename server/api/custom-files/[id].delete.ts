import { prisma } from '#server/utils/db'
import { deleteCustomFileStorage } from '#server/utils/customFiles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Custom file id is required'
    })
  }

  const file = await prisma.customFile.findUnique({
    where: { id },
    select: {
      id: true,
      storagePath: true,
      originalFilename: true
    }
  })

  if (!file) {
    throw createError({
      statusCode: 404,
      message: 'Custom file not found'
    })
  }

  await prisma.customFile.delete({
    where: { id }
  })

  await deleteCustomFileStorage(file.storagePath)

  return {
    id: file.id,
    originalFilename: file.originalFilename
  }
})

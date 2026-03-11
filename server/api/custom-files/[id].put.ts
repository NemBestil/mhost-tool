import { prisma } from '#server/utils/db'
import { normalizeCustomFileRelativePath } from '#server/utils/customFiles'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Custom file id is required'
    })
  }

  const body = await readBody(event)
  const rawRelativePath = typeof body?.relativePath === 'string' ? body.relativePath : ''

  let relativePath: string
  try {
    relativePath = normalizeCustomFileRelativePath(rawRelativePath)
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error?.message || 'Invalid relative path'
    })
  }

  const existing = await prisma.customFile.findUnique({
    where: { id },
    select: { id: true }
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Custom file not found'
    })
  }

  return prisma.customFile.update({
    where: { id },
    data: { relativePath },
    select: {
      id: true,
      relativePath: true,
      updatedAt: true
    }
  })
})

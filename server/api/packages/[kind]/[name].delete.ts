import { assertPackageKind, deleteArchiveFiles, getUploadedModel } from '#server/utils/uploadedPackages'

export default defineEventHandler(async (event) => {
  const kind = assertPackageKind(getRouterParam(event, 'kind'))
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Package name is required'
    })
  }

  const model = getUploadedModel(kind)
  const rows = await model.findMany({
    where: { name },
    select: { id: true, archivePath: true }
  })

  await deleteArchiveFiles(rows.map(row => row.archivePath))

  const result = await model.deleteMany({
    where: { name }
  })

  return {
    deleted: result.count
  }
})

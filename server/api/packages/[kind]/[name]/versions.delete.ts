import { assertPackageKind, deleteArchiveFiles, getUploadedModel } from '#server/utils/uploadedPackages'

export default defineEventHandler(async (event) => {
  const kind = assertPackageKind(getRouterParam(event, 'kind'))
  const name = getRouterParam(event, 'name')
  const body = await readBody(event)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : []

  if (!name) {
    throw createError({
      statusCode: 400,
      message: 'Package name is required'
    })
  }

  if (!ids.length) {
    throw createError({
      statusCode: 400,
      message: 'No version ids provided'
    })
  }

  const model = getUploadedModel(kind)
  const rows = await model.findMany({
    where: {
      name,
      id: { in: ids }
    },
    select: {
      id: true,
      archivePath: true
    }
  })

  await deleteArchiveFiles(rows.map(row => row.archivePath))

  const deleted = await model.deleteMany({
    where: {
      name,
      id: { in: rows.map(row => row.id) }
    }
  })

  return {
    deleted: deleted.count
  }
})

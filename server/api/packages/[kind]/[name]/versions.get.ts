import { assertPackageKind, getUploadedModel, sortByNewestVersionAndDate } from '#server/utils/uploadedPackages'

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
    orderBy: [{ uploadedAt: 'desc' }]
  })

  return {
    kind,
    name,
    versions: sortByNewestVersionAndDate(rows)
  }
})

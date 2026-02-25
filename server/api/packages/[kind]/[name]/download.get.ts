import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
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
  const id = getQuery(event).id as string | undefined

  let row
  if (id) {
    row = await model.findUnique({
      where: { id }
    })
  } else {
    const rows = await model.findMany({
      where: { name }
    })

    if (rows.length) {
      row = sortByNewestVersionAndDate(rows)[0]
    }
  }

  if (!row) {
    throw createError({
      statusCode: 404,
      message: 'Package version not found'
    })
  }

  const absolutePath = resolve(process.cwd(), row.archivePath)

  try {
    const fileStats = await stat(absolutePath)
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Length', String(fileStats.size))

    let downloadFilename = row.originalFilename
    if (downloadFilename.toLowerCase().endsWith('.zip')) {
      const base = downloadFilename.slice(0, -4)
      downloadFilename = `${base}-${row.version}.zip`
    } else {
      downloadFilename = `${downloadFilename}-${row.version}`
    }

    setHeader(event, 'Content-Disposition', contentDisposition(downloadFilename))
    return sendStream(event, createReadStream(absolutePath))
  } catch {
    throw createError({
      statusCode: 404,
      message: 'Archive file not found'
    })
  }
})

function contentDisposition(filename: string): string {
  const safeName = filename.replace(/"/g, '')
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

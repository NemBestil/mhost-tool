import { basename } from 'node:path'
import { prisma } from '#server/utils/db'
import {
  getDefaultRelativePath,
  MAX_CUSTOM_FILE_BYTES,
  persistCustomFileUpload
} from '#server/utils/customFiles'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form || form.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No files uploaded'
    })
  }

  const files = form.filter(part => part.filename && part.data)
  if (files.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No files uploaded'
    })
  }

  const uploaded = []

  for (const part of files) {
    const originalFilename = basename(part.filename || 'file')

    if (part.data.length > MAX_CUSTOM_FILE_BYTES) {
      throw createError({
        statusCode: 400,
        message: `${originalFilename} exceeds the 100MB limit`
      })
    }

    const storagePath = await persistCustomFileUpload(part.data, originalFilename)
    const record = await prisma.customFile.create({
      data: {
        originalFilename,
        storagePath,
        relativePath: getDefaultRelativePath(originalFilename)
      },
      select: {
        id: true,
        originalFilename: true,
        relativePath: true,
        uploadedAt: true
      }
    })

    uploaded.push(record)
  }

  return {
    count: uploaded.length,
    files: uploaded
  }
})

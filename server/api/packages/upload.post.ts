import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { prisma } from '#server/utils/db'
import { broadcastScanEvent } from '#server/utils/scanBroadcast'
import { detectWordPressPackage, toSafeSlug } from '#server/utils/wordpressPackage'
import { compareVersions } from '#server/utils/uploadedPackages'

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
const UPLOAD_ROOT = resolve(process.cwd(), 'uploads')

type UploadProgress = {
  total: number
  current: number
  success: number
  failed: number
  skipped: number
}

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

  const uploadId = randomUUID()
  const progress: UploadProgress = {
    total: files.length,
    current: 0,
    success: 0,
    failed: 0,
    skipped: 0
  }

  const sendEvent = (type: 'log' | 'progress' | 'error' | 'complete', message: string, data?: Record<string, unknown>) => {
    broadcastScanEvent({
      channel: 'upload',
      type,
      uploadId,
      message,
      data: {
        ...progress,
        ...data
      }
    })
  }

  sendEvent('log', `Starting upload for ${files.length} file(s)...`)
  sendEvent('progress', 'Upload started')

  for (const [index, file] of files.entries()) {
    const originalFilename = file.filename || `file-${index + 1}.zip`
    const tmpPath = join(tmpdir(), `nemwp-${uploadId}-${index}.zip`)

    try {
      if (file.data.length > MAX_UPLOAD_BYTES) {
        progress.failed++
        sendEvent('error', `${originalFilename}: exceeds 100MB limit`)
        continue
      }

      if (!isZipFile(originalFilename, file.data)) {
        progress.failed++
        sendEvent('error', `${originalFilename}: not a ZIP archive`)
        continue
      }

      await writeFile(tmpPath, file.data)
      const detected = await detectWordPressPackage(tmpPath)

      if (detected.kind === 'unknown') {
        progress.failed++
        sendEvent('error', `${originalFilename}: not a valid WordPress plugin/theme ZIP`)
        continue
      }

      if (detected.kind === 'plugin') {
        const exists = await prisma.uploadedWordPressPlugin.findFirst({
          where: {
            name: detected.slug,
            version: detected.version
          },
          select: { id: true }
        })

        if (exists) {
          progress.skipped++
          sendEvent('log', `${originalFilename}: skipped duplicate plugin (${detected.slug} ${detected.version})`, {
            fileName: originalFilename,
            packageType: 'plugin',
            result: 'skipped'
          })
          continue
        }

        // Check if there's a current latest version for this plugin
        const currentLatest = await prisma.uploadedWordPressPlugin.findFirst({
          where: {
            name: detected.slug,
            isLatest: true
          },
          select: { id: true, version: true }
        })

        // Determine if the new upload should be marked as latest
        let shouldBeLatest = true
        if (currentLatest) {
          // Compare versions: only set as latest if new version is higher
          if (compareVersions(detected.version, currentLatest.version) > 0) {
            // New version is higher, unset the current latest
            await prisma.uploadedWordPressPlugin.update({
              where: { id: currentLatest.id },
              data: { isLatest: false }
            })
          } else {
            // New version is not higher, don't mark as latest
            shouldBeLatest = false
          }
        }

        const archivePath = await persistArchive(file.data, 'plugins', detected.slug)
        const intendedFilename = `${detected.slug}.zip`

        await prisma.uploadedWordPressPlugin.create({
          data: {
            name: detected.slug,
            title: detected.title,
            slug: detected.slug,
            version: detected.version,
            archivePath,
            originalFilename: intendedFilename,
            uploadedAt: new Date(),
            isLatest: shouldBeLatest
          }
        })

        progress.success++
        sendEvent('log', `${originalFilename}: plugin uploaded (${detected.slug} ${detected.version})`, {
          fileName: intendedFilename,
          packageType: 'plugin',
          result: 'success'
        })
        continue
      }

      const exists = await prisma.uploadedWordPressTheme.findFirst({
        where: {
          name: detected.slug,
          version: detected.version
        },
        select: { id: true }
      })

      if (exists) {
        progress.skipped++
        sendEvent('log', `${originalFilename}: skipped duplicate theme (${detected.slug} ${detected.version})`, {
          fileName: originalFilename,
          packageType: 'theme',
          result: 'skipped'
        })
        continue
      }

      // Check if there's a current latest version for this theme
      const currentLatestTheme = await prisma.uploadedWordPressTheme.findFirst({
        where: {
          name: detected.slug,
          isLatest: true
        },
        select: { id: true, version: true }
      })

      // Determine if the new upload should be marked as latest
      let shouldBeLatestTheme = true
      if (currentLatestTheme) {
        // Compare versions: only set as latest if new version is higher
        if (compareVersions(detected.version, currentLatestTheme.version) > 0) {
          // New version is higher, unset the current latest
          await prisma.uploadedWordPressTheme.update({
            where: { id: currentLatestTheme.id },
            data: { isLatest: false }
          })
        } else {
          // New version is not higher, don't mark as latest
          shouldBeLatestTheme = false
        }
      }

      const archivePath = await persistArchive(file.data, 'themes', detected.slug)
      const intendedFilename = `${detected.slug}.zip`

      await prisma.uploadedWordPressTheme.create({
        data: {
          name: detected.slug,
          title: detected.title,
          slug: detected.slug,
          version: detected.version,
          archivePath,
          originalFilename: intendedFilename,
          uploadedAt: new Date(),
          isLatest: shouldBeLatestTheme
        }
      })

      progress.success++
      sendEvent('log', `${originalFilename}: theme uploaded (${detected.slug} ${detected.version})`, {
        fileName: intendedFilename,
        packageType: 'theme',
        result: 'success'
      })
    } catch (error: any) {
      progress.failed++
      sendEvent('error', `${originalFilename}: ${error?.message || 'processing failed'}`)
    } finally {
      progress.current++
      sendEvent('progress', `Processed ${progress.current}/${progress.total}: ${originalFilename}`, {
        fileName: originalFilename
      })
      await rm(tmpPath, { force: true }).catch(() => {})
    }
  }

  sendEvent(
    'complete',
    `Upload completed: ${progress.success} successful, ${progress.failed} failed, ${progress.skipped} skipped`,
    { done: true }
  )

  return {
    uploadId,
    ...progress
  }
})

function isZipFile(filename: string, data: Buffer): boolean {
  if (!filename.toLowerCase().endsWith('.zip')) {
    return false
  }

  return (
    data.length >= 4 &&
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07) &&
    (data[3] === 0x04 || data[3] === 0x06 || data[3] === 0x08)
  )
}

async function persistArchive(data: Buffer, type: 'plugins' | 'themes', slug: string): Promise<string> {
  const directory = join(UPLOAD_ROOT, type)
  await mkdir(directory, { recursive: true })

  const baseName = toSafeSlug(slug) || type
  const fileName = `${baseName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`
  const absolutePath = join(directory, fileName)

  await writeFile(absolutePath, data)

  return relative(process.cwd(), absolutePath)
}

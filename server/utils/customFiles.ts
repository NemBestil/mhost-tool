import { mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, posix, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const CUSTOM_FILE_UPLOAD_ROOT = resolve(process.cwd(), 'uploads', 'custom-files')

export const MAX_CUSTOM_FILE_BYTES = 100 * 1024 * 1024

export async function persistCustomFileUpload(data: Buffer, originalFilename: string): Promise<string> {
  await mkdir(CUSTOM_FILE_UPLOAD_ROOT, { recursive: true })

  const safeFilename = sanitizeFilename(originalFilename)
  const storedFilename = `${randomUUID()}-${safeFilename || 'file'}`
  const absolutePath = join(CUSTOM_FILE_UPLOAD_ROOT, storedFilename)

  await writeFile(absolutePath, data)
  return relative(process.cwd(), absolutePath)
}

export async function deleteCustomFileStorage(storagePath: string): Promise<void> {
  const absolutePath = resolve(process.cwd(), storagePath)
  await rm(absolutePath, { force: true }).catch(() => {})
}

export function normalizeCustomFileRelativePath(input: string): string {
  const trimmed = input.trim().replace(/\\/g, '/')
  if (!trimmed) {
    throw new Error('Relative path is required')
  }

  if (trimmed.startsWith('/')) {
    throw new Error('Relative path must not start with "/"')
  }

  const normalized = posix.normalize(trimmed)

  if (normalized === '.' || normalized.endsWith('/')) {
    throw new Error('Relative path must include a filename')
  }

  if (normalized.startsWith('../') || normalized === '..' || normalized.includes('/../')) {
    throw new Error('Relative path must stay inside the WordPress installation')
  }

  return normalized.replace(/^\.\/+/, '')
}

export function getDefaultRelativePath(originalFilename: string): string {
  return normalizeCustomFileRelativePath(basename(originalFilename))
}

function sanitizeFilename(filename: string): string {
  return basename(filename)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

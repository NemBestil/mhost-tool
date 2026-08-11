import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { prisma } from '#server/utils/db'
import { compareVersions } from '#server/utils/versions'

export type PackageKind = 'plugins' | 'themes'

export function assertPackageKind(value: string | undefined): PackageKind {
  if (value === 'plugins' || value === 'themes') {
    return value
  }

  throw createError({
    statusCode: 400,
    message: 'Invalid package type'
  })
}

export function sortByNewestVersionAndDate<T extends { version: string, uploadedAt: Date | string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const versionCmp = compareVersions(right.version, left.version)
    if (versionCmp !== 0) return versionCmp
    return new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()
  })
}

export async function deleteArchiveFiles(archivePaths: string[]) {
  for (const archivePath of archivePaths) {
    if (!archivePath) continue
    const absolute = resolve(process.cwd(), archivePath)
    await rm(absolute, { force: true }).catch(() => {})
  }
}

export function getUploadedModel(kind: PackageKind) {
  return kind === 'plugins' ? prisma.uploadedWordPressPlugin : prisma.uploadedWordPressTheme
}

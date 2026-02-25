import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { prisma } from '#server/utils/db'

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

export function compareVersions(a: string, b: string): number {
  const aParts = splitVersion(a)
  const bParts = splitVersion(b)
  const max = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < max; i++) {
    const aPart = aParts[i] ?? '0'
    const bPart = bParts[i] ?? '0'
    const aNum = Number(aPart)
    const bNum = Number(bPart)
    const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum)

    if (bothNumeric) {
      if (aNum !== bNum) return aNum - bNum
      continue
    }

    const cmp = aPart.localeCompare(bPart)
    if (cmp !== 0) return cmp
  }

  return 0
}

export function isVersionNewer(a: string, b: string): boolean {
  return compareVersions(a, b) > 0
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

function splitVersion(version: string): string[] {
  return version
    .replace(/^[^\d]*/, '')
    .split(/[.\-+_]/)
    .filter(Boolean)
}

export type OptionalVersion = string | null | undefined

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

export function resolveLatestKnownVersion(...versions: OptionalVersion[]): string | null {
  let latestVersion: string | null = null

  for (const version of versions) {
    if (!version) continue
    if (!latestVersion || isVersionNewer(version, latestVersion)) {
      latestVersion = version
    }
  }

  return latestVersion
}

function splitVersion(version: string): string[] {
  return version
    .replace(/^[^\d]*/, '')
    .split(/[.\-+_]/)
    .filter(Boolean)
}

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const HEADER_MAX_BYTES = 128 * 1024

export type WordPressPackageKind = 'plugin' | 'theme' | 'unknown'

export interface DetectedWordPressPackage {
  kind: WordPressPackageKind
  slug: string
  title: string
  version: string
}

export interface ParseWordPressHeadersResult {
  title: string
  version: string
}

export function toSafeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseWordPressHeaders(content: string, titleHeader: string): ParseWordPressHeadersResult | null {
  const normalized = content.slice(0, HEADER_MAX_BYTES)
  const titleMatch = normalized.match(new RegExp(`\\*\\s${escapeRegExp(titleHeader)}\\s*:\\s*(.+)$`, 'im'))
  if (!titleMatch?.[1]) {
    return null
  }

  const versionMatch = normalized.match(/\\*\s*Version\s*:\s*(.+)$/im)

  return {
    title: titleMatch[1].trim(),
    version: versionMatch?.[1]?.trim() || '0.0.0'
  }
}

export async function detectWordPressPackage(zipPath: string): Promise<DetectedWordPressPackage> {
  const entries = await listZipEntries(zipPath)
  if (entries.length === 0) {
    return unknownPackage()
  }

  const filteredEntries = entries.filter(entry => !entry.startsWith('__MACOSX/'))
  const root = getCommonRootDirectory(filteredEntries)
  const rootsToTry = root ? [root] : getTopLevelDirectories(filteredEntries)
  const uniqueRoots = [...new Set(rootsToTry.filter(Boolean))]

  const themeResult = await detectTheme(zipPath, filteredEntries, uniqueRoots)
  const pluginResult = await detectPlugin(zipPath, filteredEntries, uniqueRoots)

  if (themeResult && pluginResult) {
    return unknownPackage()
  }

  if (themeResult) {
    return themeResult
  }

  if (pluginResult) {
    return pluginResult
  }

  return unknownPackage()
}

async function detectTheme(
  zipPath: string,
  entries: string[],
  roots: string[]
): Promise<DetectedWordPressPackage | null> {
  const candidates: string[] = []

  for (const root of roots) {
    const stylePath = `${root}/style.css`
    if (entries.includes(stylePath)) {
      candidates.push(stylePath)
    }
  }

  if (candidates.length === 0 && entries.includes('style.css')) {
    candidates.push('style.css')
  }

  for (const stylePath of candidates) {
    const header = await readZipTextEntry(zipPath, stylePath)
    if (!header) continue

    const parsed = parseWordPressHeaders(header, 'Theme Name')
    if (!parsed) continue

    const slugBase = stylePath === 'style.css'
      ? parsed.title
      : stylePath.split('/')[0]

    const slug = toSafeSlug(slugBase)
    if (!slug) continue

    return {
      kind: 'theme',
      slug,
      title: parsed.title,
      version: parsed.version
    }
  }

  return null
}

async function detectPlugin(
  zipPath: string,
  entries: string[],
  roots: string[]
): Promise<DetectedWordPressPackage | null> {
  const candidates = new Set<string>()

  for (const root of roots) {
    const rootPhp = entries.filter(entry => {
      if (!entry.startsWith(`${root}/`)) return false
      if (!entry.toLowerCase().endsWith('.php')) return false
      const relative = entry.slice(root.length + 1)
      return !relative.includes('/')
    })

    rootPhp
      .sort((a, b) => {
        const preferredA = a.toLowerCase().endsWith(`/${root.toLowerCase()}.php`) ? 0 : 1
        const preferredB = b.toLowerCase().endsWith(`/${root.toLowerCase()}.php`) ? 0 : 1
        return preferredA - preferredB
      })
      .forEach(file => candidates.add(file))
  }

  if (candidates.size === 0) {
    const flatPhpFiles = entries.filter(entry => entry.toLowerCase().endsWith('.php') && !entry.includes('/'))
    flatPhpFiles.forEach(file => candidates.add(file))
  }

  for (const candidate of candidates) {
    const header = await readZipTextEntry(zipPath, candidate)
    if (!header) continue

    const parsed = parseWordPressHeaders(header, 'Plugin Name')
    if (!parsed) continue

    const pathParts = candidate.split('/')
    const root = pathParts.length > 1 ? pathParts[0] : candidate.replace(/\.php$/i, '')
    const slug = toSafeSlug(root)
    if (!slug) continue

    return {
      kind: 'plugin',
      slug,
      title: parsed.title,
      version: parsed.version
    }
  }

  return null
}

async function listZipEntries(zipPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath], {
      maxBuffer: 16 * 1024 * 1024
    })

    return stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

async function readZipTextEntry(zipPath: string, entryPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('unzip', ['-p', zipPath, entryPath], {
      maxBuffer: 2 * 1024 * 1024
    })
    return String(stdout)
  } catch {
    return null
  }
}

function getTopLevelDirectories(entries: string[]): string[] {
  return entries
    .map(entry => entry.split('/')[0])
    .filter(Boolean)
}

function getCommonRootDirectory(entries: string[]): string | null {
  const topLevels = [...new Set(getTopLevelDirectories(entries))]
  return topLevels.length === 1 ? topLevels[0] : null
}

function unknownPackage(): DetectedWordPressPackage {
  return {
    kind: 'unknown',
    slug: '',
    title: '',
    version: ''
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

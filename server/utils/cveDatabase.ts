import { prisma } from '#server/utils/db'

type WordfenceAffectedVersion = {
  from_version: string
  from_inclusive: boolean
  to_version: string
  to_inclusive: boolean
}

type WordfenceSoftware = {
  type: string
  name: string
  slug: string
  affected_versions: Record<string, WordfenceAffectedVersion>
  patched: boolean
  patched_versions: string[]
}

type WordfenceCopyright = {
  notice: string
  license: string
  license_url: string
}

type WordfenceVulnerability = {
  id: string
  title: string
  description: string
  software: WordfenceSoftware[]
  cvss: {
    vector: string
    score: number
    rating: string
  } | null
  cve: string | null
  cve_link: string | null
  copyrights: {
    message?: string
    [key: string]: WordfenceCopyright | string | undefined
  } | null
  published: string | null
  updated: string | null
}

type WordfenceResponse = Record<string, WordfenceVulnerability>

export async function fetchAndStoreWordfenceCveData(): Promise<{ total: number }> {
  const apiKey = process.env.WORDFENCE_API_KEY
  if (!apiKey) {
    throw new Error('WORDFENCE_API_KEY is not set in environment variables')
  }

  const response = await fetch('https://www.wordfence.com/api/intelligence/v3/vulnerabilities/production', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    throw new Error(`Wordfence API returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json() as WordfenceResponse

  const vulnerabilities = Object.values(data)

  // Delete all existing CVE data and insert fresh
  await prisma.$transaction(async (tx) => {
    await tx.vulnerabilitySoftware.deleteMany()
    await tx.vulnerability.deleteMany()

    // Insert in batches to avoid SQLite limits
    const BATCH_SIZE = 500
    for (let i = 0; i < vulnerabilities.length; i += BATCH_SIZE) {
      const batch = vulnerabilities.slice(i, i + BATCH_SIZE)

      for (const vuln of batch) {
        await tx.vulnerability.create({
          data: {
            id: vuln.id,
            title: vuln.title,
            description: vuln.description || null,
            cve: vuln.cve || null,
            cveLink: vuln.cve_link || null,
            cvssScore: vuln.cvss?.score ?? null,
            cvssRating: vuln.cvss?.rating ?? null,
            cvssVector: vuln.cvss?.vector ?? null,
            copyrights: vuln.copyrights ? JSON.stringify(vuln.copyrights) : null,
            published: vuln.published ? new Date(vuln.published) : null,
            updated: vuln.updated ? new Date(vuln.updated) : null,
            software: {
              create: vuln.software
                .filter(sw => sw.type === 'plugin' || sw.type === 'theme')
                .flatMap(sw => {
                  const versions = Object.values(sw.affected_versions)
                  if (versions.length === 0) {
                    return [{
                      type: sw.type,
                      name: sw.name,
                      slug: sw.slug,
                      patched: sw.patched,
                      patchedVersions: JSON.stringify(sw.patched_versions || []),
                      fromVersion: null,
                      fromInclusive: true,
                      toVersion: null,
                      toInclusive: true
                    }]
                  }

                  return versions.map(v => ({
                    type: sw.type,
                    name: sw.name,
                    slug: sw.slug,
                    patched: sw.patched,
                    patchedVersions: JSON.stringify(sw.patched_versions || []),
                    fromVersion: v.from_version || null,
                    fromInclusive: v.from_inclusive ?? true,
                    toVersion: v.to_version || null,
                    toInclusive: v.to_inclusive ?? true
                  }))
                })
            }
          }
        })
      }
    }
  })

  return { total: vulnerabilities.length }
}

/**
 * Compare two version strings (semver-like).
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(p => parseInt(p, 10) || 0)
  const partsB = b.split('.').map(p => parseInt(p, 10) || 0)
  const maxLen = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < maxLen; i++) {
    const partA = partsA[i] || 0
    const partB = partsB[i] || 0
    if (partA < partB) return -1
    if (partA > partB) return 1
  }

  return 0
}

function isVersionInRange(
  version: string,
  fromVersion: string | null,
  fromInclusive: boolean,
  toVersion: string | null,
  toInclusive: boolean
): boolean {
  if (fromVersion) {
    const cmp = compareVersions(version, fromVersion)
    if (fromInclusive ? cmp < 0 : cmp <= 0) return false
  }

  if (toVersion) {
    const cmp = compareVersions(version, toVersion)
    if (toInclusive ? cmp > 0 : cmp >= 0) return false
  }

  return true
}

type CveMatch = {
  vulnerabilityId: string
  title: string
  cvssScore: number
  cvssRating: string | null
  cve: string | null
  softwareType: string
  softwareName: string
  softwareSlug: string
}

/**
 * Find all CVE matches for a given plugin or theme slug + version.
 */
export async function findCveMatches(
  type: 'plugin' | 'theme',
  slug: string,
  version: string
): Promise<CveMatch[]> {
  const records = await prisma.vulnerabilitySoftware.findMany({
    where: {
      type,
      slug
    },
    include: {
      vulnerability: true
    }
  })

  const matches: CveMatch[] = []

  for (const record of records) {
    if (!record.vulnerability.cvssScore) continue

    if (isVersionInRange(version, record.fromVersion, record.fromInclusive, record.toVersion, record.toInclusive)) {
      matches.push({
        vulnerabilityId: record.vulnerability.id,
        title: record.vulnerability.title,
        cvssScore: record.vulnerability.cvssScore,
        cvssRating: record.vulnerability.cvssRating,
        cve: record.vulnerability.cve,
        softwareType: record.type,
        softwareName: record.name,
        softwareSlug: record.slug
      })
    }
  }

  return matches
}

/**
 * Iterate through all sites and associate CVEs to plugins/themes, then update currentCve per site.
 */
export async function associateCvesToSites(): Promise<{ sitesUpdated: number }> {
  // Load all vulnerability software records with their vulnerability scores
  const allVulnSoftware = await prisma.vulnerabilitySoftware.findMany({
    where: {
      vulnerability: {
        cvssScore: { not: null }
      }
    },
    select: {
      type: true,
      slug: true,
      fromVersion: true,
      fromInclusive: true,
      toVersion: true,
      toInclusive: true,
      vulnerability: {
        select: {
          cvssScore: true
        }
      }
    }
  })

  // Build lookup map by type+slug for fast matching
  const vulnMap = new Map<string, typeof allVulnSoftware>()
  for (const vs of allVulnSoftware) {
    const key = `${vs.type}:${vs.slug}`
    const existing = vulnMap.get(key)
    if (existing) {
      existing.push(vs)
    } else {
      vulnMap.set(key, [vs])
    }
  }

  // Load all sites with their plugins and themes
  const sites = await prisma.wordPressInstallation.findMany({
    select: {
      id: true,
      plugins: { select: { slug: true, version: true } },
      themes: { select: { slug: true, version: true } }
    }
  })

  let sitesUpdated = 0

  for (const site of sites) {
    let maxCve: number | null = null

    // Check plugins
    for (const plugin of site.plugins) {
      const vulns = vulnMap.get(`plugin:${plugin.slug}`)
      if (!vulns) continue

      for (const v of vulns) {
        if (isVersionInRange(plugin.version, v.fromVersion, v.fromInclusive, v.toVersion, v.toInclusive)) {
          const score = v.vulnerability.cvssScore!
          if (maxCve === null || score > maxCve) {
            maxCve = score
          }
        }
      }
    }

    // Check themes
    for (const theme of site.themes) {
      const vulns = vulnMap.get(`theme:${theme.slug}`)
      if (!vulns) continue

      for (const v of vulns) {
        if (isVersionInRange(theme.version, v.fromVersion, v.fromInclusive, v.toVersion, v.toInclusive)) {
          const score = v.vulnerability.cvssScore!
          if (maxCve === null || score > maxCve) {
            maxCve = score
          }
        }
      }
    }

    await prisma.wordPressInstallation.update({
      where: { id: site.id },
      data: { currentCve: maxCve }
    })

    sitesUpdated++
  }

  return { sitesUpdated }
}

/**
 * Get CVE details for all plugins/themes on a site, used by the site detail API.
 */
export async function getSiteCveDetails(
  plugins: { slug: string; version: string }[],
  themes: { slug: string; version: string }[]
): Promise<Map<string, number>> {
  // Returns a map of "type:slug" -> highest CVSS score
  const pluginSlugs = [...new Set(plugins.map(p => p.slug))]
  const themeSlugs = [...new Set(themes.map(t => t.slug))]

  if (pluginSlugs.length === 0 && themeSlugs.length === 0) {
    return new Map()
  }

  const softwareConditions = [
    ...(pluginSlugs.length > 0 ? [{ type: 'plugin' as const, slug: { in: pluginSlugs } }] : []),
    ...(themeSlugs.length > 0 ? [{ type: 'theme' as const, slug: { in: themeSlugs } }] : [])
  ]

  const allVulnSoftware = await prisma.vulnerabilitySoftware.findMany({
    where: {
      vulnerability: { cvssScore: { not: null } },
      OR: softwareConditions
    },
    select: {
      type: true,
      slug: true,
      fromVersion: true,
      fromInclusive: true,
      toVersion: true,
      toInclusive: true,
      vulnerability: { select: { cvssScore: true } }
    }
  })

  const result = new Map<string, number>()

  const allSoftware = [
    ...plugins.map(p => ({ type: 'plugin', slug: p.slug, version: p.version })),
    ...themes.map(t => ({ type: 'theme', slug: t.slug, version: t.version }))
  ]

  for (const sw of allSoftware) {
    const matching = allVulnSoftware.filter(v => v.type === sw.type && v.slug === sw.slug)
    let maxScore: number | null = null

    for (const v of matching) {
      if (isVersionInRange(sw.version, v.fromVersion, v.fromInclusive, v.toVersion, v.toInclusive)) {
        const score = v.vulnerability.cvssScore!
        if (maxScore === null || score > maxScore) {
          maxScore = score
        }
      }
    }

    if (maxScore !== null) {
      const key = `${sw.type}:${sw.slug}`
      const existing = result.get(key)
      if (existing === undefined || maxScore > existing) {
        result.set(key, maxScore)
      }
    }
  }

  return result
}

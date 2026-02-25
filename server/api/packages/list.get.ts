import { prisma } from '#server/utils/db'
import { sortByNewestVersionAndDate } from '#server/utils/uploadedPackages'

export default defineEventHandler(async () => {
  const [allPlugins, allThemes] = await Promise.all([
    prisma.uploadedWordPressPlugin.findMany({
      orderBy: [{ name: 'asc' }, { uploadedAt: 'desc' }]
    }),
    prisma.uploadedWordPressTheme.findMany({
      orderBy: [{ name: 'asc' }, { uploadedAt: 'desc' }]
    })
  ])

  return {
    plugins: toLatestRows(allPlugins),
    themes: toLatestRows(allThemes)
  }
})

function toLatestRows<T extends {
  id: string
  name: string
  title: string | null
  slug: string
  version: string
  uploadedAt: Date
}>(rows: T[]) {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const bucket = grouped.get(row.name) || []
    bucket.push(row)
    grouped.set(row.name, bucket)
  }

  return [...grouped.values()]
    .map((groupRows) => {
      const ordered = sortByNewestVersionAndDate(groupRows)
      const latest = ordered[0]

      return {
        ...latest,
        versionsCount: ordered.length,
        versions: ordered.map(row => row.version)
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

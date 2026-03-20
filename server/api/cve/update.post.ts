import { fetchAndStoreWordfenceCveData, associateCvesToSites } from '#server/utils/cveDatabase'

export default defineEventHandler(async () => {
  const fetchResult = await fetchAndStoreWordfenceCveData()
  const associateResult = await associateCvesToSites()

  return {
    totalVulnerabilities: fetchResult.total,
    sitesUpdated: associateResult.sitesUpdated
  }
})

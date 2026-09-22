import { fetchAndStoreWordfenceCveData, associateCvesToSites } from '#server/utils/cveDatabase'
import { sendCveDatabaseUpdateFailedReport } from '#server/utils/notificationReports'

export default defineEventHandler(async () => {
  try {
    const fetchResult = await fetchAndStoreWordfenceCveData()
    const associateResult = await associateCvesToSites()

    return {
      totalVulnerabilities: fetchResult.total,
      sitesUpdated: associateResult.sitesUpdated
    }
  } catch (error) {
    console.error('[cve/update] Failed to update CVE database:', error)
    await sendCveDatabaseUpdateFailedReport(error)
    throw error
  }
})

import { defineTask } from 'nitropack/runtime'
import { prisma } from '#server/utils/db'
import { runServerScan } from '#server/utils/serverScan'
import { runVersionChecksIfNeeded } from '#server/utils/wordpressOrgApi'

export default defineTask({
  meta: {
    name: 'scan-all-servers-daily',
    description: 'Scan all servers and refresh plugin/theme version metadata'
  },
  async run() {
    const servers = await prisma.server.findMany({
      select: {
        id: true,
        name: true,
        hostname: true,
        sshPort: true,
        sshPrivateKey: true,
        serverType: true
      }
    })

    let scanned = 0
    let failed = 0

    for (const server of servers) {
      try {
        const result = await runServerScan(server)
        if (result.success > 0) {
          scanned++
        } else {
          failed++
        }
      } catch (error) {
        failed++
        console.error(`[scan-all-servers-daily] Failed scanning ${server.id}:`, error)
      }
    }

    await runVersionChecksIfNeeded()

    return {
      result: {
        totalServers: servers.length,
        scanned,
        failed,
        versionChecks: 'runVersionChecksIfNeeded() completed'
      }
    }
  }
})

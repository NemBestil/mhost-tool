import { MonitoringLevel } from '@@/prisma/generated/client'
import { defineTask } from 'nitropack/runtime'
import { pingSitesByLevel } from '#server/utils/pingSites'

export default defineTask({
  meta: {
    name: 'ping-sites-normal',
    description: 'Ping normal priority sites'
  },
  async run() {
    const result = await pingSitesByLevel(MonitoringLevel.NORMAL)
    return { result }
  }
})

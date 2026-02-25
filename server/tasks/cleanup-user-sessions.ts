import { defineTask } from 'nitropack/runtime'
import { prisma } from '#server/utils/db'

export default defineTask({
  meta: {
    name: 'cleanup-user-sessions',
    description: 'Delete expired user sessions',
  },
  async run() {
    const result = await prisma.userSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    return {
      result,
    }
  },
})

import { prisma } from '#server/utils/db'

function safePercent(used: bigint, total: bigint): number | null {
  if (total <= BigInt(0)) return null
  // Keep one decimal for nicer UX; clamp to [0, 100]
  const pct = (Number(used) / Number(total)) * 100
  if (!Number.isFinite(pct)) return null
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
}

function pickRootAndSecond<T extends { mountPoint: string }>(disks: T[]) {
  const root = disks.find((d) => d.mountPoint === '/') ?? disks[0]
  const second = disks.find((d) => d !== root)
  return { root, second }
}

export default defineEventHandler(async () => {
  const servers = await prisma.server.findMany({
    orderBy: {
      name: 'asc',
    },
    include: {
      disks: {
        orderBy: {
          mountPoint: 'asc',
        },
      },
    },
  })

  return servers.map((s) => {
    const { root, second } = pickRootAndSecond(s.disks)

    const rootDisk = root
      ? {
          mountPoint: root.mountPoint,
          usedCapacity: root.usedCapacity.toString(),
          capacity: root.capacity.toString(),
          usagePercent: safePercent(root.usedCapacity, root.capacity),
        }
      : null

    const secondDisk = second
      ? {
          mountPoint: second.mountPoint,
          usedCapacity: second.usedCapacity.toString(),
          capacity: second.capacity.toString(),
          usagePercent: safePercent(second.usedCapacity, second.capacity),
        }
      : null

    return {
      id: s.id,
      name: s.name,
      hostname: s.hostname,
      sshPort: s.sshPort,
      serverType: s.serverType,
      cpuCores: s.cpuCores,
      ram: s.ram,
      sshIsValid: s.sshIsValid,
      disks: {
        root: rootDisk,
        second: secondDisk,
        count: s.disks.length,
      },
    }
  })
})
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../prisma/generated/client.ts'

it('reads and writes SQLite through the Prisma native adapter', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mhost-sqlite-'))
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${join(directory, 'test.db')}` })
  })

  try {
    await prisma.$executeRaw`CREATE TABLE "options" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL)`
    await prisma.option.create({ data: { key: 'sqlite-test', value: 'initial' } })
    assert.equal((await prisma.option.findUnique({ where: { key: 'sqlite-test' } }))?.value, 'initial')

    await prisma.$transaction([
      prisma.option.update({ where: { key: 'sqlite-test' }, data: { value: 'updated' } }),
      prisma.option.create({ data: { key: 'transaction-test', value: 'committed' } })
    ])
    assert.equal((await prisma.option.findUnique({ where: { key: 'sqlite-test' } }))?.value, 'updated')
    assert.equal(await prisma.option.count(), 2)

    await prisma.option.deleteMany()
    assert.equal(await prisma.option.count(), 0)
  } finally {
    await prisma.$disconnect()
    await rm(directory, { recursive: true, force: true })
  }
})

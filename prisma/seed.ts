import {prisma} from '../server/utils/prisma-client'

async function main() {

}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
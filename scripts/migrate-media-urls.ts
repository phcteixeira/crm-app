import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Migrating existing media URLs...')
  
  const messages = await (prisma as any).message.findMany({
    where: {
      mediaUrl: {
        startsWith: '/uploads/'
      }
    }
  })

  console.log(`Found ${messages.length} messages to update.`)

  for (const msg of messages) {
    const newUrl = msg.mediaUrl.replace('/uploads/', '/api/media/')
    await (prisma as any).message.update({
      where: { id: msg.id },
      data: { mediaUrl: newUrl }
    })
    console.log(`Updated msg ${msg.id}: ${msg.mediaUrl} -> ${newUrl}`)
  }

  console.log('Migration complete.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

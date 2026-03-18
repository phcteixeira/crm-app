import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const inboxes = await prisma.inbox.findMany()
  console.log('--- INBOXES ---')
  console.log(JSON.stringify(inboxes, null, 2))

  const contacts = await prisma.contact.findMany()
  console.log('\n--- CONTACTS ---')
  console.log(JSON.stringify(contacts, null, 2))

  const conversations = await prisma.conversation.findMany({
    include: { messages: true }
  })
  console.log('\n--- CONVERSATIONS ---')
  console.log(JSON.stringify(conversations, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())

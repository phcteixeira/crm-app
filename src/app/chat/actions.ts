'use server'

import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/services/evolutionApi'
import { revalidatePath } from 'next/cache'

export async function getContacts() {
  const contacts = await prisma.contact.findMany({
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })
  return contacts
}

export async function getMessages(contactId: string) {
  const messages = await prisma.message.findMany({
    where: { contactId },
    orderBy: { createdAt: 'asc' },
  })
  return messages
}

export async function sendMessage(formData: FormData) {
  const contactId = formData.get('contactId') as string
  const text = formData.get('text') as string
  const instanceName = formData.get('instanceName') as string

  if (!contactId || !text || !instanceName) return { error: 'Missing fields' }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return { error: 'Contact not found' }

  const dbInstance = await prisma.instance.findFirst({
    where: { name: instanceName }
  })
  if (!dbInstance) return { error: 'Instance not found' }

  try {
    // Send via Evolution API
    await sendTextMessage(instanceName, contact.phone, text)

    // Save to DB
    await prisma.message.create({
      data: {
        text,
        status: 'sent',
        sender: 'me',
        contactId: contact.id,
        instanceId: dbInstance.id,
      }
    })

    revalidatePath(`/chat`)
    return { success: true }
  } catch (error: any) {
    console.error('Failed to send message:', error.response?.data || error.message)
    return { error: 'Failed to send message' }
  }
}

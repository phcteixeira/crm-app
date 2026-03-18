'use server'

import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/services/evolutionApi'
import { revalidatePath } from 'next/cache'

// To be implemented: BullMQ producer setup
import { Queue } from 'bullmq'

const messageQueue = new Queue('message-queue', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
  }
})

export async function getConversations() {
  const conversations = await (prisma as any).conversation.findMany({
    include: {
      contact: true,
      inbox: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })
  return conversations
}

export async function getMessages(conversationId: string) {
  const messages = await (prisma as any).message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  })
  return messages
}

export async function sendMessage(formData: FormData) {
  const conversationId = formData.get('conversationId') as string
  const text = formData.get('text') as string

  if (!conversationId || !text) return { error: 'Missing fields' }

  const conversation = await (prisma as any).conversation.findUnique({ 
    where: { id: conversationId },
    include: { contact: true, inbox: true }
  })
  
  if (!conversation) return { error: 'Conversation not found' }

  try {
    // 1. Save to DB with 'enqueued' status (Instant feedback for User)
    const newMessage = await (prisma as any).message.create({
      data: {
        text,
        status: 'enqueued',
        senderType: 'agent',
        conversationId: conversation.id,
      }
    })

    // 2. Add to BullMQ Queue to process in background (No more waiting for Evolution API)
    await messageQueue.add('sendTextMessage', {
      messageId: newMessage.id,
      inboxName: conversation.inbox.name,
      contactIdentifier: conversation.contact.identifier,
      text: text
    })

    revalidatePath(`/chat`)
    return { success: true }
  } catch (error: any) {
    console.error('Failed to enqueue message:', error.message)
    return { error: 'Failed to enqueue message' }
  }
}

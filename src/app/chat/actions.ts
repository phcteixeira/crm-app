'use server'

import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/services/evolutionApi'
import { saveFile } from '@/lib/storage'
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
    // 0. Get user settings
    const settings = await (prisma as any).userSettings.findUnique({
      where: { userId: conversation.inbox.userId }
    })
    const evoUrl = settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL
    const evoKey = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY

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
      text: text,
      evoUrl,
      evoKey
    })

    revalidatePath(`/chat`)
    return { success: true }
  } catch (error: any) {
    console.error('Failed to enqueue message:', error.message)
    return { error: 'Failed to enqueue message' }
  }
}

export async function sendAudio(formData: FormData) {
  const conversationId = formData.get('conversationId') as string
  const audioBase64 = formData.get('audio') as string

  if (!conversationId || !audioBase64) return { error: 'Missing fields' }

  const conversation = await (prisma as any).conversation.findUnique({ 
    where: { id: conversationId },
    include: { contact: true, inbox: true }
  })
  
  if (!conversation) return { error: 'Conversation not found' }

  try {
    // 0. Get user settings
    const settings = await (prisma as any).userSettings.findUnique({
      where: { userId: conversation.inbox.userId }
    })
    const evoUrl = settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL
    const evoKey = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY

    const newMessage = await (prisma as any).message.create({
      data: {
        status: 'enqueued',
        senderType: 'agent',
        conversationId: conversation.id,
        mediaType: 'audio',
        mediaUrl: audioBase64 // Storing the base64 or a transient URL so the frontend can display the player immediately
      }
    })

    await messageQueue.add('sendAudioMessage', {
      messageId: newMessage.id,
      inboxName: conversation.inbox.name,
      contactIdentifier: conversation.contact.identifier,
      audioBase64: audioBase64,
      evoUrl,
      evoKey
    })

    revalidatePath(`/chat`)
    return { success: true }
  } catch (error: any) {
    console.error('Failed to enqueue audio message:', error.message)
    return { error: 'Failed to enqueue audio message' }
  }
}
export async function sendMedia(formData: FormData) {
  const conversationId = formData.get('conversationId') as string
  const mediaBase64 = formData.get('media') as string
  const mediaType = formData.get('mediaType') as 'image' | 'video' | 'document'
  const fileName = formData.get('fileName') as string || 'file'

  if (!conversationId || !mediaBase64 || !mediaType) return { error: 'Missing fields' }

  const conversation = await (prisma as any).conversation.findUnique({ 
    where: { id: conversationId },
    include: { contact: true, inbox: true }
  })
  
  if (!conversation) return { error: 'Conversation not found' }

  try {
    // 0. Get user settings
    const settings = await (prisma as any).userSettings.findUnique({
      where: { userId: conversation.inbox.userId }
    })
    const evoUrl = settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL
    const evoKey = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY

    // 1. Save locally for instant display and persistence
    const savedUrl = await saveFile(mediaBase64)

    // 2. Create in DB
    const newMessage = await (prisma as any).message.create({
      data: {
        status: 'enqueued',
        senderType: 'agent',
        conversationId: conversation.id,
        mediaType: mediaType,
        mediaUrl: savedUrl
      }
    })

    // 3. Queue for Evolution API
    await messageQueue.add('sendMediaMessage', {
      messageId: newMessage.id,
      inboxName: conversation.inbox.name,
      contactIdentifier: conversation.contact.identifier,
      mediaBase64: mediaBase64, // We still need the base64 to send to Evolution
      mediaType: mediaType,
      fileName: fileName,
      evoUrl,
      evoKey
    })

    revalidatePath(`/chat`)
    return { success: true }
  } catch (error: any) {
    console.error('Failed to enqueue media message:', error.message)
    return { error: 'Failed to enqueue media message' }
  }
}

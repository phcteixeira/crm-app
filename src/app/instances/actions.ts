'use server'

import { prisma } from '@/lib/prisma'
import { 
  createInstance, 
  connectInstance, 
  deleteInstance, 
  fetchConnectionState, 
  listInstances 
} from '@/services/evolutionApi'
import { revalidatePath } from 'next/cache'

import { auth } from '@/auth'

export async function createNewInstance(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  try {
    // 0. Get user settings
    const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
    const evoUrl = settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL
    const evoKey = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY

    // 1. Create in Evolution API and Setup Webhooks
    // AUTH_URL is always the correct public-facing URL (e.g. https://crm.ckmedia.com.br)
    // Falls back to localhost for local development
    // AUTH_URL is always the correct public-facing URL (e.g. https://crm.ckmedia.com.br)
    // Falls back to localhost for local development
    const baseUrl = (process.env.AUTH_URL || 'http://localhost:3005').replace(/\/$/, '')
    
    // We need to pass the custom API key/URL if they exist
    await createInstance(name, `${baseUrl}/api/webhooks/evolution`, evoUrl, evoKey)

    // 2. Connect to get QR
    let connection = await connectInstance(name, evoUrl, evoKey)
    
    // Sometimes v2 takes a split second to generate the QR. If it's not in the connect response, try fetching state.
    if (!connection.base64) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // give it 1s
      const state = await fetchConnectionState(name, evoUrl, evoKey)
      if (state?.instance?.qr) {
        connection = { base64: state.instance.qr, ...connection }
      }
    }

    // 4. Save to DB
    await prisma.inbox.create({
      data: {
        name,
        channelType: 'whatsapp',
        status: 'connecting',
        userId: session.user.id,
        credentials: {
          qrCode: connection.base64 || null,
          evolutionApiId: connection.instance?.instanceId || name
        }
      }
    })

    revalidatePath('/instances')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to create instance:', error.response?.data || error.message)
    return { error: 'Failed to create instance' }
  }
}

export async function removeInstance(name: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { error: 'Unauthorized' }

    const dbInbox = await prisma.inbox.findUnique({ where: { name } })
    if (!dbInbox || dbInbox.userId !== session.user.id) return { error: 'Unauthorized' }

    // 0. Get user settings
    const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
    const evoUrl = settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL
    const evoKey = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY

    // 1. Delete in Evolution API
    await deleteInstance(name, evoUrl, evoKey)
    
    // 2. Delete from DB
    await prisma.inbox.delete({
      where: { name }
    })

    revalidatePath('/instances')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete instance:', error.response?.data || error.message)
    return { error: 'Failed to delete instance' }
  }
}

export async function pollInstanceStatus(name: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { error: 'Unauthorized' }

    // 0. Get user settings
    const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
    const evoUrl = settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL
    const evoKey = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY

    const connection = await fetchConnectionState(name, evoUrl, evoKey)
    const state = connection?.instance?.state // 'open', 'close', 'connecting'

    if (state) {
      let newStatus = 'connecting'
      if (state === 'open') newStatus = 'connected'
      if (state === 'close') newStatus = 'disconnected'

      const dbInbox = await prisma.inbox.findUnique({ where: { name } })
      
      if (dbInbox && dbInbox.status !== newStatus) {
        
        let newCreds: any = typeof dbInbox.credentials === 'string' ? JSON.parse(dbInbox.credentials) : (dbInbox.credentials || {});
        if (state === 'open') {
          newCreds.qrCode = null;
        }

        await prisma.inbox.update({
          where: { name },
          data: { 
            status: newStatus,
            credentials: newCreds
          }
        })
        revalidatePath('/instances')
        return { changed: true, newStatus }
      }
    }
    return { changed: false }
  } catch (error) {
    return { error: 'Failed to poll status' }
  }
}

export async function syncInstancesWithEvolution() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { error: 'Unauthorized' }

    // 0. Get user settings
    const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
    const evoUrl = settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL
    const evoKey = settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY

    const evolutionData = await listInstances(evoUrl, evoKey)

    // Evolution API v2 returns an array of objects with 'name' property
    const evolutionNames: string[] = (evolutionData || []).map((i: any) => 
      i.name || i.instance?.instanceName || i.instanceName || ''
    ).filter((n: string) => n.length > 0)

    // Find DB inboxes not present in Evolution and remove them
    const dbInboxes = await prisma.inbox.findMany({ where: { userId: session.user.id } })
    const toDelete = dbInboxes.filter((i: { name: string }) => !evolutionNames.includes(i.name))

    if (toDelete.length > 0) {
      await prisma.inbox.deleteMany({
        where: { name: { in: toDelete.map(i => i.name) } }
      })
      revalidatePath('/instances')
      return { synced: true, removed: toDelete.length }
    }

    return { synced: true, removed: 0 }
  } catch (error: any) {
    console.error('Sync failed:', error.message)
    return { error: 'Failed to sync instances' }
  }
}


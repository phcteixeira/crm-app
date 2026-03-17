'use server'

import { prisma } from '@/lib/prisma'
import { createInstance, connectInstance, deleteInstance } from '@/services/evolutionApi'
import { revalidatePath } from 'next/cache'

export async function createNewInstance(formData: FormData) {
  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  try {
    // 1. Create in Evolution API and Setup Webhooks
    const domain = process.env.DOMAIN || process.env.APP_URL || 'localhost:3000'
    const protocol = domain.includes('localhost') ? 'http' : 'https'
    const webhookUrl = `${protocol}://${domain}`
    
    await createInstance(name, `${webhookUrl}/api/webhooks/evolution`)

    // 2. Connect to get QR
    let connection = await connectInstance(name)
    
    // Sometimes v2 takes a split second to generate the QR. If it's not in the connect response, try fetching state.
    if (!connection.base64) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // give it 1s
      const { fetchConnectionState } = await import('@/services/evolutionApi')
      const state = await fetchConnectionState(name)
      if (state?.instance?.qr) {
        connection = { base64: state.instance.qr, ...connection }
      }
    }

    // 4. Save to DB
    await prisma.instance.create({
      data: {
        name,
        status: 'connecting',
        qrCode: connection.base64 || null,
        evolutionApiId: connection.instance?.instanceId || name
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
    // 1. Delete in Evolution API
    await deleteInstance(name)
    
    // 2. Delete from DB
    await prisma.instance.delete({
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
    const { fetchConnectionState } = await import('@/services/evolutionApi')
    const connection = await fetchConnectionState(name)
    const state = connection?.instance?.state // 'open', 'close', 'connecting'

    if (state) {
      let newStatus = 'connecting'
      if (state === 'open') newStatus = 'connected'
      if (state === 'close') newStatus = 'disconnected'

      const dbInstance = await prisma.instance.findUnique({ where: { name } })
      
      if (dbInstance && dbInstance.status !== newStatus) {
        await prisma.instance.update({
          where: { name },
          data: { 
            status: newStatus,
            qrCode: state === 'open' ? null : dbInstance.qrCode
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
    const { listInstances } = await import('@/services/evolutionApi')
    const evolutionData = await listInstances()

    // Evolution API v2 returns an array of objects with 'name' property
    const evolutionNames: string[] = (evolutionData || []).map((i: any) => 
      i.name || i.instance?.instanceName || i.instanceName || ''
    ).filter((n: string) => n.length > 0)

    // Find DB instances not present in Evolution and remove them
    const dbInstances = await prisma.instance.findMany()
    const toDelete = dbInstances.filter((i: { name: string }) => !evolutionNames.includes(i.name))

    if (toDelete.length > 0) {
      await prisma.instance.deleteMany({
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


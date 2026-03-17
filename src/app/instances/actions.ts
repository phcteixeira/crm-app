'use server'

import { prisma } from '@/lib/prisma'
import { createInstance, connectInstance, deleteInstance } from '@/services/evolutionApi'
import { revalidatePath } from 'next/cache'

export async function createNewInstance(formData: FormData) {
  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  try {
    // 1. Create in Evolution API and Setup Webhooks
    const webhookUrl = process.env.APP_URL || 'http://localhost:3000'
    await createInstance(name, `${webhookUrl}/api/webhooks/evolution`)

    // 2. Connect to get QR
    const connection = await connectInstance(name)

    // 4. Save to DB
    await prisma.instance.create({
      data: {
        name,
        status: 'connecting',
        qrCode: connection.base64,
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

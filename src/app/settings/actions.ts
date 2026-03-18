'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
  const session = await auth()
  if (!session?.user?.id) return null

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id }
  })

  return settings
}

export async function saveSettings(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const evolutionApiUrl = formData.get('evolutionApiUrl') as string
  const evolutionApiKey = formData.get('evolutionApiKey') as string
  const defaultInstanceName = formData.get('defaultInstanceName') as string

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: {
      evolutionApiUrl: evolutionApiUrl || null,
      evolutionApiKey: evolutionApiKey || null,
      defaultInstanceName: defaultInstanceName || null,
    },
    create: {
      userId: session.user.id,
      evolutionApiUrl: evolutionApiUrl || null,
      evolutionApiKey: evolutionApiKey || null,
      defaultInstanceName: defaultInstanceName || null,
    }
  })

  revalidatePath('/settings')
  return { success: true }
}

export async function getInstanceStats() {
  const session = await auth()
  if (!session?.user?.id) return { connected: 0, pending: 0 }

  const [connected, pending] = await Promise.all([
    prisma.inbox.count({
      where: { userId: session.user.id, status: 'connected' }
    }),
    prisma.inbox.count({
      where: { userId: session.user.id, status: { in: ['connecting', 'disconnected'] } }
    })
  ])

  return { connected, pending }
}

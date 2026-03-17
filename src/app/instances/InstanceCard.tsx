'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash, QrCode } from 'lucide-react'
import { removeInstance, pollInstanceStatus } from './actions'

type Instance = {
  id: string
  name: string
  status: string
  qrCode: string | null
}

export function InstanceCard({ instance }: { instance: Instance }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let interval: NodeJS.Timeout
    // Poll the server every 3 seconds if we are still waiting for a connection
    if (instance.status === 'connecting') {
      interval = setInterval(async () => {
        const res = await pollInstanceStatus(instance.name)
        if (res?.changed) {
          router.refresh()
        }
      }, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [instance.status, instance.name, router])

  const handleDelete = () => {
    startTransition(async () => {
      await removeInstance(instance.name)
    })
  }

  return (
    <div className="glass-panel instance-card relative">
      <div className="card-header">
        <h3>{instance.name}</h3>
        <span className={`badge badge-${instance.status.toLowerCase()}`}>
          {instance.status}
        </span>
      </div>
      
      {instance.status === 'connecting' && instance.qrCode ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '10px', fontSize: '0.85rem' }}>Escaneie o QR Code</p>
          <div className="qr-container">
            <img src={instance.qrCode} alt="QR Code" style={{ width: '150px', height: '150px' }} />
          </div>
        </div>
      ) : (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <QrCode size={48} style={{ margin: '0 auto', opacity: 0.2 }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
        <button 
          onClick={handleDelete} 
          disabled={isPending}
          className="btn btn-danger"
          style={{ opacity: isPending ? 0.5 : 1 }}
        >
          <Trash size={16} />
          {isPending ? 'Removendo...' : 'Remover'}
        </button>
      </div>
    </div>
  )
}

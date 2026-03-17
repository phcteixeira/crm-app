'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash, QrCode, AlertTriangle } from 'lucide-react'
import { removeInstance, pollInstanceStatus, syncInstancesWithEvolution } from './actions'

type Instance = {
  id: string
  name: string
  status: string
  qrCode: string | null
}

// ─── Delete Confirmation Modal ──────────────────────────────────────────────
function DeleteModal({ name, onConfirm, onCancel, isPending }: {
  name: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">
          <AlertTriangle size={32} />
        </div>
        <h3 className="modal-title">Remover Instância</h3>
        <p className="modal-body">
          Tem certeza que deseja remover a instância <strong>{name}</strong>?<br />
          Essa ação irá desconectar o WhatsApp e é <strong>irreversível</strong>.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={isPending}>
            <Trash size={16} />
            {isPending ? 'Removendo...' : 'Sim, remover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Instance Card ───────────────────────────────────────────────────────────
export function InstanceCard({ instance }: { instance: Instance }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState(false)

  // Poll connection status every 3s while connecting
  useEffect(() => {
    if (instance.status !== 'connecting') return
    const interval = setInterval(async () => {
      const res = await pollInstanceStatus(instance.name)
      if (res?.changed) router.refresh()
    }, 3000)
    return () => clearInterval(interval)
  }, [instance.status, instance.name, router])

  const handleConfirmDelete = () => {
    startTransition(async () => {
      await removeInstance(instance.name)
      setShowModal(false)
      router.refresh()
    })
  }

  return (
    <>
      {showModal && (
        <DeleteModal
          name={instance.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowModal(false)}
          isPending={isPending}
        />
      )}

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
              <img 
                src={instance.qrCode.startsWith('data:image') ? instance.qrCode : `data:image/png;base64,${instance.qrCode}`} 
                alt="QR Code" 
                style={{ width: '150px', height: '150px' }} 
              />
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <QrCode size={48} style={{ margin: '0 auto', opacity: 0.2 }} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
          <button
            onClick={() => setShowModal(true)}
            disabled={isPending}
            className="btn btn-danger"
            style={{ opacity: isPending ? 0.5 : 1 }}
          >
            <Trash size={16} />
            Remover
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Auto-Sync Controller ────────────────────────────────────────────────────
export function InstancesSyncManager() {
  const router = useRouter()

  useEffect(() => {
    // Sync immediately on mount, then every 10 seconds
    const doSync = async () => {
      const res = await syncInstancesWithEvolution()
      if (res && 'removed' in res && (res as any).removed > 0) {
        router.refresh()
      }
    }

    doSync()
    const interval = setInterval(doSync, 10000)
    return () => clearInterval(interval)
  }, [router])

  return null // invisible component
}

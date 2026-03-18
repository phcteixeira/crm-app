import { prisma } from '@/lib/prisma'
import { createNewInstance } from './actions'
import { Plus } from 'lucide-react'
import { InstanceCard, InstancesSyncManager } from './InstanceCard'

export const dynamic = 'force-dynamic';

export default async function InstancesPage() {
  const instances = await prisma.inbox.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="container animate-fade-in">
      <header className="header">
        <div>
          <h1 className="text-3xl">Instâncias do WhatsApp</h1>
          <p>Gerencie suas conexões com a Evolution API</p>
        </div>
        
        {/* Nova Instância Form */}
        <form action={async (formData) => {
          'use server';
          await createNewInstance(formData);
        }} className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            name="name" 
            placeholder="Nome da Instância" 
            required 
            className="input-glass"
            style={{ width: '250px' }}
          />
          <button type="submit" className="btn btn-primary">
            <Plus size={18} />
            Nova Instância
          </button>
        </form>
      </header>

      <div className="grid-cards">
        <InstancesSyncManager />
        {instances.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', gridColumn: '1 / -1' }}>
            <p>Nenhuma instância cadastrada. Crie uma acima para começar.</p>
          </div>
        ) : (
          instances.map((instance: any) => (
            <InstanceCard key={instance.id} instance={instance} />
          ))
        )}
      </div>
    </div>
  )
}

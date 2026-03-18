import { prisma } from '@/lib/prisma'
import { createNewInstance } from './actions'
import { Plus } from 'lucide-react'
import { InstanceCard, InstancesSyncManager } from './InstanceCard'

import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic';

export default async function InstancesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const instances = await prisma.inbox.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="container animate-fade-in">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-3xl">Instâncias do WhatsApp</h1>
          <p>Gerencie suas conexões com a Evolution API</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>{session.user.email}</span>
          <form action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}>
            <button type="submit" className="btn" style={{ padding: '0.5rem 1rem', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }}>
              Sair
            </button>
          </form>
        </div>
      </header>

      <div style={{ marginBottom: '2rem' }}>
        {/* Nova Instância Form */}
        <form action={async (formData) => {
          'use server';
          await createNewInstance(formData);
        }} className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '10px', maxWidth: '500px' }}>
          <input 
            type="text" 
            name="name" 
            placeholder="Nome da Instância" 
            required 
            className="input-glass"
            style={{ width: '250px', flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">
            <Plus size={18} />
            Nova Instância
          </button>
        </form>
      </div>

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

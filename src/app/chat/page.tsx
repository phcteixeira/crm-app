import { prisma } from '@/lib/prisma'
import { ChatWindow } from './ChatWindow'
import { PhoneCall, MessageSquare } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ChatPage({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams
  const contacts = await prisma.contact.findMany({
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  const instances = await prisma.instance.findMany({
    where: { status: 'connected' }
  })

  const selectedContactId = params?.contactId as string | undefined

  // Auto-redirect to first contact if none is selected
  if (!selectedContactId && contacts.length > 0) {
    redirect(`/chat?contactId=${contacts[0].id}`)
  }

  const selectedContact = contacts.find((c: any) => c.id === selectedContactId)
  const defaultInstance = instances[0]

  // Pre-load messages server-side for instant display
  const initialMessages = selectedContact
    ? await prisma.message.findMany({
        where: { contactId: selectedContact.id },
        orderBy: { createdAt: 'asc' },
      })
    : []

  return (
    <div className="chat-layout">
      {/* SIDEBAR */}
      <aside className="chat-sidebar glass-panel">
        <div className="sidebar-header">
          <h2>Conversas</h2>
          <span className="badge badge-connected">{instances.length} online</span>
        </div>

        <div className="contact-list">
          {contacts.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
              <p>Sem conversas ainda. Conecte uma instância e aguarde mensagens.</p>
            </div>
          ) : (
            contacts.map((contact: any) => {
              const lastMsg = contact.messages[0]
              const isSelected = contact.id === selectedContactId
              return (
                <a
                  key={contact.id}
                  href={`/chat?contactId=${contact.id}`}
                  className={`contact-item ${isSelected ? 'active' : ''}`}
                >
                  <div className="contact-avatar">{(contact.name || contact.phone)[0]?.toUpperCase()}</div>
                  <div className="contact-info">
                    <div className="contact-name">{contact.name || contact.phone}</div>
                    <div className="contact-last-msg">{lastMsg?.text || '📎 Mídia'}</div>
                  </div>
                  {lastMsg && (
                    <div className="contact-time">
                      {new Date(lastMsg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </a>
              )
            })
          )}
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="chat-main">
        {selectedContact && defaultInstance ? (
          <ChatWindow
            contactId={selectedContact.id}
            contactName={selectedContact.name}
            contactPhone={selectedContact.phone}
            instanceName={defaultInstance.name}
            initialMessages={initialMessages as any}
          />
        ) : (
          <div className="chat-empty-state">
            <MessageSquare size={64} style={{ opacity: 0.15, marginBottom: '1rem' }} />
            <h2>Selecione uma conversa</h2>
            <p>Escolha um contato na lista ao lado para começar.</p>
            {instances.length === 0 && (
              <a href="/instances" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <PhoneCall size={16} /> Conectar uma Instância
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

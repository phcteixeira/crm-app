import { prisma } from '@/lib/prisma'
import { ChatWindow } from './ChatWindow'
import { PhoneCall, MessageSquare } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ChatPage({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams
  const conversations = await prisma.conversation.findMany({
    include: {
      contact: true,
      inbox: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  // We still load inboxes (formerly instances) to display count
  const inboxes = await prisma.inbox.findMany({
    where: { status: 'connected' }
  })

  const selectedConversationId = params?.conversationId as string | undefined

  // Auto-redirect to first conversation if none is selected
  if (!selectedConversationId && conversations.length > 0) {
    redirect(`/chat?conversationId=${conversations[0].id}`)
  }

  const selectedConversation = conversations.find((c: any) => c.id === selectedConversationId)

  // Pre-load messages server-side for instant display
  const initialMessages = selectedConversation
    ? await prisma.message.findMany({
        where: { conversationId: selectedConversation.id },
        orderBy: { createdAt: 'asc' },
      })
    : []

  return (
    <div className="chat-layout">
      {/* SIDEBAR */}
      <aside className="chat-sidebar glass-panel">
        <div className="sidebar-header">
          <h2>Conversas</h2>
          <span className="badge badge-connected">{inboxes.length} online</span>
        </div>

        <div className="contact-list">
          {conversations.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
              <p>Sem conversas ainda. Conecte uma caixa de entrada (Inbox) e aguarde mensagens.</p>
            </div>
          ) : (
            conversations.map((conv: any) => {
              const contact = conv.contact
              const lastMsg = conv.messages[0]
              const isSelected = conv.id === selectedConversationId
              return (
                <a
                  key={conv.id}
                  href={`/chat?conversationId=${conv.id}`}
                  className={`contact-item ${isSelected ? 'active' : ''}`}
                >
                  <div className="contact-avatar">{(contact.name || contact.identifier || "?")[0]?.toUpperCase()}</div>
                  <div className="contact-info">
                    <div className="contact-name">{contact.name || contact.identifier}</div>
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
        {selectedConversation ? (
          <ChatWindow
            conversationId={selectedConversation.id}
            contactName={selectedConversation.contact?.name}
            contactIdentifier={selectedConversation.contact?.identifier}
            inboxName={selectedConversation.inbox?.name}
            initialMessages={initialMessages as any}
          />
        ) : (
          <div className="chat-empty-state">
            <MessageSquare size={64} style={{ opacity: 0.15, marginBottom: '1rem' }} />
            <h2>Selecione uma conversa</h2>
            <p>Escolha uma conversa na lista ao lado para começar.</p>
            {inboxes.length === 0 && (
              <a href="/instances" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <PhoneCall size={16} /> Conectar Caixa de Entrada
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { getMessages, sendMessage } from './actions'

type Message = {
  id: string
  text: string | null
  status: string
  sender: string
  createdAt: string | Date
}

type Props = {
  contactId: string
  contactName: string | null
  contactPhone: string
  instanceName: string
  initialMessages: Message[]
}

export function ChatWindow({ contactId, contactName, contactPhone, instanceName, initialMessages }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    const msgs = await getMessages(contactId)
    setMessages(msgs as any)
  }

  // Re-initialize messages when contact changes (new initialMessages from server)
  useEffect(() => {
    setMessages(initialMessages)
  }, [contactId, initialMessages])

  useEffect(() => {
    const eventSource = new EventSource('/api/events')

    eventSource.addEventListener('NEW_MESSAGE', (e) => {
      try {
        const newMsg = JSON.parse(e.data)
        if (newMsg.contactId === contactId) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
        router.refresh()
      } catch (err) {}
    })

    eventSource.addEventListener('MESSAGE_STATUS_UPDATE', (e) => {
      try {
        const updateData = JSON.parse(e.data)
        setMessages(prev => prev.map(m => 
          m.id === updateData.messageId ? { ...m, status: updateData.status } : m
        ))
        router.refresh()
      } catch (err) {}
    })

    return () => {
      eventSource.close()
    }
  }, [contactId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!text.trim()) return
    const fd = new FormData()
    fd.append('contactId', contactId)
    fd.append('text', text)
    fd.append('instanceName', instanceName)

    startTransition(async () => {
      setText('')
      await sendMessage(fd)
      await loadMessages()
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="contact-avatar">{(contactName || contactPhone)[0]?.toUpperCase()}</div>
        <div>
          <div className="contact-name">{contactName || contactPhone}</div>
          <div className="contact-phone">{contactPhone}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>Nenhuma mensagem ainda. Diga olá! 👋</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message-bubble ${msg.sender === 'me' ? 'sent' : 'received'}`}>
            {msg.text && <p>{msg.text}</p>}
            <div className="message-meta">
              <span className="message-time">
                {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.sender === 'me' && (
                <span className={`message-status status-${msg.status}`}>
                  {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
        />
        <button
          className="btn-send"
          onClick={handleSend}
          disabled={isPending || !text.trim()}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  )
}

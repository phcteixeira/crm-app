'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { getMessages, sendMessage } from './actions'
import Pusher from 'pusher-js'

type Message = {
  id: string
  text: string | null
  status: string
  sender: string
  createdAt: string | Date
}

type Props = {
  conversationId: string
  contactName: string | null
  contactIdentifier: string
  inboxName: string
  initialMessages: Message[]
}

export function ChatWindow({ conversationId, contactName, contactIdentifier, inboxName, initialMessages }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    const msgs = await getMessages(conversationId)
    setMessages(msgs as any)
  }

  // Re-initialize messages when conversation changes (new initialMessages from server)
  useEffect(() => {
    setMessages(initialMessages)
  }, [conversationId, initialMessages])

  useEffect(() => {
    console.log('Initializing Pusher for conversation:', conversationId);
    
    // Auto-detect host: use ENV if provided and NOT localhost, otherwise use current window host
    const isProduction = window.location.protocol === 'https:';
    const envHost = process.env.NEXT_PUBLIC_SOKETI_HOST;
    const wsHost = (envHost && envHost !== 'localhost' && envHost !== '127.0.0.1') 
      ? envHost 
      : window.location.hostname;
    const wsPort = parseInt(process.env.NEXT_PUBLIC_SOKETI_PORT || (isProduction ? '443' : '6001'));

    const pusher = new Pusher(process.env.NEXT_PUBLIC_SOKETI_APP_KEY || 'soketi-crm-key', {
      wsHost: wsHost,
      wsPort: wsPort,
      forceTLS: isProduction,
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
      cluster: 'us-east-1'
    });

    pusher.connection.bind('state_change', (states: any) => {
      console.log('Pusher connection state changed:', states.current);
    });

    const channel = pusher.subscribe(`conversation-${conversationId}`);

    channel.bind('NEW_MESSAGE', (newMsg: any) => {
      console.log('Pusher NEW_MESSAGE received:', newMsg);
      try {
        if (newMsg.conversationId === conversationId) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
        router.refresh()
      } catch (err) {}
    });

    channel.bind('MESSAGE_STATUS_UPDATE', (updateData: any) => {
      try {
        setMessages(prev => prev.map(m => 
          m.id === updateData.messageId ? { ...m, status: updateData.status } : m
        ))
        router.refresh()
      } catch (err) {}
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`conversation-${conversationId}`);
      pusher.disconnect();
    }
  }, [conversationId])

  // Bulletproof fallback: poll for new messages every 5 seconds 
  // (In Next.js Dev Mode, EventEmitters often fail across requests due to isolated workers)
  useEffect(() => {
    const intervalId = setInterval(async () => {
      await loadMessages()
    }, 5000)
    return () => clearInterval(intervalId)
  }, [conversationId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!text.trim()) return
    const fd = new FormData()
    fd.append('conversationId', conversationId)
    fd.append('text', text)
    fd.append('inboxName', inboxName)

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
        <div className="contact-avatar">{(contactName || contactIdentifier || "?")[0]?.toUpperCase()}</div>
        <div>
          <div className="contact-name">{contactName || contactIdentifier}</div>
          <div className="contact-phone">{contactIdentifier}</div>
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

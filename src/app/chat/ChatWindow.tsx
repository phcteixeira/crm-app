'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Mic, Square, Paperclip, File, Image as ImageIcon } from 'lucide-react'
import { getMessages, sendMessage, sendAudio, sendMedia } from './actions'
import Pusher from 'pusher-js'

type Message = {
  id: string
  text: string | null
  status: string
  senderType: string
  mediaUrl?: string | null
  mediaType?: string | null
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
  const [isRecording, setIsRecording] = useState(false)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      } catch (err) {}
    });

    channel.bind('MESSAGE_STATUS_UPDATE', (updateData: any) => {
      try {
        setMessages(prev => prev.map(m => 
          m.id === updateData.messageId ? { ...m, status: updateData.status } : m
        ))
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = () => {
          const base64Audio = reader.result as string
          const fd = new FormData()
          fd.append('conversationId', conversationId)
          fd.append('inboxName', inboxName)
          fd.append('audio', base64Audio)
          
          startTransition(async () => {
            await sendAudio(fd)
            await loadMessages()
          })
        }
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      alert('Não foi possível acessar o microfone. Verifique as permissões.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }
  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = async () => {
      const base64 = reader.result as string
      let mediaType: 'image' | 'video' | 'document' = 'document'
      
      if (file.type.startsWith('image/')) mediaType = 'image'
      else if (file.type.startsWith('video/')) mediaType = 'video'

      const fd = new FormData()
      fd.append('conversationId', conversationId)
      fd.append('media', base64)
      fd.append('mediaType', mediaType)
      fd.append('fileName', file.name)

      startTransition(async () => {
        await sendMedia(fd)
        await loadMessages()
      })
    }
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
          <div key={msg.id} className={`message-bubble ${msg.senderType === 'agent' ? 'sent' : 'received'}`}>
            {msg.mediaType === 'image' && msg.mediaUrl && (
              <img src={msg.mediaUrl} alt="Image" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: msg.text ? '8px' : '0' }} />
            )}
            {msg.mediaType === 'audio' && msg.mediaUrl && (
              <audio controls src={msg.mediaUrl} style={{ maxWidth: '100%', marginBottom: msg.text ? '8px' : '0', height: '40px' }} />
            )}
            {msg.mediaType === 'video' && msg.mediaUrl && (
              <video controls src={msg.mediaUrl} style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: msg.text ? '8px' : '0' }} />
            )}
            {msg.mediaType === 'document' && msg.mediaUrl && (
              <a href={msg.mediaUrl} download="document" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: msg.text ? '8px' : '0', color: 'inherit', textDecoration: 'none' }}>
                📄 Download Anexo
              </a>
            )}
            {msg.mediaType === 'sticker' && msg.mediaUrl && (
              <img src={msg.mediaUrl} alt="Sticker" style={{ width: '120px', height: '120px', objectFit: 'contain', marginBottom: msg.text ? '8px' : '0' }} />
            )}
            {msg.text && <p>{msg.text}</p>}
            <div className="message-meta">
              <span className="message-time">
                {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.senderType === 'agent' && (
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
        {!isRecording ? (
          <textarea
            className="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            rows={1}
          />
        ) : (
          <div className="chat-input" style={{ display: 'flex', alignItems: 'center', color: '#ef4444', fontWeight: 500 }}>
            <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', display: 'inline-block', marginRight: '8px', animation: 'pulse 1.5s infinite' }}></span>
            Gravando áudio...
          </div>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        <button
          className="btn-ghost"
          onClick={handleFileClick}
          disabled={isPending || isRecording}
          title="Anexar arquivo"
          style={{ padding: '8px', color: 'var(--text-secondary)' }}
        >
          <Paperclip size={20} />
        </button>
        
        {text.trim() ? (
          <button
            className="btn-send"
            onClick={handleSend}
            disabled={isPending}
            title="Enviar mensagem"
          >
            <Send size={20} />
          </button>
        ) : (
          <button
            className="btn-send"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isPending}
            title={isRecording ? "Parar gravação" : "Gravar áudio"}
            style={{ background: isRecording ? '#ef4444' : 'var(--accent-primary)' }}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
        )}
      </div>
    </div>
  )
}

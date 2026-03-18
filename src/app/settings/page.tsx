import { prisma } from '@/lib/prisma'
import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { saveSettings } from './actions'
import Link from 'next/link'
import { Settings, Zap, Link2, CheckCircle, Clock, ArrowLeft, Save } from 'lucide-react'

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [settings, connected, pending] = await Promise.all([
    (prisma as any).userSettings.findUnique({ where: { userId: session.user.id } }),
    (prisma as any).inbox.count({ where: { userId: session.user.id, status: 'connected' } }),
    (prisma as any).inbox.count({ where: { userId: session.user.id, status: { in: ['connecting', 'disconnected'] } } }),
  ])

  const webhookUrl = `${process.env.AUTH_URL || 'http://localhost:3005'}/api/webhooks/evolution`

  return (
    <div className="page-wrapper">
      <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
        
        {/* Header */}
        <header className="header" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/instances" className="btn btn-ghost" style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px' }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.75rem' }}>
                <Settings size={24} style={{ color: 'var(--accent-primary)' }} />
                Configurações
              </h1>
              <p style={{ margin: 0 }}>Gerencie suas preferências e integrações</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{session.user.email}</span>
            <form action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}>
              <button type="submit" className="btn btn-ghost" style={{ fontSize: '0.85rem', padding: '6px 12px', color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)' }}>
                Sair
              </button>
            </form>
          </div>
        </header>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          
          {/* Webhook URL */}
          <div className="glass-panel" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Link2 size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                URL do Webhook do Sistema
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ 
                flex: 1,
                background: 'rgba(0,0,0,0.3)', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                border: '1px solid var(--panel-border)',
                wordBreak: 'break-all'
              }}>
                {webhookUrl}
              </code>
              <button 
                id="copy-webhook-btn"
                onClick={undefined}
                style={{ 
                  background: 'rgba(99,102,241,0.15)', 
                  border: '1px solid rgba(99,102,241,0.3)', 
                  color: 'var(--accent-primary)', 
                  borderRadius: '8px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  flexShrink: 0
                }}
              >
                Copiar
              </button>
            </div>
          </div>

          {/* Connected */}
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <CheckCircle size={28} style={{ color: 'var(--success)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success)', lineHeight: 1 }}>{connected}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Instância{connected !== 1 ? 's' : ''} Conectada{connected !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Pending */}
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <Clock size={28} style={{ color: 'var(--warning)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--warning)', lineHeight: 1 }}>{pending}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Instância{pending !== 1 ? 's' : ''} Pendente{pending !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Total */}
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <Zap size={28} style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-primary)', lineHeight: 1 }}>{connected + pending}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Total de Instâncias</div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
            Configurações da Evolution API
          </h2>
          <form action={saveSettings}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  URL da Evolution API
                </label>
                <input
                  type="url"
                  name="evolutionApiUrl"
                  className="input-glass"
                  placeholder={process.env.EVOLUTION_API_URL || 'https://sua-evolution-api.com.br'}
                  defaultValue={settings?.evolutionApiUrl || ''}
                />
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Sobrescreve a URL padrão definida no servidor. Deixe vazio para usar o padrão.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Token (API Key) da Evolution
                </label>
                <input
                  type="password"
                  name="evolutionApiKey"
                  className="input-glass"
                  placeholder="••••••••••••••••"
                  defaultValue={settings?.evolutionApiKey || ''}
                  autoComplete="new-password"
                />
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Seu token de autenticação da Evolution API. Deixe vazio para usar o padrão do servidor.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Nome Padrão da Instância
                </label>
                <input
                  type="text"
                  name="defaultInstanceName"
                  className="input-glass"
                  placeholder="ex: minha-empresa-whatsapp"
                  defaultValue={settings?.defaultInstanceName || ''}
                />
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Nome pré-preenchido ao criar uma nova instância.
                </p>
              </div>

              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" style={{ gap: '8px' }}>
                  <Save size={16} />
                  Salvar Configurações
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <CopyWebhookScript webhookUrl={webhookUrl} />
    </div>
  )
}

// Client-side copy button functionality
function CopyWebhookScript({ webhookUrl }: { webhookUrl: string }) {
  return (
    <script dangerouslySetInnerHTML={{ __html: `
      document.getElementById('copy-webhook-btn').addEventListener('click', function() {
        navigator.clipboard.writeText(${JSON.stringify(webhookUrl)}).then(() => {
          this.textContent = 'Copiado!';
          this.style.color = 'var(--success)';
          this.style.borderColor = 'rgba(16,185,129,0.3)';
          this.style.background = 'rgba(16,185,129,0.15)';
          setTimeout(() => {
            this.textContent = 'Copiar';
            this.style.color = '';
            this.style.borderColor = '';
            this.style.background = '';
          }, 2000);
        });
      });
    `}} />
  )
}

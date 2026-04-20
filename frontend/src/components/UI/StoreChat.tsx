'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Message {
  id: number;
  sender_role: 'admin' | 'store';
  sender_email: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface StoreChatProps {
  storeId: number;
  storeName?: string;
  currentRole: 'admin' | 'store';
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onUnreadChange?: (count: number) => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function StoreChat({ storeId, storeName, currentRole, apiFetch, onUnreadChange }: StoreChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const senderToRead = currentRole === 'store' ? 'admin' : 'store';

  const unread = messages.filter(m => m.sender_role === senderToRead && !m.read_at).length;

  useEffect(() => { onUnreadChange?.(unread); }, [unread]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/stores/${storeId}/messages`);
      if (!res.ok) return;
      const data: Message[] = await res.json();
      setMessages(data);
    } catch {}
  }, [storeId, apiFetch]);

  const markRead = useCallback(async () => {
    try { await apiFetch(`/api/stores/${storeId}/messages/read`, { method: 'PATCH' }); } catch {}
  }, [storeId, apiFetch]);

  // Poll every 20s
  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  // On open: mark as read + scroll to bottom
  useEffect(() => {
    if (open) {
      markRead();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [open, messages.length]);

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/stores/${storeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: input.trim() }),
      });
      if (res.ok) {
        setInput('');
        await fetchMessages();
        await markRead();
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
    } finally { setSending(false); }
  }

  const isAdmin = currentRole === 'admin';

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', width: '100%', padding: '12px 16px',
          background: open ? 'rgba(200,255,29,0.12)' : 'rgba(255,255,255,0.03)',
          color: open ? '#c8ff1d' : '#888',
          border: `1px solid ${open ? 'rgba(200,255,29,0.3)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
        }}
      >
        <span>💬 {isAdmin ? `Chat con ${storeName || 'Negozio'}` : 'Messaggi Admin'}</span>
        {unread > 0 && (
          <span style={{ marginLeft: 'auto', background: '#ff4444', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '2px 7px', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', width: '360px', height: '480px',
          background: '#141414', border: '1px solid rgba(200,255,29,0.2)',
          borderRadius: '18px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)', zIndex: 9999,
          fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
            <div>
              <p style={{ margin: 0, color: '#c8ff1d', fontWeight: 800, fontSize: '0.9rem' }}>
                💬 {isAdmin ? storeName || 'Negozio' : 'Admin MOTOHUB'}
              </p>
              <p style={{ margin: '1px 0 0', color: '#555', fontSize: '0.65rem' }}>
                {isAdmin ? 'Invia segnalazioni e direttive al negozio' : 'Segnalazioni e messaggi dall\'amministratore'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px' }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            className="chat-scroller">
            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '0.8rem', textAlign: 'center' }}>
                <p>Nessun messaggio.<br />{isAdmin ? 'Invia una segnalazione al negozio.' : 'L\'admin non ha ancora inviato messaggi.'}</p>
              </div>
            )}
            {messages.map(m => {
              const isMine = m.sender_role === currentRole;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  {/* Tag for admin messages shown to store */}
                  {!isAdmin && m.sender_role === 'admin' && (
                    <span style={{ fontSize: '0.58rem', color: '#c8ff1d', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '3px', paddingLeft: '4px' }}>
                      📋 SEGNALAZIONE ADMIN
                    </span>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '9px 13px',
                    background: isMine ? 'rgba(200,255,29,0.12)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isMine ? 'rgba(200,255,29,0.25)' : 'rgba(255,255,255,0.09)'}`,
                    borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    color: '#fff', fontSize: '0.82rem', lineHeight: 1.4,
                  }}>
                    {m.content}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px', paddingLeft: '4px', paddingRight: '4px' }}>
                    <span style={{ fontSize: '0.58rem', color: '#444' }}>{formatTime(m.created_at)}</span>
                    {isMine && (
                      <span style={{ fontSize: '0.58rem', color: m.read_at ? '#c8ff1d' : '#555' }}>
                        {m.read_at ? '✓✓ letto' : '✓ inviato'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', background: '#1a1a1a' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={isAdmin ? 'Scrivi una segnalazione...' : 'Rispondi all\'admin...'}
              style={{
                flex: 1, padding: '10px 14px', background: '#222', color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                fontSize: '0.82rem', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              style={{
                padding: '10px 16px', background: input.trim() ? '#c8ff1d' : '#222',
                color: input.trim() ? '#000' : '#444', border: 'none',
                borderRadius: '10px', cursor: input.trim() ? 'pointer' : 'default',
                fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s',
              }}
            >
              {sending ? '…' : '→'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .chat-scroller::-webkit-scrollbar { width: 3px; }
        .chat-scroller::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>
    </>
  );
}

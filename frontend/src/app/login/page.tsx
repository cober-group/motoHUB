'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === 'admin' ? '/admin' : '/store');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#1d1d1d', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(200,255,29,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(200,255,29,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ margin: 0, color: '#c8ff1d', fontSize: '3rem', fontWeight: 900, letterSpacing: '4px', textShadow: '0 0 30px rgba(200,255,29,0.3)' }}>
            MOTOHUB
          </h1>
          <p style={{ margin: '8px 0 0', color: '#555', fontSize: '0.85rem', letterSpacing: '2px' }}>
            VIRTUAL STORE MANAGER
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px', padding: '36px', display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>EMAIL</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="nome@motohub.it" required autoFocus
              style={{ padding: '14px 18px', background: '#2a2a2a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#c8ff1d'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>PASSWORD</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{ padding: '14px 18px', background: '#2a2a2a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#c8ff1d'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '10px', color: '#ff6666', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            marginTop: '8px', padding: '16px', background: submitting ? '#555' : '#c8ff1d',
            color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900,
            fontSize: '0.95rem', letterSpacing: '2px', cursor: submitting ? 'not-allowed' : 'pointer',
          }}>
            {submitting ? 'ACCESSO...' : 'ACCEDI'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#333', fontSize: '0.75rem' }}>
          Powered by Odoo 18 &amp; Next.js 16
        </p>
      </div>
    </div>
  );
}

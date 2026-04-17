'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { StoreManager } from '@/components/Admin/StoreManager';
import { DashboardShell } from '@/components/Dashboard/DashboardShell';

interface VisitingStore {
  id: number;
  name: string;
  sqm: number;
}

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [visitingStore, setVisitingStore] = useState<VisitingStore | null>(null);
  const [view, setView] = useState<'stores' | 'mystore'>('stores');

  if (loading) return <div style={{ background: '#1d1d1d', minHeight: '100vh' }} />;
  if (!user) { router.replace('/login'); return null; }
  if (user.role !== 'admin') { router.replace('/store'); return null; }

  // Visit mode — full-screen 3D view of a specific store (read-only)
  if (visitingStore) {
    return (
      <DashboardShell
        role="admin"
        storeId={visitingStore.id}
        storeName={visitingStore.name}
        initialSqm={visitingStore.sqm}
        visitMode
        onExitVisit={() => setVisitingStore(null)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1d1d1d', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Sidebar */}
      <div style={{ width: '380px', minWidth: '380px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '30px 24px', gap: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#c8ff1d', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '3px' }}>MOTOHUB</h1>
          <p style={{ margin: '4px 0 0', color: '#555', fontSize: '0.75rem', letterSpacing: '1px' }}>ADMIN CONSOLE</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['stores', 'mystore'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '10px', background: view === v ? '#c8ff1d' : 'rgba(255,255,255,0.04)',
              color: view === v ? '#000' : '#888', border: 'none', borderRadius: '10px',
              fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', letterSpacing: '1px',
            }}>
              {v === 'stores' ? 'NEGOZI' : 'MIO 3D'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'stores' && <StoreManager onVisitStore={s => setVisitingStore(s)} />}
          {view === 'mystore' && (
            <p style={{ color: '#555', fontSize: '0.85rem' }}>Clicca "👁 VISITA" su un negozio per entrare in modalità visita 3D.</p>
          )}
        </div>

        <button onClick={() => { logout(); router.replace('/login'); }} style={{
          padding: '12px', background: 'rgba(255,68,68,0.1)', color: '#ff6666',
          border: '1px solid rgba(255,68,68,0.2)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
        }}>
          LOGOUT
        </button>
      </div>

      {/* Main area placeholder */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: '#333', fontSize: '1rem' }}>Seleziona un negozio e clicca <span style={{ color: '#64a0ff' }}>👁 VISITA</span> per entrare</p>
        <p style={{ color: '#222', fontSize: '0.8rem' }}>oppure gestisci negozi e utenti dalla sidebar</p>
      </div>
    </div>
  );
}

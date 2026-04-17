'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { StoreManager } from '@/components/Admin/StoreManager';
import { DashboardShell } from '@/components/Dashboard/DashboardShell';

interface ActiveStore {
  id: number;
  name: string;
  sqm: number;
  mode: 'visit' | 'edit';
}

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activeStore, setActiveStore] = useState<ActiveStore | null>(null);

  if (loading) return <div style={{ background: '#1d1d1d', minHeight: '100vh' }} />;
  if (!user) { router.replace('/login'); return null; }
  if (user.role !== 'admin') { router.replace('/store'); return null; }

  // Full-screen 3D (visit = read-only, edit = full access)
  if (activeStore) {
    return (
      <DashboardShell
        role="admin"
        storeId={activeStore.id}
        storeName={activeStore.name}
        initialSqm={activeStore.sqm}
        visitMode={activeStore.mode === 'visit'}
        onExitVisit={() => setActiveStore(null)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1d1d1d', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Sidebar */}
      <div style={{ width: '420px', minWidth: '420px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '30px 24px', gap: '24px', height: '100vh', overflow: 'hidden' }}>
        <div>
          <h1 style={{ margin: 0, color: '#c8ff1d', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '3px' }}>MOTOHUB</h1>
          <p style={{ margin: '4px 0 0', color: '#555', fontSize: '0.75rem', letterSpacing: '1px' }}>ADMIN CONSOLE</p>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <StoreManager
            onVisitStore={s => setActiveStore({ ...s, mode: 'visit' })}
            onEditStore={s => setActiveStore({ ...s, mode: 'edit' })}
          />
        </div>

        <button onClick={() => { logout(); router.replace('/login'); }} style={{ padding: '12px', background: 'rgba(255,68,68,0.1)', color: '#ff6666', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
          LOGOUT
        </button>
      </div>

      {/* Main area hint */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
        <p style={{ color: '#2a2a2a', fontSize: '4rem', margin: 0 }}>🏪</p>
        <p style={{ color: '#444', fontSize: '0.95rem', margin: 0 }}>Seleziona un negozio dalla sidebar</p>
        <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
          <span style={{ color: '#555', fontSize: '0.8rem' }}><span style={{ color: '#64a0ff' }}>👁 VISITA</span> — modalità sola lettura</span>
          <span style={{ color: '#555', fontSize: '0.8rem' }}><span style={{ color: '#c8ff1d' }}>✏️ MODIFICA</span> — modifica layout e prodotti</span>
        </div>
      </div>
    </div>
  );
}

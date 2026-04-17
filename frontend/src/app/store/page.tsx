'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DashboardShell } from '@/components/Dashboard/DashboardShell';

export default function StorePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <div style={{ background: '#1d1d1d', minHeight: '100vh' }} />;
  if (!user) { router.replace('/login'); return null; }
  if (user.role !== 'store') { router.replace('/admin'); return null; }
  if (!user.storeId) {
    return (
      <div style={{ background: '#1d1d1d', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#555' }}>
        <p>Nessun negozio assegnato. Contatta l&apos;amministratore.</p>
      </div>
    );
  }

  return (
    <DashboardShell
      role="store"
      storeId={user.storeId}
      storeName={user.store_name}
      initialSqm={user.sqm ?? 150}
    />
  );
}

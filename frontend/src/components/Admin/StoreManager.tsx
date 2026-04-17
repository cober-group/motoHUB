'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiFetch } from '@/context/AuthContext';

interface Store {
  id: number;
  name: string;
  sqm: number;
  odoo_location_id: number | null;
  user_count: number;
}

interface StoreUser {
  id: number;
  email: string;
  role: string;
  created_at: string;
}

interface OdooLocation {
  id: number;
  complete_name: string;
}

interface StoreManagerProps {
  onVisitStore: (store: Store) => void;
}

export function StoreManager({ onVisitStore }: StoreManagerProps) {
  const apiFetch = useApiFetch();
  const [stores, setStores] = useState<Store[]>([]);
  const [locations, setLocations] = useState<OdooLocation[]>([]);
  const [expandedStore, setExpandedStore] = useState<number | null>(null);
  const [storeUsers, setStoreUsers] = useState<Record<number, StoreUser[]>>({});
  const [loading, setLoading] = useState(true);

  // Create store form
  const [newStore, setNewStore] = useState({ name: '', sqm: 150, odoo_location_id: '' });
  const [creatingStore, setCreatingStore] = useState(false);

  // Create user form
  const [newUser, setNewUser] = useState<Record<number, { email: string; password: string }>>({});
  const [creatingUser, setCreatingUser] = useState<number | null>(null);

  const loadStores = useCallback(async () => {
    try {
      const res = await apiFetch('/api/stores');
      setStores(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/odoo/locations');
      const data = await res.json();
      setLocations(data.locations || []);
    } catch { /* non bloccante */ }
  }, [apiFetch]);

  useEffect(() => { loadStores(); loadLocations(); }, [loadStores, loadLocations]);

  const loadUsers = async (storeId: number) => {
    const res = await apiFetch(`/api/stores/${storeId}/users`);
    const users = await res.json();
    setStoreUsers(prev => ({ ...prev, [storeId]: users }));
  };

  const toggleExpand = async (storeId: number) => {
    if (expandedStore === storeId) { setExpandedStore(null); return; }
    setExpandedStore(storeId);
    await loadUsers(storeId);
  };

  const handleCreateStore = async () => {
    if (!newStore.name.trim()) return;
    setCreatingStore(true);
    try {
      await apiFetch('/api/stores', {
        method: 'POST',
        body: JSON.stringify({ ...newStore, odoo_location_id: newStore.odoo_location_id ? parseInt(newStore.odoo_location_id) : null }),
      });
      setNewStore({ name: '', sqm: 150, odoo_location_id: '' });
      await loadStores();
    } finally {
      setCreatingStore(false);
    }
  };

  const handleDeleteStore = async (storeId: number) => {
    if (!confirm('Eliminare questo negozio e tutti i suoi dati?')) return;
    await apiFetch(`/api/stores/${storeId}`, { method: 'DELETE' });
    await loadStores();
  };

  const handleCreateUser = async (storeId: number) => {
    const u = newUser[storeId];
    if (!u?.email || !u?.password) return;
    setCreatingUser(storeId);
    try {
      const res = await apiFetch(`/api/stores/${storeId}/users`, {
        method: 'POST',
        body: JSON.stringify(u),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error); return; }
      setNewUser(prev => ({ ...prev, [storeId]: { email: '', password: '' } }));
      await loadUsers(storeId);
    } finally {
      setCreatingUser(null);
    }
  };

  const handleDeleteUser = async (storeId: number, userId: number) => {
    if (!confirm('Eliminare questo utente?')) return;
    await apiFetch(`/api/stores/${storeId}/users/${userId}`, { method: 'DELETE' });
    await loadUsers(storeId);
  };

  const S: Record<string, any> = {
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', marginBottom: '12px' },
    label: { color: '#888', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '6px', display: 'block' },
    input: { width: '100%', padding: '10px 14px', background: '#2a2a2a', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const },
    btnGreen: { padding: '10px 18px', background: '#c8ff1d', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' as const },
    btnRed: { padding: '8px 14px', background: 'rgba(255,68,68,0.1)', color: '#ff6666', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' },
    btnBlue: { padding: '8px 14px', background: 'rgba(100,160,255,0.1)', color: '#64a0ff', border: '1px solid rgba(100,160,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' },
  };

  if (loading) return <p style={{ color: '#555', textAlign: 'center', padding: '40px' }}>Caricamento negozi...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', overflowY: 'auto' }} className="custom-scroller">

      {/* Create store */}
      <div style={{ ...S.card, border: '1px solid rgba(200,255,29,0.2)', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 16px', color: '#c8ff1d', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '1px' }}>+ NUOVO NEGOZIO</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <span style={S.label}>NOME</span>
            <input style={S.input} placeholder="Es. ITS03 Tradate" value={newStore.name} onChange={e => setNewStore(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <span style={S.label}>MQ</span>
              <input style={S.input} type="number" min={50} max={1000} value={newStore.sqm} onChange={e => setNewStore(p => ({ ...p, sqm: parseInt(e.target.value) }))} />
            </div>
            <div style={{ flex: 2 }}>
              <span style={S.label}>MAGAZZINO ODOO</span>
              <select style={{ ...S.input, cursor: 'pointer' }} value={newStore.odoo_location_id} onChange={e => setNewStore(p => ({ ...p, odoo_location_id: e.target.value }))}>
                <option value="">— Tutti i magazzini —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.complete_name}</option>)}
              </select>
            </div>
          </div>
          <button style={{ ...S.btnGreen, opacity: creatingStore ? 0.6 : 1 }} onClick={handleCreateStore} disabled={creatingStore}>
            {creatingStore ? 'CREAZIONE...' : 'CREA NEGOZIO'}
          </button>
        </div>
      </div>

      {/* Store list */}
      {stores.length === 0 && <p style={{ color: '#555', textAlign: 'center', padding: '20px' }}>Nessun negozio ancora. Creane uno sopra.</p>}
      {stores.map(store => (
        <div key={store.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>{store.name}</p>
              <p style={{ margin: '4px 0 0', color: '#555', fontSize: '0.75rem' }}>{store.sqm} m² · {store.user_count} utenti</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button style={S.btnBlue} onClick={() => onVisitStore(store)}>👁 VISITA</button>
              <button style={S.btnBlue} onClick={() => toggleExpand(store.id)}>{expandedStore === store.id ? '▲ CHIUDI' : '⚙ GESTISCI'}</button>
              <button style={S.btnRed} onClick={() => handleDeleteStore(store.id)}>ELIMINA</button>
            </div>
          </div>

          {expandedStore === store.id && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ ...S.label, marginBottom: '12px' }}>UTENTI NEGOZIO</p>

              {(storeUsers[store.id] || []).map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#222', borderRadius: '8px', marginBottom: '6px' }}>
                  <span style={{ color: '#ccc', fontSize: '0.85rem' }}>{u.email}</span>
                  <button style={S.btnRed} onClick={() => handleDeleteUser(store.id, u.id)}>×</button>
                </div>
              ))}

              {/* Add user */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input
                  style={{ ...S.input, flex: 2 }}
                  placeholder="email@negozio.it"
                  value={newUser[store.id]?.email || ''}
                  onChange={e => setNewUser(p => ({ ...p, [store.id]: { ...p[store.id], email: e.target.value } }))}
                />
                <input
                  style={{ ...S.input, flex: 1 }}
                  type="password" placeholder="Password"
                  value={newUser[store.id]?.password || ''}
                  onChange={e => setNewUser(p => ({ ...p, [store.id]: { ...p[store.id], password: e.target.value } }))}
                />
                <button style={{ ...S.btnGreen, opacity: creatingUser === store.id ? 0.6 : 1 }} onClick={() => handleCreateUser(store.id)} disabled={creatingUser === store.id}>
                  + UTENTE
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

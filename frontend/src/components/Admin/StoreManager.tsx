'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiFetch } from '@/context/AuthContext';
import { StoreChat } from '@/components/UI/StoreChat';

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
  is_editor: boolean;
  created_at: string;
}

interface OdooLocation {
  id: number;
  complete_name: string;
}

interface StoreManagerProps {
  onVisitStore: (store: Store) => void;
  onEditStore: (store: Store) => void;
}

export function StoreManager({ onVisitStore, onEditStore }: StoreManagerProps) {
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
  const [editNames, setEditNames] = useState<Record<number, string>>({});
  const [newUser, setNewUser] = useState<Record<number, { email: string; password: string; is_editor: boolean }>>({});
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

  const toggleExpand = (id: number) => {
    if (expandedStore === id) {
      setExpandedStore(null);
    } else {
      setExpandedStore(id);
      const s = stores.find(st => st.id === id);
      if (s) setEditNames(p => ({ ...p, [id]: s.name }));
      loadUsers(id);
    }
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
    if (!confirm('⚠️ OPERAZIONE IRREVERSIBILE! Sei davvero sicuro di voler procedere con l\'eliminazione definitiva?')) return;
    await apiFetch(`/api/stores/${storeId}`, { method: 'DELETE' });
    await loadStores();
  };

  const handleRenameStore = async (storeId: number) => {
    const newName = editNames[storeId];
    if (!newName) return;
    try {
      await apiFetch(`/api/stores/${storeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName })
      });
      await loadStores();
    } catch (err: any) {
      alert('Errore rinominando: ' + err.message);
    }
  };

  const handleCloneStore = async (storeId: number) => {
    if (!confirm('Clonare questo negozio e il suo layout 3D?')) return;
    try {
      await apiFetch(`/api/stores/${storeId}/clone`, { method: 'POST' });
      await loadStores();
    } catch (err: any) {
      alert('Errore durante la clonazione: ' + err.message);
    }
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
      setNewUser(prev => ({ ...prev, [storeId]: { email: '', password: '', is_editor: true } }));
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

  const handleToggleEditor = async (storeId: number, userId: number, current: boolean) => {
    await apiFetch(`/api/stores/${storeId}/users/${userId}/editor`, {
      method: 'PATCH',
      body: JSON.stringify({ is_editor: !current }),
    });
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
              <button style={{ ...S.btnBlue, color: '#c8ff1d', borderColor: 'rgba(200,255,29,0.3)', background: 'rgba(200,255,29,0.07)' }} onClick={() => onEditStore(store)}>✏️ MODIFICA</button>
              <button style={{ ...S.btnBlue, color: '#ffaa00', borderColor: 'rgba(255,170,0,0.3)', background: 'rgba(255,170,0,0.07)' }} onClick={() => handleCloneStore(store.id)}>👯 CLONA</button>
              <button style={S.btnBlue} onClick={() => toggleExpand(store.id)}>{expandedStore === store.id ? '▲ CHIUDI' : '⚙ GESTISCI'}</button>
              <button style={S.btnRed} onClick={() => handleDeleteStore(store.id)}>ELIMINA</button>
            </div>
          </div>

          {expandedStore === store.id && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

              {/* Rename Store */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ ...S.label, marginBottom: '8px' }}>RINOMINA NEGOZIO</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    style={{ ...S.input, flex: 1 }}
                    value={editNames[store.id] || ''}
                    onChange={e => setEditNames(p => ({ ...p, [store.id]: e.target.value }))}
                  />
                  <button style={S.btnGreen} onClick={() => handleRenameStore(store.id)}>SALVA NOME</button>
                </div>
              </div>

              {/* Chat */}
              <div style={{ marginBottom: '16px' }}>
                <StoreChat
                  storeId={store.id}
                  storeName={store.name}
                  currentRole="admin"
                  apiFetch={apiFetch}
                />
              </div>

              <p style={{ ...S.label, marginBottom: '12px' }}>UTENTI NEGOZIO</p>

              {(storeUsers[store.id] || []).map(u => (
                <div key={u.id} style={{ background: '#222', borderRadius: '8px', marginBottom: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Top row: email + delete */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#ccc', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                    <button style={{ ...S.btnRed, padding: '4px 10px', flexShrink: 0 }} onClick={() => handleDeleteUser(store.id, u.id)}>× Elimina</button>
                  </div>
                  {/* Bottom row: badge + toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: u.is_editor ? 'rgba(200,255,29,0.1)' : 'rgba(255,100,100,0.1)', color: u.is_editor ? '#c8ff1d' : '#ff6666', border: `1px solid ${u.is_editor ? 'rgba(200,255,29,0.25)' : 'rgba(255,100,100,0.25)'}` }}>
                      {u.is_editor ? '✏️ EDITOR' : '👁 SOLA LETTURA'}
                    </span>
                    <button
                      onClick={() => handleToggleEditor(store.id, u.id, u.is_editor)}
                      style={{ padding: '3px 10px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                    >
                      {u.is_editor ? 'Rimuovi permesso' : 'Concedi permesso'}
                    </button>
                  </div>
                </div>
              ))}

              {/* Add user */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    style={{ ...S.input, flex: 2 }}
                    placeholder="email@negozio.it"
                    value={newUser[store.id]?.email || ''}
                    onChange={e => setNewUser(p => ({ ...p, [store.id]: { ...p[store.id], email: e.target.value, is_editor: p[store.id]?.is_editor ?? true } }))}
                  />
                  <input
                    style={{ ...S.input, flex: 1 }}
                    type="password" placeholder="Password"
                    value={newUser[store.id]?.password || ''}
                    onChange={e => setNewUser(p => ({ ...p, [store.id]: { ...p[store.id], password: e.target.value, is_editor: p[store.id]?.is_editor ?? true } }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={newUser[store.id]?.is_editor ?? true}
                      onChange={e => setNewUser(p => ({ ...p, [store.id]: { ...p[store.id], email: p[store.id]?.email || '', password: p[store.id]?.password || '', is_editor: e.target.checked } }))}
                      style={{ accentColor: '#c8ff1d', width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#aaa', fontSize: '0.78rem' }}>Permesso editor (può modificare il layout)</span>
                  </label>
                  <button style={{ ...S.btnGreen, opacity: creatingUser === store.id ? 0.6 : 1 }} onClick={() => handleCreateUser(store.id)} disabled={creatingUser === store.id}>
                    + UTENTE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

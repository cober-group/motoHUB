'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StoreScene } from '@/components/Three/StoreScene';
import { ProductModal } from '@/components/UI/ProductModal';
import { useAuth, useApiFetch } from '@/context/AuthContext';
import { PlacedItem } from '@/types/store';

export interface DashboardShellProps {
  role: 'admin' | 'store';
  storeId?: number;        // which store to show (admin visit / store user)
  storeName?: string;
  initialSqm?: number;
  visitMode?: boolean;     // admin read-only visit
  onExitVisit?: () => void;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 20;

export function DashboardShell({ role, storeId, storeName, initialSqm, visitMode = false, onExitVisit }: DashboardShellProps) {
  const { user, token, logout } = useAuth();
  const apiFetch = useApiFetch();
  const router = useRouter();

  const isAdmin = role === 'admin';
  // store users can edit furniture/products but NOT dimensions
  const canEditLayout = !visitMode;
  const canEditDimensions = isAdmin && !visitMode;

  const resolvedStoreId = storeId ?? user?.storeId ?? null;

  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [isInventoryMode, setIsInventoryMode] = useState(false);
  const [sqm, setSqm] = useState(initialSqm ?? 150);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(true);

  // Product modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean; itemId: string; shelfIndex: number; title: string; type: 'helmet' | 'jacket' | 'central';
  }>({ isOpen: false, itemId: '', shelfIndex: 0, title: '', type: 'helmet' });
  const [modalProducts, setModalProducts] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isModalLoadingMore, setIsModalLoadingMore] = useState(false);
  const [modalHasMore, setModalHasMore] = useState(false);
  const modalOffsetRef = useRef(0);
  const modalTypeRef = useRef('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    setMounted(true);
  }, [token, router]);

  // ── Load layout from API ──────────────────────────────────────
  useEffect(() => {
    if (!mounted || !resolvedStoreId) { setLayoutLoading(false); return; }
    apiFetch(`/api/stores/${resolvedStoreId}/layout`)
      .then(r => r.json())
      .then(data => {
        setPlacedItems(data.items || []);
        setLayoutLoading(false);
      })
      .catch(() => setLayoutLoading(false));
  }, [mounted, resolvedStoreId]);

  // ── Debounced layout save ─────────────────────────────────────
  const saveLayout = useCallback((items: PlacedItem[]) => {
    if (!resolvedStoreId || visitMode) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiFetch(`/api/stores/${resolvedStoreId}/layout`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
      }).catch(console.error);
    }, 800);
  }, [resolvedStoreId, visitMode, apiFetch]);

  const dimensions = {
    length: Math.sqrt(sqm * 2) / 2,
    width: Math.sqrt(sqm / 2) / 2,
  };

  // ── Layout mutations ──────────────────────────────────────────
  const addItem = (type: PlacedItem['type']) => {
    if (!canEditLayout) return;
    const item: PlacedItem = { id: Math.random().toString(36).slice(2, 11), type, position: [0, 0, 0], rotation: [0, 0, 0] };
    setPlacedItems(prev => { const next = [...prev, item]; saveLayout(next); return next; });
  };

  const updateItem = (id: string, position: [number, number, number], rotation: [number, number, number]) => {
    setPlacedItems(prev => { const next = prev.map(i => i.id === id ? { ...i, position, rotation } : i); saveLayout(next); return next; });
  };

  const removeItem = (id: string) => {
    if (!canEditLayout) return;
    setPlacedItems(prev => { const next = prev.filter(i => i.id !== id); saveLayout(next); return next; });
  };

  const assignProduct = (itemId: string, shelfIndex: number, product: any) => {
    setPlacedItems(prev => {
      const next = prev.map(i => i.id === itemId ? { ...i, assignedProducts: { ...i.assignedProducts, [shelfIndex]: product } } : i);
      saveLayout(next);
      return next;
    });
  };

  const clearStore = () => {
    if (!canEditLayout) return;
    if (!window.confirm('Svuotare completamente il negozio?')) return;
    setPlacedItems([]);
    saveLayout([]);
  };

  const handleSqmChange = (val: number) => {
    setSqm(val);
    if (!resolvedStoreId) return;
    apiFetch(`/api/stores/${resolvedStoreId}`, { method: 'PATCH', body: JSON.stringify({ sqm: val }) }).catch(console.error);
  };

  // ── Product modal ─────────────────────────────────────────────
  const fetchModalProducts = async (type: string, offset: number, append: boolean) => {
    if (offset === 0) setIsModalLoading(true); else setIsModalLoadingMore(true);
    try {
      const res = await fetch(
        `${API}/api/odoo/products?fixture_type=${type}&offset=${offset}&limit=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const incoming = data.products || [];
      setModalProducts(prev => append ? [...prev, ...incoming] : incoming);
      setModalHasMore(incoming.length === PAGE_SIZE);
      modalOffsetRef.current = offset + incoming.length;
    } catch (err) {
      console.error('Fetch products error:', err);
    } finally {
      setIsModalLoading(false);
      setIsModalLoadingMore(false);
    }
  };

  const handleOpenSelector = async (itemId: string, shelfIndex: number, type: 'helmet' | 'jacket' | 'central') => {
    if (visitMode) return;
    modalOffsetRef.current = 0;
    modalTypeRef.current = type;
    setModalProducts([]);
    setModalConfig({ isOpen: true, itemId, shelfIndex, type, title: `Seleziona Prodotto — ${type === 'helmet' ? 'Casco' : type === 'jacket' ? 'Giacca' : 'Arredo Centrale'}` });
    await fetchModalProducts(type, 0, false);
  };

  const handleLoadMore = () => {
    if (isModalLoadingMore || !modalHasMore) return;
    fetchModalProducts(modalTypeRef.current, modalOffsetRef.current, true);
  };

  const handleModalSelect = (product: any) => {
    assignProduct(modalConfig.itemId, modalConfig.shelfIndex, product);
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleExit = () => {
    setExiting(true);
    if (visitMode && onExitVisit) { onExitVisit(); return; }
    logout();
    router.replace('/login');
  };

  if (!mounted || layoutLoading) {
    return <div style={{ background: '#1d1d1d', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#555' }}>Caricamento negozio...</p>
    </div>;
  }

  // Capacity calc
  const cornerMargin = 0.8, wallLen = 3.5, bodyW = 3.0;
  const availX = (dimensions.width * 2) - 2 * cornerMargin;
  const availZ = (dimensions.length * 2) - 2 * cornerMargin;
  const sX = Math.max(1, Math.floor((availX - bodyW) / wallLen) + 1);
  const sZ = Math.max(1, Math.floor((availZ - bodyW) / wallLen) + 1);
  const maxSlots = (sX * 2) + (sZ * 2);
  const wallItems = placedItems.filter(i => i.type === 'helmet' || i.type === 'jacket').length;
  const isOverflowing = wallItems > maxSlots;

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#1d1d1d', overflow: 'hidden', position: 'relative' }}>

      {/* Visit mode banner */}
      {visitMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10001, background: 'rgba(100,160,255,0.15)', borderBottom: '1px solid rgba(100,160,255,0.3)', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64a0ff', fontWeight: 'bold', fontSize: '0.85rem' }}>👁 MODALITÀ VISITA — {storeName}</span>
          <button onClick={handleExit} style={{ padding: '6px 16px', background: '#64a0ff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>← TORNA ALLA CONSOLE</button>
        </div>
      )}

      {/* Sidebar */}
      <div style={{
        position: 'absolute', top: visitMode ? 48 : 20, left: 20, bottom: 20, width: '340px',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px',
        borderRadius: '24px', background: 'rgba(29,29,29,0.96)',
        border: `2px solid ${visitMode ? 'rgba(100,160,255,0.3)' : 'rgba(200,255,29,0.3)'}`,
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, color: '#c8ff1d', fontSize: '2rem', fontWeight: 900, letterSpacing: '2px' }}>MOTOHUB</h1>
            <p style={{ margin: '2px 0 0', color: '#555', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {visitMode ? `VISITA: ${storeName}` : isAdmin ? 'ADMIN CONSOLE' : 'SHOP EXPERIENCE'}
            </p>
          </div>
          {!visitMode && (
            <button onClick={handleExit} style={{ padding: '10px 18px', background: '#ff1d1d', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {isAdmin ? '← ADMIN' : 'LOGOUT'}
            </button>
          )}
        </div>

        {/* Store info */}
        <div style={{ padding: '16px', background: 'rgba(200,255,29,0.05)', border: '1px solid rgba(200,255,29,0.15)', borderRadius: '14px' }}>
          <h2 style={{ margin: '0 0 4px', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold' }}>{storeName || `Store #${resolvedStoreId}`}</h2>
          <p style={{ margin: 0, color: '#c8ff1d', fontSize: '0.7rem', fontWeight: 'bold' }}>📡 Odoo 18 Connected</p>
        </div>

        {/* Dimensions (admin only, not in visit mode) */}
        {canEditDimensions && (
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c8ff1d', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>
              <span>Dimensioni Negozio</span><span>{sqm} m²</span>
            </div>
            <input type="range" min="50" max="1000" step="10" value={sqm} onChange={e => handleSqmChange(parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#c8ff1d' }} />
            <div style={{ marginTop: '12px', padding: '10px', background: isOverflowing ? 'rgba(255,68,68,0.15)' : 'rgba(200,255,29,0.05)', borderRadius: '10px', border: `1px solid ${isOverflowing ? '#ff4444' : 'rgba(200,255,29,0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isOverflowing ? '#ff6666' : '#c8ff1d', fontWeight: 'bold' }}>
                <span>Arredi a Parete:</span><span>{wallItems} / {maxSlots}</span>
              </div>
            </div>
          </div>
        )}

        {/* Furniture buttons (admin + store, not in visit mode) */}
        {canEditLayout && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }} className="custom-scroller">
            <p style={{ color: '#555', fontSize: '0.7rem', fontWeight: 'bold', margin: 0 }}>ELEMENTI ARREDO</p>
            <button onClick={() => addItem('helmet')} className="boost-btn-brute">+ Espositore Caschi</button>
            <button onClick={() => addItem('jacket')} className="boost-btn-brute">+ Rella Giacche</button>
            <button onClick={() => addItem('central')} className="boost-btn-brute">+ Isola Centrale</button>
          </div>
        )}

        {canEditLayout && (
          <button onClick={clearStore} style={{ padding: '12px', background: 'rgba(255,68,68,0.1)', color: '#ff6666', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
            🗑️ SVUOTA NEGOZIO
          </button>
        )}
      </div>

      {/* Top-right controls */}
      {!visitMode && (
        <div style={{ position: 'absolute', top: 25, right: 25, zIndex: 100, display: 'flex', gap: '12px' }}>
          <button onClick={() => setIsInventoryMode(!isInventoryMode)} style={{ padding: '12px 22px', background: isInventoryMode ? '#c8ff1d' : '#222', color: isInventoryMode ? '#000' : '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: isInventoryMode ? '0 0 20px rgba(200,255,29,0.4)' : 'none' }}>
            {isInventoryMode ? '📦 GESTIONE ON' : '📦 GESTIONE'}
          </button>
        </div>
      )}

      {/* 3D Scene */}
      {!exiting && (
        <StoreScene
          key={sqm}
          placedItems={placedItems}
          isEditMode={!visitMode && isInventoryMode && !modalConfig.isOpen}
          isAdmin={canEditLayout}
          width={dimensions.width}
          depth={dimensions.length}
          focusedItemId={focusedItemId}
          onFocusItem={setFocusedItemId}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onOpenSelector={handleOpenSelector}
        />
      )}

      {/* Product Modal */}
      <ProductModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        products={modalProducts}
        onSelect={handleModalSelect}
        loading={isModalLoading}
        loadingMore={isModalLoadingMore}
        hasMore={modalHasMore}
        onLoadMore={handleLoadMore}
      />

      <style>{`
        .boost-btn-brute { padding: 12px 16px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); text-align: left; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 0.8rem; transition: transform 0.2s; width: 100%; }
        .boost-btn-brute:hover { background: rgba(200,255,29,0.1); border-color: #c8ff1d; transform: translateX(4px); }
        .custom-scroller::-webkit-scrollbar { width: 4px; }
        .custom-scroller::-webkit-scrollbar-thumb { background: #c8ff1d; border-radius: 2px; }
      `}</style>
    </main>
  );
}

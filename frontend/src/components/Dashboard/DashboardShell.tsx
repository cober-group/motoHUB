'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StoreScene } from '@/components/Three/StoreScene';
import { ProductModal } from '@/components/UI/ProductModal';
import { BarcodeModal } from '@/components/UI/BarcodeModal';
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

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
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

  // Barcode modal
  const [barcodeItemId, setBarcodeItemId] = useState<string | null>(null);

  const fetchProductByBarcode = useCallback(async (barcode: string) => {
    const res = await apiFetch(`/api/odoo/barcode?barcode=${encodeURIComponent(barcode)}`);
    if (res.status === 404) return null;
    const data = await res.json();
    return data.product ?? null;
  }, [apiFetch]);

  const handleOpenBarcodeScanner = (itemId: string) => {
    if (visitMode) return;
    setBarcodeItemId(itemId);
  };

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

  const handleBarcodeAssign = (product: any): boolean => {
    if (!barcodeItemId) return false;
    const item = placedItems.find(i => i.id === barcodeItemId);
    if (!item) return false;
    const maxSlots = item.type === 'helmet' ? 40 : item.type === 'jacket' ? 16 : 9;
    const assigned = item.assignedProducts || {};
    for (let i = 0; i < maxSlots; i++) {
      if (!assigned[i]) { assignProduct(barcodeItemId, i, product); return true; }
    }
    return false;
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
    if (onExitVisit) { onExitVisit(); return; }
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
    <main style={{ width: '100vw', height: '100vh', background: '#1d1d1d', overflow: 'hidden', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: '380px', minWidth: '380px', height: '100vh', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '30px 24px', gap: '24px', zIndex: 10, background: '#1d1d1d', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, color: '#c8ff1d', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '3px' }}>MOTOHUB</h1>
            <p style={{ margin: '4px 0 0', color: '#555', fontSize: '0.75rem', letterSpacing: '1px' }}>
              {visitMode ? 'VISITA NEGOZIO' : isAdmin ? 'ADMIN CONSOLE' : 'SHOP EXPERIENCE'}
            </p>
          </div>
          <button onClick={handleExit} style={{ padding: '10px 16px', background: isAdmin && onExitVisit ? 'rgba(200,255,29,0.1)' : 'rgba(255,68,68,0.1)', color: isAdmin && onExitVisit ? '#c8ff1d' : '#ff6666', border: `1px solid ${isAdmin && onExitVisit ? 'rgba(200,255,29,0.2)' : 'rgba(255,68,68,0.2)'}`, borderRadius: '10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {isAdmin && onExitVisit ? '← ADMIN' : 'LOGOUT'}
          </button>
        </div>

        {/* Store info card */}
        <div style={{ padding: '16px 18px', background: 'rgba(200,255,29,0.05)', border: '1px solid rgba(200,255,29,0.12)', borderRadius: '12px', flexShrink: 0 }}>
          <p style={{ margin: '0 0 2px', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold' }}>{storeName || `Store #${resolvedStoreId}`}</p>
          <p style={{ margin: 0, color: '#c8ff1d', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>📡 Odoo 18 Connected</p>
        </div>

        {/* Visit mode badge */}
        {visitMode && (
          <div style={{ padding: '10px 14px', background: 'rgba(100,160,255,0.08)', border: '1px solid rgba(100,160,255,0.2)', borderRadius: '10px', flexShrink: 0 }}>
            <p style={{ margin: 0, color: '#64a0ff', fontSize: '0.75rem', fontWeight: 'bold' }}>👁 MODALITÀ SOLA LETTURA</p>
          </div>
        )}

        {/* Dimensions */}
        {canEditDimensions && (
          <div style={{ padding: '18px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c8ff1d', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '10px' }}>
              <span>Dimensioni Negozio</span><span>{sqm} m²</span>
            </div>
            <input type="range" min="50" max="1000" step="10" value={sqm} onChange={e => handleSqmChange(parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#c8ff1d' }} />
            <div style={{ marginTop: '10px', padding: '8px 12px', background: isOverflowing ? 'rgba(255,68,68,0.1)' : 'rgba(200,255,29,0.04)', borderRadius: '8px', border: `1px solid ${isOverflowing ? 'rgba(255,68,68,0.3)' : 'rgba(200,255,29,0.15)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isOverflowing ? '#ff6666' : '#c8ff1d', fontWeight: 'bold' }}>
                <span>Arredi a Parete</span><span>{wallItems} / {maxSlots}</span>
              </div>
            </div>
          </div>
        )}

        {/* Furniture buttons */}
        {canEditLayout && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', minHeight: 0 }} className="custom-scroller">
            <p style={{ color: '#555', fontSize: '0.7rem', fontWeight: 'bold', margin: '0 0 4px', letterSpacing: '1px' }}>ELEMENTI ARREDO</p>
            <button onClick={() => addItem('helmet')} className="boost-btn-brute">+ Espositore Caschi</button>
            <button onClick={() => addItem('jacket')} className="boost-btn-brute">+ Rella Giacche</button>
            <button onClick={() => addItem('central')} className="boost-btn-brute">+ Isola Centrale</button>
          </div>
        )}

        {/* Gestione button (inventory toggle) */}
        {canEditLayout && (
          <button onClick={() => setIsInventoryMode(!isInventoryMode)} style={{ padding: '12px', background: isInventoryMode ? 'rgba(200,255,29,0.12)' : 'rgba(255,255,255,0.03)', color: isInventoryMode ? '#c8ff1d' : '#888', border: `1px solid ${isInventoryMode ? 'rgba(200,255,29,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>
            {isInventoryMode ? '📦 GESTIONE ATTIVA' : '📦 ATTIVA GESTIONE'}
          </button>
        )}

        {/* Clear store */}
        {canEditLayout && (
          <button onClick={clearStore} style={{ padding: '12px', background: 'rgba(255,68,68,0.08)', color: '#ff6666', border: '1px solid rgba(255,68,68,0.15)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>
            🗑️ SVUOTA NEGOZIO
          </button>
        )}
      </div>

      {/* ── 3D Scene (fills remaining space) ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!exiting && (
          <StoreScene
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
            onOpenBarcodeScanner={handleOpenBarcodeScanner}
          />
        )}
      </div>

      {/* Barcode Modal */}
      <BarcodeModal
        isOpen={!!barcodeItemId}
        onClose={() => setBarcodeItemId(null)}
        onAssign={handleBarcodeAssign}
        fetchProductByBarcode={fetchProductByBarcode}
        filledCount={barcodeItemId ? Object.keys(placedItems.find(i => i.id === barcodeItemId)?.assignedProducts || {}).length : 0}
        totalSlots={barcodeItemId ? (placedItems.find(i => i.id === barcodeItemId)?.type === 'helmet' ? 40 : 16) : 0}
      />

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

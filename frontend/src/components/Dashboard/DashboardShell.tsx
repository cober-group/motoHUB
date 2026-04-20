'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StoreScene } from '@/components/Three/StoreScene';
import { ProductModal } from '@/components/UI/ProductModal';
import { BarcodeModal } from '@/components/UI/BarcodeModal';
import { StoreChat } from '@/components/UI/StoreChat';
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

export function DashboardShell({ role, storeId, storeName, visitMode = false, onExitVisit }: DashboardShellProps) {
  const { user, token, logout } = useAuth();
  const apiFetch = useApiFetch();
  const router = useRouter();

  const isAdmin = role === 'admin';
  const isEditor = isAdmin || (user?.isEditor !== false);
  const canEditLayout = !visitMode && isEditor;
  const canEditDimensions = isAdmin && !visitMode;

  const resolvedStoreId = storeId ?? user?.storeId ?? null;

  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [isInventoryMode, setIsInventoryMode] = useState(false);
  const [widthM, setWidthM] = useState(15);
  const [depthM, setDepthM] = useState(10);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [focusedProductIndex, setFocusedProductIndex] = useState<number | null>(null);
  const [productStats, setProductStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [layoutLoading, setLayoutLoading] = useState(true);

  const exposedProducts = useMemo(() => {
    const list: any[] = [];
    placedItems.forEach(item => {
      Object.entries(item.assignedProducts || {}).forEach(([slotIndex, product]) => {
        list.push({
          itemId: item.id,
          slotIndex: parseInt(slotIndex),
          product,
          type: item.type
        });
      });
    });
    return list;
  }, [placedItems]);

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

  // ── Fetch product stats when focused product changes ──────────
  useEffect(() => {
    if (focusedProductIndex === null) { setProductStats(null); return; }
    const product = exposedProducts[focusedProductIndex]?.product;
    if (!product?.id) return;
    setStatsLoading(true);
    setProductStats(null);
    apiFetch(`/api/odoo/product/${product.id}/stats`)
      .then(r => r.json())
      .then(data => { setProductStats(data.stats); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }, [focusedProductIndex]);

  // ── Load layout from API ──────────────────────────────────────
  useEffect(() => {
    if (!mounted || !resolvedStoreId) { setLayoutLoading(false); return; }
    apiFetch(`/api/stores/${resolvedStoreId}/layout`)
      .then(r => r.json())
      .then(data => {
        setPlacedItems(data.items || []);
        if (data.widthM) setWidthM(data.widthM);
        if (data.depthM) setDepthM(data.depthM);
        setLayoutLoading(false);
      })
      .catch(() => setLayoutLoading(false));
  }, [mounted, resolvedStoreId]);

  // ── Debounced layout save ─────────────────────────────────────
  const saveLayout = useCallback((items: PlacedItem[], wM = widthM, dM = depthM) => {
    if (!resolvedStoreId || visitMode) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      apiFetch(`/api/stores/${resolvedStoreId}/layout`, {
        method: 'PUT',
        body: JSON.stringify({ items, widthM: wM, depthM: dM }),
      }).catch(console.error);
    }, 800);
  }, [resolvedStoreId, visitMode, apiFetch, widthM, depthM]);

  // Three.js uses half-sizes: room spans [-width, +width] × [-depth, +depth]
  const dimensions = {
    width: widthM / 2,
    length: depthM / 2,
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
    const maxSlots = item.type === 'helmet' ? 40 : item.type === 'jacket' ? 16 : 6;
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

  const handleDimensionChange = (w: number, d: number) => {
    setWidthM(w);
    setDepthM(d);
    saveLayout(placedItems, w, d);
    if (resolvedStoreId)
      apiFetch(`/api/stores/${resolvedStoreId}`, { method: 'PATCH', body: JSON.stringify({ sqm: w * d }) }).catch(console.error);
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

  const nextProduct = useCallback(() => {
    if (focusedProductIndex === null || exposedProducts.length === 0) return;
    setFocusedProductIndex((focusedProductIndex + 1) % exposedProducts.length);
  }, [focusedProductIndex, exposedProducts.length]);

  const prevProduct = useCallback(() => {
    if (focusedProductIndex === null || exposedProducts.length === 0) return;
    setFocusedProductIndex((focusedProductIndex - 1 + exposedProducts.length) % exposedProducts.length);
  }, [focusedProductIndex, exposedProducts.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusedProductIndex === null) return;
      if (e.key === 'ArrowRight') nextProduct();
      if (e.key === 'ArrowLeft') prevProduct();
      if (e.key === 'Escape') {
        setFocusedProductIndex(null);
        setFocusedItemId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedProductIndex, nextProduct, prevProduct]);

  const handleProductFocus = (itemId: string, slotIndex: number) => {
    const idx = exposedProducts.findIndex(p => p.itemId === itemId && p.slotIndex === slotIndex);
    if (idx !== -1) {
      setFocusedProductIndex(idx);
      setFocusedItemId(itemId);
    }
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
  const maxFurnitureSlots = (sX * 2) + (sZ * 2);
  const wallItems = placedItems.filter(i => i.type === 'helmet' || i.type === 'jacket').length;
  const isFurnitureOverflowing = wallItems >= maxFurnitureSlots;

  const currentFocusedProduct = focusedProductIndex !== null ? exposedProducts[focusedProductIndex] : null;

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
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c8ff1d', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '12px' }}>
              <span>Dimensioni Negozio</span><span>{widthM} × {depthM} m = {widthM * depthM} m²</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888', marginBottom: '4px' }}>
                  <span>Larghezza</span><span style={{ color: '#c8ff1d' }}>{widthM} m</span>
                </div>
                <input type="range" min="5" max="50" step="1" value={widthM} onChange={e => handleDimensionChange(parseInt(e.target.value), depthM)} style={{ width: '100%', cursor: 'pointer', accentColor: '#c8ff1d' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888', marginBottom: '4px' }}>
                  <span>Profondità</span><span style={{ color: '#c8ff1d' }}>{depthM} m</span>
                </div>
                <input type="range" min="5" max="50" step="1" value={depthM} onChange={e => handleDimensionChange(widthM, parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer', accentColor: '#c8ff1d' }} />
              </div>
            </div>
            <div style={{ marginTop: '10px', padding: '8px 12px', background: isFurnitureOverflowing ? 'rgba(255,68,68,0.1)' : 'rgba(200,255,29,0.04)', borderRadius: '8px', border: `1px solid ${isFurnitureOverflowing ? 'rgba(255,68,68,0.3)' : 'rgba(200,255,29,0.15)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: isFurnitureOverflowing ? '#ff6666' : '#c8ff1d', fontWeight: 'bold' }}>
                <span>Arredi a Parete</span><span>{wallItems} / {maxFurnitureSlots}</span>
              </div>
            </div>
          </div>
        )}

        {/* Furniture buttons */}
        {canEditLayout && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', minHeight: 0 }} className="custom-scroller">
            <p style={{ color: '#555', fontSize: '0.7rem', fontWeight: 'bold', margin: '0 0 4px', letterSpacing: '1px' }}>ELEMENTI ARREDO</p>
            <button onClick={() => addItem('helmet')} disabled={isFurnitureOverflowing} className="boost-btn-brute" style={{ opacity: isFurnitureOverflowing ? 0.4 : 1, cursor: isFurnitureOverflowing ? 'not-allowed' : 'pointer' }}>+ Espositore Caschi</button>
            <button onClick={() => addItem('jacket')} disabled={isFurnitureOverflowing} className="boost-btn-brute" style={{ opacity: isFurnitureOverflowing ? 0.4 : 1, cursor: isFurnitureOverflowing ? 'not-allowed' : 'pointer' }}>+ Rella Giacche</button>
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

        {/* Chat */}
        {resolvedStoreId && (
          <StoreChat
            storeId={resolvedStoreId}
            storeName={storeName}
            currentRole={role}
            apiFetch={apiFetch}
          />
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
            focusedProductIndex={focusedProductIndex}
            exposedProducts={exposedProducts}
            onFocusItem={(id) => { setFocusedItemId(id); setFocusedProductIndex(null); }}
            onFocusProduct={handleProductFocus}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onOpenSelector={handleOpenSelector}
            onOpenBarcodeScanner={handleOpenBarcodeScanner}
          />
        )}

        {/* --- Product Gallery UI --- */}
        {currentFocusedProduct && (
          <>
            {/* Arrows */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', zIndex: 100 }}>
              <button 
                onClick={(e) => { e.stopPropagation(); prevProduct(); }} 
                className="gal-nav-btn"
                style={{ pointerEvents: 'auto' }}
              >
                ←
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); nextProduct(); }} 
                className="gal-nav-btn"
                style={{ pointerEvents: 'auto' }}
              >
                →
              </button>
            </div>

            {/* Close Button Top Right */}
            <button 
              onClick={() => { setFocusedProductIndex(null); setFocusedItemId(null); }}
              style={{ position: 'absolute', top: '30px', left: '30px', width: '50px', height: '50px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '25px', cursor: 'pointer', zIndex: 110, fontSize: '1.2rem', backdropFilter: 'blur(10px)' }}
            >
              ✕
            </button>

            {/* Analytics Card */}
            {(() => {
              const p = currentFocusedProduct.product;
              const s = productStats;
              const price = p.list_price ?? 0;
              const cost = s?.standard_price ?? 0;
              const qty = s?.qty_available ?? p.qty_available ?? 0;
              const sold30 = s?.sold30 ?? 0;
              const sold90 = s?.sold90 ?? 0;
              const margin = cost > 0 ? ((price - cost) / price * 100) : null;
              const stockValue = qty * cost;
              const dailyRate = sold90 / 90;
              const coverageDays = dailyRate > 0 ? Math.round(qty / dailyRate) : null;
              const abcClass = sold90 > 20 ? 'A' : sold90 > 5 ? 'B' : 'C';
              const abcColor = abcClass === 'A' ? '#c8ff1d' : abcClass === 'B' ? '#ffaa00' : '#888';
              const imgSrc = p.image_128 ? (p.image_128.startsWith('data') ? p.image_128 : `data:image/png;base64,${p.image_128}`) : null;
              const variant = (() => { const dn = p.display_name || ''; const rest = dn.slice((p.name || '').length).trim(); return rest.startsWith('(') && rest.endsWith(')') ? rest.slice(1, -1) : rest; })();

              return (
                <div style={{ position: 'absolute', top: '24px', right: '24px', width: '300px', background: 'rgba(18,18,18,0.92)', backdropFilter: 'blur(24px)', border: '1px solid rgba(200,255,29,0.15)', borderRadius: '20px', zIndex: 120, boxShadow: '0 24px 48px rgba(0,0,0,0.5)', color: '#fff', pointerEvents: 'none', overflow: 'hidden' }}>

                  {/* Header */}
                  <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '64px', height: '64px', background: '#111', borderRadius: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
                      {imgSrc ? <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '1.6rem' }}>📦</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.3 }}>{p.name}</p>
                      {variant && <p style={{ margin: '2px 0', color: '#88aaff', fontSize: '0.72rem' }}>{variant}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ color: '#c8ff1d', fontWeight: 800, fontSize: '1rem' }}>€{price.toFixed(2)}</span>
                        <span style={{ background: abcColor, color: '#000', fontSize: '0.6rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px' }}>CLASSE {abcClass}</span>
                      </div>
                      {p.default_code && <p style={{ margin: '2px 0 0', color: '#444', fontSize: '0.62rem', letterSpacing: '0.5px' }}>SKU: {p.default_code}</p>}
                    </div>
                  </div>

                  {statsLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.8rem' }}>
                      <div style={{ width: '20px', height: '20px', border: '2px solid #c8ff1d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                      Caricamento statistiche...
                    </div>
                  ) : (
                    <>
                      {/* KPI grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          { label: 'GIACENZA', value: `${qty} pz`, color: qty < 3 ? '#ff6666' : '#fff' },
                          { label: 'MARGINE', value: margin !== null ? `${margin.toFixed(0)}%` : '—', color: margin !== null && margin > 30 ? '#c8ff1d' : margin !== null && margin > 15 ? '#ffaa00' : '#ff6666' },
                          { label: 'COSTO', value: cost > 0 ? `€${cost.toFixed(0)}` : '—', color: '#888' },
                        ].map(k => (
                          <div key={k.label} style={{ padding: '10px 8px', background: 'rgba(0,0,0,0.3)', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.55rem', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>{k.label}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.9rem', fontWeight: 800, color: k.color }}>{k.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Sales */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          { label: 'VENDUTO 30gg', value: `${sold30} pz`, sub: sold30 > 0 ? `≈ ${(sold30 / 30).toFixed(1)}/gg` : 'nessuna vendita' },
                          { label: 'VENDUTO 90gg', value: `${sold90} pz`, sub: sold90 > 0 ? `≈ ${(sold90 / 90).toFixed(1)}/gg` : 'nessuna vendita' },
                        ].map(k => (
                          <div key={k.label} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)' }}>
                            <p style={{ margin: 0, fontSize: '0.55rem', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>{k.label}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{k.value}</p>
                            <p style={{ margin: 0, fontSize: '0.62rem', color: '#666' }}>{k.sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* Bottom row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          { label: 'GIORNI SCORTA', value: coverageDays !== null ? `${coverageDays}gg` : '∞', color: coverageDays !== null && coverageDays < 14 ? '#ff6666' : coverageDays !== null && coverageDays < 30 ? '#ffaa00' : '#c8ff1d' },
                          { label: 'VALORE STOCK', value: stockValue > 0 ? `€${stockValue.toFixed(0)}` : '—', color: '#fff' },
                        ].map(k => (
                          <div key={k.label} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)' }}>
                            <p style={{ margin: 0, fontSize: '0.55rem', color: '#555', fontWeight: 700, letterSpacing: '0.5px' }}>{k.label}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 800, color: k.color }}>{k.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Insight */}
                      <div style={{ padding: '10px 14px' }}>
                        {qty < 3 && <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#ff6666' }}>⚠ Scorta critica — considera il riordino</p>}
                        {coverageDays !== null && coverageDays < 14 && <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#ffaa00' }}>⏱ Copertura &lt; 2 settimane</p>}
                        {abcClass === 'A' && <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#c8ff1d' }}>⭐ Top performer — posizione privilegiata consigliata</p>}
                        {abcClass === 'C' && sold90 === 0 && <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#888' }}>💤 Nessuna vendita negli ultimi 90 giorni</p>}
                        {margin !== null && margin < 15 && <p style={{ margin: 0, fontSize: '0.72rem', color: '#ff9966' }}>📉 Margine basso — verifica il prezzo</p>}
                        {qty >= 3 && abcClass !== 'C' && coverageDays === null || (coverageDays !== null && coverageDays >= 30 && qty >= 3 && abcClass !== 'A') ? <p style={{ margin: 0, fontSize: '0.72rem', color: '#888' }}>✓ Situazione nella norma</p> : null}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </>
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
        .boost-btn-brute:hover:not(:disabled) { background: rgba(200,255,29,0.1); border-color: #c8ff1d; transform: translateX(4px); }
        .custom-scroller::-webkit-scrollbar { width: 4px; }
        .custom-scroller::-webkit-scrollbar-thumb { background: #c8ff1d; border-radius: 2px; }
        .gal-nav-btn { width: 60px; height: 60px; background: rgba(200,255,29,0.9); color: #000; border: none; borderRadius: 30px; cursor: pointer; font-size: 1.5rem; font-weight: 900; box-shadow: 0 10px 30px rgba(200,255,29,0.4); transition: transform 0.2s, background 0.2s; }
        .gal-nav-btn:hover { transform: scale(1.1); background: #fff; }
        .gal-nav-btn:active { transform: scale(0.95); }
      `}</style>
    </main>
  );
}

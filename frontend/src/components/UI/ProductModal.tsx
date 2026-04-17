import { useState, useMemo, useRef, useEffect } from 'react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  products: any[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSelect: (product: any) => void;
  loading?: boolean;
  loadingMore?: boolean;
}

export function ProductModal({ isOpen, onClose, title, products, hasMore, onLoadMore, onSelect, loading, loadingMore }: ProductModalProps) {
  const [search, setSearch] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return products;
    return products.filter((p: any) =>
      (p.name || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [search, products]);

  // Infinite scroll: trigger onLoadMore when sentinel enters view
  useEffect(() => {
    if (!sentinelRef.current || !onLoadMore || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loadingMore) onLoadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, loadingMore]);

  const getProductImage = (base64?: string) => {
    if (!base64) return undefined;
    return base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, backdropFilter: 'blur(10px)', padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a', width: '100%', maxWidth: '900px', maxHeight: '85vh',
        borderRadius: '16px', display: 'flex', flexDirection: 'column',
        border: '1px solid #333', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        overflow: 'hidden', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#ffcc00', fontSize: '1.5rem', fontWeight: 'bold' }}>{title}</h2>
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.9rem' }}>Seleziona un articolo per l'espositore</p>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '10px 15px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#444'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
          >
            Chiudi
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '20px', background: '#222' }}>
          <input
            autoFocus
            type="text"
            placeholder="Cerca per nome prodotto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: '10px',
              border: '1px solid #444', background: '#333', color: '#fff',
              fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Product Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
          {loading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', color: '#ffcc00' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid #ffcc00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
              <p>Connessione a Odoo in corso...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#666', padding: '100px' }}>Nessun prodotto trovato</p>
          ) : (
            <>
              {filtered.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => onSelect(p)}
                  style={{ background: '#2a2a2a', borderRadius: '12px', padding: '12px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid #ffcc00'; e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ width: '100%', height: '140px', background: '#000', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.image_1920
                      ? <img src={getProductImage(p.image_1920)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ color: '#444', fontSize: '2rem' }}>📦</span>
                    }
                  </div>
                  <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', height: '2.4rem', lineHeight: '1.2rem' }}>{p.name}</h3>
                  <div style={{ display: 'inline-block', padding: '2px 8px', background: p.qty_available > 5 ? 'rgba(0,255,100,0.1)' : 'rgba(255,150,0,0.1)', border: `1px solid ${p.qty_available > 5 ? '#00ff64' : '#ff9600'}`, borderRadius: '12px', fontSize: '0.65rem', color: p.qty_available > 5 ? '#00ff64' : '#ff9600', fontWeight: 'bold', marginBottom: '10px', alignSelf: 'start' }}>
                    {p.qty_available} DISPONIBILI
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#ffcc00', fontWeight: 'bold', fontSize: '1rem' }}>€{(p.list_price ?? 0).toFixed(2)}</span>
                    <span style={{ fontSize: '0.7rem', color: '#666' }}>ID: {p.id}</span>
                  </div>
                </div>
              ))}

              {/* Infinite scroll sentinel */}
              {!search && (
                <div ref={sentinelRef} style={{ gridColumn: '1/-1', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {loadingMore && (
                    <div style={{ width: '24px', height: '24px', border: '3px solid #ffcc00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

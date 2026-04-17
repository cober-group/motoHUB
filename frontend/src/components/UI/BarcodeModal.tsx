'use client';
import { useEffect, useRef, useState } from 'react';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: any) => void;
  fetchProductByBarcode: (barcode: string) => Promise<any>;
}

export function BarcodeModal({ isOpen, onClose, onConfirm, fetchProductByBarcode }: BarcodeModalProps) {
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');
  const [product, setProduct] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBarcode('');
      setStatus('idle');
      setProduct(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setStatus('loading');
    try {
      const p = await fetchProductByBarcode(trimmed);
      if (p) {
        setProduct(p);
        setStatus('found');
      } else {
        setStatus('notfound');
      }
    } catch {
      setStatus('error');
    }
  }

  function handleConfirm() {
    if (product) { onConfirm(product); onClose(); }
  }

  const getProductImage = (base64?: string) => {
    if (!base64) return undefined;
    return base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
  };

  function getVariant(p: any): string {
    const dn: string = p.display_name || '';
    const name: string = p.name || '';
    if (!dn || !name) return '';
    const rest = dn.slice(name.length).trim();
    if (rest.startsWith('(') && rest.endsWith(')')) return rest.slice(1, -1);
    return rest;
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 20000, backdropFilter: 'blur(10px)', padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a', width: '100%', maxWidth: '480px',
        borderRadius: '16px', border: '1px solid #333',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', color: '#fff'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#c8ff1d', fontSize: '1.3rem', fontWeight: 'bold' }}>🔫 Scansiona Barcode</h2>
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.85rem' }}>Punta il lettore e premi il grilletto</p>
          </div>
          <button onClick={onClose} style={{ padding: '8px 12px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', gap: '12px' }}>
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => { setBarcode(e.target.value); setStatus('idle'); setProduct(null); }}
            placeholder="Barcode prodotto..."
            style={{
              flex: 1, padding: '14px 18px', borderRadius: '10px',
              border: '2px solid #c8ff1d', background: '#222', color: '#fff',
              fontSize: '1.1rem', outline: 'none', letterSpacing: '0.05em'
            }}
          />
          <button type="submit" disabled={status === 'loading' || !barcode.trim()} style={{
            padding: '14px 20px', background: '#c8ff1d', color: '#000', border: 'none',
            borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem',
            opacity: (!barcode.trim() || status === 'loading') ? 0.5 : 1
          }}>
            {status === 'loading' ? '...' : 'Cerca'}
          </button>
        </form>

        {/* Result */}
        <div style={{ padding: '0 24px 24px' }}>
          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #c8ff1d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ margin: 0 }}>Ricerca in Odoo...</p>
            </div>
          )}

          {status === 'notfound' && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#ff6666' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Nessun prodotto trovato</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#888' }}>Barcode: {barcode}</p>
            </div>
          )}

          {status === 'error' && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', borderRadius: '10px', padding: '16px', textAlign: 'center', color: '#ff6666' }}>
              <p style={{ margin: 0 }}>Errore durante la ricerca</p>
            </div>
          )}

          {status === 'found' && product && (
            <div style={{ background: '#222', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '72px', height: '72px', background: '#111', borderRadius: '8px', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {product.image_128
                  ? <img src={getProductImage(product.image_128)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '2rem' }}>📦</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>{product.name}</p>
                {getVariant(product) && (
                  <p style={{ margin: '0 0 6px', color: '#88aaff', fontSize: '0.82rem' }}>{getVariant(product)}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#c8ff1d', fontWeight: 'bold', fontSize: '1.1rem' }}>€{(product.list_price ?? 0).toFixed(2)}</span>
                  <span style={{ fontSize: '0.75rem', color: product.qty_available > 0 ? '#00ff64' : '#ff6666' }}>
                    {product.qty_available} disponibili
                  </span>
                </div>
              </div>
              <button
                onClick={handleConfirm}
                style={{ padding: '12px 18px', background: '#c8ff1d', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d4ff4a'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#c8ff1d'}
              >
                ✓ Assegna
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

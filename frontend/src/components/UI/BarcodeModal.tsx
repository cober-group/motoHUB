'use client';
import { useEffect, useRef, useState } from 'react';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (product: any) => boolean; // returns false if espositore pieno
  fetchProductByBarcode: (barcode: string) => Promise<any>;
  filledCount: number;
  totalSlots: number;
}

function getVariant(p: any): string {
  const dn: string = p.display_name || '';
  const name: string = p.name || '';
  if (!dn || !name) return '';
  const rest = dn.slice(name.length).trim();
  if (rest.startsWith('(') && rest.endsWith(')')) return rest.slice(1, -1);
  return rest;
}

const getProductImage = (base64?: string) => {
  if (!base64) return undefined;
  return base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
};

export function BarcodeModal({ isOpen, onClose, onAssign, fetchProductByBarcode, filledCount, totalSlots }: BarcodeModalProps) {
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'assigned' | 'full' | 'notfound' | 'error'>('idle');
  const [product, setProduct] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) { reset(); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [isOpen]);

  function reset() {
    setBarcode('');
    setStatus('idle');
    setProduct(null);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setStatus('loading');
    try {
      const p = await fetchProductByBarcode(trimmed);
      if (!p) { setStatus('notfound'); return; }
      setProduct(p);
      setStatus('found');
    } catch {
      setStatus('error');
    }
  }

  function handleAssign() {
    if (!product) return;
    const ok = onAssign(product);
    setStatus(ok ? 'assigned' : 'full');
    if (ok) setTimeout(() => { reset(); inputRef.current?.focus(); }, 900);
  }

  if (!isOpen) return null;

  const isFull = filledCount >= totalSlots;

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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#c8ff1d', fontSize: '1.2rem', fontWeight: 'bold' }}>🔫 Scansiona Barcode</h2>
            <p style={{ margin: '3px 0 0', color: '#888', fontSize: '0.8rem' }}>Scansioni multiple — ogni barcode riempie il prossimo slot vuoto</p>
          </div>
          <button onClick={onClose} style={{ padding: '8px 12px', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {/* Progress */}
        <div style={{ padding: '12px 24px', background: '#111', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${totalSlots ? (filledCount / totalSlots) * 100 : 0}%`, background: isFull ? '#ff6666' : '#c8ff1d', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '0.8rem', color: isFull ? '#ff6666' : '#c8ff1d', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {filledCount} / {totalSlots} slot
          </span>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', gap: '10px' }}>
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => { setBarcode(e.target.value); if (status !== 'idle') reset(); }}
            placeholder="Barcode prodotto..."
            disabled={isFull}
            style={{
              flex: 1, padding: '13px 16px', borderRadius: '10px',
              border: `2px solid ${isFull ? '#444' : '#c8ff1d'}`, background: '#222', color: '#fff',
              fontSize: '1rem', outline: 'none', letterSpacing: '0.05em',
              opacity: isFull ? 0.5 : 1
            }}
          />
          <button type="submit" disabled={status === 'loading' || !barcode.trim() || isFull} style={{
            padding: '13px 18px', background: '#c8ff1d', color: '#000', border: 'none',
            borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
            opacity: (!barcode.trim() || status === 'loading' || isFull) ? 0.4 : 1
          }}>
            {status === 'loading' ? '…' : 'Cerca'}
          </button>
        </form>

        {/* Result area */}
        <div style={{ padding: '0 24px 24px', minHeight: '80px' }}>
          {isFull && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', borderRadius: '10px', padding: '14px', textAlign: 'center', color: '#ff6666', fontWeight: 'bold' }}>
              Espositore pieno — tutti i slot sono occupati
            </div>
          )}

          {!isFull && status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '16px', color: '#888' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid #c8ff1d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Ricerca in Odoo...</p>
            </div>
          )}

          {!isFull && status === 'notfound' && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#ff6666', fontWeight: 'bold' }}>Nessun prodotto trovato</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#888' }}>{barcode}</p>
            </div>
          )}

          {!isFull && status === 'error' && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', borderRadius: '10px', padding: '14px', textAlign: 'center', color: '#ff6666' }}>
              Errore durante la ricerca
            </div>
          )}

          {!isFull && status === 'assigned' && (
            <div style={{ background: 'rgba(0,255,100,0.08)', border: '1px solid #00ff64', borderRadius: '10px', padding: '14px', textAlign: 'center', color: '#00ff64', fontWeight: 'bold' }}>
              ✓ Assegnato! Pronto per la prossima scansione...
            </div>
          )}

          {!isFull && status === 'full' && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', borderRadius: '10px', padding: '14px', textAlign: 'center', color: '#ff6666', fontWeight: 'bold' }}>
              Espositore pieno!
            </div>
          )}

          {!isFull && status === 'found' && product && (
            <div style={{ background: '#222', borderRadius: '12px', padding: '14px', display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '64px', height: '64px', background: '#111', borderRadius: '8px', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {product.image_128
                  ? <img src={getProductImage(product.image_128)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '1.8rem' }}>📦</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>{product.name}</p>
                {getVariant(product) && <p style={{ margin: '0 0 5px', color: '#88aaff', fontSize: '0.78rem' }}>{getVariant(product)}</p>}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#c8ff1d', fontWeight: 'bold' }}>€{(product.list_price ?? 0).toFixed(2)}</span>
                  <span style={{ fontSize: '0.72rem', color: product.qty_available > 0 ? '#00ff64' : '#ff6666' }}>{product.qty_available} disp.</span>
                </div>
              </div>
              <button
                onClick={handleAssign}
                style={{ padding: '10px 16px', background: '#c8ff1d', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d4ff4a'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#c8ff1d'}
              >
                ✓ Slot {filledCount + 1}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

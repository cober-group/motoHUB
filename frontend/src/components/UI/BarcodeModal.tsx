'use client';
import { useEffect, useRef, useState } from 'react';

function playBeep(type: 'success' | 'error') {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Two ascending tones: quick scanner acceptance
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.12);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.12);
      });
    } else {
      // Low descending buzz: rejection
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }

    setTimeout(() => ctx.close(), 1000);
  } catch { /* browser blocked audio */ }
}

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
  const [status, setStatus] = useState<'idle' | 'loading' | 'assigned' | 'full' | 'notfound' | 'error'>('idle');
  const [lastAssigned, setLastAssigned] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) { reset(); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [isOpen]);

  function reset() {
    setBarcode('');
    setStatus('idle');
    setLastAssigned(null);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setStatus('loading');
    try {
      const p = await fetchProductByBarcode(trimmed);
      if (!p) { playBeep('error'); setStatus('notfound'); return; }
      // Auto-assign immediately
      const ok = onAssign(p);
      if (ok) {
        playBeep('success');
        setLastAssigned(p);
        setStatus('assigned');
        // Auto-reset for next scan
        setTimeout(() => {
          setBarcode('');
          setStatus('idle');
          setLastAssigned(null);
          inputRef.current?.focus();
        }, 1200);
      } else {
        playBeep('error');
        setLastAssigned(p);
        setStatus('full');
      }
    } catch {
      setStatus('error');
    }
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
            <p style={{ margin: '3px 0 0', color: '#888', fontSize: '0.8rem' }}>Scansione automatica — trova e assegna istantaneamente</p>
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
            onChange={(e) => { setBarcode(e.target.value); if (status !== 'idle' && status !== 'loading') { setStatus('idle'); setLastAssigned(null); } }}
            placeholder="Scansiona o digita barcode..."
            disabled={isFull || status === 'loading'}
            autoFocus
            style={{
              flex: 1, padding: '13px 16px', borderRadius: '10px',
              border: `2px solid ${isFull ? '#444' : status === 'assigned' ? '#00ff64' : '#c8ff1d'}`, background: '#222', color: '#fff',
              fontSize: '1rem', outline: 'none', letterSpacing: '0.05em',
              opacity: isFull ? 0.5 : 1,
              transition: 'border-color 0.3s'
            }}
          />
          <button type="submit" disabled={status === 'loading' || !barcode.trim() || isFull} style={{
            padding: '13px 18px', background: status === 'loading' ? '#555' : '#c8ff1d', color: status === 'loading' ? '#999' : '#000', border: 'none',
            borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
            opacity: (!barcode.trim() || status === 'loading' || isFull) ? 0.4 : 1,
            transition: 'all 0.2s'
          }}>
            {status === 'loading' ? '⏳' : '▶'}
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
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Ricerca e assegnazione automatica...</p>
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

          {!isFull && status === 'assigned' && lastAssigned && (
            <div style={{ background: 'rgba(0,255,100,0.08)', border: '1px solid #00ff64', borderRadius: '12px', padding: '14px', display: 'flex', gap: '14px', alignItems: 'center', animation: 'fadeSlotIn 0.3s ease-out' }}>
              <style>{`@keyframes fadeSlotIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
              <div style={{ width: '52px', height: '52px', background: '#111', borderRadius: '8px', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {lastAssigned.image_128
                  ? <img src={getProductImage(lastAssigned.image_128)} alt={lastAssigned.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '1.5rem' }}>📦</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>{lastAssigned.name}</p>
                {getVariant(lastAssigned) && <p style={{ margin: '0 0 3px', color: '#88aaff', fontSize: '0.72rem' }}>{getVariant(lastAssigned)}</p>}
                <span style={{ color: '#c8ff1d', fontWeight: 'bold', fontSize: '0.85rem' }}>€{(lastAssigned.list_price ?? 0).toFixed(2)}</span>
              </div>
              <div style={{ flexShrink: 0, background: '#00ff64', color: '#000', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                ✓ Slot {filledCount}
              </div>
            </div>
          )}

          {!isFull && status === 'full' && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444', borderRadius: '10px', padding: '14px', textAlign: 'center', color: '#ff6666', fontWeight: 'bold' }}>
              Espositore pieno!
            </div>
          )}

          {!isFull && status === 'idle' && (
            <div style={{ textAlign: 'center', padding: '14px', color: '#555', fontSize: '0.8rem' }}>
              Scansiona un barcode — il prodotto verrà inserito automaticamente
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

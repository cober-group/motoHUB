import { Image, Html, Text } from '@react-three/drei';
import { memo } from 'react';
import { useProcessedImage } from '@/hooks/useProcessedImage';

interface CentralShelfProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  assignedProducts: Record<number, any>;
  onUpdate?: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemove?: (id: string) => void;
  onOpenSelector?: (itemId: string, shelfIndex: number, type: 'central') => void;
  onOpenBarcodeScanner?: (itemId: string) => void;
  isEditable?: boolean;
  isFocused?: boolean;
  onFocusProduct?: (itemId: string, slotIndex: number) => void;
}

// 3 shelves × 5 columns × 2 sides = 30 slots
// slots 0-14: front side (+Z face), slots 15-29: back side (-Z face)
const SHELF_Y = [0.52, 1.02, 1.52] as const;
const SLOT_X = [-1.1, -0.55, 0, 0.55, 1.1] as const;
const PRODUCT_Z_FRONT = 0.32;
const PRODUCT_Z_BACK = -0.32;


function SlotGroup({
  slotIndex, assigned, isEditable, isFocused, posZ,
  onOpenSelector, onFocusProduct, itemId,
}: {
  slotIndex: number; assigned: any; isEditable?: boolean; isFocused?: boolean; posZ: number;
  onOpenSelector?: (id: string, s: number, t: 'central') => void;
  onFocusProduct?: (id: string, s: number) => void;
  itemId: string;
}) {
  const { processedUrl } = useProcessedImage(assigned?.image_128);
  const isFront = posZ > 0;

  return (
    <group
      onClick={assigned ? (e) => { e.stopPropagation(); onFocusProduct?.(itemId, slotIndex); } : undefined}
    >
      {isEditable && isFocused && (
        <Html position={[0, 0.22, isFront ? 0.06 : -0.06]} center>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenSelector?.(itemId, slotIndex, 'central'); }}
            style={{ fontSize: '0.45rem', padding: '1px 5px', background: '#c8ff1d', color: '#000', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'auto' }}
          >
            {assigned ? '🔄' : '+'}
          </button>
        </Html>
      )}
      {assigned ? (
        <>
          <Image url={processedUrl} scale={0.3} position={[0, 0.18, isFront ? 0.02 : -0.02]} transparent />
          <Html position={[0, -0.03, isFront ? 0.12 : -0.12]} center distanceFactor={2.0}>
            <div style={{ background: 'rgba(0,0,0,0.88)', padding: '2px 5px', borderRadius: '3px', textAlign: 'center', width: '62px', pointerEvents: 'none' }}>
              <p style={{ margin: 0, fontSize: '5px', fontWeight: 'bold', color: '#fff', lineHeight: 1.2, fontFamily: 'system-ui', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{assigned.name}</p>
              <p style={{ margin: '1px 0 0', fontSize: '5px', fontWeight: 'bold', color: '#c8ff1d', fontFamily: 'system-ui' }}>€{(assigned.list_price ?? 0).toFixed(0)}</p>
            </div>
          </Html>
        </>
      ) : (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.09, 16]} />
          <meshStandardMaterial color="#333" transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}

export const CentralShelf = memo(function CentralShelf({
  id, position, rotation, assignedProducts,
  onRemove, onOpenSelector, onOpenBarcodeScanner,
  isEditable, isFocused, onFocusProduct,
}: CentralShelfProps) {
  const totalAssigned = Object.keys(assignedProducts).length;

  return (
    <group position={position} rotation={rotation}>

      {/* Controls bar */}
      {isEditable && isFocused && (
        <Html position={[0, 2.5, 0]} center>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <button
              onClick={() => onOpenBarcodeScanner?.(id)}
              style={{ padding: '8px 14px', background: '#1a1a1a', color: '#c8ff1d', border: '1px solid #c8ff1d', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
            >
              🔫 Barcode
            </button>
            <button
              onClick={() => onRemove?.(id)}
              style={{ padding: '8px 12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
            >
              🗑️ Rimuovi
            </button>
          </div>
        </Html>
      )}

      {/* ── Gondola structure ── */}
      {/* Central backbone panel */}
      <mesh position={[0, 1.05, 0]} receiveShadow>
        <boxGeometry args={[3.0, 2.1, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>
      {/* Left upright */}
      <mesh position={[-1.53, 1.05, 0]} receiveShadow>
        <boxGeometry args={[0.06, 2.1, 0.5]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* Right upright */}
      <mesh position={[1.53, 1.05, 0]} receiveShadow>
        <boxGeometry args={[0.06, 2.1, 0.5]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.12, 0.08, 0.52]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 2.12, 0]} receiveShadow>
        <boxGeometry args={[3.12, 0.06, 0.52]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Front shelf planks */}
      {SHELF_Y.map((y) => (
        <mesh key={`fp-${y}`} position={[0, y, 0.22]} receiveShadow>
          <boxGeometry args={[2.9, 0.04, 0.22]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      {/* Back shelf planks */}
      {SHELF_Y.map((y) => (
        <mesh key={`bp-${y}`} position={[0, y, -0.22]} receiveShadow>
          <boxGeometry args={[2.9, 0.04, 0.22]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}

      {/* ── Front side products (slots 0-14) ── */}
      {SHELF_Y.map((shelfY, shelfRow) =>
        SLOT_X.map((x, col) => {
          const slotIndex = shelfRow * 5 + col;
          return (
            <group key={slotIndex} position={[x, shelfY + 0.12, PRODUCT_Z_FRONT]}>
              <SlotGroup
                slotIndex={slotIndex}
                assigned={assignedProducts[slotIndex]}
                isEditable={isEditable}
                isFocused={isFocused}
                posZ={PRODUCT_Z_FRONT}
                onOpenSelector={onOpenSelector}
                onFocusProduct={onFocusProduct}
                itemId={id}
              />
            </group>
          );
        })
      )}

      {/* ── Back side products (slots 15-29) ── */}
      {SHELF_Y.map((shelfY, shelfRow) =>
        SLOT_X.map((x, col) => {
          const slotIndex = 15 + shelfRow * 5 + col;
          return (
            <group key={slotIndex} position={[x, shelfY + 0.12, PRODUCT_Z_BACK]}>
              <SlotGroup
                slotIndex={slotIndex}
                assigned={assignedProducts[slotIndex]}
                isEditable={isEditable}
                isFocused={isFocused}
                posZ={PRODUCT_Z_BACK}
                onOpenSelector={onOpenSelector}
                onFocusProduct={onFocusProduct}
                itemId={id}
              />
            </group>
          );
        })
      )}

      <Text position={[0, 2.28, 0.05]} fontSize={0.11} color="#c8ff1d" fontWeight="bold" anchorX="center">
        {`Isola Centrale  ${totalAssigned}/30`}
      </Text>
    </group>
  );
});

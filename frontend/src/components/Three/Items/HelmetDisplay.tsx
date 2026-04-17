import { Text, Image, Html } from '@react-three/drei';
import { memo } from 'react';

interface HelmetDisplayProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  assignedProducts: Record<number, any>;
  onUpdate?: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemove?: (id: string) => void;
  onOpenSelector?: (itemId: string, shelfIndex: number, type: 'helmet') => void;
  isEditable?: boolean;
}

const getProductImage = (base64?: string) => {
  if (!base64) return null;
  return base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
};

export const HelmetDisplay = memo(function HelmetDisplay({ id, position, rotation, assignedProducts, onRemove, onOpenSelector, isEditable }: HelmetDisplayProps) {
  return (
    <group position={position} rotation={rotation}>
      {isEditable && (
        <Html position={[0, 3.5, 0]} center>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <button onClick={() => onRemove?.(id)} style={{ padding: '8px 12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
              🗑️ Rimuovi
            </button>
          </div>
        </Html>
      )}

      <mesh position={[0, 1.5, -0.45]} castShadow>
        <boxGeometry args={[3, 3, 0.1]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>

      {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => {
        const shelfOffsets = [-1.1, -0.55, 0, 0.55, 1.1];
        return (
          <group key={s} position={[0, 0.3 + s * 0.42, -0.2]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[2.8, 0.03, 0.6]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.2} />
            </mesh>
            {shelfOffsets.map((offsetX, idx) => {
              const slotIndex = s * 5 + idx;
              const assigned = assignedProducts[slotIndex];
              return (
                <group key={slotIndex} position={[offsetX, 0, 0]}>
                  {isEditable && (
                    <Html position={[0, 0.06, 0.3]} center>
                      <button onClick={(e) => { e.stopPropagation(); onOpenSelector?.(id, slotIndex, 'helmet'); }} style={{ fontSize: '0.45rem', padding: '1px 4px', background: '#c8ff1d', color: '#000', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
                        {assigned ? '🔄' : '+'}
                      </button>
                    </Html>
                  )}
                  {assigned ? (
                    <group position={[0, 0.06, 0.1]}>
                      {assigned.image_128 ? (
                        <Image url={getProductImage(assigned.image_128) || ''} scale={0.22} position={[0, 0.2, 0.21]} transparent />
                      ) : (
                        <mesh position={[0, 0.15, 0]} castShadow>
                          <sphereGeometry args={[0.12, 16, 16]} />
                          <meshStandardMaterial color="#c8ff1d" roughness={0.1} metalness={0.8} />
                        </mesh>
                      )}
                      <Text position={[0, -0.05, 0.35]} fontSize={0.035} color="#fff" anchorX="center" maxWidth={0.4}>{assigned.name}</Text>
                      <Text position={[0, -0.1, 0.35]} fontSize={0.03} color="#c8ff1d" anchorX="center">{`€${assigned.list_price}`}</Text>
                    </group>
                  ) : (
                    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                      <circleGeometry args={[0.1, 32]} />
                      <meshStandardMaterial color="#222" transparent opacity={0.15} />
                    </mesh>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}

      <Text position={[0, 3.8, -0.4]} fontSize={0.15} color="#c8ff1d" fontWeight="bold">
        Espositore caschi (40 unità)
      </Text>
    </group>
  );
});

import { Text, Image, Html } from '@react-three/drei';
import { memo } from 'react';

interface JacketRailProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  assignedProducts: Record<number, any>;
  onUpdate?: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemove?: (id: string) => void;
  onOpenSelector?: (itemId: string, shelfIndex: number, type: 'jacket') => void;
  isEditable?: boolean;
}

const getProductImage = (base64?: string) => {
  if (!base64) return null;
  return base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
};

export const JacketRail = memo(function JacketRail({ id, position, rotation, assignedProducts, onRemove, onOpenSelector, isEditable }: JacketRailProps) {
  return (
    <group position={position} rotation={rotation}>
      {isEditable && (
        <Html position={[0, 2.5, 0]} center>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <button onClick={() => onRemove?.(id)} style={{ padding: '8px 12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              🗑️ Rimuovi
            </button>
          </div>
        </Html>
      )}

      <mesh position={[0, 1.5, -0.45]} castShadow>
        <boxGeometry args={[4, 3, 0.05]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.8} />
      </mesh>

      {[0, 1].map((r) => {
        const slotOffsets = [-1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75];
        return (
          <group key={r} position={[0, 0.8 + r * 1.5, -0.2]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 3.8, 16]} />
              <meshStandardMaterial color="silver" metalness={1} roughness={0.1} />
            </mesh>
            {slotOffsets.map((offsetX, idx) => {
              const slotIndex = r * 8 + idx;
              const assigned = assignedProducts[slotIndex];
              return (
                <group key={slotIndex} position={[offsetX, 0, 0]}>
                  {isEditable && (
                    <Html position={[0, -0.85, 0.2]} center>
                      <button onClick={(e) => { e.stopPropagation(); onOpenSelector?.(id, slotIndex, 'jacket'); }} style={{ fontSize: '0.55rem', padding: '2px 6px', background: '#c8ff1d', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
                        {assigned ? '🔄' : '+'}
                      </button>
                    </Html>
                  )}
                  {assigned ? (
                    <group position={[0, -0.2, 0.1]}>
                      {assigned.image_128 ? (
                        <Image url={getProductImage(assigned.image_128) || ''} scale={0.7} position={[0, -0.3, 0.2]} transparent />
                      ) : (
                        <mesh castShadow>
                          <boxGeometry args={[0.3, 0.5, 0.05]} />
                          <meshStandardMaterial color="#c8ff1d" />
                        </mesh>
                      )}
                      <Text position={[0, -0.75, 0.3]} fontSize={0.05} color="#fff" anchorX="center" maxWidth={0.4}>{assigned.name}</Text>
                      <Text position={[0, -0.85, 0.3]} fontSize={0.04} color="#c8ff1d" anchorX="center">{`€${assigned.list_price}`}</Text>
                    </group>
                  ) : (
                    <mesh position={[0, -0.1, 0.05]}>
                      <sphereGeometry args={[0.02, 8, 8]} />
                      <meshStandardMaterial color="#c8ff1d" transparent opacity={0.4} />
                    </mesh>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}

      <Text position={[0, 3.1, -0.4]} fontSize={0.15} color="#c8ff1d" fontWeight="bold">
        Rella abbigliamento (16 unità)
      </Text>
    </group>
  );
});

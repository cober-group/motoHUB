import { Text, Image, PivotControls, Html } from '@react-three/drei';
import { memo } from 'react';
import * as THREE from 'three';

interface CentralShelfProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  assignedProducts: Record<number, any>;
  onUpdate?: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemove?: (id: string) => void;
  onOpenSelector?: (itemId: string, shelfIndex: number, type: 'central') => void;
  isEditable?: boolean;
  isFocused?: boolean;
}

const getProductImage = (base64?: string) => {
  if (!base64) return null;
  return base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
};

export const CentralShelf = memo(function CentralShelf({ id, position, rotation, assignedProducts, onUpdate, onRemove, onOpenSelector, isEditable, isFocused }: CentralShelfProps) {
  return (
    <group position={position} rotation={rotation}>
      {isEditable && isFocused && (
        <Html position={[0, 2.5, 0]} center>
          <div style={{ pointerEvents: 'auto' }}>
            <button onClick={() => onRemove?.(id)} style={{ padding: '8px 12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              🗑️ Rimuovi
            </button>
          </div>
        </Html>
      )}

      <PivotControls
        visible={isEditable}
        depthTest={false}
        onDrag={(l) => {
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          new THREE.Matrix4().copy(l).decompose(pos, quat, new THREE.Vector3());
          const euler = new THREE.Euler().setFromQuaternion(quat);
          onUpdate?.(id, [pos.x, pos.y, pos.z], [euler.x, euler.y, euler.z]);
        }}
      >
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[3, 2, 0.2]} />
          <meshStandardMaterial color="#333" />
        </mesh>

        {[-1, 1].map((side, sideIdx) => (
          <group key={side} position={[0, 0, side * 0.3]}>
            {[0, 1, 2].map((t) => {
              const shelfIndex = sideIdx * 3 + t;
              const assigned = assignedProducts[shelfIndex];
              return (
                <group key={t} position={[0, 0.4 + t * 0.6, 0]}>
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[2.8, 0.05, 0.4]} />
                    <meshStandardMaterial color="#444" />
                  </mesh>
                  {isEditable && isFocused && (
                    <Html position={[1.6, 0.1, 0]} center>
                      <button onClick={() => onOpenSelector?.(id, shelfIndex, 'central')} style={{ fontSize: '0.6rem', padding: '3px 8px', background: '#c8ff1d', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
                        {assigned ? '🔄 Mix' : '+ Scegli'}
                      </button>
                    </Html>
                  )}
                  {assigned && (
                    <group position={[0, 0.15, 0.1]}>
                      {assigned.image_128 ? (
                        <Image url={getProductImage(assigned.image_128) || ''} scale={0.4} position={[0, 0.15, 0.11]} transparent />
                      ) : (
                        <mesh castShadow position={[0, 0.15, 0]}>
                          <boxGeometry args={[0.4, 0.3, 0.3]} />
                          <meshStandardMaterial color="#c8ff1d" />
                        </mesh>
                      )}
                      <Text position={[0, -0.05, 0.2]} fontSize={0.06} color="#fff" anchorX="center" maxWidth={0.6}>{assigned.name}</Text>
                      <Text position={[0, -0.15, 0.2]} fontSize={0.05} color="#c8ff1d" anchorX="center">{`€${assigned.list_price}`}</Text>
                    </group>
                  )}
                </group>
              );
            })}
          </group>
        ))}

        <Text position={[0, 2.2, 0]} fontSize={0.15} color="#c8ff1d" fontWeight="bold">
          SCAFFALE ISOLA CENTRALE
        </Text>
      </PivotControls>
    </group>
  );
});

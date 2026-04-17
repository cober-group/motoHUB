import { Text, Image, PivotControls, Html } from '@react-three/drei';
import { useMemo } from 'react';
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
}

export function CentralShelf({ id, position, rotation, assignedProducts, onUpdate, onRemove, onOpenSelector, isEditable }: CentralShelfProps) {
  
  const getProductImage = (base64?: string) => {
    if (!base64) return null;
    return base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
  };

  return (
    <group position={position} rotation={rotation}>
      {/* UI Controls Overlay (Outside Pivot for accessibility) */}
      {isEditable && (
        <Html position={[0, 2.5, 0]} center>
          <div style={{ pointerEvents: 'auto' }}>
            <button 
              onClick={() => onRemove?.(id)}
              style={{ padding: '8px 12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🗑️ Rimuovi
            </button>
          </div>
        </Html>
      )}

      <PivotControls 
        visible={isEditable}
        depthTest={false}
        onDrag={(l) => {
          const matrix = new THREE.Matrix4();
          matrix.copy(l);
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          matrix.decompose(pos, quat, scale);
          const euler = new THREE.Euler().setFromQuaternion(quat);
          if (onUpdate) onUpdate(id, [pos.x, pos.y, pos.z], [euler.x, euler.y, euler.z]);
        }}
      >
        {/* Central Spine */}
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[3, 2, 0.2]} />
          <meshStandardMaterial color="#333" />
        </mesh>

        {/* 2 Sides x 3 Tiers */}
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

                  {/* Product Picker UI */}
                  {isEditable && (
                    <Html position={[1.6, 0.1, 0]} center>
                      <button 
                        onClick={() => onOpenSelector?.(id, shelfIndex, 'central')}
                        style={{ 
                          fontSize: '0.6rem', 
                          padding: '3px 8px', 
                          background: '#c8ff1d', 
                          color: '#000', 
                          border: 'none', 
                          borderRadius: '3px', 
                          cursor: 'pointer', 
                          fontWeight: 'bold',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'auto'
                        }}
                      >
                         {assigned ? '🔄 Mix' : '+ Scegli'}
                      </button>
                    </Html>
                  )}
 
                  {/* Items Display */}
                  {assigned && (
                    <group position={[0, 0.15, 0.1]}>
                      {assigned.image_1920 ? (
                        <Image 
                          url={getProductImage(assigned.image_1920) || ''} 
                          scale={0.4} 
                          position={[0, 0.15, 0.11]} 
                          transparent 
                        />
                      ) : (
                        <mesh castShadow position={[0, 0.15, 0]}>
                          <boxGeometry args={[0.4, 0.3, 0.3]} />
                          <meshStandardMaterial color="#c8ff1d" />
                        </mesh>
                      )}
                      <Text position={[0, -0.05, 0.2]} fontSize={0.06} color="#fff" anchorX="center" maxWidth={0.6}>
                        {assigned.name}
                      </Text>
                      <Text position={[0, -0.15, 0.2]} fontSize={0.05} color="#c8ff1d" anchorX="center">
                        {`€${assigned.list_price}`}
                      </Text>
                    </group>
                  )}
                </group>
              );
            })}
          </group>
        ))}
 
        <Text
          position={[0, 2.2, 0]}
          fontSize={0.15}
          color="#c8ff1d"
          fontWeight="bold"
        >
          SCAFFALE ISOLA CENTRALE
        </Text>
      </PivotControls>
    </group>
  );
}

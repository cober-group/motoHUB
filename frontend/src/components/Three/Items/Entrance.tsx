import { Html, Text } from '@react-three/drei';
import { memo } from 'react';

interface EntranceProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  onUpdate?: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemove?: (id: string) => void;
  isEditable?: boolean;
  isFocused?: boolean;
}

export const Entrance = memo(function Entrance({
  id, position, rotation,
  onRemove,
  isEditable, isFocused,
}: EntranceProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* Controls */}
      {isEditable && isFocused && (
        <Html position={[0, 3.5, 0]} center>
          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <button
              onClick={() => onRemove?.(id)}
              style={{ padding: '8px 12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
            >
              🗑️ Rimuovi
            </button>
          </div>
        </Html>
      )}

      {/* Door Frame Arch */}
      <mesh position={[-1.2, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 2.5, 0.4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[1.2, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 2.5, 0.4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 2.57, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.55, 0.15, 0.4]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Entrance Signage */}
      <group position={[0, 2.9, 0.1]}>
        <mesh>
          <boxGeometry args={[1.5, 0.4, 0.05]} />
          <meshStandardMaterial color="#000" />
        </mesh>
        <Text
          position={[0, 0, 0.03]}
          fontSize={0.2}
          color="#c8ff1d"
          fontWeight="900"
          anchorX="center"
          anchorY="middle"
        >
          MOTO HUB
        </Text>
      </group>

      <Text
        position={[0, 2.4, 0.21]}
        fontSize={0.12}
        color="#c8ff1d"
        fontWeight="bold"
        fontStyle="italic"
      >
        BENVENUTI
      </Text>

      {/* Floor Mat / Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 1.0]} receiveShadow>
        <planeGeometry args={[2.2, 1.8]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>
      <Text
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 1.0]}
        fontSize={0.18}
        color="#555"
        fontWeight="bold"
        anchorX="center"
      >
        RIDE WITH US
      </Text>

      <Text position={[0, 3.2, 0]} fontSize={0.15} color="#c8ff1d" fontWeight="bold">
        Ingresso Principale
      </Text>
    </group>
  );
});

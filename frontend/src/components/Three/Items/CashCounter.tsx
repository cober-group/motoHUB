import { Html, Text } from '@react-three/drei';
import { memo } from 'react';

interface CashCounterProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  onUpdate?: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemove?: (id: string) => void;
  isEditable?: boolean;
  isFocused?: boolean;
}

export const CashCounter = memo(function CashCounter({
  id, position, rotation,
  onRemove,
  isEditable, isFocused,
}: CashCounterProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* Controls */}
      {isEditable && isFocused && (
        <Html position={[0, 2.5, 0]} center>
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

      {/* Main Desk Body */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.0, 1.0]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Desk Top */}
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.08, 1.1]} />
        <meshStandardMaterial color="#333" metalness={0.5} roughness={0.2} />
      </mesh>

      {/* Logo Panel */}
      <mesh position={[0, 0.5, 0.51]}>
        <planeGeometry args={[1.2, 0.6]} />
        <meshStandardMaterial color="#c8ff1d" emissive="#c8ff1d" emissiveIntensity={0.2} />
      </mesh>
      <Text
        position={[0, 0.5, 0.52]}
        fontSize={0.12}
        color="#000"
        fontWeight="bold"
        anchorX="center"
        anchorY="middle"
      >
        MOTO HUB
      </Text>

      {/* "CASSA" Neon Sign */}
      <group position={[0, 1.2, -0.4]}>
        <mesh>
          <boxGeometry args={[0.8, 0.25, 0.05]} />
          <meshStandardMaterial color="#000" />
        </mesh>
        <Text
          position={[0, 0, 0.03]}
          fontSize={0.15}
          color="#c8ff1d"
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
        >
          CASSA
        </Text>
      </group>

      {/* Computer Monitor Mockup */}
      <group position={[0.6, 1.25, 0]} rotation={[0, -0.3, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.35, 0.05]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[0.46, 0.31]} />
          <meshStandardMaterial color="#222" emissive="#64a0ff" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      <Text position={[0, 2.0, 0]} fontSize={0.15} color="#c8ff1d" fontWeight="bold">
        Punto Cassa
      </Text>
    </group>
  );
});

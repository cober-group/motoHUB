'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface StoreRoomProps {
  width: number;
  depth: number;
}

export function StoreRoom({ width, depth }: StoreRoomProps) {
  return (
    <group>
      {/* Floor - Concrete/Premium dark look */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[width * 2, depth * 2]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Grid Pattern Floor helper */}
      <gridHelper args={[width * 2, 20, '#444', '#222']} position={[0, 0, 0]} />

      {/* Perimeter Walls */}
      {/* Back Wall */}
      <mesh position={[0, 2.5, -depth]} castShadow receiveShadow>
        <boxGeometry args={[width * 2, 5, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Front Wall (Optional, for occlusion) */}
      <mesh position={[0, 2.5, depth]} receiveShadow>
        <boxGeometry args={[width * 2, 5, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.1} />
      </mesh>

      {/* Left Wall */}
      <mesh position={[-width, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[depth * 2, 5, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Right Wall */}
      <mesh position={[width, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[depth * 2, 5, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>
    </group>
  );
}

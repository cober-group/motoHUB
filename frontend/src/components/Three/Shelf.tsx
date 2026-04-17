'use client';

import { Text, Image } from '@react-three/drei';
import { useMemo } from 'react';

interface ShelfProps {
  position: [number, number, number];
  rotation: [number, number, number];
  category: string;
  products: any[];
}

export function Shelf({ position, rotation, category, products }: ShelfProps) {
  // Filter products for this category (mock filter for now)
  const categoryProducts = useMemo(() => {
    return products.slice(0, 4); // Just take first 4 for visual demo
  }, [products]);

  return (
    <group position={position} rotation={rotation}>
      {/* Shelf Structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4, 0.1, 1]} />
        <meshStandardMaterial color="#444" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 0.1, 1]} />
        <meshStandardMaterial color="#444" roughness={0.5} />
      </mesh>
      
      {/* Side Supports */}
      <mesh position={[-1.95, 0.75, 0]} castShadow>
        <boxGeometry args={[0.1, 1.5, 1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[1.95, 0.75, 0]} castShadow>
        <boxGeometry args={[0.1, 1.5, 1]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Category Label */}
      <Text
        position={[0, 1.6, 0.51]}
        fontSize={0.2}
        color="#ffcc00"
        anchorX="center"
        anchorY="middle"
      >
        {category.toUpperCase()}
      </Text>

      {/* Products on Shelf */}
      {categoryProducts.map((p, i) => (
        <group key={p.id || i} position={[-1.5 + i * 1, 0.1, 0]}>
          {/* Product "Box" or Placeholder */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.6, 0.8, 0.6]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          
          {/* Product Image (if available) */}
          {p.image_1920 && (
            <Image 
              url={`data:image/png;base64,${p.image_1920}`} 
              position={[0, 0.4, 0.31]} 
              scale={[0.5, 0.5]} 
              transparent
            />
          )}

          {/* Price Tag */}
          <group position={[0, 0.1, 0.35]}>
            <mesh rotation={[-0.5, 0, 0]}>
              <planeGeometry args={[0.5, 0.2]} />
              <meshStandardMaterial color="white" />
            </mesh>
            <Text
              position={[0, 0, 0.01]}
              fontSize={0.08}
              color="black"
              anchorX="center"
              anchorY="middle"
            >
              {`€${p.list_price || '0.00'}`}
            </Text>
          </group>
        </group>
      ))}
    </group>
  );
}

'use client';

import { Canvas } from '@react-three/fiber';
import { CameraControls, ContactShadows, Environment } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import { PlacedItem } from '@/types/store';
import { StoreRoom } from './StoreRoom';
import { HelmetDisplay } from './Items/HelmetDisplay';
import { JacketRail } from './Items/JacketRail';
import { CentralShelf } from './Items/CentralShelf';
import * as THREE from 'three';

interface StoreSceneProps {
  placedItems: PlacedItem[];
  isEditMode: boolean;
  isAdmin: boolean;
  width: number;
  depth: number;
  focusedItemId: string | null;
  onFocusItem: (id: string | null) => void;
  onUpdateItem: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemoveItem: (id: string) => void;
  onOpenSelector: (itemId: string, shelfIndex: number, type: 'helmet' | 'jacket' | 'central') => void;
}

export function StoreScene({ 
  placedItems, isEditMode, width, depth, 
  focusedItemId, onFocusItem, 
  onUpdateItem, onRemoveItem, onOpenSelector 
}: StoreSceneProps) {
  const controlsRef = useRef<CameraControls>(null);

  // --- DETERMINISTIC PLACEMENT HELPER ---
  const getItemPlacement = (id: string) => {
    const item = placedItems.find(i => i.id === id);
    if (!item) return null;

    if (item.type === 'central') {
      return { position: item.position, rotation: item.rotation, isHidden: false };
    }

    // Perimeter logic (helmet / jacket)
    const wallItems = placedItems.filter(i => i.type === 'helmet' || i.type === 'jacket');
    const globalIndex = wallItems.findIndex(wi => wi.id === id);
    if (globalIndex === -1) return { position: item.position, rotation: item.rotation, isHidden: false };

    const cornerMargin = 0.8;
    const currentWallLength = 3.5;
    const marginValue = 0.6;
    const itemBodyWidth = 3.0;

    const availX = (width * 2) - 2 * cornerMargin;
    const availZ = (depth * 2) - 2 * cornerMargin;
    const slotsX = Math.max(1, Math.floor((availX - itemBodyWidth) / currentWallLength) + 1);
    const slotsZ = Math.max(1, Math.floor((availZ - itemBodyWidth) / currentWallLength) + 1);
    const totalSlots = (slotsZ * 2) + (slotsX * 2);

    if (globalIndex >= totalSlots) return { position: item.position, rotation: item.rotation, isHidden: true };

    let wallIndex = 0;
    let indexInWall = 0;
    if (globalIndex < slotsZ) { 
      wallIndex = 0; indexInWall = globalIndex; 
    } else if (globalIndex < slotsZ + slotsX) { 
      wallIndex = 1; indexInWall = globalIndex - slotsZ; 
    } else if (globalIndex < slotsZ * 2 + slotsX) { 
      wallIndex = 2; indexInWall = globalIndex - (slotsZ + slotsX); 
    } else { 
      wallIndex = 3; indexInWall = globalIndex - (slotsZ * 2 + slotsX); 
    }

    const wallSlotCount = (wallIndex === 0 || wallIndex === 2) ? slotsZ : slotsX;
    const shift = (indexInWall - (wallSlotCount - 1) / 2) * currentWallLength;

    let finalPos: [number, number, number] = [0, 0, 0];
    let finalRot: [number, number, number] = [0, 0, 0];

    switch (wallIndex) {
      case 0: finalPos = [-width + marginValue, 0, shift]; finalRot = [0, Math.PI / 2, 0]; break;
      case 1: finalPos = [shift, 0, -depth + marginValue]; finalRot = [0, 0, 0]; break;
      case 2: finalPos = [width - marginValue, 0, -shift]; finalRot = [0, -Math.PI / 2, 0]; break;
      case 3: finalPos = [-shift, 0, depth - marginValue]; finalRot = [0, Math.PI, 0]; break;
    }

    return { position: finalPos, rotation: finalRot, isHidden: false };
  };

  // Transition Logic (Refined with deterministic sync)
  useEffect(() => {
    if (!controlsRef.current) return;

    if (focusedItemId) {
      const placement = getItemPlacement(focusedItemId);
      if (placement && !placement.isHidden) {
        const distance = 6.5; 
        const rotY = placement.rotation[1];
        
        const dx = Math.sin(rotY) * distance;
        const dz = Math.cos(rotY) * distance;
        
        const targetPos = new THREE.Vector3(...placement.position);
        const cameraPos = new THREE.Vector3(
          placement.position[0] + dx,
          2.5,
          placement.position[2] + dz
        );

        controlsRef.current.setLookAt(
          cameraPos.x, cameraPos.y, cameraPos.z,
          targetPos.x, targetPos.y + 1.5, targetPos.z,
          true 
        );
      }
    } else {
      controlsRef.current.setLookAt(15, 15, 15, 0, 0, 0, true);
    }
  }, [focusedItemId, width, depth]); // Added width/depth to sync camera on resize

  return (
    <Canvas shadows camera={{ position: [15, 15, 15], fov: 50 }}>
      <CameraControls ref={controlsRef} makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
      
      <color attach="background" args={['#1d1d1d']} />
      <ambientLight intensity={0.8} />
      <pointLight position={[20, 20, 20]} castShadow intensity={2} />
      <spotLight position={[-20, 25, 20]} angle={0.3} penumbra={1} castShadow intensity={3} />
      <Environment preset="city" />
      
      <StoreRoom width={width} depth={depth} />

      <group onPointerMissed={() => onFocusItem(null)}>
        {placedItems.map((item) => {
          const placement = getItemPlacement(item.id);
          if (!placement || placement.isHidden) return null;

          const commonProps = {
            id: item.id,
            position: placement.position,
            rotation: placement.rotation,
            assignedProducts: item.assignedProducts || {},
            onUpdate: onUpdateItem,
            onRemove: onRemoveItem,
            onOpenSelector,
            isEditable: isEditMode
          };

          const handleFocus = (e: any) => {
            e.stopPropagation();
            if (!focusedItemId) onFocusItem(item.id);
          };

          return (
            <group key={item.id} onClick={handleFocus}>
              {item.type === 'helmet' && <HelmetDisplay {...commonProps} onOpenSelector={(id, s) => onOpenSelector(id, s, 'helmet')} />}
              {item.type === 'jacket' && <JacketRail {...commonProps} onOpenSelector={(id, s) => onOpenSelector(id, s, 'jacket')} />}
              {item.type === 'central' && <CentralShelf {...commonProps} onOpenSelector={(id, s) => onOpenSelector(id, s, 'central')} />}
            </group>
          );
        })}
      </group>

      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
    </Canvas>
  );
}

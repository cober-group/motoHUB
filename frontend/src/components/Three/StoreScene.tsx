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
  focusedProductIndex: number | null;
  exposedProducts: any[];
  onFocusItem: (id: string | null) => void;
  onFocusProduct: (itemId: string, slotIndex: number) => void;
  onUpdateItem: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onRemoveItem: (id: string) => void;
  onOpenSelector: (itemId: string, shelfIndex: number, type: 'helmet' | 'jacket' | 'central') => void;
  onOpenBarcodeScanner: (itemId: string, shelfIndex: number, type: 'helmet' | 'jacket' | 'central') => void;
}

export function StoreScene({
  placedItems, isEditMode, width, depth,
  focusedItemId, focusedProductIndex, exposedProducts,
  onFocusItem, onFocusProduct,
  onUpdateItem, onRemoveItem, onOpenSelector, onOpenBarcodeScanner
}: StoreSceneProps) {
  const controlsRef = useRef<CameraControls>(null);

  // --- DETERMINISTIC PLACEMENT HELPER ---
  const getItemPlacement = (id: string) => {
    const item = placedItems.find(i => i.id === id);
    if (!item) return null;

    if (item.type === 'central') {
      const centralItems = placedItems.filter(i => i.type === 'central');
      const centralIndex = centralItems.findIndex(ci => ci.id === id);
      if (centralIndex === -1) return { position: item.position, rotation: item.rotation, isHidden: false };

      const spacingX = 4.5;
      const spacingZ = 3.0;
      const margin = 2.5;

      const availX = (width * 2) - (margin * 2);
      const availZ = (depth * 2) - (margin * 2);

      const numCols = Math.max(1, Math.floor(availX / spacingX) + 1);
      const numRows = Math.max(1, Math.floor(availZ / spacingZ) + 1);
      const maxIslands = numCols * numRows;

      if (centralIndex >= maxIslands) {
        return { position: item.position, rotation: item.rotation, isHidden: true };
      }

      const col = centralIndex % numCols;
      const row = Math.floor(centralIndex / numCols);

      const totalW = (numCols - 1) * spacingX;
      const totalD = (numRows - 1) * spacingZ;

      const xPos = -(totalW / 2) + col * spacingX;
      const zPos = -(totalD / 2) + row * spacingZ;

      return { position: [xPos, 0, zPos], rotation: [0, 0, 0], isHidden: false };
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

  const getLocalSlotPos = (type: string, slotIndex: number): [number, number, number] => {
    if (type === 'helmet') {
      const s = Math.floor(slotIndex / 5);
      const idx = slotIndex % 5;
      const shelfOffsets = [-1.1, -0.55, 0, 0.55, 1.1];
      return [shelfOffsets[idx], 0.3 + s * 0.42, 0];
    }
    if (type === 'jacket') {
      const r = Math.floor(slotIndex / 8);
      const idx = slotIndex % 8;
      const slotOffsets = [-1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75];
      return [slotOffsets[idx], 0.8 + r * 1.5, 0];
    }
    if (type === 'central') {
      const isBack = slotIndex >= 20;
      const sideSlot = slotIndex % 20;
      const shelfRow = Math.floor(sideSlot / 5);
      const col = sideSlot % 5;
      const xPos = ([-1.1, -0.55, 0, 0.55, 1.1] as const)[col];
      const yPos = ([0.64, 1.14, 1.64, 2.14] as const)[shelfRow];
      return [xPos, yPos, isBack ? -0.32 : 0.32];
    }
    return [0, 0, 0];
  };

  // Transition Logic (Refined with deterministic sync)
  useEffect(() => {
    if (!controlsRef.current) return;

    if (focusedProductIndex !== null) {
      const selection = exposedProducts[focusedProductIndex];
      const placement = getItemPlacement(selection.itemId);
      if (placement) {
        const localSlot = getLocalSlotPos(selection.type, selection.slotIndex);
        const worldPos = new THREE.Vector3(...localSlot)
          .applyEuler(new THREE.Euler(...placement.rotation))
          .add(new THREE.Vector3(...placement.position));

        const rotY = placement.rotation[1];
        const distance = 2.5;
        const dx = Math.sin(rotY) * distance;
        const dz = Math.cos(rotY) * distance;

        controlsRef.current.setLookAt(
          worldPos.x + dx, worldPos.y + 0.3, worldPos.z + dz,
          worldPos.x, worldPos.y, worldPos.z,
          true
        );
      }
    } else if (focusedItemId) {
      const placement = getItemPlacement(focusedItemId);
      if (placement && !placement.isHidden) {
        const distance = 8.0; 
        const rotY = placement.rotation[1];
        
        const dx = Math.sin(rotY) * distance;
        const dz = Math.cos(rotY) * distance;
        
        const targetPos = new THREE.Vector3(...placement.position);
        const cameraPos = new THREE.Vector3(
          placement.position[0] + dx,
          3.5,
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
  }, [focusedItemId, focusedProductIndex, width, depth]); 

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

          const isFocused = focusedItemId === item.id;
          const commonProps = {
            id: item.id,
            position: placement.position as [number, number, number],
            rotation: placement.rotation as [number, number, number],
            assignedProducts: item.assignedProducts || {},
            onUpdate: onUpdateItem,
            onRemove: onRemoveItem,
            onOpenSelector,
            isEditable: isEditMode,
            isFocused,
          };

          const handleFocus = (e: any) => {
            if (focusedProductIndex !== null) return; // Ignore furniture click if inside product gallery
            e.stopPropagation();
            onFocusItem(item.id);
          };

          return (
            <group key={item.id} onClick={handleFocus}>
              {item.type === 'helmet' && <HelmetDisplay {...commonProps} onFocusProduct={onFocusProduct} onOpenSelector={(id, s) => onOpenSelector(id, s, 'helmet')} onOpenBarcodeScanner={(id) => onOpenBarcodeScanner(id, 0, 'helmet')} />}
              {item.type === 'jacket' && <JacketRail {...commonProps} onFocusProduct={onFocusProduct} onOpenSelector={(id, s) => onOpenSelector(id, s, 'jacket')} onOpenBarcodeScanner={(id) => onOpenBarcodeScanner(id, 0, 'jacket')} />}
              {item.type === 'central' && <CentralShelf {...commonProps} onFocusProduct={onFocusProduct} onOpenSelector={(id, s) => onOpenSelector(id, s, 'central')} onOpenBarcodeScanner={(id) => onOpenBarcodeScanner(id, 0, 'central')} />}
            </group>
          );
        })}
      </group>

      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
    </Canvas>
  );
}

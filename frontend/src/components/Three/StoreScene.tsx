'use client';

import { Canvas } from '@react-three/fiber';
import { CameraControls, ContactShadows, Environment, PivotControls } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import { PlacedItem } from '@/types/store';
import { StoreRoom } from './StoreRoom';
import { HelmetDisplay } from './Items/HelmetDisplay';
import { JacketRail } from './Items/JacketRail';
import { CentralShelf } from './Items/CentralShelf';
import { CashCounter } from './Items/CashCounter';
import { Entrance } from './Items/Entrance';
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
  centralRotation: number;
  centralCompact: boolean;
  onFocusItem: (id: string | null) => void;
  onFocusProduct: (itemId: string, slotIndex: number) => void;
  onUpdateItem: (id: string, pos: [number, number, number], rot: [number, number, number]) => void;
  onReorderItem: (id: string, targetIndex: number) => void;
  onRemoveItem: (id: string) => void;
  onOpenSelector: (itemId: string, shelfIndex: number, type: 'helmet' | 'jacket' | 'central') => void;
  onOpenBarcodeScanner: (itemId: string, shelfIndex: number, type: 'helmet' | 'jacket' | 'central') => void;
}

export function StoreScene({
  placedItems, isEditMode, width, depth,
  focusedItemId, focusedProductIndex, exposedProducts,
  centralRotation, centralCompact,
  onFocusItem, onFocusProduct,
  onUpdateItem, onReorderItem, onRemoveItem, onOpenSelector, onOpenBarcodeScanner
}: StoreSceneProps) {
  const controlsRef = useRef<CameraControls>(null);
  const lastMatrix = useRef<THREE.Matrix4>(new THREE.Matrix4());

  // --- DETERMINISTIC PLACEMENT HELPER ---
  const getItemPlacement = (id: string): {
    position: [number, number, number];
    rotation: [number, number, number];
    isHidden: boolean;
    isJoinedLeft?: boolean;
    isJoinedRight?: boolean;
  } | null => {
    const item = placedItems.find(i => i.id === id);
    if (!item) return null;

    if (item.type === 'central') {
      const centralItems = placedItems.filter(i => i.type === 'central');
      const centralIndex = centralItems.findIndex(ci => ci.id === id);
      if (centralIndex === -1) return { position: [0, 0, 0], rotation: [0, 0, 0], isHidden: false };

      // Gondola width scales with store width to keep 1.5m aisles on both sides.
      const gondolaWidth = Math.min(3.0, width * 2 - 4.26);
      if (gondolaWidth < 1.5) return { position: [0, 0, 0], rotation: [0, 0, 0], isHidden: true };

      const gondolaHalfWidth = gondolaWidth / 2 + 0.03;
      const gondolaHalfDepth = 0.26;
      const minAisle = 1.5;
      const wallMargin = 0.6;

      // At 90° rotation the gondola's length axis becomes world-Z so X/Z footprints swap
      const isRotated = Math.abs(centralRotation) > 0.1;
      const footprintX = isRotated ? gondolaHalfDepth : gondolaHalfWidth;
      const footprintZ = isRotated ? gondolaHalfWidth : gondolaHalfDepth;

      const maxXPos = Math.max(0, (width - wallMargin) - footprintX - minAisle);
      const maxZPos = Math.max(0, (depth - wallMargin) - footprintZ - minAisle);

      // Compact: gondolas touch (spacing = gondola width + shared-upright gap)
      const compactSpacing = gondolaWidth + 0.06;
      // At 90°: long axis is Z, so compact/normal spacing applies to Z; X gets the 3m depth spacing
      const spacingX = isRotated ? 3.0 : (centralCompact ? compactSpacing : 4.5);
      const spacingZ = isRotated ? (centralCompact ? compactSpacing : 4.5) : 3.0;

      const numCols = Math.floor(maxXPos * 2 / spacingX) + 1;
      const numRows = Math.floor(maxZPos * 2 / spacingZ) + 1;
      const maxIslands = numCols * numRows;

      if (centralIndex >= maxIslands) {
        return { position: [0, 0, 0], rotation: [0, 0, 0], isHidden: true };
      }

      const col = centralIndex % numCols;
      const row = Math.floor(centralIndex / numCols);

      const totalW = (numCols - 1) * spacingX;
      const totalD = (numRows - 1) * spacingZ;

      const xPos = numCols > 1 ? -(totalW / 2) + col * spacingX : 0;
      const zPos = numRows > 1 ? -(totalD / 2) + row * spacingZ : 0;

      // Determine which uprights to omit when gondolas are joined
      let isJoinedLeft = false;
      let isJoinedRight = false;
      if (centralCompact) {
        if (!isRotated) {
          // 0°: long axis = X (numCols). Left upright faces -X (col-1), right faces +X (col+1)
          isJoinedLeft = col > 0;
          isJoinedRight = col < numCols - 1 && centralIndex + 1 < centralItems.length;
        } else {
          // 90°: long axis = Z (numRows). Gondola "left" upright faces world +Z (row+1),
          // "right" upright faces world -Z (row-1)
          isJoinedLeft = row < numRows - 1 && centralIndex + numCols < centralItems.length;
          isJoinedRight = row > 0;
        }
      }

      return {
        position: [xPos, 0, zPos],
        rotation: [0, centralRotation, 0],
        isHidden: false,
        isJoinedLeft,
        isJoinedRight,
      };
    }

    // Manual 3D override: only for items NOT slot-encoded (position[1] !== -1) with a real manual pos
    if (item.position[1] !== -1 &&
        (item.position[0] !== 0 || item.position[1] !== 0 || item.position[2] !== 0)) {
      return { position: item.position, rotation: item.rotation, isHidden: false };
    }

    // Perimeter logic (helmet / jacket / cash / entrance)
    // Slot encoding: position=[slotIndex, -1, 0] → fixed slot, not shifted by deletions
    // Legacy: position=[0,0,0] → derive slot from array index
    const wallItems = placedItems.filter(i => i.type === 'helmet' || i.type === 'jacket' || i.type === 'cash' || i.type === 'entrance');
    const globalIndex = item.position[1] === -1
      ? Math.round(item.position[0])
      : wallItems.findIndex(wi => wi.id === id);
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
      const gw = Math.min(3.0, Math.max(1.5, width * 2 - 4.26));
      const hw = gw / 2;
      const isBack = slotIndex >= 20;
      const sideSlot = slotIndex % 20;
      const shelfRow = Math.floor(sideSlot / 5);
      const col = sideSlot % 5;
      const xPositions = [-hw * 0.88, -hw * 0.44, 0, hw * 0.44, hw * 0.88];
      const yPositions = [0.64, 1.14, 1.64, 2.14];
      return [xPositions[col], yPositions[shelfRow], isBack ? -0.32 : 0.32];
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

          const isJoinedLeft = placement.isJoinedLeft ?? false;
          const isJoinedRight = placement.isJoinedRight ?? false;

          const renderItemContent = (overrides?: { position?: [number, number, number], rotation?: [number, number, number] }) => {
            const props = {
              ...commonProps,
              position: overrides?.position ?? commonProps.position,
              rotation: overrides?.rotation ?? commonProps.rotation,
            };
            return (
              <>
                {item.type === 'helmet' && <HelmetDisplay {...props} onFocusProduct={onFocusProduct} onOpenSelector={(id, s) => onOpenSelector(id, s, 'helmet')} onOpenBarcodeScanner={(id) => onOpenBarcodeScanner(id, 0, 'helmet')} />}
                {item.type === 'jacket' && <JacketRail {...props} onFocusProduct={onFocusProduct} onOpenSelector={(id, s) => onOpenSelector(id, s, 'jacket')} onOpenBarcodeScanner={(id) => onOpenBarcodeScanner(id, 0, 'jacket')} />}
                {item.type === 'central' && <CentralShelf {...props} gondolaWidth={Math.min(3.0, Math.max(1.5, width * 2 - 4.26))} onFocusProduct={onFocusProduct} onOpenSelector={(id, s) => onOpenSelector(id, s, 'central')} onOpenBarcodeScanner={(id) => onOpenBarcodeScanner(id, 0, 'central')} isJoinedLeft={isJoinedLeft} isJoinedRight={isJoinedRight} />}
                {item.type === 'cash' && <CashCounter {...props} />}
                {item.type === 'entrance' && <Entrance {...props} />}
              </>
            );
          };

          return (
            <group key={item.id} onClick={handleFocus}>
              {isEditMode && isFocused && item.type !== 'central' ? (
                <PivotControls
                  activeAxes={[true, false, true, false, true, false] as any}
                  depthTest={false}
                  fixed={true}
                  scale={60}
                  lineWidth={2}
                  anchor={[0, 0, 0]}
                  matrix={new THREE.Matrix4().compose(
                    new THREE.Vector3(...placement.position),
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(...placement.rotation)),
                    new THREE.Vector3(1, 1, 1)
                  )}
                  onDragStart={() => { if (controlsRef.current) controlsRef.current.enabled = false; }}
                  onDrag={(_l, _deltaL, w) => {
                    lastMatrix.current.copy(w);

                    // REAL-TIME RAIL SLIDING: compute target slot from drag position
                    const pos = new THREE.Vector3().setFromMatrixPosition(w);

                    const cornerMargin = 0.8, itemBodyWidth = 3.0, currentWallLength = 3.5;
                    const availX = (width * 2) - 2 * cornerMargin;
                    const availZ = (depth * 2) - 2 * cornerMargin;
                    const slotsX = Math.max(1, Math.floor((availX - itemBodyWidth) / currentWallLength) + 1);
                    const slotsZ = Math.max(1, Math.floor((availZ - itemBodyWidth) / currentWallLength) + 1);

                    const dists = [
                      Math.abs(pos.x - (-width)),
                      Math.abs(pos.z - (-depth)),
                      Math.abs(pos.x - width),
                      Math.abs(pos.z - depth),
                    ];
                    const wallIndex = dists.indexOf(Math.min(...dists));

                    let indexInWall = 0;
                    if (wallIndex === 0) indexInWall = Math.round((pos.z / currentWallLength) + (slotsZ - 1) / 2);
                    else if (wallIndex === 1) indexInWall = Math.round((pos.x / currentWallLength) + (slotsX - 1) / 2);
                    else if (wallIndex === 2) indexInWall = Math.round((-pos.z / currentWallLength) + (slotsZ - 1) / 2);
                    else if (wallIndex === 3) indexInWall = Math.round((-pos.x / currentWallLength) + (slotsX - 1) / 2);

                    const wallSlotCount = (wallIndex === 0 || wallIndex === 2) ? slotsZ : slotsX;
                    indexInWall = Math.max(0, Math.min(wallSlotCount - 1, indexInWall));

                    let targetSlot = indexInWall;
                    if (wallIndex === 1) targetSlot += slotsZ;
                    else if (wallIndex === 2) targetSlot += (slotsZ + slotsX);
                    else if (wallIndex === 3) targetSlot += (slotsZ * 2 + slotsX);

                    // Compare against the item's current stored slot, not its array index
                    const currentSlot = item.position[1] === -1 ? Math.round(item.position[0]) : -1;
                    if (currentSlot !== targetSlot) {
                      onReorderItem(item.id, targetSlot);
                    }
                  }}
                  onDragEnd={() => {
                    if (controlsRef.current) controlsRef.current.enabled = true;
                    // Wall items use slot encoding — position is managed by reorderItem during drag
                    if (item.type === 'helmet' || item.type === 'jacket' ||
                        item.type === 'cash' || item.type === 'entrance') return;
                    // Other draggable items store their manual 3D position
                    const pos = new THREE.Vector3();
                    const quat = new THREE.Quaternion();
                    const scale = new THREE.Vector3();
                    lastMatrix.current.decompose(pos, quat, scale);
                    const rot = new THREE.Euler().setFromQuaternion(quat);
                    const snap = Math.PI / 2;
                    const snappedRotY = Math.round(rot.y / snap) * snap;
                    const margin = 0.5;
                    const clampedX = Math.max(-width + margin, Math.min(width - margin, pos.x));
                    const clampedZ = Math.max(-depth + margin, Math.min(depth - margin, pos.z));
                    onUpdateItem(item.id, [clampedX, 0, clampedZ], [0, snappedRotY, 0]);
                  }}
                >
                  {renderItemContent({ position: [0, 0, 0], rotation: [0, 0, 0] })}
                </PivotControls>
              ) : (
                renderItemContent()
              )}
            </group>
          );
        })}
      </group>

      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
    </Canvas>
  );
}

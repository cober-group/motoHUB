export interface PlacedItem {
  id: string;
  type: 'helmet' | 'jacket' | 'central';
  position: [number, number, number];
  rotation: [number, number, number];
  assignedProducts?: Record<number, any>;
}

export interface PlacedItem {
  id: string;
  type: 'helmet' | 'jacket' | 'central' | 'cash' | 'entrance';
  position: [number, number, number];
  rotation: [number, number, number];
  assignedProducts?: Record<number, any>;
}

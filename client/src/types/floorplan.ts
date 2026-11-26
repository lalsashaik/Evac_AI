/**
 * Floor Plan TypeScript types — M4 (Frontend)
 * Matches the backend types and DATABASE_SCHEMA.md exactly.
 * All positions and dimensions are normalized (0.0 – 1.0).
 */

export type RoomType = 'room' | 'corridor' | 'common_area' | 'stairwell' | 'elevator' | 'restroom';
export type DoorType = 'shop_door' | 'main_entry' | 'emergency_exit' | 'entry' | 'exit' | 'internal';
export type EditorTool =
  | 'select'
  | 'room'
  | 'corridor'
  | 'stairwell'
  | 'elevator'
  | 'shop_door'
  | 'main_entry'
  | 'emergency_exit'
  | 'camera'
  | 'delete';

export interface FloorRoom {
  roomId: string;
  name: string;
  type: RoomType;
  /** Normalized x position (0–1) */
  x: number;
  /** Normalized y position (0–1) */
  y: number;
  /** Normalized width (0–1) */
  width: number;
  /** Normalized height (0–1) */
  height: number;
  fill: string;
  stroke: string;
  createdAt: string;
}

export interface FloorDoor {
  doorId: string;
  type: DoorType;
  roomId: string;
  x: number;
  y: number;
  rotation: number;
  label: string;
  createdAt: string;
}

export interface FloorCameraMarker {
  cameraId: string;
  name: string;
  roomId?: string | null;
  x: number;
  y: number;
  rotation: number;
  streamType?: string;
  streamUrl?: string;
}

export interface FloorPlan {
  floorId: string;
  floorName: string;
  floorNumber: number;
  canvasWidth: number;
  canvasHeight: number;
  createdAt: string;
  updatedAt: string;
  rooms: Record<string, FloorRoom>;
  doors: Record<string, FloorDoor>;
  cameras: Record<string, FloorCameraMarker>;
}

export interface FloorMeta {
  floorId: string;
  floorNumber: number;
  floorName: string;
}

export type SelectedElement =
  | { type: 'room'; id: string }
  | { type: 'door'; id: string }
  | { type: 'camera'; id: string }
  | null;

/** Fill / stroke colors by element type */
export const ROOM_STYLES: Record<RoomType, { fill: string; stroke: string; label: string }> = {
  room: { fill: '#eff6ff', stroke: '#3b82f6', label: 'Shop / Store' },
  corridor: { fill: '#f0fdf4', stroke: '#22c55e', label: 'Corridor' },
  common_area: { fill: '#fefce8', stroke: '#eab308', label: 'Common Area / Atrium' },
  stairwell: { fill: '#faf5ff', stroke: '#8b5cf6', label: 'Stairs / Evacuation' },
  elevator: { fill: '#f0f9ff', stroke: '#0ea5e9', label: 'Elevator / Lift' },
  restroom: { fill: '#f0fdfa', stroke: '#14b8a6', label: 'Restrooms' },
};

export const DOOR_COLORS: Record<DoorType, { fill: string; stroke: string; label: string }> = {
  shop_door: { fill: '#2563eb', stroke: '#ffffff', label: 'Shop Entry' },
  main_entry: { fill: '#16a34a', stroke: '#ffffff', label: 'Main Entry / Exit' },
  emergency_exit: { fill: '#dc2626', stroke: '#ffffff', label: 'Emergency Exit' },
  // Backward compatibility aliases
  entry: { fill: '#16a34a', stroke: '#ffffff', label: 'Main Entry / Exit' },
  exit: { fill: '#dc2626', stroke: '#ffffff', label: 'Emergency Exit' },
  internal: { fill: '#2563eb', stroke: '#ffffff', label: 'Shop Entry' },
};

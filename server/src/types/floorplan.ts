/**
 * Floor Plan TypeScript types — M4
 * Matches the DATABASE_SCHEMA.md structure exactly.
 * All positions and dimensions are normalized (0.0 – 1.0).
 */

export type RoomType = 'room' | 'corridor' | 'common_area' | 'stairwell' | 'elevator' | 'restroom';
export type DoorType = 'shop_door' | 'main_entry' | 'emergency_exit' | 'entry' | 'exit' | 'internal';

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

export interface SaveFloorPlanDto {
  floorId?: string;
  floorName?: string;
  floorNumber?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  rooms: Record<string, FloorRoom>;
  doors: Record<string, FloorDoor>;
  cameras: Record<string, FloorCameraMarker>;
}

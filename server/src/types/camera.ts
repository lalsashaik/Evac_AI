/**
 * Camera TypeScript Types — M5
 * Matches DATABASE_SCHEMA.md exactly:
 * - Authoritative record: malls/{mallId}/cameras/{cameraId}
 * - Volatile health record: malls/{mallId}/cameraHealth/{cameraId}
 * - Spatial floor placement: malls/{mallId}/floorplans/{floorId}/cameras/{cameraId}
 */

export type CameraStreamType = 'simulated' | 'mjpeg' | 'esp32cam';
export type CameraHealthStatus = 'online' | 'offline' | 'unknown' | 'inactive';

export interface CameraRecord {
  cameraId: string;
  mallId: string;
  name: string;
  floorId: string;
  roomId?: string | null;
  streamType: CameraStreamType;
  streamUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CameraHealthRecord {
  cameraId: string;
  status: CameraHealthStatus;
  lastSeenAt?: string | null;
  lastFrameAt?: string | null;
  updatedAt: string;
}

export interface CameraWithDetails extends CameraRecord {
  roomName?: string | null;
  floorName?: string | null;
  x?: number | null;
  y?: number | null;
  rotation?: number | null;
  health?: CameraHealthRecord;
}

export interface CreateCameraDto {
  cameraId?: string;
  name: string;
  floorId?: string;
  roomId?: string | null;
  streamType: CameraStreamType;
  streamUrl: string;
  isActive?: boolean;
  x?: number;
  y?: number;
  rotation?: number;
}

export interface UpdateCameraDto {
  name?: string;
  floorId?: string;
  roomId?: string | null;
  streamType?: CameraStreamType;
  streamUrl?: string;
  isActive?: boolean;
  x?: number;
  y?: number;
  rotation?: number;
}

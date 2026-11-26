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

/**
 * Real-Time Camera Detection State — M8
 * Tracks current active presence of fire/smoke separate from historical incidents.
 * Path: malls/{mallId}/cameraDetectionState/{cameraId}
 */
export interface CameraDetectionState {
  cameraId: string;
  mallId: string;
  isCurrentlyDetected: boolean;
  detectionType: 'fire' | 'smoke' | 'fire_and_smoke' | null;
  activeTypes?: string[];
  lastDetectedAt: string | null;
  updatedAt: string;
  confidence?: number | null;
  cameraStatus?: string;
  latestEvidenceFileName?: string | null;
  latestEvidenceId?: string | null;
  latestEvidenceRelativePath?: string | null;
  lastClearAt?: string | null;
}


/**
 * Camera TypeScript Types — M5 (Frontend)
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
  roomName?: string | null;
  floorName?: string | null;
  x?: number | null;
  y?: number | null;
  rotation?: number | null;
  health?: {
    cameraId: string;
    status: CameraHealthStatus;
    lastSeenAt?: string | null;
    lastFrameAt?: string | null;
    updatedAt?: string;
  };
}

export interface SampleVideoOption {
  id: string;
  label: string;
  description: string;
  url: string;
}

export const BUNDLED_SAMPLE_VIDEOS: SampleVideoOption[] = [];

/**
 * Real-Time Camera Detection State — M8 (Frontend)
 * Stored at: malls/{mallId}/cameraDetectionState/{cameraId}
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


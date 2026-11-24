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

export const BUNDLED_SAMPLE_VIDEOS: SampleVideoOption[] = [
  {
    id: 'entrance',
    label: 'Main Entrance Feed (Bundled Demo)',
    description: 'Lobby & main entrance surveillance footage',
    url: '/videos/cctv_entrance_sample.mp4',
  },
  {
    id: 'corridor',
    label: 'Corridor Walkway Feed (Bundled Demo)',
    description: 'Pedestrian corridor & emergency egress pathway',
    url: '/videos/cctv_corridor_sample.mp4',
  },
  {
    id: 'foodcourt',
    label: 'Food Court & Atrium Feed (Bundled Demo)',
    description: 'High-density commercial retail area',
    url: '/videos/cctv_foodcourt_sample.mp4',
  },
];

export type IncidentStatus =
  | 'DETECTED'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'FALSE_ALARM';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  class_name?: string;
  confidence: number;
  x_norm?: number;
  y_norm?: number;
  w_norm?: number;
  h_norm?: number;
}

export interface TimescaleObservation {
  observationId: string;
  incidentId: string;
  observationIndex: number;
  observedAt: string;
  timeFormatted: string;
  confidence: number;
  detectionType: string;
  evidenceId: string | null;
  evidenceFileName: string | null;
  evidenceRelativePath: string | null;
  evidenceAvailable: boolean;
  boundingBoxes?: BoundingBox[];
  emailSent?: boolean;
  note?: string;
  isConcluding?: boolean;
}

export interface IncidentRecord {
  incidentId: string;
  mallId: string;
  cameraId: string;
  cameraName: string;
  floorId: string;
  roomId: string | null;
  roomName: string | null;
  detectionType: string;
  confidence: number;
  detectedAt: string;
  createdAt: string;
  evidenceId: string | null;
  evidenceFileName: string | null;
  evidenceRelativePath: string | null;
  evidenceAvailable: boolean;
  evidenceEndpoint?: string | null;
  status: IncidentStatus;
  boundingBoxes: BoundingBox[];
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  investigatedBy: string | null;
  investigatedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  emailNotificationSent: boolean;
  lastStatusChangedAt: string;
  observations?: Record<string, TimescaleObservation>;
  observationCount?: number;
  lastObservationAt?: string;
  isFireActive?: boolean;
  finalEvidenceFileName?: string | null;
  finalEvidenceAvailable?: boolean;
  finalEvidenceRelativePath?: string | null;
}

export interface NotificationRecord {
  notificationId: string;
  type: string;
  incidentId: string;
  mallId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

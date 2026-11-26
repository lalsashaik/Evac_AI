from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class HealthResponse(BaseModel):
    service: str
    status: str
    environment: str
    timestamp: str
    cameras_active: int
    opencv_version: Optional[str] = None
    model_loaded: bool = False
    model_info: Optional[Dict[str, Any]] = None
    details: Optional[Dict[str, Any]] = None

class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    class_name: str
    confidence: float
    x_norm: Optional[float] = None
    y_norm: Optional[float] = None
    w_norm: Optional[float] = None
    h_norm: Optional[float] = None

class DetectionEvent(BaseModel):
    eventId: str
    cameraId: str
    mallId: str
    detectionType: str  # "fire" or "smoke"
    confidence: float
    boundingBoxes: List[BoundingBox] = Field(default_factory=list)
    timestamp: str
    evidenceId: Optional[str] = None
    evidenceFileName: Optional[str] = None
    evidenceReference: Optional[str] = None
    evidenceUrl: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class CameraStartRequest(BaseModel):
    cameraId: str
    mallId: str
    name: Optional[str] = None
    streamType: str = "simulated"  # "simulated", "mjpeg", "esp32cam"
    streamUrl: str
    frameIntervalSeconds: Optional[float] = None
    confidenceThreshold: Optional[float] = None

class CameraStatusResponse(BaseModel):
    cameraId: str
    mallId: str
    name: Optional[str] = None
    streamType: str
    streamUrl: str
    status: str  # "running", "stopped", "error", "offline"
    error: Optional[str] = None
    framesProcessed: int = 0
    detectionsCount: int = 0
    lastFrameAt: Optional[str] = None
    lastDetectionAt: Optional[str] = None

class CameraStatusListResponse(BaseModel):
    success: bool = True
    totalActive: int
    totalConfigured: int
    cameras: List[CameraStatusResponse]

class RecentDetectionsResponse(BaseModel):
    success: bool = True
    count: int
    events: List[DetectionEvent]

class CameraDetectionStatePayload(BaseModel):
    cameraId: str
    mallId: str
    isCurrentlyDetected: bool
    detectionType: Optional[str] = None
    activeTypes: List[str] = Field(default_factory=list)
    lastDetectedAt: Optional[str] = None
    updatedAt: str
    confidence: Optional[float] = None
    cameraStatus: Optional[str] = None


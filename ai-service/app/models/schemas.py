from pydantic import BaseModel
from typing import Optional, Dict, Any

class HealthResponse(BaseModel):
    service: str
    status: str
    environment: str
    timestamp: str
    cameras_active: int
    opencv_version: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

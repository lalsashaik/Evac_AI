import datetime
from fastapi import APIRouter
from app.config import settings
from app.models.schemas import HealthResponse
from app.services.camera_manager import camera_manager

try:
    import cv2
    OPENCV_VERSION = cv2.__version__
except ImportError:
    OPENCV_VERSION = "Not installed"

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Returns service health, active camera count, and OpenCV version.
    """
    return HealthResponse(
        service=settings.service_name,
        status="ok",
        environment=settings.environment,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        cameras_active=camera_manager.get_active_count(),
        opencv_version=OPENCV_VERSION,
        details={
            "backend_api_url": settings.backend_api_url,
            "yolo_detector": "placeholder (scheduled for M6)",
        }
    )

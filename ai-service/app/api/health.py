import datetime
from fastapi import APIRouter
from app.config import settings
from app.models.schemas import HealthResponse
from app.services.camera_manager import camera_manager
from app.services.detector import detector

try:
    import cv2
    OPENCV_VERSION = cv2.__version__
except ImportError:
    OPENCV_VERSION = "Not installed"

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Returns service health, active camera count, OpenCV version, and AI model status.
    """
    model_info = detector.get_info()
    return HealthResponse(
        service=settings.service_name,
        status="ok" if detector.is_loaded else "degraded",
        environment=settings.environment,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        cameras_active=camera_manager.get_active_count(),
        opencv_version=OPENCV_VERSION,
        model_loaded=detector.is_loaded,
        model_info=model_info,
        details={
            "backend_api_url": settings.backend_api_url,
            "confidence_threshold": settings.confidence_threshold,
            "frame_interval_seconds": settings.frame_interval_seconds,
            "cooldown_seconds": settings.cooldown_seconds,
            "evidence_dir": settings.evidence_dir,
        }
    )

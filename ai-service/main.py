import os
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.health import router as health_router
from app.api.cameras import router as cameras_router
from app.api.detections import router as detections_router
from app.services.camera_manager import camera_manager
from app.services.detector import detector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("evacai.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.service_name} on {settings.host}:{settings.port}...")
    logger.info(f"YOLO Detector Status: {'LOADED' if detector.is_loaded else 'NOT LOADED'}")
    if detector.is_loaded:
        logger.info(f"Supported classes: {detector.classes}")

    if getattr(settings, "auto_sync_cameras", False) and getattr(settings, "environment", "") != "test" and os.getenv("ENVIRONMENT") != "test":
        asyncio.create_task(async_sync_cameras())

    yield

    # Shutdown
    logger.info("Shutting down AI Detection Service...")
    camera_manager.stop_all()

async def async_sync_cameras():
    """Attempts camera synchronization with retry logic to handle backend startup timing."""
    max_attempts = 5
    for attempt in range(1, max_attempts + 1):
        wait_secs = attempt * 3  # 3s, 6s, 9s, 12s, 15s
        logger.info(f"[Camera Sync] Waiting {wait_secs}s before sync attempt {attempt}/{max_attempts}...")
        await asyncio.sleep(wait_secs)
        try:
            loop = asyncio.get_running_loop()
            count = await loop.run_in_executor(None, camera_manager.sync_from_backend)
            if count >= 0:
                logger.info(f"[Camera Sync] Attempt {attempt} succeeded: {count} cameras started.")
                return
        except Exception as e:
            logger.warning(f"[Camera Sync] Attempt {attempt} failed: {e}")
    logger.warning("[Camera Sync] All sync attempts exhausted. Use POST /cameras/sync to retry manually.")

app = FastAPI(
    title="EvacAI - AI Detection Service",
    description="Video stream processing and fire/smoke detection microservice for EvacAI platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for web dashboard and testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health_router)
app.include_router(cameras_router)
app.include_router(detections_router)

@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.service_name,
        "status": "online",
        "documentation": "/docs",
        "health": "/health",
        "cameras": "/cameras/status",
        "detections": "/detections/recent",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)

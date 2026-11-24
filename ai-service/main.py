import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.health import router as health_router
from app.models.schemas import HealthResponse
from app.services.camera_manager import camera_manager

try:
    import cv2
    OPENCV_VERSION = cv2.__version__
except ImportError:
    OPENCV_VERSION = "Not installed"

app = FastAPI(
    title="EvacAI - AI Detection Service",
    description="Video stream processing and fire/smoke detection microservice for EvacAI platform.",
    version="1.0.0",
)

# Enable CORS for local web dashboard and testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount health endpoint at root /health as well as through router
app.include_router(health_router)

@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.service_name,
        "status": "online",
        "documentation": "/docs",
        "health": "/health",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)

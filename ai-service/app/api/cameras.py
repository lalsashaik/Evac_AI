from fastapi import APIRouter, HTTPException, Path, Body
from typing import Optional
from app.models.schemas import (
    CameraStartRequest,
    CameraStatusResponse,
    CameraStatusListResponse,
)
from app.services.camera_manager import camera_manager

router = APIRouter(prefix="/cameras", tags=["Cameras"])

@router.get("/status", response_model=CameraStatusListResponse)
async def get_all_camera_statuses():
    """
    Lists all configured cameras and their current AI processing status.
    """
    return camera_manager.get_all_statuses()

@router.get("/{cameraId}/status", response_model=CameraStatusResponse)
async def get_single_camera_status(cameraId: str = Path(..., description="Unique camera identifier")):
    """
    Retrieves AI processing status for a specific camera.
    """
    status = camera_manager.get_camera_status(cameraId)
    if not status:
        raise HTTPException(status_code=404, detail=f"Camera '{cameraId}' is not configured in the AI service.")
    return status

@router.post("/{cameraId}/start", response_model=CameraStatusResponse)
async def start_camera_processing(
    cameraId: str = Path(..., description="Unique camera identifier"),
    payload: Optional[CameraStartRequest] = Body(None),
):
    """
    Starts AI video processing and fire/smoke detection for the specified camera.
    """
    if payload is None:
        raise HTTPException(
            status_code=400,
            detail="Camera configuration payload required (mallId, streamUrl, streamType, etc.)"
        )

    # Ensure path parameter matches payload cameraId
    if payload.cameraId != cameraId:
        payload.cameraId = cameraId

    status = camera_manager.start_camera(payload)
    return status

@router.post("/{cameraId}/stop", response_model=CameraStatusResponse)
async def stop_camera_processing(cameraId: str = Path(..., description="Unique camera identifier")):
    """
    Stops AI video processing for the specified camera and releases resources.
    """
    status = camera_manager.stop_camera(cameraId)
    if not status:
        raise HTTPException(status_code=404, detail=f"Camera '{cameraId}' is not currently active.")
    return status

@router.post("/sync")
async def sync_cameras():
    """
    Triggers dynamic synchronization with Node.js backend to load active cameras.
    """
    count = camera_manager.sync_from_backend()
    return {
        "success": True,
        "message": f"Successfully synchronized and started {count} cameras from backend.",
        "activeCount": camera_manager.get_active_count()
    }

import os
from fastapi import APIRouter, Query, HTTPException, Path
from fastapi.responses import FileResponse
from typing import Optional
from app.config import settings
from app.models.schemas import RecentDetectionsResponse
from app.services.camera_manager import camera_manager

router = APIRouter(tags=["Detections"])

@router.get("/detections/recent", response_model=RecentDetectionsResponse)
async def get_recent_detections(
    limit: int = Query(50, ge=1, le=100, description="Max recent events to return"),
    cameraId: Optional[str] = Query(None, description="Optional filter by camera ID"),
):
    """
    Retrieves recent verified fire and smoke detection events from in-memory event buffer.
    """
    events = camera_manager.get_recent_detections(limit=limit, camera_id=cameraId)
    return RecentDetectionsResponse(
        success=True,
        count=len(events),
        events=events
    )

@router.get("/evidence/{mallId}/{cameraId}/{filename}")
async def get_evidence_image(
    mallId: str = Path(..., description="Mall identifier"),
    cameraId: str = Path(..., description="Camera identifier"),
    filename: str = Path(..., description="Evidence image filename (e.g. evt_....jpg)"),
):
    """
    Serves saved evidence snapshot images with bounding box annotations.
    """
    # Security: prevent directory traversal
    clean_filename = os.path.basename(filename)
    clean_mall = os.path.basename(mallId)
    clean_cam = os.path.basename(cameraId)

    candidates = [
        os.path.join(settings.evidence_dir, "incidents", clean_mall, clean_filename),
        os.path.join(settings.evidence_dir, clean_mall, clean_cam, clean_filename),
    ]
    filepath = None
    for cand in candidates:
        if os.path.exists(cand):
            filepath = cand
            break

    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Evidence frame snapshot not found.")

    return FileResponse(filepath, media_type="image/jpeg")

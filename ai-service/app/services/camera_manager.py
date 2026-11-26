import logging
import threading
from collections import deque
from typing import Dict, List, Optional, Any
import requests

from app.config import settings
from app.models.schemas import (
    CameraStartRequest,
    CameraStatusResponse,
    CameraStatusListResponse,
    DetectionEvent,
)
from app.services.camera_worker import CameraWorker

logger = logging.getLogger("evacai.camera_manager")

class CameraManager:
    """
    Central manager for concurrent camera stream workers and in-memory detection events.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._workers: Dict[str, CameraWorker] = {}
        self._recent_events: deque = deque(maxlen=settings.max_recent_events)

    def get_active_count(self) -> int:
        with self._lock:
            return sum(1 for w in self._workers.values() if w.status == "running")

    def list_camera_ids(self) -> List[str]:
        with self._lock:
            return list(self._workers.keys())

    def start_camera(self, req: CameraStartRequest) -> CameraStatusResponse:
        """
        Starts or restarts processing for a single camera.
        Prevents duplicate processing loops.
        """
        with self._lock:
            # If camera already running, stop old worker first to prevent duplicates
            if req.cameraId in self._workers:
                old_worker = self._workers[req.cameraId]
                if old_worker.status == "running":
                    logger.info(f"Restarting existing worker for camera '{req.cameraId}'")
                    old_worker.stop()

            worker = CameraWorker(
                camera_id=req.cameraId,
                mall_id=req.mallId,
                name=req.name,
                stream_url=req.streamUrl,
                stream_type=req.streamType,
                frame_interval_seconds=req.frameIntervalSeconds,
                confidence_threshold=req.confidenceThreshold,
                event_callback=self._on_detection,
                state_callback=self._on_detection_state,
                observation_callback=self._on_observation,
            )
            self._workers[req.cameraId] = worker
            worker.start()

            return worker.get_status()

    def stop_camera(self, camera_id: str) -> Optional[CameraStatusResponse]:
        """
        Stops processing for a camera and releases its video capture resources.
        """
        with self._lock:
            worker = self._workers.get(camera_id)
            if not worker:
                return None

            worker.stop()
            return worker.get_status()

    def get_camera_status(self, camera_id: str) -> Optional[CameraStatusResponse]:
        with self._lock:
            worker = self._workers.get(camera_id)
            return worker.get_status() if worker else None

    def get_all_statuses(self) -> CameraStatusListResponse:
        with self._lock:
            cameras = [w.get_status() for w in self._workers.values()]
            active = sum(1 for c in cameras if c.status == "running")
            return CameraStatusListResponse(
                success=True,
                totalActive=active,
                totalConfigured=len(cameras),
                cameras=cameras,
            )

    def _on_detection(self, event: DetectionEvent) -> None:
        """Internal callback invoked by workers when a verified detection occurs."""
        with self._lock:
            self._recent_events.appendleft(event)

        # Asynchronously dispatch detection to backend without blocking worker thread
        threading.Thread(
            target=self._dispatch_detection_to_backend,
            args=(event,),
            name=f"Dispatch-{event.eventId}",
            daemon=True
        ).start()

    def _dispatch_detection_to_backend(self, event: DetectionEvent) -> None:
        """Sends detection payload to POST /api/detection on the Node.js backend."""
        endpoint = f"{settings.backend_api_url}/detection"
        headers = {
            "X-AI-Service-Key": settings.ai_service_key,
            "Content-Type": "application/json",
        }
        payload = {
            "cameraId": event.cameraId,
            "mallId": event.mallId,
            "detectionType": event.detectionType,
            "confidence": event.confidence,
            "timestamp": event.timestamp,
            "boundingBoxes": [
                {
                    "x": b.x,
                    "y": b.y,
                    "width": b.width,
                    "height": b.height,
                    "class_name": b.class_name,
                    "confidence": b.confidence,
                    "x_norm": b.x_norm,
                    "y_norm": b.y_norm,
                    "w_norm": b.w_norm,
                    "h_norm": b.h_norm,
                }
                for b in event.boundingBoxes
            ],
            "evidenceId": event.eventId,
            "evidenceFileName": f"{event.eventId}.jpg",
            "evidenceRelativePath": f"incidents/{event.mallId}/{event.eventId}.jpg",
        }

        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=5.0)
            if resp.status_code == 201:
                data = resp.json().get("data", {})
                logger.info(
                    f"✅ [Backend Ingestion] Created incident '{data.get('incidentId')}' for {event.detectionType.upper()} on camera '{event.cameraId}'"
                )
            elif resp.status_code == 200:
                data = resp.json().get("data", {})
                logger.info(
                    f"ℹ️ [Backend Ingestion] Deduplicated {event.detectionType.upper()} event on camera '{event.cameraId}' (active incident: '{data.get('incidentId')}')"
                )
            else:
                logger.warning(f"Backend detection ingestion returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Could not dispatch detection to backend ({endpoint}): {e}")

    def _on_detection_state(self, state: Dict[str, Any]) -> None:
        """Internal callback invoked by workers when real-time presence detection state changes."""
        threading.Thread(
            target=self._dispatch_detection_state_to_backend,
            args=(state,),
            name=f"StateDispatch-{state.get('cameraId')}",
            daemon=True
        ).start()

    def _dispatch_detection_state_to_backend(self, state: Dict[str, Any]) -> None:
        """Sends real-time presence detection state to POST /api/detection/state on Node.js backend."""
        endpoint = f"{settings.backend_api_url}/detection/state"
        headers = {
            "X-AI-Service-Key": settings.ai_service_key,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.post(endpoint, json=state, headers=headers, timeout=5.0)
            if resp.status_code != 200:
                logger.debug(f"Backend detection state update returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.debug(f"Could not dispatch detection state to backend ({endpoint}): {e}")

    def _on_observation(self, observation: Dict[str, Any]) -> None:
        """Internal callback invoked by workers when a 15-min periodic timescale observation snapshot is taken."""
        threading.Thread(
            target=self._dispatch_observation_to_backend,
            args=(observation,),
            name=f"ObservationDispatch-{observation.get('cameraId')}",
            daemon=True
        ).start()

    def _dispatch_observation_to_backend(self, observation: Dict[str, Any]) -> None:
        """Sends periodic 15-min observation snapshot to POST /api/detection/observation on Node.js backend."""
        endpoint = f"{settings.backend_api_url}/detection/observation"
        headers = {
            "X-AI-Service-Key": settings.ai_service_key,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.post(endpoint, json=observation, headers=headers, timeout=5.0)
            if resp.status_code == 200:
                logger.info(
                    f"✅ [Observation Ingestion] Recorded observation snapshot #{observation.get('observationIndex')} "
                    f"for camera '{observation.get('cameraId')}'"
                )
            else:
                logger.debug(f"Backend observation ingestion returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.debug(f"Could not dispatch observation to backend ({endpoint}): {e}")


    def get_recent_detections(self, limit: int = 50, camera_id: Optional[str] = None) -> List[DetectionEvent]:
        with self._lock:
            events = list(self._recent_events)
            if camera_id:
                events = [e for e in events if e.cameraId == camera_id]
            return events[:limit]

    def stop_all(self) -> None:
        """Stops all active camera workers during graceful service shutdown."""
        with self._lock:
            logger.info("Stopping all camera workers...")
            for w in self._workers.values():
                w.stop()
            self._workers.clear()

    def sync_from_backend(self) -> int:
        """
        Fetches registered cameras from Node.js backend (/internal/cameras)
        and initiates monitoring for active cameras.
        Returns the number of successfully started cameras.
        """
        endpoint = f"{settings.backend_api_url}/internal/cameras"
        headers = {"X-AI-Service-Key": settings.ai_service_key}
        logger.info(f"[Camera Sync] Fetching cameras from {endpoint}...")

        try:
            resp = requests.get(endpoint, headers=headers, timeout=5.0)
            if resp.status_code != 200:
                logger.warning(f"[Camera Sync] Backend returned status {resp.status_code}: {resp.text[:200]}")
                return 0

            data = resp.json()
            cameras_data = data.get("data", {}).get("cameras", [])
            total = len(cameras_data)
            active_count = sum(1 for c in cameras_data if c.get("isActive", True))
            logger.info(f"[Camera Sync] Received {total} cameras ({active_count} active) from backend.")
            started = 0

            for cam in cameras_data:
                cam_id = cam.get("cameraId", "unknown")
                stream_url = cam.get("streamUrl", "")
                stream_type = cam.get("streamType", "simulated")
                is_active = cam.get("isActive", True)

                if not is_active:
                    logger.info(f"[Camera Sync] Skipping inactive camera '{cam_id}'.")
                    continue

                if not stream_url:
                    logger.warning(f"[Camera Sync] Camera '{cam_id}' has no streamUrl — skipping.")
                    continue

                logger.info(
                    f"[Camera Sync] Starting worker for camera '{cam_id}' "
                    f"(type={stream_type}, url={stream_url!r})"
                )
                req = CameraStartRequest(
                    cameraId=cam_id,
                    mallId=cam.get("mallId", "mall_default"),
                    name=cam.get("name"),
                    streamType=stream_type,
                    streamUrl=stream_url,
                )
                self.start_camera(req)
                started += 1

            logger.info(f"[Camera Sync] Done — {started} cameras started.")
            return started
        except requests.exceptions.ConnectionError:
            logger.warning(f"[Camera Sync] Cannot reach backend at {endpoint}. Is Node.js server running?")
            return -1
        except Exception as e:
            logger.warning(f"[Camera Sync] Unexpected error: {e}")
            return -1

camera_manager = CameraManager()

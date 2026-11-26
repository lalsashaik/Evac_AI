import os
import cv2
import time
import uuid
import datetime
import logging
import threading
from typing import Optional, Callable, Dict, Any, List

from app.config import settings
from app.models.schemas import DetectionEvent, BoundingBox, CameraStatusResponse
from app.services.detector import detector

logger = logging.getLogger("evacai.camera_worker")

class CameraWorker:
    """
    Dedicated worker thread for reading frames from a single camera feed
    and running fire/smoke detection with duplicate throttling and evidence capture.
    """
    def __init__(
        self,
        camera_id: str,
        mall_id: str,
        stream_url: str,
        stream_type: str = "simulated",
        name: Optional[str] = None,
        frame_interval_seconds: Optional[float] = None,
        confidence_threshold: Optional[float] = None,
        event_callback: Optional[Callable[[DetectionEvent], None]] = None,
        state_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        observation_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.camera_id = camera_id
        self.mall_id = mall_id
        self.stream_url = stream_url
        self.stream_type = stream_type.lower()
        self.name = name or camera_id
        self.frame_interval = frame_interval_seconds or settings.frame_interval_seconds
        self.confidence_threshold = confidence_threshold or settings.confidence_threshold
        self.event_callback = event_callback
        self.state_callback = state_callback
        self.observation_callback = observation_callback
        self.clearing_period = settings.detection_clearing_seconds
        self.grace_period = settings.detection_grace_period_seconds

        self.status = "stopped"  # "running", "stopped", "error", "offline"
        self.last_error: Optional[str] = None
        self.frames_processed = 0
        self.detections_count = 0
        self.last_frame_at: Optional[str] = None
        self.last_detection_at: Optional[str] = None

        # Adjacent-frame fire detection state tracking (no cooldown)
        self._had_fire_previous_frame: bool = False
        self._is_currently_detected: bool = False
        self._current_detection_type: Optional[str] = None
        self._active_types: List[str] = []
        self._last_state_dispatch: float = 0.0
        self._last_clear_snapshot_time: float = 0.0
        self._has_dispatched_initial_clear: bool = False

        # Timescale observation snapshots (15 min = 900s by default, or configured via env)
        self._last_observation_snapshot_time: float = 0.0
        self._observation_counter: int = 1
        self._observation_interval: float = float(os.getenv("TIMESCALE_OBSERVATION_SECONDS", "900.0"))

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def resolve_source(self) -> str:
        """
        Resolves the given stream URL to a valid local filesystem path or remote URL.
        """
        url = self.stream_url.strip()

        # If it's an HTTP/HTTPS stream (e.g. ESP32-CAM MJPEG or remote IP cam)
        if url.startswith("http://") or url.startswith("https://") or url.startswith("rtsp://"):
            return url

        # Direct absolute or relative path
        if os.path.exists(url):
            return os.path.abspath(url)

        # Normalize relative path (remove leading slash)
        clean_rel = url.lstrip("/\\")

        candidates = [
            os.path.join(settings.workspace_root, clean_rel),
            os.path.join(settings.workspace_root, "client", "public", clean_rel),
            os.path.join(settings.workspace_root, "client", "public", "videos", os.path.basename(url)),
            os.path.join(settings.workspace_root, "client", "dist", clean_rel),
            os.path.join(settings.workspace_root, "client", "dist", "videos", os.path.basename(url)),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", clean_rel),
        ]

        for cand in candidates:
            normalized = os.path.normpath(cand)
            if os.path.exists(normalized):
                logger.info(f"Resolved camera '{self.camera_id}' source '{url}' -> '{normalized}'")
                return normalized

        # If not found, log warning and return original path
        logger.warning(
            f"Camera '{self.camera_id}': could not find local file for '{url}'. "
            f"Attempted: {[os.path.normpath(c) for c in candidates]}"
        )
        return url

    def start(self) -> None:
        """Starts the background worker thread."""
        if self._thread and self._thread.is_alive():
            logger.warning(f"Camera '{self.camera_id}' worker is already running.")
            return

        self._stop_event.clear()
        self.status = "starting"
        self.last_error = None
        self._thread = threading.Thread(
            target=self._run,
            name=f"CameraWorker-{self.camera_id}",
            daemon=True
        )
        self._thread.start()
        logger.info(f"Started camera worker for '{self.camera_id}' (Source: {self.stream_url})")

    def stop(self) -> None:
        """Signals the worker thread to stop and waits for resource release."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        self.status = "stopped"
        if self._is_currently_detected:
            self._is_currently_detected = False
            self._current_detection_type = None
            self._active_types = []
            self._dispatch_current_state()
        logger.info(f"Stopped camera worker for '{self.camera_id}'")

    def _dispatch_current_state(
        self,
        ts: Optional[str] = None,
        final_evidence: Optional[Dict[str, Any]] = None
    ) -> None:
        """Dispatches real-time presence detection state to state_callback."""
        if not self.state_callback:
            return
        ts_val = ts or datetime.datetime.now(datetime.timezone.utc).isoformat()
        payload = {
            "cameraId": self.camera_id,
            "mallId": self.mall_id,
            "isCurrentlyDetected": self._is_currently_detected,
            "detectionType": self._current_detection_type,
            "activeTypes": list(self._active_types),
            "lastDetectedAt": self.last_detection_at,
            "updatedAt": ts_val,
            "cameraStatus": self.status,
        }
        if final_evidence:
            payload["finalEvidenceId"] = final_evidence.get("evidenceId")
            payload["finalEvidenceFileName"] = final_evidence.get("evidenceFileName")
            payload["finalEvidenceRelativePath"] = final_evidence.get("evidenceRelativePath")

        try:
            self.state_callback(payload)
        except Exception as e:
            logger.debug(f"Error in state callback for camera '{self.camera_id}': {e}")


    def get_status(self) -> CameraStatusResponse:
        return CameraStatusResponse(
            cameraId=self.camera_id,
            mallId=self.mall_id,
            name=self.name,
            streamType=self.stream_type,
            streamUrl=self.stream_url,
            status=self.status,
            error=self.last_error,
            framesProcessed=self.frames_processed,
            detectionsCount=self.detections_count,
            lastFrameAt=self.last_frame_at,
            lastDetectionAt=self.last_detection_at,
        )

    def _run(self) -> None:
        resolved_src = self.resolve_source()
        is_network_stream = self.stream_type in ("mjpeg", "esp32cam") or resolved_src.startswith("http")

        cap = None
        retry_delay = 2.0

        while not self._stop_event.is_set():
            try:
                # Open stream or video
                cap = cv2.VideoCapture(resolved_src)
                if not cap.isOpened():
                    self.status = "error" if not is_network_stream else "offline"
                    self.last_error = f"Cannot open video source: {resolved_src}"
                    logger.warning(f"Camera '{self.camera_id}': {self.last_error}")

                    if not is_network_stream:
                        # For a local file that does not exist, pause and retry occasionally
                        if self._stop_event.wait(min(retry_delay, 10.0)):
                            break
                        retry_delay *= 1.5
                        continue
                    else:
                        if self._stop_event.wait(5.0):
                            break
                        continue

                self.status = "running"
                self.last_error = None
                retry_delay = 2.0
                last_process_time = 0.0
                fps_val = cap.get(cv2.CAP_PROP_FPS) or 25.0
                frame_delay = 1.0 / max(1.0, min(60.0, fps_val))

                logger.info(f"Camera '{self.camera_id}' stream opened successfully ({fps_val:.1f} FPS).")

                # Frame processing loop
                while not self._stop_event.is_set():
                    ret, frame = cap.read()
                    now = time.time()

                    if not ret:
                        if self.stream_type == "simulated" or not is_network_stream:
                            # Prerecorded video reached EOF -> rewind cleanly
                            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            ret, frame = cap.read()
                            if not ret:
                                # Fallback re-instantiation if seeking failed
                                cap.release()
                                cap = cv2.VideoCapture(resolved_src)
                                ret, frame = cap.read()
                            if not ret:
                                if self._stop_event.wait(0.5):
                                    break
                                continue
                        else:
                            # Network stream disconnected
                            logger.warning(f"Camera '{self.camera_id}' network stream lost. Reconnecting...")
                            self.status = "offline"
                            self.last_error = "Connection lost to video stream."
                            break

                    # Check sampling interval
                    if (now - last_process_time) < self.frame_interval:
                        # Sleep to pace simulated reading and minimize CPU load
                        time.sleep(min(0.04, frame_delay))
                        continue

                    last_process_time = now
                    self.frames_processed += 1
                    self.last_frame_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

                    # Run inference on current frame
                    detections = detector.detect(frame, conf_threshold=self.confidence_threshold)
                    ts_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    curr_has_fire = bool(detections and len(detections) > 0)
                    prev_has_fire = self._had_fire_previous_frame

                    # Determine primary detection type for current frame
                    if curr_has_fire:
                        classes_found = [d["class_name"].lower() for d in detections]
                        has_f = any("fire" in c for c in classes_found)
                        has_s = any("smoke" in c for c in classes_found)
                        if has_f and has_s:
                            new_type = "fire_and_smoke"
                            active_types = ["fire", "smoke"]
                        elif has_f:
                            new_type = "fire"
                            active_types = ["fire"]
                        else:
                            new_type = "smoke"
                            active_types = ["smoke"]
                    else:
                        new_type = None
                        active_types = []

                    # -----------------------------------------------------------------
                    # ADJACENT-FRAME FIRE DETECTION LOGIC (NO COOLDOWN)
                    # -----------------------------------------------------------------
                    if curr_has_fire and not prev_has_fire:
                        # CASE 2: Fire detected in current frame, but NOT in previous frame -> NEW INCIDENT
                        # Send 1 email alert, produce a new incident alert in website, highlight red marker
                        logger.info(
                            f"🔥 [{self.camera_id}] CASE 2: Fire breakout detected! (prev: NO_FIRE -> curr: {new_type.upper()}). "
                            f"Registering new incident and sending alert email..."
                        )
                        self._had_fire_previous_frame = True
                        self._is_currently_detected = True
                        self._current_detection_type = new_type
                        self._active_types = active_types
                        self.last_detection_at = ts_now
                        self._last_state_dispatch = now
                        self._last_observation_snapshot_time = now
                        self._observation_counter = 1

                        # Immediately update real-time camera state in Firebase RTDB
                        self._dispatch_current_state(ts_now)
                        # Save evidence frame and dispatch incident creation to backend (triggers email + alert)
                        self._handle_detections(frame, detections, primary_type=new_type)

                    elif curr_has_fire and prev_has_fire:
                        # CASE 1: Fire detected in previous frame AND in current frame -> SAME INCIDENT
                        # Continuous monitoring: do NOT send a new mail, do NOT produce a new alert
                        self._had_fire_previous_frame = True
                        self._is_currently_detected = True
                        self._current_detection_type = new_type
                        self._active_types = active_types
                        self.last_detection_at = ts_now

                        # Periodic 15-minute timescale observation snapshot
                        if (now - self._last_observation_snapshot_time) >= self._observation_interval:
                            self._last_observation_snapshot_time = now
                            self._observation_counter += 1
                            logger.info(
                                f"⏱️ [{self.camera_id}] 15-minute periodic timescale observation snapshot #{self._observation_counter} captured."
                            )
                            try:
                                obs_id = f"evt_obs_{self._observation_counter}_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
                                obs_rel, obs_abs = detector.save_evidence(
                                    frame=frame,
                                    mall_id=self.mall_id,
                                    camera_id=self.camera_id,
                                    event_id=obs_id,
                                    detections=detections
                                )
                                if self.observation_callback:
                                    self.observation_callback({
                                        "cameraId": self.camera_id,
                                        "mallId": self.mall_id,
                                        "detectionType": new_type,
                                        "confidence": max((d["confidence"] for d in detections), default=0.8),
                                        "timestamp": ts_now,
                                        "boundingBoxes": detections,
                                        "evidenceId": obs_id,
                                        "evidenceFileName": f"{obs_id}.jpg",
                                        "observationIndex": self._observation_counter,
                                    })
                            except Exception as obs_err:
                                logger.warning(f"Could not record timescale observation snapshot: {obs_err}")

                        # Heartbeat every 5s to keep real-time continuous monitoring alive in RTDB
                        if (now - self._last_state_dispatch) >= 5.0:
                            self._last_state_dispatch = now
                            self._dispatch_current_state(ts_now)

                    elif not curr_has_fire and prev_has_fire:
                        # CASE 3: Previous frame had fire, current frame has NO fire -> INCIDENT IS OVER
                        # Capture concluding snapshot, reduce active hazards count, auto-resolve incident alert, remove red marker in floor plan
                        logger.info(
                            f"✅ [{self.camera_id}] CASE 3: Fire cleared! (prev: FIRE -> curr: NO_FIRE). "
                            f"Capturing concluding snapshot and auto-resolving alert..."
                        )
                        self._had_fire_previous_frame = False
                        self._is_currently_detected = False
                        self._current_detection_type = None
                        self._active_types = []
                        self._last_state_dispatch = now
                        self._last_clear_snapshot_time = now
                        self._has_dispatched_initial_clear = True

                        final_evidence = None
                        try:
                            final_event_id = f"evt_concluded_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
                            final_rel, final_abs = detector.save_evidence(
                                frame=frame,
                                mall_id=self.mall_id,
                                camera_id=self.camera_id,
                                event_id=final_event_id,
                                detections=[]
                            )
                            final_evidence = {
                                "evidenceId": final_event_id,
                                "evidenceFileName": f"{final_event_id}.jpg",
                                "evidenceRelativePath": final_rel,
                            }
                            logger.info(
                                f"📸 [{self.camera_id}] Final concluding snapshot captured -> {final_event_id}.jpg."
                            )
                        except Exception as final_err:
                            logger.warning(f"Failed to save concluding snapshot: {final_err}")

                        # Immediately dispatch cleared state to backend with concluding snapshot (auto-resolves incident in RTDB)
                        self._dispatch_current_state(ts_now, final_evidence=final_evidence)

                    else:
                        # Normal surveillance: neither previous nor current frame has fire
                        self._had_fire_previous_frame = False
                        self._is_currently_detected = False
                        self._current_detection_type = None
                        self._active_types = []
                        if (now - self._last_state_dispatch) >= 5.0:
                            self._last_state_dispatch = now
                            # Periodically or on first clear frame, capture a verified clean frame snapshot
                            clear_evidence = None
                            if not self._has_dispatched_initial_clear or (now - self._last_clear_snapshot_time) >= 30.0:
                                self._has_dispatched_initial_clear = True
                                self._last_clear_snapshot_time = now
                                try:
                                    clean_event_id = f"evt_clear_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"
                                    clean_rel, clean_abs = detector.save_evidence(
                                        frame=frame,
                                        mall_id=self.mall_id,
                                        camera_id=self.camera_id,
                                        event_id=clean_event_id,
                                        detections=[]
                                    )
                                    clear_evidence = {
                                        "evidenceId": clean_event_id,
                                        "evidenceFileName": f"{clean_event_id}.jpg",
                                        "evidenceRelativePath": clean_rel,
                                    }
                                    logger.info(
                                        f"📸 [{self.camera_id}] Surveillance all-clear snapshot captured -> {clean_event_id}.jpg."
                                    )
                                except Exception as clean_err:
                                    logger.debug(f"Could not record surveillance clear snapshot: {clean_err}")

                            self._dispatch_current_state(ts_now, final_evidence=clear_evidence)

                    if detections and self.frames_processed % 30 == 0:
                        logger.debug(
                            f"[{self.camera_id}] Frame {self.frames_processed}: "
                            f"{len(detections)} detection(s): "
                            + ", ".join(f"{d['class_name']}@{d['confidence']:.2f}" for d in detections)
                        )
                    elif self.frames_processed % 50 == 0:
                        logger.info(
                            f"[{self.camera_id}] ✓ Processed {self.frames_processed} frames — no detection above "
                            f"{self.confidence_threshold:.0%} threshold."
                        )

            except Exception as e:
                self.status = "error"
                self.last_error = str(e)
                logger.error(f"Unexpected error in camera worker '{self.camera_id}': {e}", exc_info=True)
                if self._stop_event.wait(3.0):
                    break
            finally:
                if cap is not None:
                    cap.release()
                    cap = None

        self.status = "stopped"
        logger.info(f"Camera worker '{self.camera_id}' processing loop terminated cleanly.")

    def _handle_detections(
        self,
        frame,
        detections: List[Dict[str, Any]],
        primary_type: Optional[str] = None
    ) -> None:
        """
        Invoked ONLY on Case 2 (fire breakout / new incident).
        Saves evidence frame snapshot and emits DetectionEvent to create new incident and send email.
        No cooldown suppression.
        """
        if not primary_type:
            classes_found = [d["class_name"].lower() for d in detections]
            primary_type = "fire" if any("fire" in c for c in classes_found) else "smoke"

        primary_confs = [d["confidence"] for d in detections if primary_type in d["class_name"].lower()]
        max_conf = max(primary_confs) if primary_confs else detections[0]["confidence"]

        now = time.time()
        self.detections_count += 1
        ts_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.last_detection_at = ts_now

        event_id = f"evt_{int(now * 1000)}_{uuid.uuid4().hex[:6]}"

        # Save annotated evidence snapshot locally
        try:
            rel_ref, abs_path = detector.save_evidence(
                frame=frame,
                mall_id=self.mall_id,
                camera_id=self.camera_id,
                event_id=event_id,
                detections=detections
            )
        except Exception as e:
            logger.error(f"Failed to save evidence snapshot: {e}")
            rel_ref = None

        # Build structured bounding box records
        boxes: List[BoundingBox] = []
        frame_h, frame_w = frame.shape[:2]
        for d in detections:
            boxes.append(BoundingBox(
                x=d["x"],
                y=d["y"],
                width=d["width"],
                height=d["height"],
                class_name=d["class_name"],
                confidence=d["confidence"],
                x_norm=d.get("x_norm"),
                y_norm=d.get("y_norm"),
                w_norm=d.get("w_norm"),
                h_norm=d.get("h_norm"),
            ))

        event = DetectionEvent(
            eventId=event_id,
            evidenceId=event_id,
            evidenceFileName=f"{event_id}.jpg",
            cameraId=self.camera_id,
            mallId=self.mall_id,
            detectionType=primary_type,
            confidence=max_conf,
            boundingBoxes=boxes,
            timestamp=ts_now,
            evidenceReference=rel_ref,
            evidenceUrl=f"/evidence/{self.mall_id}/{self.camera_id}/{event_id}.jpg" if rel_ref else None,
            metadata={
                "cameraName": self.name,
                "streamType": self.stream_type,
                "framesProcessed": self.frames_processed,
                "totalDetectionsInFrame": len(detections),
                "resolution": f"{frame_w}x{frame_h}",
            }
        )

        logger.info(
            f"🔥 [AI DETECTION] {primary_type.upper()} on camera '{self.camera_id}' "
            f"(conf: {max_conf:.2f}, boxes: {len(boxes)}, eventId: {event_id})"
        )

        if self.event_callback:
            try:
                self.event_callback(event)
            except Exception as e:
                logger.error(f"Error in event callback: {e}")

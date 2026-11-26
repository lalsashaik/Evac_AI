import os
import cv2
import tempfile
import datetime
import logging
from typing import List, Dict, Any, Optional, Tuple
from app.config import settings

# Prevent Ultralytics from warning about global config directory
os.environ.setdefault("YOLO_CONFIG_DIR", tempfile.gettempdir())

logger = logging.getLogger("evacai.detector")

class FireSmokeDetector:
    """
    Ultralytics YOLOv8 inference wrapper specialized for fire and smoke detection.
    """
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.model_path
        # Resolve model path relative to BASE_DIR if needed
        if not os.path.isabs(self.model_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            candidate = os.path.normpath(os.path.join(base_dir, "..", self.model_path))
            if os.path.exists(candidate):
                self.model_path = candidate

        self.model = None
        self.is_loaded = False
        self.classes: Dict[int, str] = {}
        self.load_error: Optional[str] = None
        
        self._load_model()

    def _load_model(self) -> None:
        try:
            if not os.path.exists(self.model_path):
                self.load_error = f"Model weights file not found at: {self.model_path}"
                logger.warning(self.load_error)
                self.is_loaded = False
                return

            from ultralytics import YOLO
            import numpy as np
            self.model = YOLO(self.model_path)
            self.classes = self.model.names if hasattr(self.model, "names") else {}
            # Pre-warm the model on a dummy canvas so subsequent frame inferences run with low latency (~30ms)
            dummy = np.zeros((320, 320, 3), dtype=np.uint8)
            self.model.predict(dummy, verbose=False, conf=0.5)
            self.is_loaded = True
            self.load_error = None
            logger.info(f"Loaded and warmed up YOLOv8 model from {self.model_path}. Detected classes: {self.classes}")
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            logger.error(f"Failed to load YOLO model: {e}", exc_info=True)

    def get_info(self) -> Dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "model_path": self.model_path,
            "classes": self.classes,
            "supported_classes": ["fire", "smoke"],
            "error": self.load_error,
            "framework": "ultralytics-yolov8",
        }

    def detect(self, frame, conf_threshold: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Runs object detection on a single BGR frame.
        Returns list of detection dictionaries:
        [{
            'x': float,
            'y': float,
            'width': float,
            'height': float,
            'class_name': str,
            'confidence': float,
            'box_xyxy': [x1, y1, x2, y2]
        }]
        """
        if not self.is_loaded or self.model is None:
            return []

        threshold = conf_threshold if conf_threshold is not None else settings.confidence_threshold

        try:
            results = self.model(frame, conf=threshold, verbose=False)
            detections: List[Dict[str, Any]] = []
            frame_h, frame_w = frame.shape[:2]

            for r in results:
                if not hasattr(r, "boxes") or r.boxes is None:
                    continue
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    class_name = self.classes.get(cls_id, f"class_{cls_id}").lower()
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    box_w = max(0.0, x2 - x1)
                    box_h = max(0.0, y2 - y1)

                    detections.append({
                        "x": round(x1, 2),
                        "y": round(y1, 2),
                        "width": round(box_w, 2),
                        "height": round(box_h, 2),
                        "class_name": class_name,
                        "confidence": round(conf, 4),
                        "x_norm": round(x1 / max(1, frame_w), 4),
                        "y_norm": round(y1 / max(1, frame_h), 4),
                        "w_norm": round(box_w / max(1, frame_w), 4),
                        "h_norm": round(box_h / max(1, frame_h), 4),
                        "box_xyxy": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)]
                    })

            return detections
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return []

    def annotate_frame(
        self,
        frame,
        detections: List[Dict[str, Any]],
        camera_id: str = "",
        timestamp_str: Optional[str] = None
    ):
        """
        Draws bounding boxes and labels onto a copy of the frame.
        """
        annotated = frame.copy()
        ts = timestamp_str or datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for det in detections:
            x1 = int(det["x"])
            y1 = int(det["y"])
            x2 = int(det["x"] + det["width"])
            y2 = int(det["y"] + det["height"])
            cls_name = det["class_name"].lower()
            conf = det["confidence"]

            # Colors (BGR)
            # Fire: Red (0, 0, 255)
            # Smoke: Orange / Gray (0, 165, 255)
            color = (0, 0, 255) if "fire" in cls_name else (0, 165, 255)

            # Draw bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            # Draw label banner
            label = f"{cls_name.upper()} {conf * 100:.1f}%"
            (font_w, font_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(
                annotated,
                (x1, max(0, y1 - font_h - 6)),
                (x1 + font_w + 6, max(font_h + 6, y1)),
                color,
                -1
            )
            cv2.putText(
                annotated,
                label,
                (x1 + 3, max(font_h + 2, y1 - 3)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                1,
                cv2.LINE_AA
            )

        # Draw HUD banner overlay at top left
        if detections and len(detections) > 0:
            hud_text = f"EvacAI Detection | Cam: {camera_id} | {ts}"
            hud_color = (0, 0, 255)
        else:
            hud_text = f"EvacAI Surveillance | STATUS: ALL CLEAR / NO FIRE | Cam: {camera_id} | {ts}"
            hud_color = (0, 200, 0)

        cv2.putText(
            annotated,
            hud_text,
            (10, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            hud_color,
            2,
            cv2.LINE_AA
        )

        return annotated

    def save_evidence(
        self,
        frame,
        mall_id: str,
        camera_id: str,
        event_id: str,
        detections: List[Dict[str, Any]]
    ) -> Tuple[str, str]:
        """
        Annotates the frame and writes the evidence snapshot image to disk.
        Returns: (relative_reference, absolute_file_path)
        """
        # Primary M7 storage: evidence/incidents/{mallId}/{eventId}.jpg
        incidents_dir = os.path.join(settings.evidence_dir, "incidents", mall_id)
        os.makedirs(incidents_dir, exist_ok=True)

        filename = f"{event_id}.jpg"
        abs_path = os.path.join(incidents_dir, filename)
        rel_reference = f"incidents/{mall_id}/{filename}"

        annotated = self.annotate_frame(frame, detections, camera_id=camera_id)
        cv2.imwrite(abs_path, annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])

        # Backward compatibility mirror for M6 camera-scoped path: evidence/{mallId}/{cameraId}/{filename}
        try:
            cam_dir = os.path.join(settings.evidence_dir, mall_id, camera_id)
            os.makedirs(cam_dir, exist_ok=True)
            cv2.imwrite(os.path.join(cam_dir, filename), annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
        except Exception as e:
            logger.debug(f"Could not write camera mirror evidence: {e}")

        return rel_reference, abs_path

# Global detector instance
detector = FireSmokeDetector()

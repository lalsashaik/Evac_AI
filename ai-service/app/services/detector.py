"""
Fire & Smoke Detection Engine (Placeholder for Milestone 6)

Will handle:
- Loading the YOLOv8 fire/smoke weights
- Running inference on extracted video frames
- Non-maximum suppression and confidence thresholding
- Deduplicating consecutive detection events (cooldown window)
- Extracting evidence bounding boxes and snapshot frames
"""
from typing import Optional

class FireSmokeDetector:
    def __init__(self):
        self.is_loaded = False
        self.model_name = "yolov8-fire-smoke-placeholder"

    def is_ready(self) -> bool:
        return self.is_loaded

detector = FireSmokeDetector()

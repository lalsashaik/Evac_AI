"""
Camera Stream Manager (Placeholder for Milestones 5 & 6)

Will handle:
- Connecting to simulated cameras (video files)
- Connecting to live ESP32-CAM MJPEG streams
- Frame extraction at configured FPS
- Keeping track of active stream threads and status
"""
from typing import Dict, Any, List

class CameraManager:
    def __init__(self):
        self._active_streams: Dict[str, Any] = {}

    def get_active_count(self) -> int:
        return len(self._active_streams)

    def list_cameras(self) -> List[str]:
        return list(self._active_streams.keys())

camera_manager = CameraManager()

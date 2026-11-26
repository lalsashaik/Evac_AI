# EvacAI — AI Integration

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development

---

## 1. Overview

The AI component is a standalone Python service that:

1. Connects to configured camera streams.
2. Extracts video frames at a configurable interval.
3. Runs fire and smoke detection using a YOLO-based model.
4. Suppresses duplicate detections within a cooldown window.
5. Captures an annotated evidence snapshot frame.
6. Saves snapshots to shared local evidence storage (`EVACAI_EVIDENCE_DIR`).
7. Reports detection events to the Node.js backend (`POST /api/detection`).
8. Reports camera health status to the backend.

The AI service operates **independently** of the web dashboard. It is a background service that runs continuously.

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | Python 3.10+ |
| API framework | FastAPI (for `/health`, `/status`, optional future control endpoints) |
| Video processing | OpenCV (cv2) |
| Object detection | Ultralytics YOLOv8 |
| Local Evidence Storage | Shared filesystem directory (`EVACAI_EVIDENCE_DIR`) |
| HTTP client | `httpx` (async) or `requests` |
| Configuration | `pyyaml` |
| Concurrency | `asyncio` with `concurrent.futures` or `threading` for stream readers |

---

## 3. Model Selection

### 3.1 Why Not a Generic COCO-trained YOLO?

Standard YOLO models trained on COCO (Common Objects in Context) **do not include fire or smoke classes**. Using a generic model will produce zero fire/smoke detections regardless of confidence threshold.

A fire-and-smoke-specific model or fine-tuned weights are required.

### 3.2 Evaluated Options

| Option | Description | Recommendation |
|--------|-------------|----------------|
| **YOLOv8n fine-tuned on fire/smoke dataset** | Small, fast, reasonably accurate. Train on a public fire/smoke dataset. | ✅ Primary recommendation for MVP |
| **Pre-trained fire detection weights (community)** | Readily available on GitHub/Roboflow for YOLOv5/v8. Quality varies. | ✅ Good starting point; verify on test videos |
| **YOLOv5s fire detection (Robowflow Universe)** | Well-documented fire/smoke models from Roboflow community. | ✅ Alternative if YOLOv8 weights unavailable |
| **Generic YOLOv8 (COCO)** | Has no fire or smoke class. | ❌ Not suitable |

### 3.3 Recommended Datasets for Fine-tuning

| Dataset | Source | Notes |
|---------|--------|-------|
| **Fire and Smoke (Roboflow Universe)** | roboflow.com | Well-labelled, multiple versions available |
| **D-Fire** | GitHub (Pedro Vinícius A. B. de Venâncio) | 21,000+ images, fire + smoke classes |
| **FSD (Fire Smoke Dataset)** | Various Kaggle versions | Mixed quality; check labelling |
| **FASDD** | Academic paper dataset | High quality, may require request |

### 3.4 Model Classes

The model must detect:
- Class `fire` (or `flame`)
- Class `smoke`

Some models detect both; some detect only one. Configure the detection pipeline to handle both classes and report `detectionType` accordingly.

### 3.5 Chosen Model for MVP (Implemented in Milestone 6)

- **Model Architecture:** Ultralytics YOLOv8n (Nano) fine-tuned for Fire and Smoke detection.
- **Weights File:** `ai-service/models/fire_smoke_yolov8n.pt` (~6.2 MB).
- **Model Source / Provenance:** Hosted via Hugging Face (`rabahdev/fire-smoke-yolov8n`), trained on the academic **D-Fire** dataset (Pedro Vinícius A. B. de Venâncio), comprising over 21,000 annotated images of real-world fire and smoke hazards.
- **Classes Supported:**
  - `0`: `smoke`
  - `1`: `fire`
- **Default Confidence Threshold:** `0.60` (configurable via `CONFIDENCE_THRESHOLD` environment variable).
- **Execution Target:** CPU by default (with auto-acceleration if NVIDIA CUDA is present). Runs smoothly on standard laptop hardware.

---

## 4. Video Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI Service — Per-Camera Worker                   │
│                                                                      │
│  ┌────────────┐    ┌─────────────┐    ┌────────────────────────┐    │
│  │ OpenCV     │    │ Frame       │    │ YOLO Inference         │    │
│  │ VideoCapture────► Sampler     ────► Engine                  │    │
│  │ (stream    │    │ (every N    │    │ (fire/smoke detection)  │    │
│  │  or file)  │    │  seconds)   │    │                        │    │
│  └────────────┘    └─────────────┘    └──────────┬─────────────┘    │
│                                                   │                  │
│                              ┌────────────────────┘                  │
│                              ▼                                       │
│                     Confidence ≥ threshold?                          │
│                       Yes ──────────────► Duplicate check            │
│                       No  ──────────────► Discard frame              │
│                                                   │                  │
│                              ┌────────────────────┘                  │
│                              ▼                                       │
│                     In cooldown window?                              │
│                       Yes ──────────────► Update frameCount, skip   │
│                       No  ──────────────► Capture snapshot           │
│                                                   │                  │
│                              ┌────────────────────┘                  │
│                              ▼                                       │
│                     Save snapshot locally (EVACAI_EVIDENCE_DIR)     │
│                              │                                       │
│                              ▼                                       │
│                     POST /api/detection to backend                   │
│                              │                                       │
│                              ▼                                       │
│                     Start cooldown timer                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Frame Extraction

### 5.1 Sampling Strategy

The AI service does **not** run inference on every video frame. This is intentional:

- Fire detection does not require per-frame precision. A 2-second interval is sufficient.
- Skipping frames reduces CPU/GPU load significantly.
- Reduces the risk of duplicate incident generation from rapid consecutive detections.

**Default configuration:**
```yaml
inference:
  frameIntervalSeconds: 2.0
```

The service tracks `last_inference_time` per camera and only processes a frame when the interval has elapsed.

### 5.2 Frame Extraction Code Pattern

```python
import cv2
import time

cap = cv2.VideoCapture(stream_url)
last_inference_time = 0

while True:
    ret, frame = cap.read()
    if not ret:
        # Handle disconnection or end-of-file (simulated camera loop)
        handle_stream_error(camera_id)
        break

    now = time.time()
    if now - last_inference_time >= frame_interval_seconds:
        last_inference_time = now
        process_frame(camera_id, frame)
```

---

## 6. YOLO Inference

```python
from ultralytics import YOLO

model = YOLO("models/fire_smoke_yolov8.pt")

def run_inference(frame):
    results = model(frame, conf=confidence_threshold, verbose=False)
    detections = []
    for result in results:
        for box in result.boxes:
            cls_name = model.names[int(box.cls)]
            conf = float(box.conf)
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "class": cls_name,       # "fire" or "smoke"
                "confidence": conf,
                "x": x1,
                "y": y1,
                "width": x2 - x1,
                "height": y2 - y1
            })
    return detections
```

The inference runs on CPU by default. If a GPU is available, YOLOv8 uses it automatically.

---

## 7. Confidence Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `confidenceThreshold` | 0.60 | Minimum confidence to register a detection. Detections below this are discarded. |
| Recommended range | 0.50 – 0.75 | Lower = more sensitive (more false positives). Higher = more conservative (may miss early fire). |

**Adjustment strategy:**
- During testing with simulated cameras: start at 0.60.
- If too many false positives: increase to 0.70.
- If real fire test videos produce no detections: decrease to 0.50.
- Do not go below 0.40 without understanding the false-positive implications.

The threshold is configured in `config.yaml` and requires a service restart to take effect in MVP.

---

## 8. Duplicate Detection Handling

### 8.1 The Problem

A camera looking at an ongoing fire will produce a positive detection on **every sampled frame** for the duration of the fire. Without deduplication, the system would generate hundreds or thousands of separate incidents for a single fire event.

### 8.2 Two-Layer Deduplication

**Layer 1 — AI Service (cooldown window):**

The AI service tracks a per-camera, per-detection-type cooldown:

```python
cooldown_state = {}  # Key: f"{camera_id}_{detection_type}"

def should_report(camera_id, detection_type):
    key = f"{camera_id}_{detection_type}"
    last_reported = cooldown_state.get(key, 0)
    if time.time() - last_reported > cooldown_seconds:
        cooldown_state[key] = time.time()
        return True
    return False
```

**Default cooldown:** 30 seconds. Configurable in `config.yaml`.

**Layer 2 — Backend (incidentGroups):**

The backend maintains `incidentGroups` records. When a detection arrives:
- If an active group exists for `{cameraId}_{detectionType}` with an unexpired cooldown → increment `frameCount`, return deduplicated.
- If no active group or expired cooldown → create a new incident, create/reset the group.

This two-layer approach ensures that even if the AI service fails to suppress a duplicate (e.g., after a restart), the backend provides a second safety net.

### 8.3 Cooldown Configuration

```yaml
inference:
  cooldownSeconds: 30  # Minimum seconds between incidents for the same camera + detection type
```

---

## 9. Snapshot Capture and Local Evidence Storage

When a detection passes the confidence threshold and cooldown check:

```python
def save_evidence(self, frame, mall_id, camera_id, event_id, detections):
    """
    Annotates the frame with detection bounding boxes and writes
    the evidence snapshot JPEG image directly to disk.
    """
    incidents_dir = os.path.join(settings.evidence_dir, "incidents", mall_id)
    os.makedirs(incidents_dir, exist_ok=True)

    filename = f"{event_id}.jpg"
    abs_path = os.path.join(incidents_dir, filename)
    rel_reference = f"incidents/{mall_id}/{filename}"

    annotated = self.annotate_frame(frame, detections, camera_id=camera_id)
    cv2.imwrite(abs_path, annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])

    return rel_reference, abs_path
```

The AI service writes the annotated frame directly to local disk within `EVACAI_EVIDENCE_DIR` and passes the safe `evidenceId`, `evidenceFileName`, and `evidenceRelativePath` to the Node.js backend via `POST /api/detection`. No binary images or Base64 payloads are sent across HTTP, and no cloud storage SDK is used.

---

## 10. Camera Health Reporting

The AI service reports camera health to the backend regularly:

```
POST /api/internal/camera-health
X-AI-Service-Key: {secret}
Body: {
  "cameraId": "cam_001",
  "mallId": "mall_XYZ",
  "status": "online",
  "lastFrameAt": "2026-11-24T14:00:00.000Z"
}
```

**Reporting intervals:**
- Status `online`: reported every 30 seconds while connected.
- Status `offline`: reported immediately when connection fails.

The backend writes this to `/malls/{mallId}/cameraHealth/{cameraId}`.

---

## 11. AI Service Internal API (FastAPI)

The AI service exposes endpoints for health monitoring, camera lifecycle control, and recent detection inspection:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Returns service status, model loaded status, class mapping, active cameras, and OpenCV version. |
| `/cameras/status` | GET | Returns processing status, frames count, and detections count for all configured cameras. |
| `/cameras/{cameraId}/status` | GET | Returns status for a single camera worker. |
| `/cameras/{cameraId}/start` | POST | Starts or restarts AI processing loop for the camera. Accepts camera configuration payload. |
| `/cameras/{cameraId}/stop` | POST | Stops AI processing for the camera and releases video capture resources. |
| `/cameras/sync` | POST | Requests immediate camera synchronization from Node.js backend (`/api/internal/cameras`). |
| `/detections/recent` | GET | Returns recent verified fire/smoke detection events with bounding boxes and evidence links. |
| `/evidence/{mallId}/{cameraId}/{filename}` | GET | Serves local annotated evidence JPEG snapshots with detection bounding boxes. |

### 11.1 Detection Event Output Contract (for Milestone 7)

```json
{
  "eventId": "evt_1795540026870_a4c9af",
  "cameraId": "cam_001",
  "mallId": "mall_XYZ",
  "detectionType": "fire",
  "confidence": 0.86,
  "boundingBoxes": [
    {
      "x": 120.5,
      "y": 80.2,
      "width": 64.0,
      "height": 48.0,
      "class_name": "fire",
      "confidence": 0.86
    }
  ],
  "timestamp": "2026-11-24T17:07:06.870Z",
  "evidenceReference": "evidence/mall_XYZ/cam_001/evt_1795540026870_a4c9af.jpg",
  "evidenceUrl": "/evidence/mall_XYZ/cam_001/evt_1795540026870_a4c9af.jpg",
  "metadata": {
    "cameraName": "Entrance Atrium Cam-01",
    "streamType": "simulated",
    "framesProcessed": 12,
    "totalDetectionsInFrame": 1
  }
}
```

---

## 12. Concurrency Model

Each camera runs in an independent loop. For MVP with a small number of cameras (2–8):

- **Threading model:** One thread per camera using Python `threading.Thread`.
- **Shared state:** Camera cooldown state protected by a `threading.Lock`.

For a larger number of cameras (post-MVP), replace threads with `asyncio` with `asyncio.gather` for concurrent stream reading.

---

## 13. Error Handling and Recovery

| Error Condition | AI Service Behaviour |
|-----------------|---------------------|
| Stream URL unreachable | Mark camera `offline`. Retry connection with exponential backoff (5s, 10s, 30s, 60s max). |
| OpenCV frame read fails | Same as above — `cap.read()` returning False. |
| Simulated video ends | Loop: `cap.set(CAP_PROP_POS_FRAMES, 0)` and continue. |
| Backend POST fails | Log error. Do not crash worker loop. Detection is buffered in memory. |
| Local evidence save fails | Log error. Send detection to backend with evidence available false. |
| YOLO model load fails | Fatal error. Exit with log. The model file must be present at startup. |

---

## 14. Configuration Reference

Environment variables and `.env` specification:

```bash
# Service Settings
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=development

# Backend Integration
BACKEND_API_URL=http://localhost:4000/api
AI_SERVICE_KEY=evacai_dev_secret_key_change_in_production

# Detection & Video Inference
MODEL_PATH=models/fire_smoke_yolov8n.pt
CONFIDENCE_THRESHOLD=0.60
FRAME_INTERVAL_SECONDS=1.0
COOLDOWN_SECONDS=30
MAX_RECENT_EVENTS=100

# Local Shared Evidence Storage (M7)
EVACAI_EVIDENCE_DIR=../evidence
```

logging:
  level: "INFO"                  # DEBUG | INFO | WARNING | ERROR
  file: "logs/ai-service.log"
```

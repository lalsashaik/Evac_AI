# EvacAI — Hardware Integration

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development

---

## 1. Overview

EvacAI integrates with two categories of camera sources:

| Category | Description | MVP Status |
|----------|-------------|------------|
| **Simulated Camera** | Pre-recorded video file read by OpenCV | ✅ Fully supported in MVP |
| **ESP32-CAM (Local)** | Physical ESP32-CAM device on the same local network as the AI service | ✅ Supported in MVP with local deployment |
| **ESP32-CAM (Remote)** | ESP32-CAM accessed by a cloud-hosted AI service | ⚠️ Not in MVP — requires tunneling solution |

---

## 2. ESP32-CAM Overview

The ESP32-CAM is a low-cost Wi-Fi-enabled microcontroller with an integrated OV2640 camera module. When flashed with the standard `CameraWebServer` example from the Arduino IDE (or ESP-IDF), it exposes an HTTP MJPEG stream endpoint over the local Wi-Fi network.

### 2.1 Default ESP32-CAM Stream Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://{ip}/stream` | Continuous MJPEG stream |
| `http://{ip}/capture` | Single JPEG frame capture |
| `http://{ip}/status` | Camera settings status (JSON) |
| `http://{ip}/control?var=...&val=...` | Adjust camera parameters |

### 2.2 MJPEG Stream Format

The ESP32-CAM delivers an HTTP MJPEG stream as a `multipart/x-mixed-replace` response:

```
HTTP/1.1 200 OK
Content-Type: multipart/x-mixed-replace; boundary=frame

--frame
Content-Type: image/jpeg
Content-Length: 12345

{JPEG binary data}
--frame
Content-Type: image/jpeg
...
```

OpenCV's `VideoCapture` class handles this format natively using the stream URL.

### 2.3 Typical Frame Rate

- ESP32-CAM over Wi-Fi typically delivers 5–15 FPS depending on resolution and network conditions.
- For AI inference, the AI service samples at a **configurable interval** (default: every 2 seconds / every Nth frame), not on every frame.

---

## 3. Local Network Architecture (MVP)

In MVP, the AI service runs on a local machine (e.g., a laptop or dedicated PC) on the same Wi-Fi network as the ESP32-CAM devices.

```
                         Local Network (192.168.x.x)
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                  │
 │   ESP32-CAM #1          ESP32-CAM #2          ESP32-CAM #3      │
 │   192.168.1.50          192.168.1.51          192.168.1.52      │
 │   /stream endpoint      /stream endpoint      /stream endpoint   │
 │                                                                  │
 │              ▲                 ▲                  ▲             │
 │              └─────────────────┴──────────────────┘             │
 │                                     │                            │
 │                        ┌────────────┴────────────┐              │
 │                        │   Python AI Service     │              │
 │                        │   (Local PC / laptop)   │              │
 │                        │   OpenCV reads streams  │              │
 │                        └────────────┬────────────┘              │
 │                                     │                            │
 └─────────────────────────────────────┼────────────────────────── ┘
                                       │ HTTPS
                                       ▼
                           ┌──────────────────────┐
                           │   Node.js Backend    │
                           │   (Cloud-hosted or   │
                           │    local)            │
                           └──────────────────────┘
```

**Key constraint:** The AI service must be on the same LAN as the ESP32-CAMs. Private IP addresses (192.168.x.x) are not routable from the internet.

---

## 4. Simulated Camera Strategy

For development, testing, and demonstration without physical hardware, the AI service supports **simulated cameras** backed by pre-recorded video files.

### 4.1 Configuration

A simulated camera is configured identically to a real camera, except:
- `streamType` = `"simulated"`
- `streamUrl` = absolute path to a local video file (e.g., `/app/test-videos/fire_test.mp4`)

### 4.2 OpenCV Handling

OpenCV `VideoCapture` accepts both live stream URLs and local file paths. The AI service uses a unified interface:

```python
cap = cv2.VideoCapture(stream_url)  # Works for both MJPEG streams and video files
```

For simulated cameras, when the video ends (`cap.read()` returns False), the service loops the video by seeking back to frame 0:

```python
if not ret:
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # Loop
    ret, frame = cap.read()
```

### 4.3 Test Video Requirements

- Format: MP4 (H.264) or AVI
- Recommended resolution: 640×480 or 1280×720
- Content: Real fire/smoke footage for model testing
- Storage: `ai-service/test-videos/` (not committed to git due to file size; documented in README)

**Suggested test video sources:**
- Kaggle fire detection datasets (video versions).
- YouTube Creative Commons fire footage (downloaded and stored locally).
- Custom recordings.

---

## 5. Camera Configuration in the AI Service

The AI service reads camera configuration from the backend at startup:

```
AI Service startup:
  1. GET /api/internal/cameras  (using AI service secret key)
  2. Build a list of active camera stream workers.
  3. Start a worker thread/async task per active camera.
  4. Each worker: opens stream → samples frames → runs inference → reports.
```

Configuration updates (e.g., a new camera URL set by management) require an **AI service restart** in MVP. Post-MVP can implement a configuration polling endpoint.

### 5.1 Camera Configuration File (Local Fallback)

If the backend is unreachable at startup, the AI service falls back to `config.yaml`:

```yaml
cameras:
  - cameraId: "cam_001"
    mallId: "mall_XYZ"
    streamType: "simulated"
    streamUrl: "/app/test-videos/fire_test.mp4"
    isActive: true

  - cameraId: "cam_002"
    mallId: "mall_XYZ"
    streamType: "esp32cam"
    streamUrl: "http://192.168.1.50/stream"
    isActive: true

inference:
  frameIntervalSeconds: 2.0
  confidenceThreshold: 0.6
  cooldownSeconds: 30

backend:
  url: "http://localhost:4000"
  aiServiceSecret: "..."
```

---

## 6. Camera Connection States

The system must distinguish between three separate states for each camera:

| State | Meaning | Display |
|-------|---------|---------|
| **Registered** | Camera exists in the database with a configured URL | Camera card shown in dashboard |
| **Reachable** | AI service has successfully opened the stream URL | "Online" indicator |
| **Streaming** | Frontend `<img>` or `<video>` tag is successfully receiving frames | Live feed visible |

A camera can be "Registered" but "Offline" if the ESP32-CAM is powered off. The AI service reports health via the backend; the frontend displays it. The frontend's own stream embed is a separate check — the MJPEG `<img>` tag may fail independently.

---

## 7. ESP32-CAM Hardware Requirements

| Requirement | Specification |
|-------------|--------------|
| Module | ESP32-CAM (AI Thinker variant recommended) |
| Firmware | Arduino `CameraWebServer` example with PSRAM enabled |
| Camera resolution | SVGA (800×600) or VGA (640×480) for balance of quality and stream speed |
| Wi-Fi | Connected to same network as the AI service machine |
| Power | 5V regulated supply (USB or dedicated) |
| Recommended SSID | Dedicated IoT VLAN for security (post-MVP) |

### 7.1 Flash Instructions (brief)

1. Install Arduino IDE with ESP32 board support.
2. Open `File → Examples → ESP32 → Camera → CameraWebServer`.
3. Set `SSID` and `PASSWORD` for the local Wi-Fi.
4. Select `AI Thinker ESP32-CAM` as the board.
5. Flash using a USB-to-serial adapter (the ESP32-CAM has no built-in USB).
6. After flashing, open Serial Monitor to find the assigned IP address.
7. Use `http://{ip}/stream` as the camera's `streamUrl` in the EvacAI configuration.

---

## 8. Known Limitations and Risks

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| ESP32-CAM private IP | AI service cannot be cloud-hosted in MVP | AI service runs locally on same LAN. Document clearly. |
| ESP32-CAM stream drops | OpenCV VideoCapture fails silently | AI service implements reconnection with exponential backoff. |
| MJPEG has no audio | — | Not required for fire/smoke detection. |
| ESP32-CAM firmware variability | Different firmwares expose different endpoints | Standardize on `CameraWebServer` example. |
| No authentication on ESP32 stream | Any LAN device can access the stream | Acceptable for MVP local network. Post-MVP: add HTTP Basic Auth or VPN. |
| Frame rate varies with Wi-Fi load | Inference may skip frames | Frame-based sampling (not time-based) is used; acceptable for detection. |

---

## 9. Future Remote Access Architecture (Post-MVP)

For post-MVP cloud deployment, one of these approaches will be needed to allow a remotely hosted AI service to access local ESP32-CAM streams:

### Option A: Local Gateway (Recommended for Simplicity)

A lightweight local agent runs on a PC at the mall. It reads ESP32-CAM streams locally and forwards detection results to the cloud-hosted backend. The heavy AI inference is also done locally.

```
ESP32-CAMs → Local AI Service → HTTPS → Cloud Backend
```

This is effectively the same as the MVP architecture, just explicitly deployed as a "gateway" device at each mall.

### Option B: Secure Tunnel (ZeroTier / Tailscale)

A VPN-like overlay network connects the cloud AI service to the local network. The AI service accesses private ESP32 IPs through the tunnel.

```
Cloud AI Service → ZeroTier tunnel → Local Network → ESP32-CAM IPs
```

**Pros:** No gateway machine needed.  
**Cons:** Requires installing ZeroTier/Tailscale on the cloud host and at the mall.

### Option C: RTSP/WebRTC Relay Server

An intermediate relay server accepts streams from the local network and re-publishes them to the cloud AI service.

**Complexity:** High. Not recommended for this project scope.

> **Decision required before post-MVP deployment:** Select Option A or Option B based on operational requirements. Option A is recommended for a final-year project scope.

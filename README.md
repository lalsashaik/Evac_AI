# EvacAI — Emergency Evacuation & AI Safety Platform

> **Project Type:** College Major Project Prototype  
> **Status:** All Core Modules & Milestones (M1–M11) Complete  
> **Repository Structure:** Monorepo (`client/`, `server/`, `ai-service/`, `docs/`)

---

## 1. Project Overview

**EvacAI** is an intelligent, multi-tenant Fire & Smoke Detection, CCTV Monitoring, and Incident Evacuation Management Platform designed for shopping malls and multi-occupancy commercial properties.

The platform bridges real-time computer vision (Ultralytics YOLOv8), IoT hardware streams (ESP32-CAM and simulated video), interactive spatial floor plan mapping, and an automated incident management pipeline. When fire or smoke is detected:
1. **AI Vision Pipeline** classifies fire/smoke within ~30ms and captures annotated evidence snapshots.
2. **Backend Server** deduplicates detections, creates an authoritative incident record, updates Firebase Realtime Database heads, and dispatches high-priority HTML alert emails to assigned property managers.
3. **Frontend Dashboard** alerts operators in real time, displays live camera statuses on an interactive floor map, allows CCTV video inspection, and manages incident lifecycle states (`DETECTED` &rarr; `ACKNOWLEDGED` &rarr; `INVESTIGATING` &rarr; `RESOLVED` / `FALSE_ALARM`).
4. **Auto-Resolution & Evidence Timeline**: As long as fire continues, periodic 15-minute observation snapshots are recorded. When fire is fully cleared, the system auto-resolves active hazards, resets the global emergency status to normal, and records a safe concluding snapshot with an "ALL CLEAR" watermark.

---

## 2. Core Features

### 🏢 Superadmin Portal
- **Mall Provisioning**: Register commercial properties with contact details, address, and allowed building level quotas ($G$ through $G+N$).
- **Manager Account Management**: Provision mall management user accounts with role-based access control (RBAC), multi-tenant isolation, and automatic Firebase claim synchronization.
- **Platform Analytics**: High-level platform health, active properties, and surveillance statistics.

### 🗺️ Interactive Floor Plan Canvas Editor
- **Multi-Level Support**: Manage and design building layouts across ground and upper floors.
- **Spatial Element Placement**: Place shops, corridor walkways, emergency exits, and CCTV cameras on an interactive HTML5/Konva canvas.
- **Camera Field of View & Orientation**: Rotate and position camera markers to align with physical surveillance zones.

### 📹 Surveillance & CCTV Management
- **Multi-Source Ingestion**: Support for simulated video files (`.mp4`), MJPEG streams, and ESP32-CAM wireless streams.
- **Live Stream Preview**: Modal player with real-time detection overlays, active hazard indicators, and stream health diagnostics.
- **Camera Status Sync**: Online/offline heartbeat monitoring and detection state propagation via Firebase RTDB.

### 🤖 AI Vision & Detection Engine
- **Model**: Ultralytics YOLOv8 Nano (`YOLOv8n`) specialized for fire and smoke detection.
- **Model Weights**: `fire_smoke_yolov8n.pt` (~3.01M parameters) running at low latency (~30ms per frame).
- **Target Classes**: Detects `fire` and `smoke` bounding boxes with confidence scores.
- **Adjacent-Frame State Tracking**: Frame-by-frame edge detection prevents redundant duplicate emails while reacting instantly to fire breakout and fire extinction.
- **Evidence Watermarking**: Automatically annotates captured evidence frames with bounding boxes, camera IDs, timestamps, and fire/cleared HUD watermarks.

### 🚨 Real-Time Incident Pipeline & Notification
- **Instant Ingestion**: Secure AI service to backend ingestion over `/api/detection` protected by API keys.
- **Automated Email Dispatch**: Sends instant SMTP alert emails with embedded evidence and property details strictly to managers of the affected mall.
- **In-App Notification Center**: Audio-visual bell notifications and floating emergency toast alerts with 1-click drilldown into hazard details.
- **Evidence Timeline**: Multi-snapshot progression tracking from initial breakout frame to periodic observations and concluding safe frames.

### 🌐 Mall Situation Room
- **Live Situation Blueprint**: Visual floor plan map rendering real-time camera presence indicators (pulsing red for fire, amber for smoke, emerald for normal).
- **Global Emergency Status**: Central `/emergency/status` head synchronizes building-wide emergency states across all connected clients.

---

## 3. Technology Stack

| Layer | Technologies | Role |
|-------|--------------|------|
| **Frontend (`client/`)** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Konva, React-Konva, Lucide Icons, Firebase Web SDK | Responsive management portal, floor plan designer, surveillance monitor, situation room |
| **Backend (`server/`)** | Node.js (v22), Express, TypeScript, tsx, Nodemailer, Firebase Admin SDK | Multi-tenant REST API, incident lifecycle controller, email dispatcher, evidence server |
| **AI Vision Service (`ai-service/`)** | Python 3.10–3.13, FastAPI, Uvicorn, OpenCV, Ultralytics YOLOv8, PyTorch, Pydantic | Real-time video frame sampling, YOLOv8 inference, evidence snapshot generator |
| **IoT Hardware** | ESP32-CAM, Wi-Fi MJPEG Server, RTSP/HTTP Streams | Edge camera stream capture and transmission |
| **Database & Cloud** | Firebase Authentication, Realtime Database (RTDB), Local Evidence Store | User identity, multi-tenant state sync, incident logs, evidence storage |

---

## 4. AI Vision Architecture & Model Specifications

| Parameter | Specification | Details |
|-----------|---------------|---------|
| **YOLO Version** | **YOLOv8** | Ultralytics YOLOv8 Nano (`YOLOv8n`) detection architecture |
| **Model Weights** | **`fire_smoke_yolov8n.pt`** | Stored in `ai-service/models/fire_smoke_yolov8n.pt` (~3.01M parameters) |
| **Detected Classes** | **2 Classes** | Class 0: `smoke`<br>Class 1: `fire` |
| **Input Dimensions** | **640 × 640 pixels** | 3-channel RGB/BGR input with automatic letterboxing |
| **Sampling Rate** | **1 FPS** (Default) | `FRAME_INTERVAL_SECONDS=1.0` (time-based sampling via OpenCV) |
| **Inference Latency** | **~25–35 ms** | Pre-warmed model canvas for instant first-frame response |
| **Detection Logic** | **Adjacent-Frame State Machine** | Differentiates breakout (Case 2), ongoing fire (Case 1), and fire extinction (Case 3) |
| **Training Source** | **Fine-tuned Checkpoint** | Transfer-learned on public fire and smoke datasets |

---

## 5. Monorepo Structure

```
Evac_AI_Website/
├── client/                     # Frontend web application (Vite + React + TS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── camera/         # Camera management, CCTV player modal, situation plan
│   │   │   ├── floorplan/      # Konva canvas editor, properties panel, toolbar
│   │   │   ├── incident/       # Incident table, detail modal, multi-snap timeline viewer
│   │   │   ├── layout/         # AppHeader, AppSidebar, UserDropdown
│   │   │   ├── notifications/  # NotificationBell and toast triggers
│   │   │   └── ui/             # shadcn/ui components (Card, Button, Dialog, Badge)
│   │   ├── context/            # AuthContext (Firebase auth, claims, tenant profile)
│   │   ├── pages/              # LandingPage, LoginPage, SuperadminDashboard, MallDashboard, MallSituation
│   │   └── types/              # TypeScript definitions (camera, floorplan, incident, auth)
│   └── public/videos/          # Sample CCTV video feeds for simulation
│
├── server/                     # Backend API server (Express + Node + TS)
│   ├── src/
│   │   ├── config/             # Environment loader and Firebase Admin initialization
│   │   ├── controllers/        # detectionController, incidentController, cameraController, floorplanController, adminController
│   │   ├── middleware/         # authMiddleware (verifyToken, requireRole, requireMallAccess)
│   │   ├── routes/             # detectionRoutes, incidentRoutes, cameraRoutes, floorplanRoutes, adminRoutes
│   │   ├── services/           # emailService (SMTP alert dispatch), emergencyService (global emergency sync)
│   │   └── types/              # Backend TypeScript data schemas
│   └── scripts/                # Automated verification and test scripts
│
├── ai-service/                 # Computer vision microservice (FastAPI + Python)
│   ├── app/
│   │   ├── api/                # Health check and camera control endpoints
│   │   ├── models/             # Pydantic schemas (DetectionEvent, CameraStatus)
│   │   ├── services/           # detector.py (YOLOv8 wrapper), camera_worker.py (threaded stream worker)
│   │   └── config.py           # Configuration loader (.env and settings)
│   ├── models/                 # Model weights (fire_smoke_yolov8n.pt)
│   ├── main.py                 # FastAPI application instance & lifespan management
│   └── requirements.txt        # Python dependencies (ultralytics, opencv, fastapi)
│
├── evidence/                   # Shared directory for annotated detection snapshots
│   └── incidents/<mallId>/     # Incident breakout frames, timeline observations, clear frames
│
├── docs/                       # Technical architecture, database schemas, and API contracts
├── package.json                # Root development orchestration scripts
└── README.md                   # Project documentation
```

---

## 6. Prerequisites

Ensure you have installed:
- **Node.js**: `v18.0.0` or higher (`v22.x` recommended)
- **npm**: `v9.0.0` or higher
- **Python**: `v3.10` to `v3.13` with `venv` support
- **Git**
- *(Optional)* Hardware: **ESP32-CAM** module programmed with an HTTP/MJPEG camera web server

---

## 7. Installation & Setup

### 7.1 Clone Repository
```powershell
git clone <repository-url>
cd Evac_AI_Website
```

### 7.2 Backend Installation (`server/`)
```powershell
cd server
npm install
Copy-Item .env.example .env
cd ..
```

### 7.3 Frontend Installation (`client/`)
```powershell
cd client
npm install
Copy-Item .env.example .env
cd ..
```

### 7.4 AI Service Installation (`ai-service/`)
```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
cd ..
```

---

## 8. Environment Configuration

### Backend (`server/.env`)
```ini
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_KEY=evacai_dev_secret_key_change_in_production

# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://<your-project-id>-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=<your-project-id>.appspot.com

# Evidence Storage Directory
EVACAI_EVIDENCE_DIR=../evidence

# SMTP Email Configuration (Gmail App Password or Custom SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM="EvacAI Emergency Alert" <your-email@gmail.com>
```

### Frontend (`client/.env`)
```ini
VITE_API_BASE_URL=http://localhost:4000
VITE_AI_SERVICE_URL=http://localhost:8000

# Firebase Web App Credentials
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### AI Service (`ai-service/.env`)
```ini
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=development
BACKEND_API_URL=http://localhost:4000/api
AI_SERVICE_KEY=evacai_dev_secret_key_change_in_production

# Model & Inference Settings
MODEL_PATH=models/fire_smoke_yolov8n.pt
CONFIDENCE_THRESHOLD=0.60
FRAME_INTERVAL_SECONDS=1.0
DETECTION_CLEARING_SECONDS=15.0
EVACAI_EVIDENCE_DIR=../evidence
```

---

## 9. Running the Application

### Option A: From Root (Multi-Terminal)

Open three separate terminals in the project root:

```powershell
# Terminal 1: Backend Express Server (Port 4000)
npm run dev:server

# Terminal 2: Frontend Web App (Port 5173)
npm run dev:client

# Terminal 3: Python AI Vision Service (Port 8000)
npm run dev:ai
```

### Option B: From Individual Subdirectories

```powershell
# Backend
cd server
npm run dev

# Frontend
cd client
npm run dev

# AI Service
cd ai-service
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

---

## 10. Key API Endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Backend health and Firebase connection status |
| `GET` | `/api/emergency/status` | Public | Real-time global emergency status (`active` / `normal`) |
| `POST` | `/api/auth/login` | Public | Firebase authentication and custom claim resolution |
| `GET` | `/api/auth/me` | Authenticated | Current user profile, role, and mall assignment |
| `GET` / `POST` | `/api/admin/malls` | Superadmin | List and create shopping malls |
| `GET` / `POST` | `/api/admin/users` | Superadmin | List and create mall management user accounts |
| `GET` / `PUT` | `/api/malls/:mallId/floorplan` | Mall Management | Get and save floor plan JSON (rooms, corridors, doors, cameras) |
| `GET` / `POST` | `/api/malls/:mallId/cameras` | Mall Management | List and configure CCTV cameras |
| `POST` | `/api/detection` | AI Service Key | Ingest fire/smoke detection events with evidence |
| `POST` | `/api/detection/observation` | AI Service Key | Append periodic timeline observation frame to incident |
| `POST` | `/api/detection/state` | AI Service Key | Update camera detection status (presence & clearing) |
| `GET` | `/api/malls/:mallId/incidents` | Mall Management | List incidents with status and camera filters |
| `PATCH` | `/api/malls/:mallId/incidents/:id/status` | Mall Management | Update lifecycle state (`ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`, `FALSE_ALARM`) |
| `GET` | `/api/malls/:mallId/incidents/:id/evidence` | Mall Management | Retrieve authenticated evidence JPEG frame |
| `POST` | `/api/malls/:mallId/incidents/:id/email` | Mall Management | Manually trigger or resend alert email |

---

## 11. Automated Verification & Test Suites

The project includes an end-to-end automated test suite:

```powershell
# Run Comprehensive Emergency & Evidence Timeline Test Suite (8/8 Checks)
npx tsx server/scripts/test-emergency-and-timeline.ts

# Run Milestone 7 E2E Incident Pipeline & Deduplication Test
npx tsx server/scripts/test-m7-e2e.ts

# Run Camera Management & Stream Verification Test
npx tsx server/scripts/test-m5-camera.ts

# Run Floor Plan Persistence & Schema Validation Test
npx tsx server/scripts/test-m4-floorplan.ts

# Run AI Service YOLO Model Diagnostics
ai-service\venv\Scripts\python.exe ai-service\test_ai_service.py
```

---

## 12. Milestones & Project Progress

- [x] **Milestone 0: Architecture & Planning** — System architecture, database schema, and API contracts defined.
- [x] **Milestone 1: Project Foundation** — Monorepo scaffolding, health endpoints, and build pipelines.
- [x] **Milestone 2: Authentication & Role Guards** — Firebase Auth, RBAC middleware, and token claims.
- [x] **Milestone 3: Superadmin Portal** — Multi-tenant mall creation and management account provisioning.
- [x] **Milestone 4: Interactive Floor Plan Canvas** — HTML5 canvas editor for rooms, corridors, exits, and camera markers.
- [x] **Milestone 5: Camera Management** — Camera CRUD, multi-stream ingestion, and spatial floor placement.
- [x] **Milestone 6: AI Vision Service** — YOLOv8 Nano detection engine with `fire_smoke_yolov8n.pt`.
- [x] **Milestone 7: Incident Pipeline & Automated Alerting** — Ingestion, evidence capture, timeline snapshots, and SMTP email dispatch.
- [x] **Milestone 8: Mall Situation Room** — Live interactive blueprint, camera presence indicators, and auto-clearing concluding snapshots.
- [x] **Milestone 9: Incident Lifecycle Management UI** — Real-time hazard feed, state transitions, and timeline evidence inspection.
- [x] **Milestone 10: ESP32-CAM Hardware Integration** — Wi-Fi streaming, auto-reconnect, and MJPEG frame buffering.
- [x] **Milestone 11: Production Hardening & Resilience** — End-to-end tests, null safety guards, and responsive error handling.

---

## 13. License & Authors

Developed as a Major Project Prototype by the **EvacAI Development Team**.  
Licensed under the [ISC License](LICENSE).

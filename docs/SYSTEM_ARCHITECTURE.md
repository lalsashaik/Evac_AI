# EvacAI — System Architecture

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development

---

## 1. Architecture Overview

EvacAI is a multi-component distributed system. The major components are:

1. **React Frontend** — Web application for mall management and superadmin.
2. **Node.js Backend** — REST API server handling business logic and Firebase Admin operations.
3. **Python AI Service** — Independent video processing and fire/smoke detection service.
4. **Firebase Authentication** — Identity and token management.
5. **Firebase Realtime Database** — Primary application database.
6. **Local Evidence Storage (`EVACAI_EVIDENCE_DIR`)** — Shared on-disk incident snapshot JPEG storage (no Firebase Storage).
7. **ESP32-CAM Devices** — Physical camera hardware (future/hardware-integration phase).
8. **Simulated Camera Sources** — Pre-recorded video files for development and testing.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE (Browser)                        │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │          React Frontend (Vite + TypeScript + Tailwind)         │ │
│  │  - Superadmin Dashboard                                        │ │
│  │  - Mall Management Dashboard                                   │ │
│  │  - Floor Plan Editor (React Konva)                             │ │
│  │  - CCTV Monitoring View                                        │ │
│  │  - Incident Management View                                    │ │
│  └──────────┬──────────────────────────────┬───────────────────── ┘ │
│             │ REST API Calls               │ Firebase SDK           │
└─────────────┼──────────────────────────────┼───────────────────────-┘
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────────────┐
│   Node.js Backend       │    │          Firebase Platform          │
│   (Express + TS)        │◄───┤                                     │
│                         │    │  ┌─────────────────────────────┐    │
│  - Auth middleware       │    │  │  Firebase Authentication    │    │
│  - Mall CRUD            │    │  └─────────────────────────────┘    │
│  - Camera CRUD          │    │                                     │
│  - Incident creation    │    │  ┌─────────────────────────────┐    │
│  - Deduplication logic  │    │  │  Firebase Realtime Database  │    │
│  - Notification trigger │    │  └─────────────────────────────┘    │
│  - Firebase Admin SDK   │    │                                     │
└─────────────┬───────────┘    │  ┌─────────────────────────────┐    │
              │                │  │  Firebase Storage            │    │
              │ Writes/Reads   │  └─────────────────────────────┘    │
              └────────────────┴─────────────────────────────────────┘
                                              ▲
              ┌───────────────────────────────┘
              │ POST /api/detection
┌─────────────┴───────────────────────────────────────────────────────┐
│                    Python AI Service (FastAPI)                       │
│                                                                      │
│  - Stream reader (OpenCV)                                            │
│  - Frame extractor                                                   │
│  - YOLO inference engine                                             │
│  - Duplicate-event suppressor                                        │
│  - Snapshot capturer → Local Evidence Directory (`EVACAI_EVIDENCE_DIR`)│
│  - Detection event sender                                            │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ Reads MJPEG stream
        ┌──────────────────┼──────────────────────────┐
        │                  │                           │
        ▼                  ▼                           ▼
┌──────────────┐  ┌──────────────────┐    ┌────────────────────────┐
│ ESP32-CAM    │  │ ESP32-CAM        │    │  Simulated Camera      │
│ (Camera 1)   │  │ (Camera 2)       │    │  (Pre-recorded video)  │
│ Local network│  │ Local network    │    │  Local file            │
└──────────────┘  └──────────────────┘    └────────────────────────┘
```

---

## 2. Component Responsibilities

### 2.1 React Frontend

**Technology:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Konva

**Responsibilities:**
- Render all UI: dashboards, floor plan editor, CCTV view, incident management.
- Authenticate users through Firebase Auth SDK (client-side sign-in).
- Attach Firebase ID tokens to all requests to the Node.js backend.
- Read real-time updates (incidents, camera status) directly from Firebase Realtime Database via listeners.
- Render the interactive floor plan canvas using React Konva.
- Embed camera streams in `<img>` tags (MJPEG) or `<video>` tags.
- Display loading, offline, and error states for cameras.

**What it must NOT do:**
- Must not perform privileged database writes directly.
- Must not hold or expose Firebase service account credentials.
- Must not trust its own role/mall assignment for access control.
- Must not trigger email notifications.

---

### 2.2 Node.js Backend

**Technology:** Node.js, Express, TypeScript, Firebase Admin SDK

**Responsibilities:**
- Expose REST API endpoints for all privileged operations.
- Verify Firebase ID tokens on every protected endpoint.
- Read custom claims from verified tokens (role, mallId).
- Enforce mall-level data isolation on all operations.
- Manage user accounts via Firebase Admin SDK (create, disable, set custom claims).
- Handle mall CRUD, camera CRUD, and floor plan updates.
- Receive and validate detection payloads from the AI service.
- Apply incident deduplication and cooldown logic.
- Create incident records in Firebase Realtime Database.
- Write snapshot references to incident records.
- Trigger email notifications (via Nodemailer or a transactional email provider).
- Expose a health endpoint.

**What it must NOT do:**
- Must not perform real-time video processing or AI inference.
- Must not store raw video streams or footage.

---

### 2.3 Python AI Service

**Technology:** Python 3.10+, FastAPI, OpenCV, Ultralytics YOLO

**Responsibilities:**
- Load camera configuration from a local config file or by calling the backend API at startup.
- Open MJPEG streams with OpenCV `VideoCapture`.
- Process pre-recorded video files for simulated cameras.
- Extract frames at a configurable interval (not every frame).
- Run YOLO-based fire/smoke detection on each extracted frame.
- Filter detections below the configurable confidence threshold.
- Suppress duplicate events using a per-camera cooldown window.
- Capture a snapshot of the detected frame.
- Upload the snapshot to Firebase Storage using the Firebase Admin SDK or service account credentials.
- Send a structured detection event payload to the Node.js backend via authenticated HTTP POST.
- Expose a `/health` and `/status` endpoint for monitoring.
- Run independently of the web dashboard — it is a background service.

**What it must NOT do:**
- Must not perform database writes directly to Firebase Realtime Database (all writes go via the backend).
- Must not store raw video streams or large data in Firebase.

---

### 2.4 Firebase Authentication

**Responsibilities:**
- Issue and validate JSON Web Tokens (ID tokens) for all authenticated users.
- Store user credentials (email/password).
- Support custom claims attached to user tokens (role, mallId).

**Usage pattern:**
- Frontend: signs in users, gets ID token, refreshes token automatically.
- Backend: verifies ID token using Firebase Admin SDK on every request.
- AI service: uses a long-lived service account credential (not user auth).

---

### 2.5 Firebase Realtime Database

**Responsibilities:**
- Primary data store for all application entities.
- Provides real-time push notifications to connected clients via listeners.
- Stores: users (metadata), malls, floor plans, rooms, corridors, doors, cameras, incidents, camera health.

**NOT used for:**
- Video stream data.
- Binary files (snapshots are stored on local filesystem in `EVACAI_EVIDENCE_DIR`).
- Base64 image strings.

---

### 2.6 Local Evidence Storage (`EVACAI_EVIDENCE_DIR`)

**Responsibilities:**
- Store annotated incident snapshot JPEG files captured by the Python AI service upon fire/smoke detection.
- Provide directory isolation by mall: `EVACAI_EVIDENCE_DIR/incidents/{mallId}/{evidenceId}.jpg`.
- Secured through authenticated Node.js backend endpoint `GET /api/malls/{mallId}/incidents/{incidentId}/evidence` (no public static hosting, strict path traversal defense).
- EvacAI avoids Firebase Storage to prevent billing dependencies (Blaze plan) in major project prototype.

---

## 3. Communication Flows

### A. Frontend ↔ Backend

```
Frontend                                  Backend
   │                                         │
   │  1. Firebase Auth: signInWithEmailAndPassword()
   │  2. Get ID Token (auto-refreshed every hour)
   │                                         │
   │──── HTTP Request + Bearer <idToken> ───►│
   │                                         │  3. Verify token (Admin SDK)
   │                                         │  4. Extract role + mallId claims
   │                                         │  5. Authorize operation
   │                                         │  6. Execute business logic
   │◄─── HTTP Response (JSON) ───────────────│
```

All REST API calls from the frontend include the Firebase ID token as a Bearer token in the Authorization header. The backend verifies this token and extracts custom claims for every request.

---

### B. Frontend ↔ Firebase

```
Frontend (Firebase Client SDK)
   │
   ├── Firebase Auth: signIn / signOut / onAuthStateChanged
   │
   ├── Firebase Realtime Database (Read-only listeners):
   │      onValue("/malls/{mallId}/incidents/...")     ← Real-time incident updates
   │      onValue("/malls/{mallId}/cameras/status/...") ← Camera status updates
   │      onValue("/malls/{mallId}/floorplan/...")      ← Floor plan data
   │
   └── Firebase Storage:
          getDownloadURL(snapshotRef)  ← Retrieve snapshot images
```

The frontend reads from Firebase Realtime Database using real-time listeners for live updates. It does not perform direct writes to privileged nodes. Firebase Security Rules enforce this.

---

### C. Backend ↔ Firebase

```
Backend (Firebase Admin SDK)
   │
   ├── Firebase Auth Admin:
   │      createUser()         ← Create superadmin / management accounts
   │      setCustomUserClaims() ← Assign role, mallId
   │      updateUser()         ← Disable/enable accounts
   │      verifyIdToken()      ← Verify all incoming requests
   │
   ├── Firebase Realtime Database (Admin - bypasses Security Rules):
   │      set() / update()     ← Create/update malls, cameras, incidents
   │      get()                ← Read mall/camera data for validation
   │
   └── Firebase Storage Admin:
          (AI service uploads directly; backend stores the reference URL)
```

---

### D. AI Service → Backend

```
AI Service                               Backend
   │                                        │
   │  POST /api/detection                   │
   │  Headers:                              │
   │    Authorization: Bearer <ai-secret>   │
   │  Body: {                               │
   │    cameraId, mallId,                   │
   │    detectionType: "fire"|"smoke",      │
   │    confidence: 0.87,                   │
   │    timestamp: "ISO8601",               │
   │    snapshotUrl: "https://...",         │
   │    boundingBoxes: [...]                │
   │  }                                     │
   │──────────────────────────────────────► │
   │                                        │  Validate AI secret
   │                                        │  Validate cameraId exists in mallId
   │                                        │  Apply cooldown/deduplication
   │                                        │  Create incident record
   │                                        │  Trigger email notification
   │◄─────────────────── HTTP 201 / 200 ────│
```

The AI service authenticates to the backend using a shared secret (API key stored as an environment variable on both sides). This is not a user token.

---

### E. ESP32-CAM → AI Service

```
ESP32-CAM (Local Network)              AI Service (Local Machine)
   │                                        │
   │  HTTP MJPEG Stream                     │
   │  GET http://192.168.x.x/stream        │
   │──────────────────────────────────────► │
   │  Content-Type: multipart/x-mixed-replace
   │  (continuous JPEG frames)              │
   │                                        │
   │                           OpenCV VideoCapture reads frames
```

In MVP (local deployment), the AI service and ESP32-CAM must be on the same local network. The AI service directly connects to the camera's HTTP MJPEG endpoint.

> **Important Limitation:** A remotely hosted AI service cannot access a private ESP32 IP address. This is addressed in the Hardware Integration document and is planned for post-MVP via a local gateway or tunneling approach.

---

### F. Management Dashboard ← Real-time Incident Updates

```
Firebase Realtime Database
   │
   │  New incident written by backend at:
   │  /malls/{mallId}/incidents/{incidentId}
   │
   └──► Firebase pushes update to all connected clients
           │
           ▼
        Frontend listener (onValue)
           │
           ▼
        React state update → Incident alert rendered on dashboard
```

No polling is required. The Firebase Realtime Database SDK maintains a persistent WebSocket connection and pushes updates to the frontend immediately when the backend writes a new incident.

---

## 4. Repository Structure

```
evac-ai/
├── docs/                        ← Architecture documentation (this folder)
│   ├── PROJECT_OVERVIEW.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── AUTHENTICATION_AND_SECURITY.md
│   ├── API_CONTRACTS.md
│   ├── HARDWARE_INTEGRATION.md
│   ├── AI_INTEGRATION.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── MILESTONE_STATUS.md
│
├── frontend/                    ← React application
│   ├── src/
│   │   ├── components/          ← Reusable UI components
│   │   ├── pages/               ← Route-level page components
│   │   │   ├── superadmin/      ← Superadmin views
│   │   │   └── mall/            ← Mall management views
│   │   ├── features/            ← Feature slices (floorplan, incidents, cameras)
│   │   ├── hooks/               ← Custom React hooks
│   │   ├── lib/                 ← Firebase client, API client, utilities
│   │   ├── types/               ← TypeScript interfaces and types
│   │   └── routes/              ← React Router configuration
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                     ← Node.js Express API
│   ├── src/
│   │   ├── routes/              ← API route handlers
│   │   ├── middleware/          ← Auth, error, validation middleware
│   │   ├── services/            ← Business logic services
│   │   ├── firebase/            ← Firebase Admin SDK initialization
│   │   ├── types/               ← TypeScript interfaces
│   │   └── index.ts             ← Entry point
│   ├── .env.example
│   └── package.json
│
├── ai-service/                  ← Python AI detection service
│   ├── src/
│   │   ├── detection/           ← YOLO inference engine
│   │   ├── streams/             ← Camera stream readers
│   │   ├── events/              ← Detection event builder and sender
│   │   └── main.py              ← Entry point
│   ├── models/                  ← YOLO weights (not committed to git)
│   ├── test-videos/             ← Simulated camera test footage
│   ├── config.yaml              ← Camera and threshold configuration
│   ├── requirements.txt
│   └── .env.example
│
├── firebase/
│   ├── database.rules.json      ← Realtime Database security rules
│   └── storage.rules            ← Storage security rules
│
├── .gitignore
└── README.md
```

---

## 5. Deployment Architecture (MVP)

For MVP, all components are designed for **local or simple cloud deployment**:

| Component | MVP Deployment Target |
|-----------|----------------------|
| React Frontend | Vercel, Netlify, or Firebase Hosting |
| Node.js Backend | Railway, Render, or local server |
| Python AI Service | Local machine (same network as cameras) |
| Firebase Auth | Firebase cloud (managed) |
| Firebase Realtime DB | Firebase cloud (managed) |
| Firebase Storage | Firebase cloud (managed) |

> **Critical Note:** The Python AI Service must run on the same local network as ESP32-CAM devices in the MVP. It cannot be cloud-hosted for private camera access without a tunneling solution. See `HARDWARE_INTEGRATION.md` for details.

---

## 6. Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Firebase Realtime Database over Firestore | Lower latency for real-time push updates, simpler listener model, adequate for MVP scale. |
| AI service separate from backend | AI inference is compute-intensive and runs on a different cadence. Separation prevents backend latency impact. |
| AI service authenticates with shared secret | The AI service is a trusted internal service, not a user. User auth tokens are inappropriate. |
| Frontend reads incidents directly from Firebase | Avoids polling the backend. Firebase provides sub-second real-time push with no extra infrastructure. |
| Backend performs all privileged writes | Keeps Firebase Security Rules simple. Privileged writes bypass rules via Admin SDK. |
| React Konva for floor plan | Purpose-built canvas library for React with full hit-testing, drag-and-drop, and shape support. |
| No Socket.IO | Firebase Realtime Database listeners provide equivalent real-time push capability without additional infrastructure. |
| Percentage-based floor plan coordinates | Ensures consistent floor plan rendering across different monitor and window sizes. |

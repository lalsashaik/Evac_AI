# EvacAI — Emergency Evacuation & AI Safety Platform

> **Project Type:** College Major Project Prototype  
> **Milestone Status:** Milestone 1 (Project Foundation) Complete  
> **Repository Structure:** Monorepo (`client/`, `server/`, `ai-service/`, `docs/`)

---

## 1. Project Overview

**EvacAI** is an AI-powered Fire and Smoke Detection, CCTV Monitoring, and Incident Management Platform designed for shopping malls and multi-occupancy commercial complexes.

It combines real-time computer vision (OpenCV + YOLO), IoT hardware (ESP32-CAM video streams), an interactive floor plan safety mapping engine, and a multi-tenant web application to provide rapid alerting, evidence capture, and coordinated emergency evacuation management.

---

## 2. Technology Stack

| Layer | Technologies | Role |
|-------|--------------|------|
| **Frontend (`client/`)** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Firebase Web SDK | Management dashboard, real-time status monitor, interactive canvas (future M4) |
| **Backend (`server/`)** | Node.js (v22), Express, TypeScript, tsx, dotenv, Firebase Admin SDK | Business logic, REST API, incident deduplication, role guards |
| **AI Service (`ai-service/`)** | Python 3.13, FastAPI, Uvicorn, OpenCV (headless), Pydantic | Video frame extraction, YOLO fire/smoke detection microservice (future M6) |
| **Cloud Platform** | Firebase Authentication, Realtime Database, Cloud Storage | Real-time state synchronization, user identity, evidence image storage |

---

## 3. Monorepo Folder Structure

```
EvacAI_Website/
├── client/                     # Frontend web application (Vite + React + TS)
│   ├── src/
│   │   ├── components/         # Reusable UI & ServiceStatus components
│   │   │   └── ui/             # shadcn/ui primitives (button, card, badge)
│   │   ├── lib/
│   │   │   ├── firebase.ts     # Safe client Firebase SDK initialization
│   │   │   └── utils.ts        # Class merging utilities (cn)
│   │   ├── pages/
│   │   │   └── LandingPage.tsx # M1 EvacAI test & service status landing page
│   │   ├── App.tsx             # React Router root configuration
│   │   ├── main.tsx            # DOM root mounting
│   │   └── index.css           # Tailwind CSS base styles & HSL variables
│   ├── .env.example            # Client environment variable template
│   ├── package.json
│   ├── tailwind.config.js
│   ├── components.json         # shadcn/ui configuration
│   └── vite.config.ts          # Vite bundler configuration with `@/` alias
│
├── server/                     # Backend API server (Express + Node + TS)
│   ├── src/
│   │   ├── config/
│   │   │   ├── environment.ts  # Typed environment variable loader
│   │   │   └── firebase.ts     # Firebase Admin SDK safe initialization
│   │   ├── controllers/
│   │   │   └── healthController.ts # Health check handler
│   │   ├── middleware/
│   │   │   └── errorHandler.ts # 404 & global exception middleware
│   │   ├── routes/
│   │   │   ├── healthRoutes.ts # /health route definition
│   │   │   └── index.ts        # Central API router
│   │   └── index.ts            # Server entry point & CORS configuration
│   ├── .env.example            # Backend environment variable template
│   ├── package.json
│   └── tsconfig.json
│
├── ai-service/                 # Computer vision microservice (FastAPI + Python)
│   ├── app/
│   │   ├── api/
│   │   │   └── health.py       # GET /health router
│   │   ├── models/
│   │   │   └── schemas.py      # Pydantic models for health responses
│   │   ├── services/
│   │   │   ├── camera_manager.py # Camera stream manager skeleton
│   │   │   └── detector.py       # YOLO detector skeleton
│   │   └── config.py           # Settings loader
│   ├── main.py                 # FastAPI application instance & CORS
│   ├── requirements.txt        # Python package dependencies
│   ├── .env.example            # AI service environment variable template
│   └── venv/                   # Local Python virtual environment (ignored in git)
│
├── docs/                       # Architecture, database schema, & API contracts
│   ├── API_CONTRACTS.md
│   ├── AI_INTEGRATION.md
│   ├── AUTHENTICATION_AND_SECURITY.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEVELOPMENT_ROADMAP.md
│   ├── HARDWARE_INTEGRATION.md
│   ├── MILESTONE_STATUS.md
│   ├── PROJECT_OVERVIEW.md
│   └── SYSTEM_ARCHITECTURE.md
│
├── .gitignore                  # Strict exclusions for secrets, credentials, logs, venv
├── package.json                # Root development scripts for quick local execution
└── README.md                   # This project guide
```

---

## 4. Prerequisites

Before running the project locally, ensure you have installed:

- **Node.js**: v18.0.0 or higher (v22.x recommended)
- **npm**: v9.0.0 or higher
- **Python**: v3.10 or higher (v3.13 tested) with `venv` support
- **Git**

---

## 5. Quick Installation & Setup

### 5.1 Clone & Root Setup

```powershell
git clone <repository-url>
cd Evac_AI_Website
```

### 5.2 Backend Installation

```powershell
cd server
npm install
Copy-Item .env.example .env
cd ..
```

### 5.3 Frontend Installation

```powershell
cd client
npm install
Copy-Item .env.example .env
cd ..
```

### 5.4 AI Service Installation

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
cd ..
```

---

## 6. Environment Configuration

Each service contains a `.env.example` file. Create `.env` files in each service directory:

### Backend (`server/.env`)
```ini
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_KEY=evacai_dev_secret_key_change_in_production

# Firebase Admin (Set when project credentials are available)
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

### Frontend (`client/.env`)
```ini
VITE_API_BASE_URL=http://localhost:4000
VITE_AI_SERVICE_URL=http://localhost:8000

# Firebase Web App (Set when project credentials are available)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### AI Service (`ai-service/.env`)
```ini
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=development
BACKEND_API_URL=http://localhost:4000/api
AI_SERVICE_KEY=evacai_dev_secret_key_change_in_production
```

> **Security Note:** `.env` files, `serviceAccountKey.json`, and credentials are strictly excluded from Git tracking via `.gitignore`. Never commit secrets to the repository.

---

## 7. Running the Services Locally

You can run each service independently or use the root convenience scripts.

### Option A: From Root (Recommended)

In three separate terminal windows:

```powershell
# Terminal 1 — Start Backend Server (Port 4000)
npm run dev:server

# Terminal 2 — Start Frontend Application (Port 5173)
npm run dev:client

# Terminal 3 — Start Python AI Service (Port 8000)
npm run dev:ai
```

### Option B: From Individual Service Directories

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

## 8. Verifying Service Health

When services are running, open your browser or use curl to inspect the health endpoints:

1. **Frontend Landing & Health Monitor:**  
   Open `http://localhost:5173` in your browser. The page displays the real-time health diagnostic probes for all services.

2. **Backend Health Check:**  
   `GET http://localhost:4000/health`  
   ```json
   {
     "service": "evacai-backend",
     "status": "ok",
     "environment": "development",
     "uptime": 24,
     "timestamp": "2026-11-24T10:48:59.399Z",
     "firebase": {
       "initialized": false,
       "message": "Pending setup: No service account credentials found. Place serviceAccountKey.json in server/ or set GOOGLE_APPLICATION_CREDENTIALS."
     }
   }
   ```

3. **Python AI Service Health Check:**  
   `GET http://localhost:8000/health`  
   ```json
   {
     "service": "evacai-ai-service",
     "status": "ok",
     "environment": "development",
     "timestamp": "2026-11-24T10:49:24.606823+00:00",
     "cameras_active": 0,
     "opencv_version": "5.1.0",
     "details": {
       "backend_api_url": "http://localhost:4000/api",
       "yolo_detector": "placeholder (scheduled for M6)"
     }
   }
   ```

---

## 9. Firebase Configuration Instructions

Actual Firebase project credentials will be provided during Milestone 2. To configure Firebase when credentials are ready:

### Step 1: Create Firebase Project
1. Visit the [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a project** and name it (e.g. `evacai-project`).
3. Enable **Firebase Authentication** (Email/Password provider).
4. Enable **Firebase Realtime Database** in test mode (`default-rtdb`).
5. Enable **Firebase Cloud Storage**.

### Step 2: Backend Admin Credentials
1. In Firebase Console, go to **Project Settings** > **Service accounts**.
2. Click **Generate new private key** and download the JSON file.
3. Save this file as `server/serviceAccountKey.json` (do not commit it).
4. In `server/.env`, verify:
   ```ini
   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
   FIREBASE_DATABASE_URL=https://<your-project-id>-default-rtdb.firebaseio.com
   FIREBASE_STORAGE_BUCKET=<your-project-id>.appspot.com
   ```

### Step 3: Frontend Web App Credentials
1. In Firebase Console, go to **Project Settings** > **General** > **Your apps**.
2. Click the Web icon (`</>`) to register a web application.
3. Copy the configuration keys into `client/.env`:
   ```ini
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

Both frontend and backend contain safe fallback initialization logic that logs diagnostic guidance without crashing if credentials are omitted.

---

## 10. Development Roadmap & Milestones

- **M0: Architecture & Planning** — ✅ Complete
- **M1: Project Foundation & Scaffolding** — ✅ Complete
- **M2: Authentication & Role Guards** — ⏳ Next
- **M3: Superadmin — Mall Management** — ⏳ Pending
- **M4: Interactive Floor Plan Canvas Editor** — ⏳ Pending
- **M5: Camera Management & CCTV Feeds** — ⏳ Pending
- **M6: AI Vision Service Foundation (YOLO)** — ⏳ Pending
- **M7: Incident Pipeline & Alerting** — ⏳ Pending
- **M8: CCTV Monitoring Dashboard** — ⏳ Pending
- **M9: Incident Management Lifecycle UI** — ⏳ Pending
- **M10: ESP32-CAM Hardware Integration** — ⏳ Pending
- **M11: Hardening & Polish** — ⏳ Pending

See `docs/DEVELOPMENT_ROADMAP.md` and `docs/MILESTONE_STATUS.md` for complete technical details.

# EvacAI — Milestone Status

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Last Updated:** 2026-11-24  
> **Current Stage:** Pre-Development — Architecture and Planning Complete

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ COMPLETE | All acceptance criteria met and verified. |
| 🔄 IN PROGRESS | Currently being developed. |
| ⏳ PENDING | Scheduled but not started. |
| 🔴 BLOCKED | Cannot proceed due to an unresolved dependency or decision. |
| ⏭️ SKIPPED | Explicitly deferred or removed from scope. |

---

## Milestone Overview

| # | Milestone | Status | Start Date | End Date | Notes |
|---|-----------|--------|------------|----------|-------|
| M0 | Architecture and Planning | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | All 9 documentation files created. |
| M1 | Project Scaffolding | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | Monorepo structure, 3 services configured & verified, Firebase prepared. |
| M2 | Authentication | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | Firebase Auth, RBAC custom claims, middleware, tenant isolation verified. |
| M3 | Superadmin — Mall Management | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | Mall CRUD, unique ID generation, account issuance, superadmin UI. |
| M4 | Floor Plan Editor | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | Visual Konva editor, single floor, rooms, doors, cameras, RTDB persistence. |
| M5 | Camera Management | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | Camera CRUD, CCTV simulation, prerecorded video feeds, MJPEG prep, floor plan integration. |
| M6 | AI Service — Foundation | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | FastAPI, OpenCV, YOLOv8 fire/smoke model, video loop, cooldown, evidence generation, 10/10 tests pass. |
| M7 | Incident Pipeline & Evidence | ✅ COMPLETE | 2026-11-24 | 2026-11-24 | Internal ingestion, local evidence storage, RTDB deduplication, notifications, email, 30/30 unit tests + E2E test pass. |
| M8 | Real-Time Mall Situation on CCTV Monitoring | ✅ COMPLETE | 2026-11-25 | 2026-11-25 | Split layout, RTDB cameraDetectionState, 15s automatic clearing, 20/20 tests pass. |
| M9 | Incident Management UI | ⏳ PENDING | — | — | Depends on M7, M8. |
| M10 | ESP32-CAM Integration | ⏳ PENDING | — | — | Depends on M6, M7. |
| M11 | Hardening and Polish | ⏳ PENDING | — | — | Depends on all previous. |

---

## Milestone 0 — Architecture and Planning

**Status:** ✅ COMPLETE

**Completed deliverables:**

| Document | Status |
|----------|--------|
| `docs/PROJECT_OVERVIEW.md` | ✅ Created |
| `docs/SYSTEM_ARCHITECTURE.md` | ✅ Created |
| `docs/DATABASE_SCHEMA.md` | ✅ Created |
| `docs/AUTHENTICATION_AND_SECURITY.md` | ✅ Created |
| `docs/API_CONTRACTS.md` | ✅ Created |
| `docs/HARDWARE_INTEGRATION.md` | ✅ Created |
| `docs/AI_INTEGRATION.md` | ✅ Created |
| `docs/DEVELOPMENT_ROADMAP.md` | ✅ Created |
| `docs/MILESTONE_STATUS.md` | ✅ Created |

**Outstanding decisions (must be resolved before or during Milestone 1):**

| # | Decision | Owner | Status |
|---|----------|-------|--------|
| D1 | Approve the overall architecture as documented | Project Owner | ⏳ Pending |
| D2 | Approve the Firebase Realtime Database schema | Project Owner | ⏳ Pending |
| D3 | Select email notification provider (Nodemailer SMTP / Brevo / Mailgun / SendGrid) | Project Owner | ⏳ Pending |
| D4 | Select backend hosting platform (Railway / Render / local) | Project Owner | ⏳ Pending |
| D5 | Select frontend hosting platform (Vercel / Netlify / Firebase Hosting) | Project Owner | ⏳ Pending |
| D6 | Confirm default cooldown window (30 seconds proposed) | Project Owner | ⏳ Pending |
| D7 | Confirm use of `CameraWebServer` Arduino firmware for ESP32-CAM | Project Owner | ⏳ Pending |

---

## Milestone 1 — Project Scaffolding

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] Initialized `client/` with Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui.
- [x] Initialized `server/` with Node.js + Express + TypeScript.
- [x] Initialized `ai-service/` with FastAPI + Python 3.13 + OpenCV (headless).
- [x] Centralized Firebase JavaScript SDK integration module in `client/src/lib/firebase.ts`.
- [x] Centralized Firebase Admin SDK integration module in `server/src/config/firebase.ts` (safe fallback until credentials provided).
- [x] Implemented GET `/health` endpoint on backend (`server/src/controllers/healthController.ts`).
- [x] Implemented GET `/health` endpoint on AI service (`ai-service/app/api/health.py`).
- [x] Built interactive system health diagnostics page on frontend (`client/src/components/ServiceStatus.tsx`).
- [x] Comprehensive `.gitignore` covering node_modules, Python venvs, `.env`, and Firebase service account keys.
- [x] Created `.env.example` templates for all three services.
- [x] Added root-level `package.json` convenience scripts.
- [x] Verified TypeScript compilation, service startups, and CORS health probe connectivity.

*Note on Firebase:* Client and backend integration modules are prepared and verified. Actual live cloud connection remains pending until project owner provides Firebase credentials (scheduled for M2).

---

## Milestone 2 — Authentication & Role Management

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] Initialized Firebase Email/Password Authentication integration in frontend and backend.
- [x] Implemented idempotent superadmin setup script (`server/scripts/create-superadmin.ts` / `npm run create-superadmin`).
- [x] Implemented mall management test user setup script (`server/scripts/create-management-user.ts` / `npm run create-management-user`).
- [x] Configured Firebase custom claims (`role: superadmin | mall_management`, `mallId`).
- [x] Persisted user profile records in Firebase Realtime Database at `/users/{uid}` matching database design.
- [x] Implemented backend authentication middleware:
  - `verifyFirebaseToken`: decodes and verifies Firebase JWT Bearer tokens.
  - `requireRole`: strictly enforces role boundaries (`superadmin`, `mall_management`).
  - `requireMallAccess`: enforces tenant isolation by matching token `mallId` claim with target `mallId` route param.
- [x] Implemented identity endpoints:
  - `GET /api/auth/me`: returns authenticated user profile, role, and mallId.
  - `POST /api/auth/verify`: verifies token claims for token refresh.
  - Test endpoints: `/api/auth/test/superadmin`, `/api/auth/test/management`, `/api/auth/test/malls/:mallId`.
- [x] Implemented frontend authentication architecture:
  - Centralized `AuthContext` with `onAuthStateChanged`, login, logout, and token auto-refresh.
  - `ProtectedRoute` component handling authentication loading, redirects to `/login`, and cross-role guard redirects.
  - Modern EvacAI Login page (`/login`) with error mapping, show/hide password, and loading states.
  - Superadmin dashboard placeholder (`/superadmin`) with live backend authorization test panel.
  - Mall management dashboard placeholder (`/management`) with live tenant isolation test panel.
- [x] Verified all 12 Milestone 2 test scenarios via automated test suite (`npm run test:auth`):
  1. Valid superadmin login
  2. Valid mall management login
  3. Invalid email/password rejection
  4. Logout functionality
  5. Session persistence across refresh
  6. Unauthenticated access prevention
  7. Superadmin access to management routes (restricted)
  8. Mall management access to superadmin routes (restricted)
  9. Request without token (401 Unauthorized)
  10. Request with invalid token (401 Unauthorized)
  11. Backend role restriction (200 OK for matched role, 403 Forbidden for mismatched)
  12. Mall management tenant isolation (200 OK for assigned mall, 403 Forbidden for foreign mall)

---

## Milestone 3 — Superadmin — Mall and Account Management

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] Backend Mall Management APIs (`server/src/controllers/adminController.ts`, `server/src/routes/adminRoutes.ts`):
  - `POST /api/admin/malls`: Creates new shopping mall with backend-generated collision-free unique ID (`mall_<slug>_<timestamp><suffix>`).
  - `GET /api/admin/malls`: Lists all registered malls, enriched with management account email/display names.
  - `GET /api/admin/malls/:mallId`: Fetches details for a specific mall.
  - `PUT /api/admin/malls/:mallId` & `PATCH /api/admin/malls/:mallId`: Updates mall metadata safely under `/malls/{mallId}/info` without overwriting floorplans, cameras, or incidents.
  - `PATCH /api/admin/malls/:mallId/status`: Toggles active/inactive status, cleanly enabling or disabling the associated Firebase Auth account.
- [x] Backend Management Account Creation APIs:
  - `POST /api/admin/management-users` & `POST /api/admin/malls/:mallId/management-account`: Securely provisions new mall management accounts using Firebase Admin SDK, assigns custom claims (`role: 'mall_management'`, `mallId`), creates `/users/{uid}` in RTDB, and links `managementUid` in `/malls/{mallId}/info`.
  - Input validation: validates target mall existence and active status; gracefully rejects duplicate emails with HTTP 409 `EMAIL_ALREADY_EXISTS`.
  - `GET /api/admin/management-users`: Lists all active management accounts with assigned mall names and identifiers.
  - `GET /api/admin/stats`: Calculates total malls, active malls, and total management accounts.
- [x] Complete Superadmin Dashboard & Management UI (`client/src/pages/SuperadminDashboard.tsx`):
  - **Overview Section**: Platform stats cards (Total Malls, Active Malls, Management Accounts), quick action shortcuts, recent malls list.
  - **Malls Management Section**: Searchable grid of malls, active/inactive status badges, detailed view modal, edit modal with permanent ID preservation, and deactivation confirmation modal.
  - **Management Accounts Section**: Searchable table displaying managers, login emails, assigned mall badges, claim tags, and active status.
  - **Create Mall Modal**: Clean form with name, address, contact person, phone, and email fields.
  - **Create Management Account Modal**: Clean form with name, email, password, and active mall dropdown selector.
- [x] Verified all 12 Milestone 3 test scenarios via automated test suite (`npm run test:admin`):
  1. Superadmin can create a mall (HTTP 201).
  2. Superadmin can view all malls (HTTP 200).
  3. Superadmin can edit mall details without mutating `mallId` (HTTP 200).
  4. Creating a mall generates a unique collision-free ID.
  5. Superadmin can create a management account (HTTP 201).
  6. Management account receives correct role custom claim (`role: 'mall_management'`).
  7. Management account receives correct mallId custom claim (`mallId: '<createdMallId>'`).
  8. Created account appears in management account list.
  9. Duplicate email creation is rejected gracefully (HTTP 409 `EMAIL_ALREADY_EXISTS`).
  10. Selecting a nonexistent mall is rejected (HTTP 404 `MALL_NOT_FOUND`).
  11. Mall management users cannot access superadmin APIs (HTTP 403 Forbidden).
  12. Superadmin can still log in and access dashboard after changes (HTTP 200).

---

## Milestone 4 — Interactive Floor Plan Editor

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] Installed `react-konva` & `konva` in the frontend client.
- [x] Defined TypeScript data models for floor plans (`FloorRoom`, `FloorDoor`, `FloorCameraMarker`, `FloorPlan`) adhering strictly to `DATABASE_SCHEMA.md`.
- [x] Implemented normalized coordinate system (0.0 to 1.0) for resolution-independent canvas rendering.
- [x] Backend Floor Plan APIs (`server/src/controllers/floorplanController.ts`, `server/src/routes/floorplanRoutes.ts`):
  - `GET /api/malls/:mallId/floorplan`: Returns the floor plan for the assigned mall (or null if empty).
  - `PUT /api/malls/:mallId/floorplan`: Replaces/saves the floor plan structure under `/malls/{mallId}/floorplans/{floorId}`.
  - Strict tenant isolation enforced via `verifyFirebaseToken`, `requireRole('mall_management')`, and `requireMallAccess`.
- [x] Interactive Visual Floor Plan Editor (`client/src/components/floorplan/`, `client/src/pages/FloorPlanEditor.tsx`):
  - **Canvas (`FloorPlanCanvas.tsx`)**: Responsive HTML5 canvas via React Konva with dynamic grid, selection highlight, drag-and-drop movement, and transformer-based free resizing.
  - **Toolbar (`EditorToolbar.tsx`)**: Visual tool switching for Select, Add Room, Add Corridor, Entry Door, Exit Door, Add Camera, and Delete.
  - **Properties Panel (`PropertiesPanel.tsx`)**: Real-time property inspection and editing for rooms (name, type, coordinates, dimensions), doors (label, type, coordinates), and camera markers (name, ID, coordinates).
  - **Element Palette**: Color-coded distinguishing styles for rooms, corridors, common areas, stairwells, entry/exit doors, and camera markers.
  - **Save & Load Workflow**: Clear saving status indicators (idle, saving, saved, error, dirty changes), Ctrl+S keyboard shortcut, and auto-reload on session restore.
- [x] Seamless Mall Dashboard integration (`client/src/pages/MallDashboard.tsx`) with tabbed navigation between "Overview" and "Floor Plan".
- [x] Verified all 13 Milestone 4 test scenarios via automated test suite (`npm run test:floorplan`):
  1. Mall management can open floor plan editor endpoint (HTTP 200).
  2. A room can be added and floor plan saved (HTTP 200).
  3. Room can be moved and resized.
  4. Room properties can be edited (name and type).
  5. Corridors can be added and edited.
  6. Entry and exit doors can be added.
  7. Camera markers can be placed and positioned.
  8. Elements can be deleted from floor plan.
  9. Refreshing/reloading application restores saved floor plan perfectly.
  10. Editing and saving again updates floor plan correctly without data loss.
  11. Mall manager cannot access or modify another mall's floor plan (HTTP 403 Forbidden).
  12. Unauthenticated request blocked (HTTP 401 Unauthorized).
  13. Existing M1, M2, and M3 functionality continues to work intact.

---

## Milestone 5 — Camera Management & CCTV Simulation

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] Defined TypeScript data models for cameras (`CameraRecord`, `CameraHealthRecord`, `CameraWithDetails`, `CreateCameraDto`, `UpdateCameraDto`) adhering strictly to `DATABASE_SCHEMA.md`.
- [x] Bundled 3 royalty-free / CC0 sample MP4 surveillance videos in `client/public/videos/` (`cctv_entrance_sample.mp4`, `cctv_corridor_sample.mp4`, `cctv_foodcourt_sample.mp4`) alongside developer documentation in `client/public/videos/README.md`.
- [x] Backend Camera Management APIs (`server/src/controllers/cameraController.ts`, `server/src/routes/cameraRoutes.ts`):
  - `GET /api/malls/:mallId/cameras`: Lists all cameras registered for the mall, enriched with spatial coordinates (`x`, `y`, `rotation`), room names, floor names, and health status (`online`, `offline`, `inactive`, `unknown`).
  - `POST /api/malls/:mallId/cameras`: Creates a new authoritative camera record, initializes camera health, and synchronizes spatial markers with the floor plan.
  - `GET /api/malls/:mallId/cameras/:cameraId`: Retrieves detailed camera configuration.
  - `PATCH /api/malls/:mallId/cameras/:cameraId`: Updates camera details, stream source, active state, and floor marker placement.
  - `DELETE /api/malls/:mallId/cameras/:cameraId`: Deletes camera configuration, health record, and floor plan marker while strictly preserving rooms, doors, and historical incident records.
  - Strict tenant isolation enforced via `verifyFirebaseToken`, `requireRole('mall_management')`, and `requireMallAccess`.
- [x] Floor Plan Editor Camera Synchronization (`server/src/controllers/floorplanController.ts`):
  - Saving floor plan (`PUT /api/malls/:mallId/floorplan`) ensures cameras placed on the canvas automatically provision or update persistent authoritative records under `/malls/{mallId}/cameras/{cameraId}`.
- [x] Full Camera Management UI (`client/src/components/camera/CameraManagement.tsx`):
  - **Overview & Metrics Bar**: Total devices, active feeds, simulation feeds, and floor plan mapped cameras.
  - **Search & Filters**: Search by camera name, ID, or room; filter by building floor; filter by stream type and active status.
  - **Camera Grid Cards**: Live status indicators, video preview thumbnails, room/floor location labels, active/inactive toggle, quick edit, delete, and view feed buttons.
  - **Add / Edit Camera Modal (`CameraFormModal.tsx`)**: Validated form with camera name, floor selector, room dropdown from floor plan, stream type toggle (Simulated vs MJPEG), preset sample video selector, and normalized spatial coordinates.
  - **Delete Confirmation Modal**: Clear warning explaining that stream and marker will be removed while rooms and historical incidents remain intact.
- [x] Authentic CCTV Player & Stream Viewer (`client/src/components/camera/CctvPlayerModal.tsx`):
  - Prerecorded video player supporting play/pause, mute/unmute, loop, and fullscreen.
  - Dynamic CCTV surveillance HUD overlay with pulsing `● REC`, live ticking digital clock (`YYYY-MM-DD HH:mm:ss`), zone information, resolution, and channel label.
  - MJPEG stream rendering prepared for future ESP32-CAM integration (`<img>` with error/connection handlers and informational hardware disclaimer).
  - Accurate connection status indication based on actual stream/video load success (`connected`, `disconnected`, `inactive`, `loading`).
- [x] Interactive Floor Plan Editor Enhancement (`client/src/components/floorplan/PropertiesPanel.tsx`, `client/src/pages/FloorPlanEditor.tsx`):
  - Clicking any camera marker on the floor plan canvas provides an **"Open CCTV Live Feed"** button, opening the CCTV Player modal directly from the floor plan blueprint.
- [x] Verified all 14 Milestone 5 test scenarios via automated test suite (`npm run test:camera`):
  1. Mall management can create a camera (HTTP 201).
  2. The camera appears in the camera list with health and room name (HTTP 200).
  3. The camera appears at the correct position on the floor plan (HTTP 200).
  4. Camera details persist and can be fetched individually (HTTP 200).
  5. Camera details can be edited and changes persist (HTTP 200).
  6. Camera location can be changed and reflects on floor plan (HTTP 200).
  7. Prerecorded video asset is present and playable in static assets.
  8. Different cameras can be configured with different prerecorded videos.
  9. MJPEG viewer source registration is prepared for future ESP32-CAM.
  10. Camera can be deleted without affecting rooms or floor plan (HTTP 200).
  11. Manager cannot access another mall's cameras by mutating URL parameter (HTTP 403 Forbidden).
  12. Superadmin restricted from mall-management camera endpoint (HTTP 403 Forbidden).
  13. Unauthenticated request blocked with HTTP 401 Unauthorized.
  14. Existing M1, M2, M3, and M4 endpoints continue functioning intact.

---

## Milestone 6 — AI Service Foundation & Fire/Smoke Detection

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] Integrated Ultralytics YOLOv8n deep learning framework and PyTorch in the standalone Python FastAPI AI microservice (`ai-service/`).
- [x] Acquired, verified, and integrated pre-trained YOLOv8 fire and smoke detection model weights (`ai-service/models/fire_smoke_yolov8n.pt`, 6.2 MB) fine-tuned on the academic **D-Fire** dataset (Pedro Vinícius A. B. de Venâncio; 21,000+ real-world annotated images) with verified classes `{0: 'smoke', 1: 'fire'}`.
- [x] Implemented dedicated thread-safe camera stream manager and worker pipeline (`ai-service/app/services/camera_worker.py`, `ai-service/app/services/camera_manager.py`):
  - Robust multi-threaded video stream reader with frame sampling rate control (`frame_interval_seconds: 1.0s` default).
  - Clean path resolution for M5 camera `streamUrl` references, resolving relative paths (e.g. `/videos/cctv_fire_sample.mp4`) directly to local filesystem assets in `client/public/videos/`.
  - Seamless continuous video looping for simulated CCTV feeds (`cv2.CAP_PROP_POS_FRAMES: 0`) without resource leaks.
  - Reconnection retry backoff logic for HTTP MJPEG / ESP32-CAM stream sources.
  - Duplicate start loop protection and clean resource release on stop.
- [x] Implemented fire & smoke detection and evidence capture engine (`ai-service/app/services/detector.py`):
  - Frame inference with configurable confidence threshold (default: 0.60).
  - Bounding box extraction with pixel coordinates and confidence scores.
  - Local annotated evidence image generation (`ai-service/evidence/{mallId}/{cameraId}/{eventId}.jpg`) with color-coded bounding boxes (red for fire, amber for smoke) and surveillance HUD watermark.
- [x] Implemented duplicate detection suppression and cooldown grouping (`cooldown_seconds: 30s` default), preventing flood of repeated events during continuous ongoing fire.
- [x] Implemented comprehensive REST API endpoints in FastAPI:
  - `GET /health`: Reports service status, model loaded status, classes, active camera count, and OpenCV version.
  - `GET /cameras/status`: Lists all registered cameras and real-time processing metrics (frames processed, detections count, status).
  - `GET /cameras/{cameraId}/status`: Retrieves processing status for a single camera.
  - `POST /cameras/{cameraId}/start`: Starts/restarts AI video processing loop for a camera with custom configuration.
  - `POST /cameras/{cameraId}/stop`: Gracefully terminates camera processing loop and releases video capture.
  - `POST /cameras/sync`: Requests synchronization from Node.js backend.
  - `GET /detections/recent`: Returns recent structured detection events buffer for M7 incident consumption.
  - `GET /evidence/{mallId}/{cameraId}/{filename}`: Serves annotated evidence snapshots with path traversal protection.
- [x] Implemented Node.js backend integration endpoint:
  - `GET /api/internal/cameras` (`server/src/routes/internalRoutes.ts`) protected by `X-AI-Service-Key` header to allow the AI service to dynamically pull active cameras across all shopping malls.
- [x] Bundled and verified sample test videos in `client/public/videos/` and `client/dist/videos/`:
  - `cctv_fire_sample.mp4`: Active burning fire footage (confirmed fire detection confidence up to 0.91).
  - `cctv_smoke_sample.mp4`: Visible rising smoke hazard footage (confirmed smoke detection).
  - `cctv_corridor_sample.mp4`, `cctv_entrance_sample.mp4`, `cctv_foodcourt_sample.mp4`: Normal surveillance footage (confirmed 0 false positive detections at 0.60 threshold).
- [x] Subtle Frontend Camera UI integration:
  - Added subtle "AI Sensing Active (YOLOv8)" indicator in the CCTV management header.
  - Added "AI Ready" badges to camera preview cards in `client/src/components/camera/CameraManagement.tsx`.
  - Added active "AI SENSING: ACTIVE (YOLOv8)" readout to the CCTV surveillance player HUD overlay in `client/src/components/camera/CctvPlayerModal.tsx`.
  - Added fire and smoke demo options to the camera video preset dropdown in `client/src/types/camera.ts`.
- [x] Verified all 10 Milestone 6 test scenarios via automated test suite (`npm run test:ai`):
  1. Health endpoint reports online with YOLOv8 fire/smoke detector (HTTP 200).
  2. Model classes verified (`smoke`, `fire`).
  3. Camera start and stop processing lifecycle works cleanly.
  4. Duplicate camera start requests handled safely without thread leaks.
  5. Fire successfully detected on sample fire video with evidence frame saved.
  6. Smoke hazard sample video processed with confirmed detections.
  7. Normal CCTV corridor footage processed with 0 false positive detections.
  8. Cooldown grouping throttled detected frames into 1 event.
  9. Unreachable video source gracefully handled with error status; service remains intact.
  10. Multi-camera concurrency verified (multiple feeds processed simultaneously).
- [x] Confirmed regression safety: M1, M2, M3, M4, and M5 test suites continue passing 14/14 tests.

---

## Milestone 7 — Incident Pipeline, Local Evidence Storage & Notifications

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] **Zero Cloud Storage & Local Evidence Storage Architecture**:
  - Eliminated Firebase Storage completely to avoid Blaze plan billing dependency.
  - Implemented shared local evidence filesystem storage via configurable `EVACAI_EVIDENCE_DIR` (`evidence/incidents/{mallId}/{evidenceId}.jpg`).
  - Strict database rule: Firebase Realtime Database stores only metadata and local file references (`evidenceId`, `evidenceFileName`, `evidenceRelativePath`, `evidenceAvailable`).
  - Zero Base64 strings and zero binary image bytes in Firebase Realtime Database.
  - Protected backend evidence retrieval endpoint (`GET /api/malls/{mallId}/incidents/{incidentId}/evidence`) requiring JWT authentication, mall management role, mall tenancy validation, and strict path traversal defenses (`path.resolve` boundary verification).
- [x] **Detection Ingestion API (`POST /api/detection`)**:
  - Authenticated via internal shared secret `X-AI-Service-Key`.
  - Comprehensive payload validation: `cameraId`, `mallId`, `detectionType` (`fire`, `smoke`, `fire_and_smoke`), confidence `[0, 1]`, ISO timestamp, bounding boxes, evidence reference.
  - Authoritative validation from Firebase RTDB: verifies mall exists and is active, verifies camera exists, belongs to the mall, and is active.
  - Enriches incident with authoritative camera name, room name, floor ID, and mall name (never trusts AI-supplied labels).
- [x] **Backend Deduplication & Incident Grouping**:
  - Implemented atomic Firebase RTDB transaction on `/malls/{mallId}/incidentGroups/{cameraId}_{detectionType}` with 30-second configurable cooldown window.
  - **Case A (New incident)**: Creates new incident record under `/malls/{mallId}/incidents/{incidentId}`, initializes group with `frameCount: 1`, triggers notifications.
  - **Case B (Active cooldown)**: Suppresses duplicate incident creation, updates `lastDetectedAt`, increments `frameCount` atomically, returns deduplicated response.
  - **Case C (Expired cooldown)**: Archives previous group, creates fresh incident record, resets cooldown window and `frameCount: 1`.
  - Concurrent detection safety verified with parallel simultaneous detection bursts.
- [x] **Incident Management & Lifecycle APIs**:
  - `GET /api/malls/{mallId}/incidents`: Lists incidents with status and camera filtering, sorted chronologically descending.
  - `GET /api/malls/{mallId}/incidents/{incidentId}`: Returns detailed incident record with spatial metadata and evidence retrieval URI.
  - `PATCH /api/malls/{mallId}/incidents/{incidentId}/status`: Enforces strict lifecycle transitions (`DETECTED` → `ACKNOWLEDGED` → `INVESTIGATING` → `RESOLVED` or `FALSE_ALARM`) with user UID attribution and resolution notes.
- [x] **Real-Time In-App & Email Notifications**:
  - In-app notification records stored at `/malls/{mallId}/notifications/{notificationId}`.
  - Notification management APIs: `GET /api/malls/{mallId}/notifications` (with unread count) and `PATCH /api/malls/{mallId}/notifications/{notificationId}/read`.
  - Email notification service (`emailService.ts`) with HTML alert template, dispatched asynchronously via Nodemailer SMTP. Failures are non-blocking and isolated.
- [x] **Frontend Real-Time Integration**:
  - `NotificationBell.tsx`: Real-time Firebase `onValue` listener on `/malls/{mallId}/notifications` with unread badge, interactive dropdown, and clean unmount unsubscriber.
  - Initial load seed tracking to prevent toast notification flood on dashboard load while alerting dynamically on new incidents in real time without page refresh.
  - Prominent emergency toast banner with direct incident inspector trigger.
  - `IncidentManagement.tsx`: Comprehensive incident table with status filter tabs, camera info, timestamps, and evidence status badges.
  - `IncidentModal.tsx`: Modal inspector with authenticated evidence image fetching (Bearer token to blob URL) and lifecycle action buttons.
  - Integrated into `AppHeader.tsx` and `MallDashboard.tsx` with dedicated sidebar navigation tab.
- [x] **End-to-End & Automated Test Verification**:
  - Verified 30/30 unit & integration test scenarios in `server/scripts/test-m7-incident.ts` (`npm run test:incident`):
    1. Valid AI service key creates incident (201).
    2. Missing AI key rejected (401).
    3. Invalid AI key rejected (401).
    4. Missing cameraId rejected (400).
    5. Invalid confidence (> 1.0) rejected (400).
    6. Invalid detectionType rejected (400).
    7. Nonexistent mall rejected (404).
    8. Nonexistent camera rejected (404).
    9. Path traversal in evidenceId rejected (400).
    10. Inactive camera rejected (400).
    11. Second detection within 30s deduplicated (200).
    12. Deduplication increments frameCount and updates group metadata.
    13. Different detectionType (smoke) creates independent incident.
    14. 5 concurrent detections cleanly deduplicate to the same incident.
    15. Detection after cooldown expiration creates new incident.
    16. RTDB contains only local evidence references (No Base64, No storage URLs).
    17. Protected evidence endpoint returns JPEG binary (200 image/jpeg).
    18. Unauthenticated evidence retrieval rejected (401).
    19. Cross-mall evidence access rejected (403).
    20. Missing evidence file returns sensible 404 response.
    21. Evidence directory excluded from Git (.gitignore check).
    22. Path traversal attack on evidence endpoint blocked (403/400).
    23. In-app notification created under /notifications with isRead=false.
    24. In-app notifications listable via API with unread count.
    25. In-app notification can be marked as read.
    26. Incidents listable with status filter.
    27. Individual incident detail retrievable.
    28. Incident status transition DETECTED -> ACKNOWLEDGED succeeds.
    29. Invalid status jump (DETECTED -> RESOLVED) rejected (400).
    30. Terminal transition to RESOLVED records notes and resolvedAt.
  - Verified 10/10 AI service test scenarios in `ai-service/test_ai_service.py` (`npm run test:ai`).
  - Verified full E2E live inference pipeline in `server/scripts/test-m7-e2e.ts` (`npm run test:e2e`): Live OpenCV/YOLO video inference on `cctv_fire_sample.mp4`, local evidence file write, dispatch to backend, RTDB metadata storage, zero Base64/cloud storage URLs verified, authenticated evidence retrieval, in-app notification, and deduplication.
  - Verified regression safety: M5 camera test suite continues passing 14/14 tests (`npm run test:camera`).

---

## Milestone 8 — Real-Time Mall Situation on CCTV Footage Monitoring Page

**Status:** ✅ COMPLETE

**Completed deliverables:**
- [x] **Ephemeral Camera Presence Tracking (`/malls/{mallId}/cameraDetectionState/{cameraId}`)**:
  - Differentiated physical fire/smoke presence from immutable historical incident logs (`/incidents/{incidentId}`).
  - Added REST endpoints in Node.js backend:
    - `POST /api/detection/state`: Authenticated via `X-AI-Service-Key`, updates camera detection presence in RTDB.
    - `GET /api/detection/state/:mallId`: Authenticated via Firebase JWT, fetches real-time detection states across all cameras.
  - Automatically activates `isCurrentlyDetected: true` on new or deduplicated hazard detections.
- [x] **Automatic Fire/Smoke Clearance & Heartbeat in AI Service**:
  - Implemented per-class detection timestamp tracking (`_last_seen_times`) in `ai-service/app/services/camera_worker.py`.
  - Configurable clearing threshold (`detection_clearing_seconds: 15.0s`).
  - Active presence evaluation (`now - last_seen <= clearing_period`) with 5s periodic heartbeat state dispatch.
  - When fire/smoke is absent for 15s, state transitions to `isCurrentlyDetected: false` and notifies backend, automatically clearing the red marker without requiring management acknowledgement.
  - Added Test 11 to `ai-service/test_ai_service.py` verifying state transitions and automatic clearing.
- [x] **Real-Time Mall Situation Floor Plan Component (`CameraSituationFloorPlan.tsx`)**:
  - Built interactive visual component using React Konva reusing M4 coordinate transformation (normalized 0.0–1.0 mapped to canvas 1000x660).
  - Exact styling for rooms, corridors, stairwells, and entry/exit doors matching the visual floor plan editor.
  - Normal cameras rendered with dark blue badge, directional pointer, and status ring.
  - Active hazard cameras rendered with high-contrast red marker, animated pulsing halo ring, and `🔥 [HAZARD]` indicator.
  - Interactive click popover displaying Camera Name, Room Name, Hazard Type (`fire`, `smoke`, `fire_and_smoke`), Detection Timestamp, Status, Multiple Incident Badge count, and one-click "Open CCTV Live Feed" trigger.
  - Graceful fallback banner if floor plan is unconfigured with a direct link to the Floor Plan Editor.
- [x] **Dedicated Mall Situation Page & Large-Screen Blueprint Monitoring (`MallSituation.tsx`)**:
  - Created a dedicated navigation option **"Mall Situation"** in the management sidebar (`MallDashboard.tsx`).
  - Moved the situation blueprint from the surveillance feeds page to the dedicated page, giving 100% of the screen area to the high-resolution blueprint canvas with dynamic scaling up to 2.2x.
  - Features multi-floor switching, active hazard alert metrics, full-screen toggle for security monitoring walls, and interactive camera marker popovers with direct live CCTV modal playback.
- [x] **Streamlined CCTV Surveillance Feeds Page (`CameraManagement.tsx`)**:
  - Full-width, full-height CCTV video grid layout with responsive column scaling (1 to 4 columns).
  - Maintained synchronized hazard indicators: red glow border, pulsing hazard badges, and "Inspect Active Feed" action on affected camera feeds.
  - Added "Mall Situation" quick shortcut button in the header toolbar for seamless one-click navigation between feeds and blueprint.
- [x] **Continuous Fire/Smoke Monitoring & 15-Minute Cooldown Architecture**:
  - Continuous frame-by-frame hazard evaluation (1.0s) and continuous 5s heartbeats even when no fire exists, preventing false staleness.
  - 15-minute cooldown (`COOLDOWN_SECONDS=900`) strictly governs evidence snapshots and alert emails without throttling continuous spatial awareness.
  - Updating or changing camera video in the UI automatically restarts the AI worker with the new feed, immediately clears RTDB detection state, and clears incident deduplication groups.
- [x] **Multi-Listener Real-Time Synchronization & Tenant Isolation**:
  - Connected Firebase Realtime Database listeners on `/malls/{mallId}/cameraDetectionState`, `/malls/{mallId}/incidents`, and `/malls/{mallId}/floorplans/{floorId}`.
  - Component unmount unsubscribers cleanly detach all listeners to prevent memory leaks.
  - Strict tenant isolation: managers strictly listen to and view only their assigned `mallId`.
- [x] **Automated Verification Suite (`server/scripts/test-m8-situation.ts`)**:
  - Implemented 20-scenario automated test suite (`npm run test:situation`) verifying:
    1. Floor plan and camera spatial positions load accurately (HTTP 200).
    2. Incident with status `DETECTED` reflects in RTDB.
    3. Camera detection state updates to `isCurrentlyDetected: true`.
    4. Second camera detected simultaneously highlights both cameras independently.
    5. Two incidents on the same camera result in a single consolidated marker with count=2.
    6. Transitioning 1 of 2 incidents to `ACKNOWLEDGED` maintains red marker while other is `DETECTED`.
    7. All incidents transitioning to `RESOLVED` resets detection state when presence clears.
    8. Incident marked `FALSE_ALARM` clears active highlight.
    9. Camera with no floor-plan position retains its incident record without crashing.
    10. Incomplete/corrupted incident records handled gracefully without frontend errors.
    11. Fast incident burst updates processed cleanly without race conditions.
    12. Tenant isolation strictly prevents cross-mall state access (HTTP 403).
    13. Unauthenticated state retrieval rejected (HTTP 401).
    14. Camera detection state updates via internal API with valid secret key (HTTP 200).
    15. Camera detection state rejected when internal key is missing or invalid (HTTP 401).
    16. Automatic marker reset: AI clearing event resets `isCurrentlyDetected: false` without incident resolution.
    17. Camera cards reflect real-time active detection presence.
    18. Multi-camera independent clearing: Camera 1 clearing does not affect Camera 2.
    19. Stale detection state safeguard: timestamps older than 30s treated as offline/cleared.
    20. Historical incident audit trail and evidence remain intact when presence clears.
  - Passed: 20 / 20 scenarios (`npm run test:situation`).
- [x] **Regression & Build Verification**:
  - Verified M5 Camera Management test suite: 14 / 14 scenarios passed (`npm run test:camera`).
  - Verified M7 Incident Pipeline test suite: 30 / 30 scenarios passed (`npm run test:incident`).
  - Verified AI Service test suite: 11 / 11 tests passed (`npm run test:ai`).
  - Client build verified: Vite TypeScript build passed with 0 errors (`npm run build --prefix client`).
  - Server build verified: Node.js TypeScript build passed with 0 errors (`npm run build --prefix server`).

---

## M8 Onwards

Milestones M9 through M11 remain pending. See `DEVELOPMENT_ROADMAP.md` for full scope, acceptance criteria, and dependencies.

---

## Decisions Log

This section is updated throughout development to record key decisions made.

| Date | Decision | Detail | Decided By |
|------|----------|--------|------------|
| 2026-11-24 | Technology stack finalized | React/Vite/TS/Tailwind/shadcn/Konva + Node/Express/TS/Firebase + Python/FastAPI/OpenCV/YOLOv8 | Architecture review |
| 2026-11-24 | Firebase Realtime Database chosen over Firestore | Lower latency push updates, simpler listener model | Architecture review |
| 2026-11-24 | No Socket.IO | Firebase Realtime Database listeners are sufficient | Architecture review |
| 2026-11-24 | AI service runs locally in MVP | Private ESP32 IPs cannot be accessed remotely without tunneling | Architecture review |
| 2026-11-24 | Normalized (0–1) floor plan coordinates | Screen-size independence for floor plan rendering | Architecture review |
| 2026-11-24 | Two-layer deduplication | AI service cooldown + backend incidentGroups | Architecture review |
| 2026-11-24 | Monorepo service directory naming | Standardized to `client/`, `server/`, `ai-service/` | Milestone 1 execution |
| 2026-11-24 | Graceful Firebase initialization | Backend and client boot cleanly with diagnostic warnings when credentials are absent | Milestone 1 execution |
| 2026-11-24 | Static video asset approach for CCTV simulation | Video files are served as static public assets in `client/public/videos/`, never stored in RTDB | Milestone 5 execution |
| 2026-11-24 | Camera-floorplan bidirectional synchronization | Floor plan camera markers and authoritative camera configs synchronize automatically | Milestone 5 execution |
| 2026-11-24 | MJPEG rendering path separation | Prerecorded simulated feeds use HTML5 `<video>`, while MJPEG uses `<img>` element with error handlers | Milestone 5 execution |
| 2026-11-24 | YOLOv8n fine-tuned on D-Fire dataset selected for M6 | Nano variant provides fast, reliable inference on standard laptop CPUs without requiring dedicated GPU | Milestone 6 execution |
| 2026-11-24 | Relative camera stream path resolution | AI service resolves browser-relative paths (`/videos/...`) directly to `client/public/videos/` without duplicating configuration | Milestone 6 execution |
| 2026-11-24 | Local evidence snapshot retention | Evidence frames are saved locally under `ai-service/evidence/{mallId}/{cameraId}/` with HTTP serving, keeping RTDB lean | Milestone 6 execution |
| 2026-11-24 | Shared local evidence storage replacing Firebase Storage | Eliminates Blaze plan billing dependency. Snapshots saved to shared filesystem `EVACAI_EVIDENCE_DIR`. RTDB stores only file references. | Milestone 7 execution |
| 2026-11-24 | Zero Base64/binary image data in RTDB | RTDB stores clean JSON metadata only, strictly avoiding database bloat and performance degradation. | Milestone 7 execution |
| 2026-11-24 | Authenticated backend evidence proxy | Snapshots are protected behind `GET /api/malls/{mallId}/incidents/{incidentId}/evidence` with JWT, role, and path traversal validation. | Milestone 7 execution |
| 2026-11-24 | Backend deduplication via atomic RTDB transactions | Deduplication groups under `/incidentGroups/{cameraId}_{detectionType}` with 30s cooldown prevent duplicate alerts during continuous fires. | Milestone 7 execution |
| 2026-11-24 | Non-blocking email dispatch | Nodemailer SMTP alerts run asynchronously and catch errors without failing incident creation. | Milestone 7 execution |
| 2026-11-24 | Client notification seed tracking | Frontend tracks initial load timestamp to suppress historical toast storms while alerting in real time on new events. | Milestone 7 execution |
| 2026-11-25 | M7 Pipeline Audit & Automatic Camera Synchronization | Fixed `AUTO_SYNC_CAMERAS=true` in AI service `.env` and added exponential retry logic in `main.py` so AI service auto-discovers configured cameras on boot. | M7 Pipeline Audit |
| 2026-11-25 | Frontend Real-Time RTDB Incident Listener | Added live `onValue` Firebase RTDB listener in `IncidentManagement.tsx` with Live badge indicator so incidents appear instantaneously without requiring manual page refresh. | M7 Pipeline Audit |
| 2026-11-25 | Confidence-Based Email Auto-Trigger | Configured `EMAIL_ALERT_CONFIDENCE_THRESHOLD=0.65` in backend; high confidence detections auto-dispatch emergency emails with automatic Ethereal preview/live SMTP dispatch; added manual dispatch button in `IncidentModal.tsx`. | M7 Pipeline Audit |
| 2026-11-25 | Ephemeral Camera Presence vs Immutable Incidents | Stored real-time fire/smoke presence at `/malls/{mallId}/cameraDetectionState/{cameraId}` independently from `/malls/{mallId}/incidents`. Real-time floor plan markers reflect active hazard presence while incident lifecycle preserves complete audit trail and evidence. | Milestone 8 execution |
| 2026-11-25 | 15-Second Automatic Fire/Smoke Clearing | AI worker tracks detection timestamps per hazard class and resets `isCurrentlyDetected: false` when fire/smoke is absent for 15s. Camera markers automatically revert to normal without requiring manual operator intervention. | Milestone 8 execution |
| 2026-11-25 | Normalized Konva Floor Plan Reuse | Reused M4 coordinate math and styling inside `CameraSituationFloorPlan.tsx` to maintain exact visual parity between editor and live surveillance situation view without duplicating layout engines. | Milestone 8 execution |
| 2026-11-25 | Multi-Mode CCTV Surveillance Layout | Introduced Split View (default side-by-side), Feeds Grid, and Floor Plan layout options on the existing CCTV Footage Monitoring page with zero disruption to camera playback or stream controls. | Milestone 8 execution |

---

## Known Technical Risks (Active)

| Risk | Status | Action |
|------|--------|--------|
| Fire/smoke model accuracy | ✅ Verified in M6 | Successfully verified on real fire & smoke video footage; confidence threshold tuned to 0.60 |
| ESP32-CAM stream stability | ⏳ To test in M10 | Reconnection retry logic implemented in M6 camera worker |
| Cooldown window tuning | ✅ Verified in M7 | Two-tier deduplication (AI cooldown + backend atomic transaction on incidentGroups) verified with concurrent bursts |
| Email delivery reliability | ✅ Verified in M7 | Non-blocking Nodemailer SMTP integration with mock fallback verified |
| Storage billing dependency | ✅ Mitigated in M7 | Zero cloud storage dependency; local filesystem evidence storage implemented and verified |

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
| M6 | AI Service — Foundation | ⏳ PENDING | — | — | Depends on M5. |
| M7 | Incident Pipeline | ⏳ PENDING | — | — | Depends on M6. |
| M8 | CCTV Monitoring Dashboard | ⏳ PENDING | — | — | Depends on M7. |
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

## M5 Onwards

All subsequent milestones (M6 to M11) remain pending. See `DEVELOPMENT_ROADMAP.md` for full scope, acceptance criteria, and dependencies.

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

---

## Known Technical Risks (Active)

| Risk | Status | Action |
|------|--------|--------|
| Fire/smoke model accuracy | ⏳ To evaluate in M6 | Download and test 2–3 pre-trained YOLOv8 fire/smoke models |
| ESP32-CAM stream stability | ⏳ To test in M10 | Implement reconnection logic in M6 |
| Cooldown window tuning | ⏳ To tune in M7 | Make configurable; adjust during testing |
| Email delivery reliability | ⏳ To evaluate in M7 | Select a reliable transactional email provider |

# EvacAI — Development Roadmap

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development

---

## 1. Development Philosophy

- Each milestone is independently testable and deployable before the next begins.
- Completed features must remain working after each milestone ends.
- The AI service and hardware integration are developed in parallel with the web application where possible.
- Simulated cameras are always available for testing — physical hardware is an overlay, not a dependency.
- No milestone implements UI-only features without backend support. Frontend and backend are developed together.

---

## 2. Milestone Summary

| # | Milestone | Description | Estimated Duration |
|---|-----------|-------------|-------------------|
| M1 | Project Scaffolding | Monorepo structure, tooling, Firebase setup | 1 week |
| M2 | Authentication | Firebase Auth, superadmin/management login, role guards | 1 week |
| M3 | Superadmin — Mall Management | Mall CRUD, management account creation | 1 week |
| M4 | Floor Plan Editor | Interactive canvas, rooms, doors, save/load | 2 weeks |
| M5 | Camera Management | Camera CRUD, floor plan placement, stream config | 1 week |
| M6 | AI Service — Foundation | Python service, OpenCV, YOLO, simulated cameras | 2 weeks |
| M7 | Incident Pipeline | Detection events, deduplication, incident creation, notifications | 1.5 weeks |
| M8 | CCTV Monitoring Dashboard | Live feed viewer, camera status, incident alerts | 1 week |
| M9 | Incident Management | Incident lifecycle UI, evidence viewer, acknowledgement | 1 week |
| M10 | ESP32-CAM Integration | Physical hardware, real stream testing | 1 week |
| M11 | Hardening and Polish | Error states, security review, documentation | 1 week |

**Total estimated duration:** 13–14 weeks

---

## 3. Milestone Details

---

### Milestone 1 — Project Scaffolding

**Scope:**
- Initialize the monorepo with the following structure: `frontend/`, `backend/`, `ai-service/`, `docs/`, `firebase/`.
- Initialize the React Vite project with TypeScript, Tailwind CSS, and shadcn/ui.
- Initialize the Node.js Express project with TypeScript.
- Initialize the Python AI service project with FastAPI.
- Set up `.gitignore` correctly for all three environments.
- Create `.env.example` files for backend and AI service.
- Create a Firebase project (manual step — not code).
- Configure Firebase Realtime Database and Firebase Storage.
- Deploy Firebase Security Rules (initial permissive version for development).
- Configure Firebase Admin SDK credentials in the backend.
- Implement the backend `/health` endpoint.
- Implement the AI service `/health` endpoint.
- Verify frontend dev server runs.
- Verify backend server starts and returns `/health`.

**Dependencies:** None.

**Acceptance Criteria:**
- [ ] `cd frontend && pnpm dev` starts the Vite dev server without errors.
- [ ] `cd backend && npm run dev` starts the Express server without errors.
- [ ] `GET http://localhost:4000/health` returns `{ status: "ok" }`.
- [ ] `cd ai-service && uvicorn main:app` starts FastAPI without errors.
- [ ] `GET http://localhost:8000/health` returns `{ status: "ok" }`.
- [ ] Firebase project is created and Admin SDK initializes without errors.
- [ ] All `.env.example` files are present and documented.
- [ ] All secrets are excluded from version control.

---

### Milestone 2 — Authentication

**Scope:**
- Implement superadmin account creation script (`backend/scripts/create-superadmin.ts`).
- Implement Firebase Auth sign-in in the frontend.
- Implement the `POST /api/auth/verify` backend endpoint.
- Implement backend auth middleware: `verifyFirebaseToken`, `requireRole`, `requireMallAccess`.
- Implement role-based routing in the frontend:
  - Unauthenticated users → Login page.
  - Superadmin → Superadmin dashboard (placeholder).
  - Mall management → Mall dashboard (placeholder).
- Implement `onAuthStateChanged` listener in the frontend.
- Implement automatic token refresh.
- Implement logout functionality.
- Deploy Firebase Security Rules (read-restricted by role).

**Dependencies:** Milestone 1

**Acceptance Criteria:**
- [ ] Running the create-superadmin script creates a superadmin account with correct custom claims.
- [ ] Superadmin can log in and is routed to the superadmin dashboard.
- [ ] A management account (created manually with the Firebase Admin SDK for testing) can log in and is routed to the mall dashboard.
- [ ] An unauthenticated user is redirected to the login page.
- [ ] A superadmin token fails to access mall management endpoints and vice versa (`requireRole` enforced).
- [ ] A management account for Mall A cannot access data for Mall B (`requireMallAccess` enforced).
- [ ] Logout clears the session and redirects to login.

---

### Milestone 3 — Superadmin — Mall Management

**Scope:**
- Implement superadmin dashboard (list of malls, platform stats).
- Implement `GET /api/admin/malls` endpoint.
- Implement `POST /api/admin/malls` endpoint.
- Implement `PATCH /api/admin/malls/{mallId}` endpoint.
- Implement `PATCH /api/admin/malls/{mallId}/status` endpoint (activate/deactivate).
- Implement `POST /api/admin/malls/{mallId}/management-account` endpoint.
- Implement `GET /api/admin/stats` endpoint.
- Implement the superadmin UI: mall list, create mall form, edit mall form, create management account form, activate/deactivate toggle.
- Write `/users/{uid}` metadata on account creation.
- Write `/malls/{mallId}/info` on mall creation.

**Dependencies:** Milestone 2

**Acceptance Criteria:**
- [ ] Superadmin can create a new mall and it appears in the mall list.
- [ ] Superadmin can edit mall name, address, and contact information.
- [ ] Superadmin can create a management account for a mall. The new user can log in.
- [ ] Superadmin can deactivate a mall — the management account can no longer authenticate.
- [ ] Superadmin can reactivate a mall — the management account can authenticate again.
- [ ] Platform statistics (mall count, camera count, incident count) display on the dashboard.
- [ ] A management account that is deactivated cannot access any API endpoint.

---

### Milestone 4 — Floor Plan Editor

**Scope:**
- Implement the interactive floor plan editor using React Konva.
- Features:
  - Draw rectangular rooms by click-drag on the canvas.
  - Select, move, and resize rooms.
  - Name rooms via inline or sidebar input.
  - Add corridors and common areas (same rectangle mechanism, different type).
  - Place entry and exit door markers on room edges.
  - Delete rooms and doors.
  - Save the floor plan via `PUT /api/malls/{mallId}/floorplan`.
  - Load the floor plan via `GET /api/malls/{mallId}/floorplan`.
  - Display an empty canvas with instructions if no floor plan exists.
- Implement backend `GET /api/malls/{mallId}/floorplan` endpoint.
- Implement backend `PUT /api/malls/{mallId}/floorplan` endpoint.
- Implement normalized coordinate storage (0.0–1.0 fractions).

**Note:** Camera placement on the floor plan is implemented in Milestone 5.

**Dependencies:** Milestone 3

**Acceptance Criteria:**
- [ ] Management can open the floor plan editor.
- [ ] Management can draw a room by dragging on the canvas.
- [ ] Rooms can be named, moved, and resized.
- [ ] At least two room types (room, corridor) are distinguishable visually.
- [ ] Entry and exit doors can be placed on room boundaries.
- [ ] Rooms and doors can be deleted.
- [ ] Clicking Save writes the floor plan to Firebase Realtime Database via the backend.
- [ ] Reloading the page restores the saved floor plan correctly.
- [ ] The floor plan renders consistently when the browser window is resized.

---

### Milestone 5 — Camera Management

**Scope:**
- Implement camera CRUD:
  - `POST /api/malls/{mallId}/cameras`
  - `GET /api/malls/{mallId}/cameras`
  - `PATCH /api/malls/{mallId}/cameras/{cameraId}`
  - `DELETE /api/malls/{mallId}/cameras/{cameraId}`
- Implement `GET /api/internal/cameras` (AI service camera list endpoint).
- Implement camera drag-and-drop onto the floor plan canvas.
- Display camera icons on the floor plan.
- Implement camera configuration panel (name, stream URL, stream type).
- Implement camera list page (outside the floor plan editor).
- Delete camera: removes from `/cameras/` and from floor plan placement.
- Display placeholder camera health status (health reporting comes in Milestone 6).

**Dependencies:** Milestone 4

**Acceptance Criteria:**
- [ ] Management can register a new camera with a name, stream type, and stream URL.
- [ ] A registered camera appears in the camera list.
- [ ] Management can drag a camera icon from a panel onto the floor plan canvas.
- [ ] The camera icon is positioned correctly on the canvas after save/reload.
- [ ] Management can update the camera's stream URL.
- [ ] Deleting a camera removes it from both the camera list and the floor plan.
- [ ] `GET /api/internal/cameras` returns all active cameras for all malls (used by AI service).

---

### Milestone 6 — AI Service — Foundation

**Scope:**
- Implement the full Python AI service:
  - Startup: fetch camera list from backend.
  - Per-camera stream reader loop using OpenCV.
  - Simulated camera support (video file loop).
  - Frame sampling at configurable interval.
  - YOLO fire/smoke inference.
  - Confidence threshold filtering.
  - Per-camera cooldown tracking.
  - Snapshot capture.
  - Firebase Storage upload.
  - `POST /api/detection` call to backend.
  - Camera health reporting (`POST /api/internal/camera-health`).
  - `config.yaml` configuration file.
- Implement `POST /api/internal/camera-health` backend endpoint.
- Write camera health to `/malls/{mallId}/cameraHealth/{cameraId}`.
- Download and validate fire/smoke YOLO weights.
- Test with at least one simulated camera and a fire/smoke test video.

**Dependencies:** Milestone 5 (camera CRUD and `/api/internal/cameras` endpoint)

**Acceptance Criteria:**
- [ ] AI service starts and loads camera list from the backend.
- [ ] AI service opens the simulated camera video file and loops it.
- [ ] YOLO inference runs on sampled frames without errors.
- [ ] A detection on the test video triggers a `POST /api/detection` call to the backend.
- [ ] Camera health updates appear in `/malls/{mallId}/cameraHealth/` after the service starts.
- [ ] After the cooldown window, a second detection event is sent for the same camera.
- [ ] AI service logs clearly show: frame sampled, inference result, detection sent, detection deduplicated.

---

### Milestone 7 — Incident Pipeline

**Scope:**
- Implement `POST /api/detection` backend endpoint (full logic):
  - AI service key verification.
  - Camera validation.
  - incidentGroup cooldown check.
  - Incident record creation in Firebase.
  - incidentGroup creation/update.
  - Email notification trigger (Nodemailer).
- Implement incident CRUD backend endpoints:
  - `GET /api/malls/{mallId}/incidents`
  - `GET /api/malls/{mallId}/incidents/{incidentId}`
  - `PATCH /api/malls/{mallId}/incidents/{incidentId}/status`
- Configure Nodemailer (or equivalent) for email dispatch.
- Implement real-time incident listener on the frontend (Firebase onValue).
- Display a notification badge or toast on the management dashboard when a new incident arrives.
- Write to `/malls/{mallId}/notifications/` for in-app notification records.

**Dependencies:** Milestone 6

**Acceptance Criteria:**
- [ ] AI service sends a detection → Backend creates an incident in Firebase Realtime Database.
- [ ] A second detection within the cooldown window does NOT create a new incident.
- [ ] A detection after the cooldown window DOES create a new incident.
- [ ] The snapshot URL in the incident record points to a valid image in Firebase Storage.
- [ ] An email is sent to the mall contact email when a new incident is created.
- [ ] The management dashboard shows a real-time notification within 2 seconds of incident creation (without page refresh).
- [ ] Management can view the list of incidents.
- [ ] Management can view the full detail of an incident including snapshot.
- [ ] Management can change incident status (DETECTED → ACKNOWLEDGED, etc.).

---

### Milestone 8 — CCTV Monitoring Dashboard

**Scope:**
- Implement the camera monitoring dashboard:
  - Camera grid showing all registered cameras.
  - Camera online/offline status badge (from Firebase `cameraHealth`).
  - Camera name and room name display.
  - Click camera → Open camera view modal.
  - Camera view: embed live stream using `<img src="{streamUrl}">` for MJPEG.
  - Loading state while stream is connecting.
  - Disconnected/error state if `<img>` fails to load.
  - Edit stream URL from the camera view modal.
- Implement real-time camera health listener (Firebase `onValue`).

**Dependencies:** Milestone 7

**Acceptance Criteria:**
- [ ] Management dashboard shows all cameras with current online/offline status.
- [ ] Clicking a camera opens a modal with the live MJPEG stream embedded.
- [ ] An offline camera shows a clear disconnected state, not a broken image.
- [ ] Camera status updates in real time when the AI service changes a camera's health status.
- [ ] Management can edit the camera's stream URL from the monitoring view.
- [ ] The floor plan view highlights a camera location when it has an active incident (DETECTED status).

---

### Milestone 9 — Incident Management UI

**Scope:**
- Implement the incident management page:
  - Sortable, filterable incident list (by status, camera, date).
  - Incident card with: type badge, camera, room, timestamp, confidence, status.
  - Incident detail view: snapshot image, bounding box overlay (optional), metadata, timeline of status changes.
  - Status action buttons: Acknowledge, Investigate, Resolve, Mark as False Alarm.
  - Confirm dialog before status transitions.
  - Resolution note input for RESOLVED and FALSE_ALARM.
- Implement incident notification in the navbar (unread count badge).
- Implement mark notification as read.

**Dependencies:** Milestone 7, Milestone 8

**Acceptance Criteria:**
- [ ] Incidents are listed with correct metadata.
- [ ] Filtering by status works correctly.
- [ ] Management can acknowledge an incident and the status updates immediately.
- [ ] Management can resolve an incident with a note.
- [ ] Management can mark an incident as FALSE_ALARM.
- [ ] Invalid status transitions (e.g., RESOLVED → DETECTED) are rejected with a clear error.
- [ ] The snapshot image is displayed in the incident detail view.
- [ ] The incident list updates in real time when a new incident arrives.

---

### Milestone 10 — ESP32-CAM Integration

**Scope:**
- Flash at least one ESP32-CAM with the standard `CameraWebServer` firmware.
- Configure the ESP32-CAM to connect to the local Wi-Fi network.
- Register the ESP32-CAM as a camera in EvacAI with its stream URL.
- Verify the AI service connects to the ESP32-CAM stream using OpenCV.
- Verify detection events arrive from the real camera.
- Verify camera health status correctly reflects ESP32-CAM power on/off.
- Document any stream stability issues encountered.

**Dependencies:** Milestone 6, Milestone 7

**Acceptance Criteria:**
- [ ] ESP32-CAM appears in the camera list as "online" when powered and connected.
- [ ] ESP32-CAM appears as "offline" after being powered off (within health check interval).
- [ ] The live MJPEG stream is viewable in the management dashboard.
- [ ] The AI service processes frames from the ESP32-CAM and generates a detection when test fire footage is played in front of it (or when triggered with a lighter — with appropriate safety precautions).
- [ ] The incident pipeline functions end-to-end with the physical camera.

---

### Milestone 11 — Hardening and Polish

**Scope:**
- Security audit:
  - Verify all API endpoints reject unauthenticated requests.
  - Verify mall isolation (a management account cannot access another mall's data).
  - Review Firebase Security Rules.
  - Verify no credentials in frontend bundle.
- Error handling:
  - Backend: global error handler with consistent error format.
  - Frontend: error boundaries for major sections.
  - AI service: stream reconnection and graceful degradation.
- UX polish:
  - Loading states for all data fetches.
  - Empty states for empty lists.
  - Form validation on all inputs.
  - Responsive layout (desktop-primary is acceptable for MVP).
- Documentation:
  - Update all docs to reflect final implementation.
  - Write a `README.md` with setup and run instructions for each component.
  - Update `MILESTONE_STATUS.md`.

**Dependencies:** All previous milestones

**Acceptance Criteria:**
- [ ] All API endpoints return 401 without auth and 403 for wrong role/mall.
- [ ] No Firebase service account credentials are present in the built frontend bundle.
- [ ] All forms validate inputs and show appropriate error messages.
- [ ] All major sections have loading and empty states.
- [ ] The backend global error handler prevents stack traces from leaking in production responses.
- [ ] README files explain how to run each component from scratch.

---

## 4. Milestone Dependencies Graph

```
M1 (Scaffolding)
  └──► M2 (Authentication)
         └──► M3 (Superadmin)
                └──► M4 (Floor Plan Editor)
                       └──► M5 (Camera Management)
                              ├──► M6 (AI Service)
                              │      └──► M7 (Incident Pipeline)
                              │             ├──► M8 (CCTV Dashboard)
                              │             └──► M9 (Incident UI)
                              │                    └──► M10 (ESP32-CAM) ──► M11 (Hardening)
                              └──► (UI parts of M8 can begin)
```

---

## 5. Technical Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Fire/smoke YOLO model has poor accuracy | Medium | High | Evaluate 2–3 pre-trained models. Plan fine-tuning fallback with D-Fire dataset. |
| ESP32-CAM stream drops frequently | High | Medium | Implement reconnection with exponential backoff. Document known limitations. |
| Firebase Realtime Database query limitations | Low | Medium | Schema designed for direct path access; avoid cross-mall queries. |
| React Konva coordinate system complexity | Medium | Medium | Use normalized (0–1) coordinates from day one. Document clearly. |
| Email delivery failures | Low | Low | Use a transactional email provider (Brevo/Mailgun); log failures in incident record. |
| Local ESP32 IP inaccessible from cloud backend | High | High | AI service runs locally in MVP. Documented and planned. Not a blocker. |
| Cooldown window too short → duplicate incidents | Medium | Medium | Configurable. Tune during Milestone 7 testing. |
| Cooldown window too long → missed re-ignition | Low | High | Log frameCount. Allow management to manually trigger a new incident if needed. |

---

## 6. Items Requiring Approval Before Implementation

| Item | Decision Needed |
|------|-----------------|
| Fire/smoke YOLO model selection | Approve specific weights after evaluation in M6 |
| Email provider | Select from Nodemailer (SMTP), Brevo, Mailgun, or SendGrid |
| Backend hosting platform | Select from Railway, Render, or local (affects M11) |
| Frontend hosting platform | Vercel, Netlify, or Firebase Hosting |
| Default cooldown window duration | Approve 30-second default or specify a different value |
| ESP32-CAM firmware variant | Confirm use of `CameraWebServer` example from Arduino IDE |

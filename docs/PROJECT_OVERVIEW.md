# EvacAI — Project Overview

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development

---

## 1. Product Description

**EvacAI** is an AI-powered Fire and Smoke Detection, CCTV Monitoring, and Incident Management System designed for shopping malls. It combines computer vision, real-time web technologies, and IoT hardware (ESP32-CAM) to deliver an intelligent safety monitoring platform.

The system enables mall management to visually monitor their property through a web dashboard, receive instant alerts when fire or smoke is detected by AI, investigate incidents with captured evidence, and manage their building floor plan with cameras positioned at real-world locations.

A centralized Superadmin layer manages the entire platform — creating mall accounts, configuring tenants, and overseeing platform health.

---

## 2. Functional Requirements

### 2.1 Superadmin

| ID   | Requirement |
|------|-------------|
| SA-01 | Superadmin must be able to log in securely using email and password. |
| SA-02 | Superadmin must be able to view all registered shopping malls. |
| SA-03 | Superadmin must be able to create new shopping mall accounts with name, address, and contact information. |
| SA-04 | Superadmin must be able to edit mall information. |
| SA-05 | Superadmin must be able to create management accounts for a specific mall. |
| SA-06 | Superadmin must be able to activate and deactivate mall accounts. |
| SA-07 | Superadmin must be able to view basic platform statistics (total malls, total cameras, total incidents). |
| SA-08 | There must be no public registration path for the superadmin role. |

### 2.2 Mall Management

| ID   | Requirement |
|------|-------------|
| MM-01 | Mall management must be able to log in securely using email and password. |
| MM-02 | Mall management must only be able to access data belonging to their assigned mall. |
| MM-03 | Mall management must be able to create a building floor plan using an interactive canvas editor. |
| MM-04 | Mall management must be able to draw, name, move, and resize rectangular rooms. |
| MM-05 | Mall management must be able to add corridors and common areas. |
| MM-06 | Mall management must be able to mark entry and exit doors on the floor plan. |
| MM-07 | Mall management must be able to drag and drop camera icons onto the floor plan. |
| MM-08 | Mall management must be able to associate cameras with rooms or general positions. |
| MM-09 | Mall management must be able to configure camera stream URLs and properties. |
| MM-10 | Mall management must be able to view live camera footage. |
| MM-11 | Mall management must be able to view camera connection status (online/offline). |
| MM-12 | Mall management must be able to view fire/smoke incident alerts in real time. |
| MM-13 | Mall management must be able to view incident history with evidence. |
| MM-14 | Mall management must be able to acknowledge, investigate, and resolve incidents. |
| MM-15 | Mall management must receive email notifications when a new incident is detected. |

### 2.3 AI/ML Detection Service

| ID   | Requirement |
|------|-------------|
| AI-01 | The AI service must continuously pull video frames from configured camera streams. |
| AI-02 | The AI service must run fire and smoke object detection on extracted frames. |
| AI-03 | The AI service must generate detection events with confidence scores and timestamps. |
| AI-04 | The AI service must report detection events to the Node.js backend via a secured API. |
| AI-05 | The AI service must support simulated cameras (pre-recorded video files) for testing. |
| AI-06 | The AI service must support live ESP32-CAM HTTP MJPEG streams. |
| AI-07 | The AI service must not produce a new incident for every consecutive frame of the same event. |
| AI-08 | The AI service must be operable independently of whether the web dashboard is open. |

### 2.4 Incident Management

| ID   | Requirement |
|------|-------------|
| IM-01 | The backend must create incident records upon receiving validated detection events. |
| IM-02 | Each incident must record: ID, mall, camera, room, detection type, confidence, timestamp, snapshot, status. |
| IM-03 | Incidents must be deduplicated — one ongoing event must not generate thousands of separate incidents. |
| IM-04 | Incidents must support a defined lifecycle: DETECTED → ACKNOWLEDGED → INVESTIGATING → RESOLVED / FALSE_ALARM. |
| IM-05 | Email notifications must be sent to mall management upon new incident creation. |
| IM-06 | Incident snapshots must be stored in Firebase Storage. |
| IM-07 | Incidents must appear on the management dashboard in real time without page refresh. |

### 2.5 Floor Plan Editor

| ID   | Requirement |
|------|-------------|
| FP-01 | The editor must run entirely in the browser using React Konva. |
| FP-02 | Rooms must be drawable as rectangles and must support naming, moving, and resizing. |
| FP-03 | Corridors and common areas must be representable on the canvas. |
| FP-04 | Entry and exit doors must be placeable on room boundaries. |
| FP-05 | Camera icons must be draggable onto the canvas and repositionable. |
| FP-06 | The floor plan must be saved as structured JSON data to Firebase Realtime Database. |
| FP-07 | The floor plan must reload correctly when the editor is re-opened. |
| FP-08 | The coordinate system must be consistent across different screen sizes (normalized/percentage-based). |
| FP-09 | The design must support future room/camera highlighting for incident visualization. |
| FP-10 | The database schema must support multiple floors without requiring structural changes. |

---

## 3. Non-Functional Requirements

| ID    | Category        | Requirement |
|-------|-----------------|-------------|
| NF-01 | Security        | All API endpoints must require authentication. No unauthenticated access to incident or camera data. |
| NF-02 | Security        | Mall-level data isolation must be enforced server-side, not just on the frontend. |
| NF-03 | Security        | Firebase service account credentials must never be exposed to the browser. |
| NF-04 | Security        | Custom Firebase Auth claims must be verified server-side for every privileged operation. |
| NF-05 | Reliability     | The AI service must continue operating if the web dashboard is closed or unreachable. |
| NF-06 | Reliability     | The system must gracefully handle camera disconnections without crashing. |
| NF-07 | Performance     | Real-time incident updates must reach the dashboard within 2 seconds of backend creation. |
| NF-08 | Performance     | Floor plan operations (save/load) must complete within 3 seconds under normal conditions. |
| NF-09 | Maintainability | Each component (frontend, backend, AI service) must be independently deployable. |
| NF-10 | Maintainability | AI confidence thresholds and processing intervals must be configurable without code changes. |
| NF-11 | Usability       | The system must clearly distinguish between camera registered, camera reachable, and camera streaming. |
| NF-12 | Scalability     | The database schema must not require structural changes to add floors or cameras to a mall. |

---

## 4. MVP Scope

The Minimum Viable Product covers the following:

### In Scope

- Superadmin login and mall/account management.
- Mall management login with strict tenant isolation.
- Interactive floor plan editor (single floor per mall).
- Camera registration, configuration, and placement on the floor plan.
- Simulated camera support (pre-recorded video for AI testing).
- AI fire/smoke detection service running locally.
- Incident creation, deduplication, lifecycle management.
- Incident snapshot storage in Firebase Storage.
- Real-time incident alerts on the management dashboard.
- Email notifications on new incident.
- CCTV monitoring dashboard with live feed viewing.
- Camera online/offline status.

### Not In Scope for MVP

- Multi-floor support (database schema supports it; UI does not implement it).
- Mobile application.
- Hardware smoke/flame sensors.
- Buzzers, LEDs, relay modules.
- Speaker or public announcement integration.
- Automatic evacuation routing.
- ESP32-CAM streams accessed from a remote server (requires tunneling solution — planned for post-MVP).
- Role management beyond superadmin and mall management.
- Advanced analytics and reporting.

---

## 5. Future Scope

The following capabilities are planned for future versions but are explicitly outside MVP:

| Feature | Description |
|---------|-------------|
| Multi-floor support | UI enhancements to manage multiple floors per mall with the existing database schema. |
| Remote ESP32-CAM access | Secure tunneling (e.g., ZeroTier, Tailscale, or custom relay) to allow cloud-hosted AI to access private cameras. |
| Hardware sensor integration | ESP32-based smoke, temperature, and flame sensors reporting through MQTT or HTTP. |
| Automated evacuation routing | Algorithmic escape-route overlay on the floor plan during incidents. |
| Mobile application | React Native companion app for management and notifications. |
| Advanced analytics | Trend analysis, incident frequency heatmaps, camera uptime reports. |
| Multi-tenant analytics | Superadmin-level cross-mall incident statistics and reporting. |
| Integration APIs | Webhooks and third-party integrations for building management systems. |

---

## 6. Glossary

| Term | Definition |
|------|------------|
| **Superadmin** | The platform-level administrator who manages all mall accounts. |
| **Mall Management** | The staff account assigned to a specific shopping mall. |
| **Camera** | A registered video source (simulated or ESP32-CAM) placed on the floor plan. |
| **Floor Plan** | A structured JSON representation of a mall's layout stored in the database. |
| **Incident** | A fire or smoke detection event with associated evidence and lifecycle status. |
| **Detection Event** | A payload sent by the AI service to the backend when fire/smoke is detected. |
| **Cooldown** | A configurable time window preventing duplicate incidents from the same camera. |
| **MJPEG** | Motion JPEG — the streaming format used by ESP32-CAM over HTTP. |
| **Custom Claim** | A Firebase Auth token attribute used to encode role and mall assignment. |

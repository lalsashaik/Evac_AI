# EvacAI — API Contracts

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development

---

## 1. General Conventions

### Base URL

```
Development: http://localhost:4000/api
Production:  https://{backend-domain}/api
```

### Authentication

All endpoints (except `/health` and `/api/detection`) require a Firebase ID token:

```
Authorization: Bearer {firebase-id-token}
```

The `/api/detection` endpoint uses the AI service shared secret:

```
X-AI-Service-Key: {ai-service-secret}
```

### Response Format

All responses are JSON. Success responses follow:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses follow:

```json
{
  "success": false,
  "error": {
    "code": "MALL_NOT_FOUND",
    "message": "The requested mall does not exist."
  }
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (GET, PATCH, PUT) |
| 201 | Created (POST) |
| 400 | Bad request / validation error |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate) |
| 500 | Internal server error |

---

## 2. Auth Endpoints

### `POST /api/auth/verify`

Verifies a Firebase ID token and returns the user's decoded claims. Used by the frontend after sign-in to confirm role and mallId.

**Auth:** Bearer token (Firebase ID token)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "email": "manager@mall.com",
    "role": "mall_management",
    "mallId": "mall_XYZ",
    "isActive": true
  }
}
```

---

## 3. Superadmin — Mall Management Endpoints

> All endpoints in this section require `role: superadmin`.

### `GET /api/admin/malls`

Returns all registered shopping malls.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "malls": [
      {
        "mallId": "mall_XYZ",
        "name": "Sunrise Mall",
        "address": "123 Main St",
        "contactEmail": "admin@sunrisemall.com",
        "contactPhone": "+91-9876543210",
        "isActive": true,
        "createdAt": "2026-11-01T10:00:00.000Z",
        "managementUid": "uid_abc"
      }
    ]
  }
}
```

---

### `POST /api/admin/malls`

Creates a new shopping mall.

**Request body:**
```json
{
  "name": "Sunrise Mall",
  "address": "123 Main St, City",
  "contactEmail": "admin@sunrisemall.com",
  "contactPhone": "+91-9876543210"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "mallId": "mall_XYZ",
    "name": "Sunrise Mall",
    "createdAt": "2026-11-24T10:00:00.000Z"
  }
}
```

---

### `PATCH /api/admin/malls/{mallId}`

Updates mall information.

**Request body** (all fields optional):
```json
{
  "name": "Updated Mall Name",
  "address": "456 New St",
  "contactEmail": "new@mall.com",
  "contactPhone": "+91-1234567890"
}
```

**Response 200:**
```json
{ "success": true, "data": { "mallId": "mall_XYZ", "updatedAt": "..." } }
```

---

### `PATCH /api/admin/malls/{mallId}/status`

Activates or deactivates a mall account.

**Request body:**
```json
{ "isActive": false }
```

**Backend actions:**
1. Updates `/malls/{mallId}/info.isActive`.
2. Calls `admin.auth().updateUser(managementUid, { disabled: !isActive })`.
3. Updates `/users/{managementUid}.isActive`.

**Response 200:**
```json
{ "success": true, "data": { "mallId": "mall_XYZ", "isActive": false } }
```

---

### `POST /api/admin/malls/{mallId}/management-account`

Creates the management user account for a mall.

**Request body:**
```json
{
  "email": "manager@sunrisemall.com",
  "displayName": "Sunrise Mall Management",
  "temporaryPassword": "TempPass@2026"
}
```

**Backend actions:**
1. Creates Firebase Auth user.
2. Sets custom claims: `{ role: "mall_management", mallId }`.
3. Writes `/users/{uid}`.
4. Updates `/malls/{mallId}/info.managementUid`.

**Response 201:**
```json
{
  "success": true,
  "data": {
    "uid": "uid_new",
    "email": "manager@sunrisemall.com",
    "mallId": "mall_XYZ"
  }
}
```

---

### `GET /api/admin/stats`

Returns basic platform statistics.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "totalMalls": 5,
    "activeMalls": 4,
    "totalCameras": 22,
    "totalIncidents": 108
  }
}
```

---

## 4. Mall Management — Floor Plan Endpoints

> All endpoints in this section require `role: mall_management` and mall access to `:mallId`.

### `GET /api/malls/{mallId}/floorplan`

Returns the floor plan for the first (and only MVP) floor.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "floorId": "floor_1",
    "floorName": "Ground Floor",
    "floorNumber": 1,
    "canvasWidth": 1200,
    "canvasHeight": 800,
    "rooms": { ... },
    "doors": { ... },
    "cameras": { ... }
  }
}
```

---

### `PUT /api/malls/{mallId}/floorplan`

Saves the entire floor plan. Replaces the existing floor plan data with the submitted structure.

**Request body:**
```json
{
  "floorName": "Ground Floor",
  "canvasWidth": 1200,
  "canvasHeight": 800,
  "rooms": {
    "room_001": {
      "roomId": "room_001",
      "name": "Food Court",
      "type": "common_area",
      "x": 0.10,
      "y": 0.15,
      "width": 0.25,
      "height": 0.20,
      "fill": "#E8F0FE",
      "stroke": "#4A90E2"
    }
  },
  "doors": { ... },
  "cameras": {
    "cam_001": {
      "cameraId": "cam_001",
      "x": 0.12,
      "y": 0.17,
      "rotation": 45
    }
  }
}
```

**Response 200:**
```json
{ "success": true, "data": { "floorId": "floor_1", "updatedAt": "..." } }
```

---

## 5. Mall Management — Camera Endpoints

### `GET /api/malls/{mallId}/cameras`

Returns all cameras registered for the mall, with health status.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "cameras": [
      {
        "cameraId": "cam_001",
        "name": "Entrance Camera",
        "floorId": "floor_1",
        "roomId": "room_002",
        "streamType": "esp32cam",
        "streamUrl": "http://192.168.1.50/stream",
        "isActive": true,
        "createdAt": "...",
        "updatedAt": "...",
        "health": {
          "status": "online",
          "lastSeenAt": "...",
          "lastFrameAt": "..."
        }
      }
    ]
  }
}
```

---

### `POST /api/malls/{mallId}/cameras`

Registers a new camera.

**Request body:**
```json
{
  "name": "Entrance Camera",
  "floorId": "floor_1",
  "roomId": "room_002",
  "streamType": "simulated",
  "streamUrl": "/videos/cctv_entrance_sample.mp4",
  "isActive": true,
  "x": 0.25,
  "y": 0.20,
  "rotation": 0
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "cameraId": "cam_001",
    "name": "Entrance Camera",
    "mallId": "mall_XYZ",
    "floorId": "floor_1",
    "roomId": "room_002",
    "streamType": "simulated",
    "streamUrl": "/videos/cctv_entrance_sample.mp4",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "...",
    "x": 0.25,
    "y": 0.20,
    "rotation": 0
  }
}
```

---

### `GET /api/malls/{mallId}/cameras/{cameraId}`

Returns details for a single camera, including floor plan coordinates, room name, and health status.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "cameraId": "cam_001",
    "name": "Entrance Camera",
    "mallId": "mall_XYZ",
    "floorId": "floor_1",
    "floorName": "Ground Floor",
    "roomId": "room_002",
    "roomName": "Main Entrance Lobby",
    "streamType": "simulated",
    "streamUrl": "/videos/cctv_entrance_sample.mp4",
    "isActive": true,
    "x": 0.25,
    "y": 0.20,
    "rotation": 0,
    "createdAt": "...",
    "updatedAt": "...",
    "health": {
      "cameraId": "cam_001",
      "status": "online",
      "lastSeenAt": "...",
      "lastFrameAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

### `PATCH /api/malls/{mallId}/cameras/{cameraId}`

Updates camera configuration, including stream URL.

**Request body** (all fields optional):
```json
{
  "name": "Updated Camera Name",
  "streamUrl": "http://192.168.1.55/stream",
  "streamType": "esp32cam",
  "isActive": true
}
```

**Response 200:**
```json
{ "success": true, "data": { "cameraId": "cam_001", "updatedAt": "..." } }
```

---

### `DELETE /api/malls/{mallId}/cameras/{cameraId}`

Removes a camera registration. Also removes the camera's floor plan placement entry.

**Response 200:**
```json
{ "success": true, "data": { "cameraId": "cam_001", "deleted": true } }
```

---

## 6. Mall Management — Incident Endpoints

### `GET /api/malls/{mallId}/incidents`

Returns incidents for the mall, most recent first.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | enum | — | Filter by status |
| `cameraId` | string | — | Filter by camera |
| `limit` | integer | 50 | Maximum results |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "incidents": [
      {
        "incidentId": "inc_001",
        "cameraId": "cam_001",
        "cameraName": "Entrance Camera",
        "detectionType": "fire",
        "confidence": 0.91,
        "detectedAt": "2026-11-24T14:00:00.000Z",
        "status": "DETECTED",
        "evidenceAvailable": true,
        "evidenceEndpoint": "/api/malls/mall_XYZ/incidents/inc_001/evidence",
        "roomName": "Food Court"
      }
    ]
  }
}
```

---

### `GET /api/malls/{mallId}/incidents/{incidentId}`

Returns the full detail of a single incident.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "incidentId": "inc_001",
    "mallId": "mall_XYZ",
    "cameraId": "cam_001",
    "cameraName": "Entrance Camera",
    "floorId": "floor_1",
    "roomId": "room_002",
    "roomName": "Food Court",
    "detectionType": "fire",
    "confidence": 0.91,
    "detectedAt": "2026-11-24T14:00:00.000Z",
    "createdAt": "2026-11-24T14:00:01.000Z",
    "evidenceId": "evt_1795542157045_06fa3d",
    "evidenceFileName": "evt_1795542157045_06fa3d.jpg",
    "evidenceRelativePath": "incidents/mall_XYZ/evt_1795542157045_06fa3d.jpg",
    "evidenceAvailable": true,
    "evidenceEndpoint": "/api/malls/mall_XYZ/incidents/inc_001/evidence",
    "boundingBoxes": [ { "x": 120, "y": 80, "width": 60, "height": 45, "class_name": "fire", "confidence": 0.91 } ],
    "status": "ACKNOWLEDGED",
    "acknowledgedBy": "uid_abc",
    "acknowledgedAt": "2026-11-24T14:05:00.000Z",
    "emailNotificationSent": true
  }
}
```

---

### `PATCH /api/malls/{mallId}/incidents/{incidentId}/status`

Updates the lifecycle status of an incident.

**Request body:**
```json
{
  "status": "ACKNOWLEDGED",
  "resolutionNote": "Optional note for RESOLVED or FALSE_ALARM."
}
```

**Valid transitions:**
```
DETECTED → ACKNOWLEDGED → INVESTIGATING → RESOLVED
DETECTED → FALSE_ALARM
ACKNOWLEDGED → FALSE_ALARM
INVESTIGATING → RESOLVED
INVESTIGATING → FALSE_ALARM
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "incidentId": "inc_001",
    "status": "ACKNOWLEDGED",
    "acknowledgedBy": "uid_abc",
    "acknowledgedAt": "..."
  }
}
```

---

### `GET /api/malls/{mallId}/incidents/{incidentId}/evidence`

Streams the authenticated JPEG evidence snapshot from local storage (`EVACAI_EVIDENCE_DIR`).

**Auth:** Bearer token (Requires `role: mall_management` or `superadmin`, scoped to `:mallId`)

**Response 200:**
- Headers: `Content-Type: image/jpeg`
- Body: Binary JPEG image data

**Response 404:**
```json
{
  "success": false,
  "error": {
    "code": "EVIDENCE_NOT_FOUND",
    "message": "Evidence snapshot file is not found on disk."
  }
}
```

---

### `GET /api/malls/{mallId}/notifications`

Returns in-app notifications for the mall, most recent first.

**Auth:** Bearer token (Requires `role: mall_management` or `superadmin`, scoped to `:mallId`)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "notificationId": "notif_001",
        "type": "incident_detected",
        "incidentId": "inc_001",
        "mallId": "mall_XYZ",
        "message": "FIRE detected in Food Court by Entrance Camera.",
        "createdAt": "2026-11-24T14:00:01.000Z",
        "isRead": false
      }
    ],
    "unreadCount": 1
  }
}
```

---

### `PATCH /api/malls/{mallId}/notifications/{notificationId}/read`

Marks an in-app notification as read.

**Auth:** Bearer token (Requires `role: mall_management` or `superadmin`, scoped to `:mallId`)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "notificationId": "notif_001",
    "isRead": true
  }
}
```

---

## 7. AI Service — Detection Endpoint

> This endpoint is called by the Python AI service, not by the frontend or mall management.

### `POST /api/detection`

Submits a fire/smoke detection event.

**Auth:** `X-AI-Service-Key: {secret}` (not a Firebase token)

**Request body:**
```json
{
  "cameraId": "cam_001",
  "mallId": "mall_XYZ",
  "detectionType": "fire",
  "confidence": 0.91,
  "timestamp": "2026-11-24T14:00:00.000Z",
  "evidenceId": "evt_1795542157045_06fa3d",
  "evidenceFileName": "evt_1795542157045_06fa3d.jpg",
  "evidenceRelativePath": "incidents/mall_XYZ/evt_1795542157045_06fa3d.jpg",
  "boundingBoxes": [
    {
      "x": 120,
      "y": 80,
      "width": 60,
      "height": 45,
      "class_name": "fire",
      "confidence": 0.91
    }
  ]
}
```

**Backend processing:**
1. Verifies `X-AI-Service-Key` header.
2. Validates that `cameraId` exists under `mallId`.
3. Fetches camera metadata (roomId, floorId, name).
4. Checks incidentGroups for active cooldown window.
5. If in cooldown: updates `frameCount`, returns `200 { deduplicated: true }`.
6. If not in cooldown: creates incident record, creates/updates incidentGroup, triggers email.

**Response 201 (new incident):**
```json
{
  "success": true,
  "data": {
    "incidentId": "inc_001",
    "created": true,
    "deduplicated": false
  }
}
```

**Response 200 (deduplicated):**
```json
{
  "success": true,
  "data": {
    "incidentId": "inc_001",
    "created": false,
    "deduplicated": true
  }
}
```

---

## 8. AI Service — Camera Configuration Endpoint

The AI service calls this endpoint at startup to retrieve the list of cameras it should monitor.

### `GET /api/internal/cameras`

**Auth:** `X-AI-Service-Key: {secret}`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "cameras": [
      {
        "cameraId": "cam_001",
        "mallId": "mall_XYZ",
        "streamType": "esp32cam",
        "streamUrl": "http://192.168.1.50/stream",
        "isActive": true
      },
      {
        "cameraId": "cam_002",
        "mallId": "mall_XYZ",
        "streamType": "simulated",
        "streamUrl": "/app/test-videos/fire_test.mp4",
        "isActive": true
      }
    ]
  }
}
```

---

## 9. Health Endpoint

### `GET /health`

No authentication required.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-11-24T14:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 10. Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token / API key |
| `FORBIDDEN` | 403 | Authenticated but lacks permission |
| `MALL_NOT_FOUND` | 404 | Mall ID does not exist |
| `CAMERA_NOT_FOUND` | 404 | Camera ID does not exist |
| `INCIDENT_NOT_FOUND` | 404 | Incident ID does not exist |
| `INVALID_STATUS_TRANSITION` | 400 | The requested status change is not allowed |
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `ACCOUNT_DISABLED` | 403 | The mall or user account is deactivated |
| `INTERNAL_ERROR` | 500 | Unexpected server-side error |

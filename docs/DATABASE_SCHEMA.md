# EvacAI — Database Schema

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development  
> **Database:** Firebase Realtime Database (JSON tree)

---

## 1. Design Principles

1. **Mall-level isolation:** All mall-specific data lives under `/malls/{mallId}/`. Firebase Security Rules enforce read/write access per mallId.
2. **Avoid deep nesting:** Firebase recommends against nesting beyond 3–4 levels for query efficiency. Camera and incident data is flattened relative to mall context.
3. **Denormalize for reads:** Some data is intentionally duplicated (e.g., mallId and cameraName inside an incident record) to avoid multi-path joins at read time.
4. **Future multi-floor support:** Floor plan data is organized under `/malls/{mallId}/floorplans/{floorId}/` so additional floors can be added without schema changes.
5. **Camera health is separated:** Live camera heartbeat/status data is written frequently by the AI service. It is kept under a dedicated node (`cameraHealth`) to avoid mixing volatile data with static camera configuration.
6. **Indexing:** The `.indexOn` rules in security configuration are defined for the most common query patterns.

---

## 2. Full JSON Structure

```json
{
  "users": {
    "{uid}": {
      "email": "string",
      "displayName": "string",
      "role": "superadmin | mall_management",
      "mallId": "string | null",
      "createdAt": "ISO8601",
      "createdBy": "uid",
      "isActive": true
    }
  },

  "malls": {
    "{mallId}": {

      "info": {
        "mallId": "string",
        "name": "string",
        "address": "string",
        "contactEmail": "string",
        "contactPhone": "string",
        "createdAt": "ISO8601",
        "createdBy": "uid",
        "isActive": true,
        "managementUid": "uid"
      },

      "floorplans": {
        "{floorId}": {
          "floorId": "string",
          "floorName": "string",
          "floorNumber": 1,
          "createdAt": "ISO8601",
          "updatedAt": "ISO8601",
          "canvasWidth": 1200,
          "canvasHeight": 800,

          "rooms": {
            "{roomId}": {
              "roomId": "string",
              "name": "string",
              "type": "room | corridor | common_area | stairwell",
              "x": 0.10,
              "y": 0.15,
              "width": 0.25,
              "height": 0.20,
              "fill": "#E8F0FE",
              "stroke": "#4A90E2",
              "createdAt": "ISO8601"
            }
          },

          "doors": {
            "{doorId}": {
              "doorId": "string",
              "type": "entry | exit | internal",
              "roomId": "string",
              "x": 0.22,
              "y": 0.15,
              "rotation": 0,
              "label": "Main Entrance",
              "createdAt": "ISO8601"
            }
          },

          "cameras": {
            "{cameraId}": {
              "cameraId": "string",
              "name": "string",
              "mallId": "string",
              "floorId": "string",
              "roomId": "string | null",
              "x": 0.30,
              "y": 0.22,
              "rotation": 45,
              "streamType": "simulated | esp32cam",
              "streamUrl": "string",
              "isActive": true,
              "createdAt": "ISO8601",
              "updatedAt": "ISO8601"
            }
          }
        }
      },

      "cameras": {
        "{cameraId}": {
          "cameraId": "string",
          "name": "string",
          "mallId": "string",
          "floorId": "string",
          "roomId": "string | null",
          "streamType": "simulated | esp32cam",
          "streamUrl": "string",
          "isActive": true,
          "createdAt": "ISO8601",
          "updatedAt": "ISO8601"
        }
      },

      "cameraHealth": {
        "{cameraId}": {
          "cameraId": "string",
          "status": "online | offline | unknown",
          "lastSeenAt": "ISO8601",
          "lastFrameAt": "ISO8601",
          "updatedAt": "ISO8601"
        }
      },

      "incidents": {
        "{incidentId}": {
          "incidentId": "string",
          "mallId": "string",
          "cameraId": "string",
          "cameraName": "string",
          "floorId": "string",
          "roomId": "string | null",
          "roomName": "string | null",
          "detectionType": "fire | smoke | fire_and_smoke",
          "confidence": 0.87,
          "detectedAt": "ISO8601",
          "createdAt": "ISO8601",
          "snapshotUrl": "string",
          "snapshotPath": "string",
          "status": "DETECTED | ACKNOWLEDGED | INVESTIGATING | RESOLVED | FALSE_ALARM",
          "boundingBoxes": [
            {
              "x": 120,
              "y": 80,
              "width": 60,
              "height": 45,
              "class": "fire",
              "confidence": 0.87
            }
          ],
          "acknowledgedBy": "uid | null",
          "acknowledgedAt": "ISO8601 | null",
          "investigatedBy": "uid | null",
          "investigatedAt": "ISO8601 | null",
          "resolvedBy": "uid | null",
          "resolvedAt": "ISO8601 | null",
          "resolutionNote": "string | null",
          "emailNotificationSent": true,
          "lastStatusChangedAt": "ISO8601"
        }
      },

      "incidentGroups": {
        "{groupKey}": {
          "groupKey": "string",
          "cameraId": "string",
          "detectionType": "fire | smoke",
          "activeIncidentId": "string",
          "firstDetectedAt": "ISO8601",
          "lastDetectedAt": "ISO8601",
          "cooldownExpiresAt": "ISO8601",
          "frameCount": 12
        }
      },

      "notifications": {
        "{notificationId}": {
          "notificationId": "string",
          "type": "incident_detected",
          "incidentId": "string",
          "mallId": "string",
          "message": "string",
          "createdAt": "ISO8601",
          "isRead": false
        }
      }
    }
  },

  "platformStats": {
    "totalMalls": 5,
    "activeMalls": 4,
    "totalCameras": 22,
    "totalIncidents": 108,
    "updatedAt": "ISO8601"
  }
}
```

---

## 3. Entity Descriptions

### 3.1 `users/{uid}`

Stores metadata for all platform users. The UID is the Firebase Auth UID.

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | User's email address (mirrors Firebase Auth). |
| `displayName` | string | Display name. |
| `role` | enum | `superadmin` or `mall_management`. Must match Firebase Auth custom claims. |
| `mallId` | string\|null | The mall this user belongs to. `null` for superadmin. |
| `createdAt` | ISO8601 | Account creation timestamp. |
| `createdBy` | uid | UID of the superadmin who created this account. |
| `isActive` | boolean | Whether this account is enabled. |

> **Important:** This node mirrors custom claims. It is used for display and audit purposes. Authorization always uses the verified Firebase Auth token claims, not this node.

---

### 3.2 `malls/{mallId}/info`

Top-level mall metadata.

| Field | Type | Description |
|-------|------|-------------|
| `mallId` | string | Auto-generated Firebase push key or UUID. |
| `name` | string | Shopping mall name. |
| `address` | string | Physical address. |
| `contactEmail` | string | Contact email for notifications. |
| `contactPhone` | string | Contact phone number. |
| `isActive` | boolean | Whether the mall account is active. |
| `managementUid` | uid | The Firebase Auth UID of the management account. |

---

### 3.3 `malls/{mallId}/floorplans/{floorId}`

Floor plan container. Each mall has one floor in MVP; schema supports multiple.

| Field | Type | Description |
|-------|------|-------------|
| `floorId` | string | Unique floor identifier (e.g., `floor_1`). |
| `floorName` | string | Human-readable name (e.g., "Ground Floor"). |
| `floorNumber` | integer | Numeric floor level (0 = ground, 1 = first, etc.). |
| `canvasWidth` | integer | Reference canvas width used during design. |
| `canvasHeight` | integer | Reference canvas height used during design. |

---

### 3.4 `malls/{mallId}/floorplans/{floorId}/rooms/{roomId}`

A single room, corridor, or area on the floor plan.

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `room`, `corridor`, `common_area`, `stairwell`. |
| `x`, `y` | float (0–1) | Normalized position (percentage of canvas dimensions). |
| `width`, `height` | float (0–1) | Normalized size. |
| `fill` | hex color | Background color for display. |
| `stroke` | hex color | Border color. |

> **Coordinate System:** All positions and dimensions are stored as fractions of the canvas (0.0 – 1.0). At render time, multiply by the actual canvas pixel dimensions. This ensures the floor plan renders correctly on any screen size.

---

### 3.5 `malls/{mallId}/floorplans/{floorId}/doors/{doorId}`

An entry, exit, or internal door placed on a room boundary.

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `entry`, `exit`, `internal`. |
| `roomId` | string | The room this door belongs to. |
| `x`, `y` | float (0–1) | Normalized position on the canvas. |
| `rotation` | integer | Degrees of rotation (0, 90, 180, 270). |
| `label` | string | Optional display label. |

---

### 3.6 `malls/{mallId}/floorplans/{floorId}/cameras/{cameraId}`

Camera position within the floor plan canvas (display/layout data).

> **Note:** This node stores position data for the floor plan editor. The authoritative camera configuration (stream URL, type, active status) is in `malls/{mallId}/cameras/{cameraId}`.

| Field | Type | Description |
|-------|------|-------------|
| `x`, `y` | float (0–1) | Normalized position on the canvas. |
| `rotation` | integer | Camera icon rotation on the canvas. |

---

### 3.7 `malls/{mallId}/cameras/{cameraId}`

Authoritative camera configuration record.

| Field | Type | Description |
|-------|------|-------------|
| `cameraId` | string | Unique identifier (also used as AI service reference). |
| `streamType` | enum | `simulated` or `esp32cam`. |
| `streamUrl` | string | Full URL to the camera stream. |
| `isActive` | boolean | Whether the camera should be monitored by the AI service. |

---

### 3.8 `malls/{mallId}/cameraHealth/{cameraId}`

Live camera status written by the AI service. Separated from configuration for high write frequency.

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `online`, `offline`, `unknown`. |
| `lastSeenAt` | ISO8601 | Last time the AI service successfully connected. |
| `lastFrameAt` | ISO8601 | Last time a valid frame was extracted. |

---

### 3.9 `malls/{mallId}/incidents/{incidentId}`

A fire or smoke detection incident.

| Field | Type | Description |
|-------|------|-------------|
| `detectionType` | enum | `fire`, `smoke`, `fire_and_smoke`. |
| `confidence` | float | Highest confidence score from detection (0.0–1.0). |
| `status` | enum | `DETECTED`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`, `FALSE_ALARM`. |
| `snapshotUrl` | string | Public Firebase Storage download URL. |
| `snapshotPath` | string | Firebase Storage path (for admin deletion). |
| `boundingBoxes` | array | YOLO detection bounding boxes in the original frame pixels. |
| `emailNotificationSent` | boolean | Whether the email notification was successfully sent. |

---

### 3.10 `malls/{mallId}/incidentGroups/{groupKey}`

Deduplication tracking record. Groups consecutive detections from the same camera of the same type.

| Field | Type | Description |
|-------|------|-------------|
| `groupKey` | string | Composite key: `{cameraId}_{detectionType}`. |
| `activeIncidentId` | string | The incident currently representing this ongoing event. |
| `cooldownExpiresAt` | ISO8601 | New incidents are suppressed until this time. |
| `frameCount` | integer | How many frames have been grouped into this incident. |

---

## 4. Relationships and References

```
users/{uid}
  └── mallId ─────────────────────► malls/{mallId}

malls/{mallId}/info
  └── managementUid ───────────────► users/{uid}

malls/{mallId}/floorplans/{floorId}/rooms/{roomId}
  └── (referenced by cameras and doors)

malls/{mallId}/floorplans/{floorId}/cameras/{cameraId}
  └── cameraId ────────────────────► malls/{mallId}/cameras/{cameraId}

malls/{mallId}/cameras/{cameraId}
  └── roomId ──────────────────────► malls/{mallId}/floorplans/{floorId}/rooms/{roomId}

malls/{mallId}/incidents/{incidentId}
  ├── cameraId ────────────────────► malls/{mallId}/cameras/{cameraId}
  ├── roomId ──────────────────────► malls/{mallId}/floorplans/{floorId}/rooms/{roomId}
  └── floorId ─────────────────────► malls/{mallId}/floorplans/{floorId}

malls/{mallId}/incidentGroups/{groupKey}
  └── activeIncidentId ────────────► malls/{mallId}/incidents/{incidentId}
```

---

## 5. Query and Indexing Strategy

### 5.1 Common Queries

| Query | Firebase Path | Filter |
|-------|---------------|--------|
| All incidents for a mall | `/malls/{mallId}/incidents` | — |
| Active (unresolved) incidents | `/malls/{mallId}/incidents` | `orderByChild("status").equalTo("DETECTED")` |
| Incidents by camera | `/malls/{mallId}/incidents` | `orderByChild("cameraId").equalTo(cameraId)` |
| Incidents by date | `/malls/{mallId}/incidents` | `orderByChild("detectedAt").limitToLast(50)` |
| Camera health for all cameras | `/malls/{mallId}/cameraHealth` | — |
| All cameras for a mall | `/malls/{mallId}/cameras` | — |

### 5.2 Required `.indexOn` Rules

```json
{
  "rules": {
    "malls": {
      "$mallId": {
        "incidents": {
          ".indexOn": ["status", "cameraId", "detectedAt", "detectionType"]
        },
        "cameras": {
          ".indexOn": ["isActive", "floorId"]
        },
        "cameraHealth": {
          ".indexOn": ["status"]
        }
      }
    }
  }
}
```

---

## 6. Denormalization Decisions

| Denormalized Field | Location | Source | Reason |
|--------------------|----------|--------|--------|
| `cameraName` | `incidents/{id}` | `cameras/{id}.name` | Avoids a second read when displaying incident list |
| `roomName` | `incidents/{id}` | `rooms/{id}.name` | Avoids floor plan join when displaying incident list |
| `mallId` | `incidents/{id}` | Caller context | Enables direct query and security rule check |
| `floorId` | `incidents/{id}` | Camera record | Enables incident-to-floor-plan mapping |
| Camera position | `floorplans/.../cameras/` AND `cameras/` | Same entity | Floor plan node holds layout data; cameras node holds config |

---

## 7. Firebase Storage Structure

```
gs://{project-id}.appspot.com/
└── incidents/
    └── {mallId}/
        └── {incidentId}/
            └── snapshot.jpg
```

Each incident stores exactly one snapshot image. The path is deterministic given `mallId` and `incidentId`, making cleanup straightforward.

---

## 8. Data Lifecycle and Cleanup

| Entity | Lifecycle |
|--------|-----------|
| `users` | Created by superadmin. Soft-deleted by setting `isActive: false` and disabling Firebase Auth account. |
| `malls` | Created by superadmin. Deactivated with `isActive: false`. Not hard-deleted in MVP. |
| `cameras` | Created/deleted by mall management via backend. Deletion also removes floor plan placement entry. |
| `incidents` | Never deleted in MVP (audit trail). Status transitions managed by management. |
| `incidentGroups` | Backend cleans up stale groups after cooldown window expires. |
| `cameraHealth` | Overwritten on every AI heartbeat. No accumulation. |
| `notifications` | Marked as read by frontend. Not deleted in MVP. |

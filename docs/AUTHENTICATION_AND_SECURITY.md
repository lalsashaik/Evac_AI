# EvacAI — Authentication and Security

> **Document Version:** 1.0  
> **Date:** 2026-11-24  
> **Status:** Approved for Development

---

## 1. Authentication Overview

EvacAI uses **Firebase Authentication** as the identity provider for all human users. The Python AI service uses a separate shared secret mechanism — it is a trusted internal service, not a user.

```
                 ┌────────────────────────────────┐
                 │      Firebase Authentication    │
                 │  - Email/password sign-in       │
                 │  - Issues Firebase ID tokens    │
                 │  - Supports custom claims       │
                 └────────────┬───────────────────┘
                              │
              ┌───────────────┼────────────────────┐
              ▼               ▼                    ▼
       Superadmin        Mall Management       AI Service
       (email/pwd)       (email/pwd)           (API key — not user auth)
              │               │
              ▼               ▼
       Firebase ID Token (JWT)
              │
              ▼
       Sent as Bearer token to Node.js Backend
              │
              ▼
       Backend verifies token + reads custom claims
```

---

## 2. User Roles and Account Creation

### 2.1 Superadmin

- **Creation:** The superadmin account is created manually by a developer using the Firebase Admin SDK or the Firebase Console **before the system goes live**. There is **no public registration path**.
- **Custom Claim:** `{ role: "superadmin", mallId: null }`
- **Account count:** Exactly one in MVP.
- **Access:** Can access all mall data, create new malls, create management accounts, and manage the platform.

**Manual creation script (run once):**
```
backend/scripts/create-superadmin.ts (not part of the web application)
```

This script:
1. Calls `admin.auth().createUser({ email, password })`.
2. Calls `admin.auth().setCustomUserClaims(uid, { role: "superadmin", mallId: null })`.
3. Writes a matching record to `/users/{uid}` in Firebase Realtime Database.

---

### 2.2 Mall Management Account

- **Creation:** Created by the superadmin through the web application.
- **Custom Claim:** `{ role: "mall_management", mallId: "{mallId}" }`
- **Access:** Can only access data for their assigned mall.

**Creation flow (via backend API):**
```
Superadmin → POST /api/admin/malls/{mallId}/management-account
  Body: { email, displayName, temporaryPassword }
  
Backend:
  1. Verifies caller is superadmin (custom claims).
  2. Calls admin.auth().createUser({ email, password }).
  3. Calls admin.auth().setCustomUserClaims(uid, { role: "mall_management", mallId }).
  4. Writes record to /users/{uid}.
  5. Writes managementUid to /malls/{mallId}/info.
  6. Returns { uid, email }.
```

---

## 3. Firebase Custom Claims Strategy

Custom claims are stored in the Firebase ID token and are used for authorization on the backend.

| Claim | Superadmin | Mall Management |
|-------|-----------|-----------------|
| `role` | `"superadmin"` | `"mall_management"` |
| `mallId` | `null` | `"{mallId}"` (assigned mall) |

### 3.1 Why Custom Claims?

- Claims are part of the signed Firebase JWT — they cannot be forged by the client.
- The backend reads claims from the verified token without an extra database lookup.
- Security rules can also read custom claims for client-side Firebase access control.

### 3.2 When Claims Take Effect

Custom claims become active when the Firebase ID token is refreshed (up to 1 hour). After setting claims, the backend should respond with a flag prompting the frontend to call `user.getIdToken(true)` to force a token refresh.

---

## 4. Backend Authentication Middleware

Every protected API endpoint passes through authentication middleware:

```
Request → verifyFirebaseToken() → extractClaims() → authorizeRole() → handler()
```

### 4.1 `verifyFirebaseToken` Middleware

```
1. Extract Authorization header: "Bearer {idToken}"
2. Call admin.auth().verifyIdToken(idToken)
   - Verifies signature against Firebase public keys.
   - Checks token expiry.
   - Returns decoded token with claims.
3. Attach decoded token to request context.
4. If verification fails → respond 401 Unauthorized.
```

### 4.2 `requireRole` Middleware

```
requireRole("superadmin"):
  - Checks decoded.role === "superadmin"
  - Else → 403 Forbidden

requireRole("mall_management"):
  - Checks decoded.role === "mall_management"
  - Checks decoded.mallId is defined
  - Else → 403 Forbidden
```

### 4.3 `requireMallAccess` Middleware

```
For any endpoint operating on {mallId}:
  - If role is superadmin → allow (superadmin can access any mall).
  - If role is mall_management:
      - Compare decoded.mallId with request param :mallId
      - If mismatch → 403 Forbidden
```

This is the core tenant isolation mechanism. It ensures management cannot access a different mall's data even if they know another mall's ID.

---

## 5. AI Service Authentication

The AI service is an internal trusted service, not a user. It does not use Firebase Auth tokens.

**Authentication mechanism:** Shared secret (API key).

```
AI Service → POST /api/detection
  Header: X-AI-Service-Key: {secret}
  
Backend:
  - Reads process.env.AI_SERVICE_SECRET
  - Compares constant-time against incoming header value
  - If mismatch → 401 Unauthorized
```

**Security considerations:**
- The secret is a randomly generated 256-bit token stored in both `.env` files.
- The secret is never committed to version control.
- In production, this should be rotated periodically.
- The endpoint `/api/detection` only accepts this header — Firebase ID tokens are not checked on this route.

---

## 6. Firebase Realtime Database Security Rules

Security rules enforce access control for **direct Firebase client SDK access** (frontend reads). Backend Admin SDK bypasses these rules.

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && (auth.token.role === 'superadmin' || auth.uid === $uid)",
        ".write": false
      }
    },

    "malls": {
      "$mallId": {

        "info": {
          ".read": "auth != null && (auth.token.role === 'superadmin' || auth.token.mallId === $mallId)",
          ".write": false
        },

        "floorplans": {
          ".read": "auth != null && (auth.token.role === 'superadmin' || auth.token.mallId === $mallId)",
          ".write": false
        },

        "cameras": {
          ".read": "auth != null && (auth.token.role === 'superadmin' || auth.token.mallId === $mallId)",
          ".write": false
        },

        "cameraHealth": {
          ".read": "auth != null && (auth.token.role === 'superadmin' || auth.token.mallId === $mallId)",
          ".write": false
        },

        "incidents": {
          ".read": "auth != null && (auth.token.role === 'superadmin' || auth.token.mallId === $mallId)",
          ".write": false,

          ".indexOn": ["status", "cameraId", "detectedAt", "detectionType"]
        },

        "notifications": {
          ".read": "auth != null && auth.token.mallId === $mallId",
          ".write": false
        }
      }
    },

    "platformStats": {
      ".read": "auth != null && auth.token.role === 'superadmin'",
      ".write": false
    }
  }
}
```

**Key rule decisions:**
- All client writes are set to `false`. All writes go through the backend (Admin SDK).
- Mall management can only read data where `auth.token.mallId === $mallId`.
- Superadmin can read all mall data.
- `platformStats` is superadmin-only.
- Camera health is readable by management (for live status display) but only writable by the backend.

---

## 7. Firebase Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Incident snapshots: readable by authenticated users with correct mallId
    match /incidents/{mallId}/{incidentId}/{fileName} {
      allow read: if request.auth != null &&
                     (request.auth.token.role == 'superadmin' ||
                      request.auth.token.mallId == mallId);
      allow write: false; // Only backend/AI service can write (via Admin SDK)
    }

    // Deny all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 8. Mall-Level Data Isolation Summary

| Layer | Enforcement Mechanism |
|-------|-----------------------|
| **Firebase Auth custom claims** | `mallId` claim embedded in signed JWT, cannot be forged. |
| **Backend middleware** | `requireMallAccess` compares `decoded.mallId` with `:mallId` route param on every request. |
| **Firebase Security Rules** | Client reads restricted to matching `auth.token.mallId === $mallId`. |
| **Firebase Storage Rules** | Snapshot access restricted to matching mall ID in storage path. |

No single layer is relied upon alone. If one layer is misconfigured, other layers continue to enforce isolation.

---

## 9. Environment Variables and Secret Management

### Backend (`.env`)

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_DATABASE_URL=
FIREBASE_STORAGE_BUCKET=
AI_SERVICE_SECRET=
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
PORT=4000
```

### AI Service (`.env`)

```
BACKEND_API_URL=http://localhost:4000
AI_SERVICE_SECRET=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
```

**Rules:**
- `.env` files are listed in `.gitignore` and never committed.
- `.env.example` files with blank values are committed as templates.
- The Firebase service account JSON is not used as a file in production — values are loaded from environment variables individually.

---

## 10. Account Activation and Deactivation

**Deactivating a mall management account:**
```
Superadmin → PATCH /api/admin/malls/{mallId}/status  { isActive: false }

Backend:
  1. Calls admin.auth().updateUser(managementUid, { disabled: true })
  2. Updates /malls/{mallId}/info.isActive = false
  3. Updates /users/{managementUid}.isActive = false
```

A disabled Firebase Auth account cannot obtain a new ID token. Existing tokens expire within 1 hour. The backend also checks `isActive` in custom claims on each request where this matters.

---

## 11. Security Checklist

| Item | Status |
|------|--------|
| All API routes require auth (except `/health`) | Required |
| Token verified server-side on every request | Required |
| Role checked from token claims, not request body | Required |
| Mall isolation enforced per request | Required |
| No Firebase credentials in frontend code | Required |
| AI service uses separate secret, not user tokens | Required |
| `.env` files excluded from git | Required |
| Firebase Security Rules restrict client writes | Required |
| Storage rules enforce mall-level access | Required |
| Superadmin created via script, no public registration | Required |

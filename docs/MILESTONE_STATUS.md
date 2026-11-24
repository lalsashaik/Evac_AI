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
| M2 | Authentication | ⏳ PENDING | — | — | Depends on M1. |
| M3 | Superadmin — Mall Management | ⏳ PENDING | — | — | Depends on M2. |
| M4 | Floor Plan Editor | ⏳ PENDING | — | — | Depends on M3. |
| M5 | Camera Management | ⏳ PENDING | — | — | Depends on M4. |
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

## M1 Onwards

All subsequent milestones are pending. See `DEVELOPMENT_ROADMAP.md` for full scope, acceptance criteria, and dependencies.

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

---

## Known Technical Risks (Active)

| Risk | Status | Action |
|------|--------|--------|
| Fire/smoke model accuracy | ⏳ To evaluate in M6 | Download and test 2–3 pre-trained YOLOv8 fire/smoke models |
| ESP32-CAM stream stability | ⏳ To test in M10 | Implement reconnection logic in M6 |
| Cooldown window tuning | ⏳ To tune in M7 | Make configurable; adjust during testing |
| Email delivery reliability | ⏳ To evaluate in M7 | Select a reliable transactional email provider |

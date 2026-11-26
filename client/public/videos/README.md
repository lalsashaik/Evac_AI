# EvacAI — CCTV Simulation Sample Videos

This directory holds local static video assets for simulated CCTV camera feeds in EvacAI.

## Bundled Sample Videos

The following sample videos are bundled with the repository for development, college project demos, and evaluation without physical camera hardware:

1. `cctv_entrance_sample.mp4` — Bundled sample video for Main Entrance / Lobby CCTV feeds (normal surveillance).
2. `cctv_corridor_sample.mp4` — Bundled sample video for Corridor / Hallway CCTV feeds (normal surveillance).
3. `cctv_foodcourt_sample.mp4` — Bundled sample video for Food Court / Retail Area CCTV feeds (normal surveillance).
4. `cctv_fire_sample.mp4` — Bundled fire hazard sample video for AI fire detection testing (M6).
5. `cctv_smoke_sample.mp4` — Bundled smoke hazard sample video for AI smoke detection testing (M6).

## How to Add Your Own Sample Videos

1. Drop any browser-compatible video file (`.mp4` encoded with H.264/AAC, or `.webm` with VP8/VP9) into this `client/public/videos/` directory.
   - Example: `client/public/videos/my_custom_cctv.mp4`
2. In the EvacAI Camera Management interface:
   - When creating or editing a camera, set **Source Type** to **Simulated (Prerecorded Video)**.
   - In the video selection, choose **Custom Video URL / Path** and enter:
     `/videos/my_custom_cctv.mp4`
3. Click **Save Camera**. The feed will now load and simulate surveillance streaming in real time.

## Note on Video Storage

Video files are served as static frontend assets from Vite/public and are **never** stored inside the Firebase Realtime Database. Only the reference URL/path (e.g. `/videos/cctv_entrance_sample.mp4`) is persisted in the database schema.

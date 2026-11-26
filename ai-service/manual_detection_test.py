"""
EvacAI — Manual AI Detection Tester CLI
Run this script to manually evaluate fire & smoke detection on any video or image.

Usage:
    npm run test:manual -- --source client/public/videos/cctv_fire_sample.mp4 --conf 0.60
    npm run test:manual -- --source client/public/videos/cctv_smoke_sample.mp4 --conf 0.50
    npm run test:manual -- --source client/public/videos/cctv_corridor_sample.mp4 --conf 0.60

Or directly:
    ai-service\\venv\\Scripts\\python.exe ai-service\\manual_detection_test.py client/public/videos/cctv_fire_sample.mp4 0.60 20
"""
import os
import sys
import time
import argparse
from pathlib import Path

# Add ai-service to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import cv2
from app.config import settings
from app.services.detector import detector

def resolve_path(source_str: str) -> str:
    if os.path.exists(source_str):
        return os.path.abspath(source_str)
    
    clean = source_str.lstrip("/\\")
    candidates = [
        os.path.join(settings.workspace_root, clean),
        os.path.join(settings.workspace_root, "client", "public", clean),
        os.path.join(settings.workspace_root, "client", "public", "videos", os.path.basename(source_str)),
        os.path.join(settings.workspace_root, "client", "dist", clean),
        os.path.join(settings.workspace_root, "client", "dist", "videos", os.path.basename(source_str)),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return source_str

def main():
    parser = argparse.ArgumentParser(description="EvacAI Manual YOLOv8 Fire & Smoke Tester")
    parser.add_argument("positional_source", nargs="?", default=None, help="Optional positional video/image source path")
    parser.add_argument("positional_conf", nargs="?", type=float, default=None, help="Optional positional confidence (0.10 to 0.95)")
    parser.add_argument("positional_max_frames", nargs="?", type=int, default=None, help="Optional positional max frames")
    parser.add_argument("--source", "-s", type=str, default=None, help="Video or image path")
    parser.add_argument("--conf", "-c", type=float, default=None, help="Confidence threshold (0.10 to 0.95)")
    parser.add_argument("--max-frames", "-m", type=int, default=None, help="Max frames to process")
    parser.add_argument("--sample-step", type=int, default=5, help="Step between sampled frames")
    parser.add_argument("--save-evidence", type=str, default="evidence/manual_test_result.jpg", help="Where to save annotated frame")
    
    # Use parse_known_args to gracefully handle any extra positional args passed by npm or PowerShell
    args, unknown = parser.parse_known_args()

    effective_source = args.source or args.positional_source or "/videos/cctv_fire_sample.mp4"
    effective_conf = args.conf if args.conf is not None else (args.positional_conf if args.positional_conf is not None else 0.60)
    effective_max_frames = args.max_frames if args.max_frames is not None else (args.positional_max_frames if args.positional_max_frames is not None else 60)

    # Handle any unknown positional args (e.g. if npm or powershell passed extra tokens)
    for extra in unknown:
        try:
            val = float(extra)
            if 0.0 < val < 1.0:
                effective_conf = val
            elif val >= 1.0:
                effective_max_frames = int(val)
        except ValueError:
            if not args.source and not args.positional_source:
                effective_source = extra

    print("\n" + "=" * 65)
    print("        EvacAI — Manual AI Detection Model Verification        ")
    print("=" * 65)

    if not detector.is_loaded:
        print(f"❌ Error: Model failed to load from {detector.model_path}")
        print(f"Details: {detector.load_error}")
        return

    info = detector.get_info()
    print(f"✅ Model: {os.path.basename(info['model_path'])}")
    print(f"✅ Framework: {info['framework']}")
    print(f"✅ Classes: {info['classes']}")
    print(f"✅ Confidence Threshold: {effective_conf * 100:.1f}%")

    target_path = resolve_path(effective_source)
    print(f"📁 Target video source: {target_path}")

    cap = cv2.VideoCapture(target_path)
    if not cap.isOpened():
        print(f"❌ Failed to open video source: {target_path}")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"🎥 Video Resolution: {width}x{height} | FPS: {fps:.1f} | Total Frames: {total_frames}")
    print("-" * 65)

    analyzed = 0
    fire_count = 0
    smoke_count = 0
    highest_conf = 0.0
    latencies = []
    saved_snapshot = False

    out_save_path = os.path.join(str(BASE_DIR), args.save_evidence)
    os.makedirs(os.path.dirname(out_save_path), exist_ok=True)

    frame_idx = 0
    while cap.isOpened() and analyzed < effective_max_frames and frame_idx < total_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % args.sample_step == 0:
            analyzed += 1
            t0 = time.perf_counter()
            detections = detector.detect(frame, conf_threshold=effective_conf)
            t_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(t_ms)

            time_pos_sec = frame_idx / max(1.0, fps)

            if detections:
                det_strs = []
                for d in detections:
                    cls_name = d["class_name"].upper()
                    conf = d["confidence"]
                    if conf > highest_conf:
                        highest_conf = conf

                    if "FIRE" in cls_name:
                        fire_count += 1
                        det_strs.append(f"FIRE ({conf * 100:.1f}%)")
                    else:
                        smoke_count += 1
                        det_strs.append(f"SMOKE ({conf * 100:.1f}%)")

                det_repr = ", ".join(det_strs)
                print(f"  Frame {frame_idx:4d} [{time_pos_sec:5.2f}s]: ⚠️  Detections: {det_repr} | Box: {detections[0]['box_xyxy']} ({t_ms:.1f} ms)")

                # Save the first detected evidence frame
                if not saved_snapshot:
                    annotated = detector.annotate_frame(frame, detections, camera_id="manual_test")
                    cv2.imwrite(out_save_path, annotated)
                    saved_snapshot = True
            else:
                print(f"  Frame {frame_idx:4d} [{time_pos_sec:5.2f}s]: 🟢 Clear (No fire/smoke) ({t_ms:.1f} ms)")

        frame_idx += 1

    cap.release()

    avg_ms = sum(latencies) / len(latencies) if latencies else 0.0

    print("=" * 65)
    print("                      DETECTION SUMMARY                         ")
    print("=" * 65)
    print(f"  Total Frames Analyzed : {analyzed}")
    print(f"  Fire Detections       : {fire_count}")
    print(f"  Smoke Detections      : {smoke_count}")
    print(f"  Highest Confidence    : {highest_conf * 100:.1f}%")
    print(f"  Average Inference Time: {avg_ms:.1f} ms (~{1000.0 / max(1.0, avg_ms):.1f} FPS on CPU)")
    if saved_snapshot:
        print(f"  Annotated Snapshot    : {out_save_path}")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    main()

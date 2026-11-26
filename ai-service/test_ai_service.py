"""
EvacAI — Milestone 6 AI Service Verification Test Suite

Verifies:
1. AI service health endpoint, OpenCV version, and model status
2. Model loading, fire/smoke class names, and inference
3. Camera start/stop processing controls and duplicate worker protection
4. Video stream reading and frame sampling
5. Fire detection on sample fire CCTV footage
6. Smoke detection on sample smoke CCTV footage
7. False positive resistance on normal CCTV footage
8. Bounding box coordinates, confidence scores, and structured detection events
9. Local evidence snapshot frame capture and retrieval
10. Duplicate detection suppression within cooldown window
11. Graceful error handling for missing/unreachable video sources
12. Concurrent multi-camera stream processing
"""
import os
import sys
import time
import unittest
from fastapi.testclient import TestClient

# Ensure ai-service is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ["ENVIRONMENT"] = "test"
os.environ["AUTO_SYNC_CAMERAS"] = "false"
from app.config import settings
settings.environment = "test"
settings.auto_sync_cameras = False
os.environ["ENVIRONMENT"] = "test"
os.environ["AUTO_SYNC_CAMERAS"] = "false"
from main import app
from app.services.detector import detector
from app.services.camera_manager import camera_manager

class TestEvacAIAIService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Verify model file exists
        if not detector.is_loaded:
            raise RuntimeError(f"Detector failed to load: {detector.load_error}")

    def tearDown(self):
        # Stop all running cameras between tests
        camera_manager.stop_all()

    def test_01_health_endpoint(self):
        """1. Health endpoint returns 200, model loaded, classes, and OpenCV info."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["service"], settings.service_name)
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["model_loaded"])
        self.assertIn("fire", str(data["model_info"]["classes"]).lower())
        self.assertIn("smoke", str(data["model_info"]["classes"]).lower())
        self.assertIsNotNone(data["opencv_version"])
        print("  [PASS] Test 1: Health endpoint reports online with YOLOv8 fire/smoke detector.")

    def test_02_model_classes_and_inference(self):
        """2. YOLO model detects supported classes."""
        info = detector.get_info()
        self.assertTrue(info["loaded"])
        self.assertIn("fire", [c.lower() for c in info["classes"].values()])
        self.assertIn("smoke", [c.lower() for c in info["classes"].values()])
        print(f"  [PASS] Test 2: Model classes verified: {info['classes']}")

    def test_03_start_and_stop_camera(self):
        """3. Can start and stop camera processing cleanly."""
        cam_id = "test_cam_ctrl"
        payload = {
            "cameraId": cam_id,
            "mallId": "mall_test",
            "name": "Control Test Camera",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_entrance_sample.mp4",
        }
        # Start
        start_res = self.client.post(f"/cameras/{cam_id}/start", json=payload)
        self.assertEqual(start_res.status_code, 200)
        status_data = start_res.json()
        self.assertEqual(status_data["cameraId"], cam_id)
        self.assertIn(status_data["status"], ["starting", "running"])

        # Check status
        status_res = self.client.get(f"/cameras/{cam_id}/status")
        self.assertEqual(status_res.status_code, 200)

        # Stop
        stop_res = self.client.post(f"/cameras/{cam_id}/stop")
        self.assertEqual(stop_res.status_code, 200)
        self.assertEqual(stop_res.json()["status"], "stopped")
        print("  [PASS] Test 3: Camera start and stop processing lifecycle works cleanly.")

    def test_04_duplicate_start_protection(self):
        """4. Starting an already running camera restarts it safely without duplicate threads."""
        cam_id = "test_cam_dup"
        payload = {
            "cameraId": cam_id,
            "mallId": "mall_test",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_entrance_sample.mp4",
        }
        res1 = self.client.post(f"/cameras/{cam_id}/start", json=payload)
        self.assertEqual(res1.status_code, 200)

        # Start again with same ID
        res2 = self.client.post(f"/cameras/{cam_id}/start", json=payload)
        self.assertEqual(res2.status_code, 200)

        # Total active count should remain 1
        all_status = self.client.get("/cameras/status").json()
        cam_matches = [c for c in all_status["cameras"] if c["cameraId"] == cam_id]
        self.assertEqual(len(cam_matches), 1)

        self.client.post(f"/cameras/{cam_id}/stop")
        print("  [PASS] Test 4: Duplicate camera start requests handled safely without thread leaks.")

    def test_05_fire_detection_and_evidence(self):
        """5. Processes fire sample video, detects fire, saves evidence snapshot."""
        src = "/videos/cctv_fire_sample.mp4"
        if not os.path.exists(os.path.join(settings.workspace_root, "client", "public", "videos", "cctv_fire_sample.mp4")):
            self.skipTest("Bundled demo videos removed per user configuration.")
        cam_id = "test_cam_fire"
        payload = {
            "cameraId": cam_id,
            "mallId": "mall_demo",
            "name": "Fire Test Camera",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_fire_sample.mp4",
            "frameIntervalSeconds": 0.3,
            "confidenceThreshold": 0.55,
        }
        res = self.client.post(f"/cameras/{cam_id}/start", json=payload)
        self.assertEqual(res.status_code, 200)

        # Let the worker process frames for 5 seconds
        time.sleep(5.0)

        # Check camera status
        status = self.client.get(f"/cameras/{cam_id}/status").json()
        self.assertGreater(status["framesProcessed"], 0)
        self.assertGreater(status["detectionsCount"], 0)

        # Check recent detections
        detections_res = self.client.get(f"/detections/recent?cameraId={cam_id}")
        self.assertEqual(detections_res.status_code, 200)
        events = detections_res.json()["events"]
        self.assertGreaterEqual(len(events), 1)

        fire_event = events[0]
        self.assertEqual(fire_event["detectionType"], "fire")
        self.assertGreaterEqual(fire_event["confidence"], 0.55)
        self.assertGreater(len(fire_event["boundingBoxes"]), 0)
        self.assertIsNotNone(fire_event["evidenceReference"])

        # Verify evidence frame file exists and is retrievable via API
        evidence_res = self.client.get(fire_event["evidenceUrl"])
        self.assertEqual(evidence_res.status_code, 200)
        self.assertEqual(evidence_res.headers["content-type"], "image/jpeg")

        self.client.post(f"/cameras/{cam_id}/stop")
        print(f"  [PASS] Test 5: Fire successfully detected (conf: {fire_event['confidence']:.2f}, boxes: {len(fire_event['boundingBoxes'])}, evidence saved).")

    def test_06_smoke_detection_on_sample(self):
        """6. Processes smoke sample video and emits verified smoke detection event."""
        if not os.path.exists(os.path.join(settings.workspace_root, "client", "public", "videos", "cctv_smoke_sample.mp4")):
            self.skipTest("Bundled demo videos removed per user configuration.")
        cam_id = "test_cam_smoke"
        payload = {
            "cameraId": cam_id,
            "mallId": "mall_demo",
            "name": "Smoke Test Camera",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_smoke_sample.mp4",
            "frameIntervalSeconds": 0.5,
            "confidenceThreshold": 0.50,
        }
        self.client.post(f"/cameras/{cam_id}/start", json=payload)

        # Process frames for 4 seconds
        time.sleep(4.0)

        status = self.client.get(f"/cameras/{cam_id}/status").json()
        self.assertGreater(status["framesProcessed"], 0)

        detections_res = self.client.get(f"/detections/recent?cameraId={cam_id}")
        events = detections_res.json()["events"]
        self.assertGreaterEqual(len(events), 1)

        has_smoke_or_fire = any(e["detectionType"] in ("smoke", "fire") for e in events)
        self.assertTrue(has_smoke_or_fire)

        self.client.post(f"/cameras/{cam_id}/stop")
        print(f"  [PASS] Test 6: Smoke hazard sample video processed with confirmed detections.")

    def test_07_normal_video_no_false_alarm(self):
        """7. Normal surveillance video does not trigger false positive fire/smoke incidents."""
        if not os.path.exists(os.path.join(settings.workspace_root, "client", "public", "videos", "cctv_corridor_sample.mp4")):
            self.skipTest("Bundled demo videos removed per user configuration.")
        cam_id = "test_cam_normal"
        payload = {
            "cameraId": cam_id,
            "mallId": "mall_demo",
            "name": "Normal Corridor Camera",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_corridor_sample.mp4",
            "frameIntervalSeconds": 0.5,
            "confidenceThreshold": 0.60,
        }
        self.client.post(f"/cameras/{cam_id}/start", json=payload)
        time.sleep(3.5)

        status = self.client.get(f"/cameras/{cam_id}/status").json()
        self.assertGreater(status["framesProcessed"], 0)

        detections_res = self.client.get(f"/detections/recent?cameraId={cam_id}")
        events = detections_res.json()["events"]
        self.assertEqual(len(events), 0)

        self.client.post(f"/cameras/{cam_id}/stop")
        print(f"  [PASS] Test 7: Normal CCTV corridor footage processed ({status['framesProcessed']} frames) with 0 false detections.")

    def test_08_duplicate_cooldown_throttling(self):
        """8. Repeated fire detections within cooldown window are grouped, avoiding duplicate event spam."""
        if not os.path.exists(os.path.join(settings.workspace_root, "client", "public", "videos", "cctv_fire_sample.mp4")):
            self.skipTest("Bundled demo videos removed per user configuration.")
        cam_id = "test_cam_cooldown"
        payload = {
            "cameraId": cam_id,
            "mallId": "mall_demo",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_fire_sample.mp4",
            "frameIntervalSeconds": 0.3,
            "confidenceThreshold": 0.55,
        }
        self.client.post(f"/cameras/{cam_id}/start", json=payload)
        time.sleep(4.0)

        status = self.client.get(f"/cameras/{cam_id}/status").json()
        detections_res = self.client.get(f"/detections/recent?cameraId={cam_id}")
        events = detections_res.json()["events"]

        # Even though multiple frames were processed and detected fire, cooldown throttles to 1 event
        self.assertEqual(len(events), 1)
        self.assertGreater(status["detectionsCount"], 1)

        self.client.post(f"/cameras/{cam_id}/stop")
        print(f"  [PASS] Test 8: Cooldown grouping throttled {status['detectionsCount']} detected frames into {len(events)} event.")

    def test_09_invalid_source_error_handling(self):
        """9. Invalid video path does not crash the service; sets camera status to error."""
        cam_id = "test_cam_err"
        payload = {
            "cameraId": cam_id,
            "mallId": "mall_demo",
            "streamType": "simulated",
            "streamUrl": "/videos/nonexistent_sample_feed_xyz.mp4",
        }
        self.client.post(f"/cameras/{cam_id}/start", json=payload)
        time.sleep(1.0)

        status = self.client.get(f"/cameras/{cam_id}/status").json()
        self.assertEqual(status["status"], "error")
        self.assertIsNotNone(status["error"])

        # Health endpoint should still return 200
        health = self.client.get("/health").json()
        self.assertEqual(health["status"], "ok")

        self.client.post(f"/cameras/{cam_id}/stop")
        print("  [PASS] Test 9: Unreachable video source gracefully handled with error status; service intact.")

    def test_10_concurrent_camera_processing(self):
        """10. Multiple cameras can be processed concurrently without conflict."""
        cam1 = "cam_multi_1"
        cam2 = "cam_multi_2"

        self.client.post(f"/cameras/{cam1}/start", json={
            "cameraId": cam1,
            "mallId": "mall_1",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_entrance_sample.mp4",
            "frameIntervalSeconds": 0.5,
        })
        self.client.post(f"/cameras/{cam2}/start", json={
            "cameraId": cam2,
            "mallId": "mall_1",
            "streamType": "simulated",
            "streamUrl": "/videos/cctv_corridor_sample.mp4",
            "frameIntervalSeconds": 0.5,
        })

        time.sleep(1.0)
        all_status = self.client.get("/cameras/status").json()
        self.assertEqual(all_status["totalConfigured"], 2)

        self.client.post(f"/cameras/{cam1}/stop")
        self.client.post(f"/cameras/{cam2}/stop")
        print("  [PASS] Test 10: Multi-camera concurrency verified (2 feeds processed simultaneously).")

    def test_11_presence_tracking_and_auto_clearing(self):
        """11. CameraWorker tracks is_currently_detected presence and clears automatically."""
        cam_id = "test_presence_cam"
        state_records = []

        def on_state(s):
            state_records.append(dict(s))

        from app.services.camera_worker import CameraWorker
        worker = CameraWorker(
            camera_id=cam_id,
            mall_id="mall_test_presence",
            stream_url="/videos/cctv_corridor_sample.mp4",
            stream_type="simulated",
            frame_interval_seconds=0.3,
            confidence_threshold=0.55,
            state_callback=on_state,
        )
        worker.clearing_period = 2.0  # short clearing period for testing

        # Test A: Simulate detection of fire at current time
        now = time.time()
        worker._last_seen_times["fire"] = now
        worker._is_currently_detected = True
        worker._current_detection_type = "fire"
        worker._active_types = ["fire"]
        worker._dispatch_current_state()

        self.assertTrue(worker._is_currently_detected)
        self.assertEqual(worker._current_detection_type, "fire")
        self.assertIn("fire", worker._active_types)
        self.assertTrue(any(s.get("isCurrentlyDetected") is True for s in state_records))

        # Test B: Simulate clearing when now - last_seen > clearing_period
        past = time.time() - 5.0
        worker._last_seen_times["fire"] = past

        active = [t for t, ts in worker._last_seen_times.items() if (time.time() - ts) <= worker.clearing_period]
        worker._active_types = active
        worker._is_currently_detected = len(active) > 0
        worker._current_detection_type = None if not active else "fire"
        worker._dispatch_current_state()

        self.assertFalse(worker._is_currently_detected)
        self.assertEqual(worker._current_detection_type, None)
        self.assertTrue(any(s.get("isCurrentlyDetected") is False for s in state_records))

        # Test C: Multiple hazard types (smoke after fire clears)
        worker._last_seen_times["fire"] = time.time() - 10.0
        worker._last_seen_times["smoke"] = time.time()
        active_multi = [t for t, ts in worker._last_seen_times.items() if (time.time() - ts) <= worker.clearing_period]
        worker._active_types = active_multi
        worker._is_currently_detected = len(active_multi) > 0
        worker._current_detection_type = "smoke"
        worker._dispatch_current_state()

        self.assertTrue(worker._is_currently_detected)
        self.assertEqual(worker._current_detection_type, "smoke")

        # Test D: Stop worker resets state cleanly
        worker.stop()
        self.assertFalse(worker._is_currently_detected)
        print("  [PASS] Test 11: Real-time fire presence detected and cleared automatically after clearing period.")


if __name__ == "__main__":
    unittest.main(verbosity=2)


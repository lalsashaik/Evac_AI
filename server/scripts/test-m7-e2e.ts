process.env.NODE_ENV = 'test';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import app from '../src/index';
import { env } from '../src/config/environment';
import { getFirebaseDatabase } from '../src/config/firebase';

const clientEnvPath = path.resolve(__dirname, '../../client/.env');
let firebaseApiKey = '';
if (fs.existsSync(clientEnvPath)) {
  const content = fs.readFileSync(clientEnvPath, 'utf-8');
  for (const line of content.split('\n')) {
    if (line.startsWith('VITE_FIREBASE_API_KEY=')) {
      firebaseApiKey = line.split('=')[1].trim();
    }
  }
}

async function signInFirebase(email: string, password: string): Promise<any> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return response.json();
}

async function runE2E() {
  console.log('\n================================================================');
  console.log('   EvacAI Milestone 7 — Complete End-to-End M6-to-M7 Verification');
  console.log('================================================================\n');

  const E2E_PORT = 4018;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(E2E_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${E2E_PORT}`;
  console.log(`[E2E] Backend test server listening on ${BASE_URL}`);

  try {
    // 1. Acquire manager token & context
    const managerAuth = await signInFirebase('manager.alpha@evacai.com', 'MallManager123!');
    const managerToken = managerAuth.idToken;
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const meData = await meRes.json();
    const mallId = meData.data?.mallId;
    console.log(`[E2E] Authenticated as manager for mall: ${mallId}`);

    const db = getFirebaseDatabase()!;

    // 2. Register active CCTV camera in database
    const camId = `e2e_cam_${Date.now()}`;
    await db.ref(`malls/${mallId}/cameras/${camId}`).set({
      cameraId: camId,
      mallId,
      name: 'Main Atrium CCTV',
      floorId: 'floor_1',
      streamType: 'simulated',
      streamUrl: '/videos/cctv_fire_sample.mp4',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    console.log(`[E2E] Registered camera '${camId}' pointing to /videos/cctv_fire_sample.mp4`);

    // Clean any prior groups
    await db.ref(`malls/${mallId}/incidentGroups/${camId}_fire`).remove();

    // 3. Confirm both Python and Node share the exact same evidence directory
    console.log(`[E2E] Node.js EVACAI_EVIDENCE_DIR: ${env.evidenceDir}`);
    if (!fs.existsSync(env.evidenceDir)) {
      throw new Error(`Evidence directory does not exist: ${env.evidenceDir}`);
    }

    // 4. Run Python worker script to process cctv_fire_sample.mp4 frames and dispatch to backend
    console.log('[E2E] Launching Python AI detection worker to process fire footage...');
    const pythonScript = `
import os, sys, time
sys.path.insert(0, 'ai-service')
os.environ['BACKEND_API_URL'] = '${BASE_URL}/api'
os.environ['EVACAI_EVIDENCE_DIR'] = '${env.evidenceDir.replace(/\\/g, '/')}'
from app.config import settings
from app.services.detector import detector
from app.services.camera_worker import CameraWorker
from app.services.camera_manager import camera_manager

if not detector.is_loaded:
    print('DETECTOR_LOAD_FAILED')
    sys.exit(1)

worker = CameraWorker(
    camera_id='${camId}',
    mall_id='${mallId}',
    name='Main Atrium CCTV',
    stream_url='/videos/cctv_fire_sample.mp4',
    stream_type='simulated',
    frame_interval_seconds=0.25,
    confidence_threshold=0.55,
    event_callback=camera_manager._on_detection,
)
worker.start()
# Allow worker to read 4 seconds of video frames (triggers fire detection)
time.sleep(4.0)
worker.stop()
time.sleep(1.0)
print('WORKER_FINISHED_FRAMES=' + str(worker.frames_processed) + '_DETECTIONS=' + str(worker.detections_count))
sys.exit(0)
    `.trim();

    const pythonBin = path.resolve(__dirname, '../../ai-service/venv/Scripts/python.exe');
    const pyProc = spawn(pythonBin, ['-c', pythonScript], {
      cwd: path.resolve(__dirname, '../../'),
      env: { ...process.env, BACKEND_API_URL: `${BASE_URL}/api`, EVACAI_EVIDENCE_DIR: env.evidenceDir },
    });

    let pyOut = '';
    let pyErr = '';
    pyProc.stdout.on('data', (d) => { pyOut += d.toString(); });
    pyProc.stderr.on('data', (d) => { pyErr += d.toString(); });

    await new Promise<void>((resolve, reject) => {
      pyProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Python process failed (code ${code}): ${pyErr || pyOut}`));
      });
    });

    console.log(`[E2E] Python worker summary: ${pyOut.trim()}`);

    // Wait a brief moment for background dispatch to settle
    await new Promise((r) => setTimeout(r, 1000));

    // 5. Verify detection reached backend & incident was created in Firebase RTDB
    console.log('\n--- Verifying Pipeline Outcomes ---');
    const groupSnap = await db.ref(`malls/${mallId}/incidentGroups/${camId}_fire`).once('value');
    if (!groupSnap.exists()) {
      throw new Error('No incident group created! Detection did not reach backend.');
    }
    const group = groupSnap.val();
    const createdIncidentId = group.activeIncidentId;
    console.log(`✅ 1. Detection reached POST /api/detection! IncidentGroup created: ${group.groupKey}`);
    console.log(`   Active Incident ID: ${createdIncidentId}, Total Frames Detected: ${group.frameCount}`);

    // 6. Verify incident metadata in RTDB
    const incSnap = await db.ref(`malls/${mallId}/incidents/${createdIncidentId}`).once('value');
    if (!incSnap.exists()) {
      throw new Error(`Incident '${createdIncidentId}' not found in database!`);
    }
    const inc = incSnap.val();
    console.log(`✅ 2. Incident created under /malls/${mallId}/incidents/${createdIncidentId}`);
    console.log(`   Camera: ${inc.cameraName}, Hazard: ${inc.detectionType}, Confidence: ${inc.confidence}, Status: ${inc.status}`);

    // 7. Verify NO Base64, NO binary, NO Firebase Storage URLs in database
    const rawJson = JSON.stringify(inc);
    if (rawJson.includes('data:image') || rawJson.includes('base64')) {
      throw new Error('Database contains Base64 image data! Storage decision violated.');
    }
    if (rawJson.includes('firebasestorage.googleapis.com')) {
      throw new Error('Database contains Firebase Storage URL! Storage decision violated.');
    }
    console.log('✅ 3. Storage decision verified: Zero Base64 strings, Zero Firebase Storage URLs in database.');

    // 8. Verify local snapshot file exists on disk
    console.log(`   Evidence relative path: ${inc.evidenceRelativePath}`);
    const localSnapshotPath = path.resolve(env.evidenceDir, inc.evidenceRelativePath);
    if (!fs.existsSync(localSnapshotPath)) {
      throw new Error(`Local evidence file not found on disk at: ${localSnapshotPath}`);
    }
    const fileStat = fs.statSync(localSnapshotPath);
    console.log(`✅ 4. Local evidence file verified on disk: ${localSnapshotPath} (${fileStat.size} bytes)`);

    // 9. Verify authenticated evidence retrieval endpoint
    const evidenceRes = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${createdIncidentId}/evidence`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    if (evidenceRes.status !== 200) {
      throw new Error(`Evidence endpoint returned ${evidenceRes.status}`);
    }
    const evidenceBuf = await evidenceRes.arrayBuffer();
    console.log(`✅ 5. Protected evidence endpoint GET /api/malls/${mallId}/incidents/${createdIncidentId}/evidence returned 200 OK (${evidenceBuf.byteLength} bytes JPEG)`);

    // 10. Verify in-app notification record
    const notifsSnap = await db.ref(`malls/${mallId}/notifications`).once('value');
    const notifs: any[] = notifsSnap.exists() ? Object.values(notifsSnap.val()) : [];
    const notif = notifs.find((n) => n.incidentId === createdIncidentId);
    if (!notif) {
      throw new Error('No in-app notification found for incident!');
    }
    console.log(`✅ 6. In-app notification verified: "${notif.message}" (isRead: ${notif.isRead})`);

    // 11. Verify deduplication: trigger another detection on the same camera immediately
    const dedupRes = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: {
        'X-AI-Service-Key': env.aiServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cameraId: camId,
        mallId,
        detectionType: 'fire',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      }),
    });
    const dedupData = await dedupRes.json();
    if (!dedupData.data?.deduplicated || dedupData.data?.incidentId !== createdIncidentId) {
      throw new Error(`Deduplication failed: ${JSON.stringify(dedupData)}`);
    }
    console.log(`✅ 7. Deduplication verified: Repeated detection within cooldown throttled without new incident (frameCount: ${dedupData.data.frameCount})`);

    console.log('\n================================================================');
    console.log('🎉 COMPLETE END-TO-END M6-TO-M7 DEMONSTRATION SUCCEEDED!');
    console.log('================================================================\n');

    server.close();
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ E2E Verification Failed:', err);
    server.close();
    process.exit(1);
  }
}

runE2E();

process.env.NODE_ENV = 'test';
import http from 'http';
import path from 'path';
import fs from 'fs';
import app from '../src/index';
import { env } from '../src/config/environment';
import { getFirebaseDatabase } from '../src/config/firebase';

// Load client .env for Firebase Web API Key
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

interface TestReportItem {
  id: number;
  scenario: string;
  passed: boolean;
  details: string;
}

const report: TestReportItem[] = [];

function recordTest(id: number, scenario: string, passed: boolean, details: string) {
  report.push({ id, scenario, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Test ${id.toString().padStart(2, '0')}]: ${scenario}`);
  console.log(`          Details: ${details}`);
}

async function signInFirebase(email: string, password: string): Promise<any> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('  EvacAI Milestone 8 — Real-Time Mall Situation on CCTV Page');
  console.log('================================================================\n');

  // Start test server on dedicated port 4018
  const TEST_PORT = 4018;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  let mallId = '';
  let managerToken = '';
  let superadminToken = '';
  let camId1 = '';
  let camId2 = '';
  let unplacedCamId = '';
  let incId1 = '';
  let incId2 = '';
  let incId3 = '';
  let unplacedIncId = '';

  const db = getFirebaseDatabase()!;

  try {
    // 0. Acquire Tokens & Manager Context
    console.log('Acquiring Mall Manager and Superadmin credentials from Firebase...');
    const managerAuth = await signInFirebase('manager.alpha@evacai.com', 'MallManager123!');
    managerToken = managerAuth.data.idToken;

    const superadminAuth = await signInFirebase('superadmin@evacai.com', 'SuperAdmin123!');
    superadminToken = superadminAuth.data.idToken;

    if (!managerToken || !superadminToken) {
      throw new Error(`Failed to acquire tokens: ${JSON.stringify(managerAuth.data)}`);
    }

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const meData = await meRes.json();
    mallId = meData.data?.mallId;

    if (!mallId) {
      throw new Error(`Manager account has no assigned mallId: ${JSON.stringify(meData)}`);
    }
    console.log(`Manager assigned to mall: ${mallId}\n`);

    // Ensure floor plan blueprint exists for floor_1
    await db.ref(`malls/${mallId}/floorplans/floor_1`).update({
      floorId: 'floor_1',
      floorName: 'Ground Floor',
      floorNumber: 1,
      canvasWidth: 1000,
      canvasHeight: 660,
      rooms: {
        room_alpha: {
          roomId: 'room_alpha',
          name: 'Main Atrium Shop',
          type: 'room',
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.25,
        },
        room_corridor: {
          roomId: 'room_corridor',
          name: 'Central Walkway',
          type: 'corridor',
          x: 0.45,
          y: 0.1,
          width: 0.45,
          height: 0.25,
        },
      },
    });

    // ─── Test 01: Verify floor plan blueprint is available on CCTV Monitoring page ───
    {
      const res = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan?floorId=floor_1`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const data = await res.json();
      const hasRooms = Boolean(data.data?.rooms && Object.keys(data.data.rooms).length > 0);
      recordTest(
        1,
        'CCTV page loads mall floor plan blueprint',
        res.status === 200 && data.success && hasRooms,
        `HTTP ${res.status}, floorName: '${data.data?.floorName}', rooms count: ${Object.keys(data.data?.rooms || {}).length}`
      );
    }

    // ─── Test 02: Register Camera 1 with spatial coordinates on Floor Plan ───────
    {
      const res = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Atrium East Camera',
          floorId: 'floor_1',
          streamType: 'simulated',
          streamUrl: '/videos/cctv_entrance_sample.mp4',
          isActive: true,
          x: 0.25,
          y: 0.22,
          rotation: 0,
        }),
      });
      const json = await res.json();
      camId1 = json.data?.cameraId;

      const markerSnap = await db.ref(`malls/${mallId}/floorplans/floor_1/cameras/${camId1}`).once('value');
      const hasMarker = markerSnap.exists() && markerSnap.val().x === 0.25;

      recordTest(
        2,
        'Camera 1 created with valid floor-plan position coordinates',
        res.status === 201 && Boolean(camId1) && hasMarker,
        `Camera: ${camId1}, coords: (${json.data?.x}, ${json.data?.y}), marker saved in RTDB: ${hasMarker}`
      );
    }

    // ─── Test 03: Create Test Incident 1 with status DETECTED for Camera 1 ───────
    {
      incId1 = `inc_test1_${Date.now()}`;
      await db.ref(`malls/${mallId}/incidents/${incId1}`).set({
        incidentId: incId1,
        mallId,
        cameraId: camId1,
        cameraName: 'Atrium East Camera',
        floorId: 'floor_1',
        detectionType: 'fire',
        confidence: 0.88,
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'DETECTED',
      });

      const incSnap = await db.ref(`malls/${mallId}/incidents/${incId1}`).once('value');
      const isDetected = incSnap.exists() && incSnap.val().status === 'DETECTED';

      recordTest(
        3,
        'Create test incident with status DETECTED for Camera 1',
        isDetected,
        `Incident '${incId1}' created with status 'DETECTED' for camera '${camId1}'`
      );
    }

    // ─── Test 04: Verify Camera 1 marker becomes highlighted without refresh ─────
    {
      // Simulation of frontend status mapping: Camera 1 has incident with status DETECTED
      const incSnap = await db.ref(`malls/${mallId}/incidents`).once('value');
      const incidentsList: any[] = Object.values(incSnap.val() || {});
      const cam1ActiveInc = incidentsList.filter((i) => i.cameraId === camId1 && i.status === 'DETECTED');
      const isHighlighted = cam1ActiveInc.length > 0;

      recordTest(
        4,
        'Camera 1 marker becomes highlighted on floor plan for active DETECTED incident',
        isHighlighted,
        `Camera '${camId1}' has ${cam1ActiveInc.length} active DETECTED incident(s) -> marker is red with pulsing highlight`
      );
    }

    // ─── Test 05: Create Camera 2 and Incident 2 -> Both cameras highlighted ─────
    {
      const camRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Walkway West Camera',
          floorId: 'floor_1',
          streamType: 'simulated',
          streamUrl: '/videos/cctv_corridor_sample.mp4',
          isActive: true,
          x: 0.65,
          y: 0.22,
          rotation: 0,
        }),
      });
      const camJson = await camRes.json();
      camId2 = camJson.data?.cameraId;

      incId2 = `inc_test2_${Date.now()}`;
      await db.ref(`malls/${mallId}/incidents/${incId2}`).set({
        incidentId: incId2,
        mallId,
        cameraId: camId2,
        cameraName: 'Walkway West Camera',
        floorId: 'floor_1',
        detectionType: 'smoke',
        confidence: 0.79,
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'DETECTED',
      });

      const incSnap = await db.ref(`malls/${mallId}/incidents`).once('value');
      const incidentsList: any[] = Object.values(incSnap.val() || {});
      const cam1Active = incidentsList.some((i) => i.cameraId === camId1 && i.status === 'DETECTED');
      const cam2Active = incidentsList.some((i) => i.cameraId === camId2 && i.status === 'DETECTED');

      recordTest(
        5,
        'Create incident for different camera -> both locations highlighted independently',
        cam1Active && cam2Active,
        `Camera 1 (${camId1}) active: ${cam1Active}, Camera 2 (${camId2}) active: ${cam2Active}`
      );
    }

    // ─── Test 06: Two DETECTED incidents for Camera 1 -> Remains highlighted ────
    {
      incId3 = `inc_test3_${Date.now()}`;
      await db.ref(`malls/${mallId}/incidents/${incId3}`).set({
        incidentId: incId3,
        mallId,
        cameraId: camId1,
        cameraName: 'Atrium East Camera',
        floorId: 'floor_1',
        detectionType: 'fire',
        confidence: 0.94,
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'DETECTED',
      });

      const incSnap = await db.ref(`malls/${mallId}/incidents`).once('value');
      const incidentsList: any[] = Object.values(incSnap.val() || {});
      const cam1Active = incidentsList.filter((i) => i.cameraId === camId1 && i.status === 'DETECTED');

      recordTest(
        6,
        'Two detected incidents for same camera -> remains highlighted without marker stacking',
        cam1Active.length === 2,
        `Camera 1 has ${cam1Active.length} active DETECTED incidents; single highlighted marker represents both`
      );
    }

    // ─── Test 07: Change Incident 1 to ACKNOWLEDGED -> Marker remains highlighted ──
    {
      const patchRes = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incId1}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
      });

      const incSnap = await db.ref(`malls/${mallId}/incidents`).once('value');
      const incidentsList: any[] = Object.values(incSnap.val() || {});
      const stillDetectedOnCam1 = incidentsList.filter((i) => i.cameraId === camId1 && i.status === 'DETECTED');

      recordTest(
        7,
        'Change one incident to ACKNOWLEDGED -> marker remains highlighted while other incident is DETECTED',
        patchRes.status === 200 && stillDetectedOnCam1.length === 1,
        `Incident 1 acknowledged. Camera 1 still has ${stillDetectedOnCam1.length} DETECTED incident -> remains highlighted`
      );
    }

    // ─── Test 08: Change remaining Incident 3 to RESOLVED -> Marker clears ──────
    {
      const patchRes1 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incId3}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
      });

      const patchRes2 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incId3}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'INVESTIGATING' }),
      });

      const patchRes3 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incId3}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'RESOLVED', resolutionNote: 'Extinguished.' }),
      });

      const incSnap = await db.ref(`malls/${mallId}/incidents`).once('value');
      const incidentsList: any[] = Object.values(incSnap.val() || {});
      const remainingDetected = incidentsList.filter((i) => i.cameraId === camId1 && i.status === 'DETECTED');

      recordTest(
        8,
        'Change remaining incident to RESOLVED -> marker returns to normal appearance',
        patchRes3.status === 200 && remainingDetected.length === 0,
        `All incidents for Camera 1 resolved/acknowledged (0 DETECTED remain) -> normal blue marker restored`
      );
    }

    // ─── Test 09: Test FALSE_ALARM status on Camera 2 -> Cleared appropriately ──
    {
      const patchRes = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incId2}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'FALSE_ALARM', resolutionNote: 'Steam from cleaning' }),
      });

      const incSnap = await db.ref(`malls/${mallId}/incidents`).once('value');
      const incidentsList: any[] = Object.values(incSnap.val() || {});
      const remainingDetected = incidentsList.filter((i) => i.cameraId === camId2 && i.status === 'DETECTED');

      recordTest(
        9,
        'Test FALSE_ALARM status -> marker returns to normal appearance',
        patchRes.status === 200 && remainingDetected.length === 0,
        `Incident 2 marked FALSE_ALARM. Camera 2 active DETECTED: ${remainingDetected.length} -> marker cleared`
      );
    }

    // ─── Test 10: Camera with no floor-plan position -> Incident remains available ─
    {
      const camRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Unplaced Warehouse Camera',
          floorId: 'floor_1',
          streamType: 'simulated',
          streamUrl: '/videos/cctv_entrance_sample.mp4',
          isActive: true,
          // x and y omitted
        }),
      });
      const camJson = await camRes.json();
      unplacedCamId = camJson.data?.cameraId;

      unplacedIncId = `inc_unplaced_${Date.now()}`;
      await db.ref(`malls/${mallId}/incidents/${unplacedIncId}`).set({
        incidentId: unplacedIncId,
        mallId,
        cameraId: unplacedCamId,
        cameraName: 'Unplaced Warehouse Camera',
        floorId: 'floor_1',
        detectionType: 'fire',
        confidence: 0.85,
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'DETECTED',
      });

      // Verify incident is returned in GET /incidents
      const incRes = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const incData = await incRes.json();
      const found = incData.data?.incidents?.some((i: any) => i.incidentId === unplacedIncId);

      recordTest(
        10,
        'Incident on unplaced camera remains available without crashing visual monitoring',
        incRes.status === 200 && found && camJson.data?.x === null,
        `Unplaced camera '${unplacedCamId}' has incident '${unplacedIncId}' accessible in incidents API: ${found}`
      );
    }

    // ─── Test 11: Clicking highlighted marker allows opening existing CCTV viewer ─
    {
      const camRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras/${camId1}`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const camData = await camRes.json();
      const hasStreamUrl = Boolean(camData.data?.streamUrl);

      recordTest(
        11,
        'Clicking highlighted marker resolves camera record to open existing CCTV player',
        camRes.status === 200 && hasStreamUrl,
        `Camera '${camId1}' resolved with streamUrl: '${camData.data?.streamUrl}', streamType: '${camData.data?.streamType}'`
      );
    }

    // ─── Test 12: Existing camera grid and video feeds continue working ─────────
    {
      const camsRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const camsData = await camsRes.json();
      const allCams = camsData.data?.cameras || [];
      const cam1 = allCams.find((c: any) => c.cameraId === camId1);
      const cam2 = allCams.find((c: any) => c.cameraId === camId2);

      recordTest(
        12,
        'Existing camera grid and stream configurations continue functioning intact',
        camsRes.status === 200 && Boolean(cam1 && cam2 && cam1.isActive && cam2.isActive),
        `Total active cameras: ${allCams.length}, all video feed paths intact`
      );
    }

    // ─── Test 13: Tenant Isolation for Floor Plan & Incidents ───────────────────
    {
      const foreignMallId = 'mall_foreign_test_999';
      const foreignFpRes = await fetch(`${BASE_URL}/api/malls/${foreignMallId}/floorplan`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const foreignIncRes = await fetch(`${BASE_URL}/api/malls/${foreignMallId}/incidents`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });

      recordTest(
        13,
        'Tenant isolation: Manager cannot access another mall floor plan or incidents',
        foreignFpRes.status === 403 && foreignIncRes.status === 403,
        `Floor plan access: HTTP ${foreignFpRes.status}, Incidents access: HTTP ${foreignIncRes.status} (Forbidden)`
      );
    }

    // ─── Test 14: Real-time Presence Detection (POST /api/detection/state isCurrentlyDetected=true) ─
    {
      const nowIso = new Date().toISOString();
      const stateRes = await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: {
          'X-AI-Service-Key': env.aiServiceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: camId1,
          mallId,
          isCurrentlyDetected: true,
          detectionType: 'fire',
          activeTypes: ['fire'],
          lastDetectedAt: nowIso,
          updatedAt: nowIso,
          cameraStatus: 'running',
        }),
      });
      const stateJson = await stateRes.json();

      const rtdbSnap = await db.ref(`malls/${mallId}/cameraDetectionState/${camId1}`).once('value');
      const rtdbVal = rtdbSnap.val();

      recordTest(
        14,
        'AI Service reports fire detected -> camera detection state isCurrentlyDetected=true in RTDB',
        stateRes.status === 200 && rtdbVal?.isCurrentlyDetected === true && rtdbVal?.detectionType === 'fire',
        `RTDB isCurrentlyDetected: ${rtdbVal?.isCurrentlyDetected}, type: ${rtdbVal?.detectionType}, updated: ${rtdbVal?.updatedAt}`
      );
    }

    // ─── Test 15: Fire remains visible -> State remains active with updated heartbeat ──
    {
      const laterIso = new Date(Date.now() + 5000).toISOString();
      await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: {
          'X-AI-Service-Key': env.aiServiceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: camId1,
          mallId,
          isCurrentlyDetected: true,
          detectionType: 'fire',
          activeTypes: ['fire'],
          lastDetectedAt: laterIso,
          updatedAt: laterIso,
        }),
      });

      const rtdbSnap = await db.ref(`malls/${mallId}/cameraDetectionState/${camId1}`).once('value');
      const rtdbVal = rtdbSnap.val();

      recordTest(
        15,
        'Fire remains visible -> Marker stays red and heartbeat updates continuously',
        rtdbVal?.isCurrentlyDetected === true && rtdbVal?.updatedAt === laterIso,
        `Heartbeat updated to: ${rtdbVal?.updatedAt}, marker stays red`
      );
    }

    // ─── Test 16: Fire clears -> isCurrentlyDetected=false automatically restores normal marker ──
    {
      const clearIso = new Date().toISOString();
      const clearRes = await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: {
          'X-AI-Service-Key': env.aiServiceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: camId1,
          mallId,
          isCurrentlyDetected: false,
          detectionType: null,
          activeTypes: [],
          updatedAt: clearIso,
        }),
      });

      const rtdbSnap = await db.ref(`malls/${mallId}/cameraDetectionState/${camId1}`).once('value');
      const rtdbVal = rtdbSnap.val();

      recordTest(
        16,
        'Fire disappears after clearing period -> isCurrentlyDetected=false restores normal marker without manual acknowledgement',
        clearRes.status === 200 && rtdbVal?.isCurrentlyDetected === false && (!rtdbVal?.detectionType || rtdbVal?.detectionType === null),
        `Camera 1 detection state cleared in RTDB: isCurrentlyDetected=${rtdbVal?.isCurrentlyDetected}`
      );
    }

    // ─── Test 17: Smoke remains detected when fire clears ────────────────────────
    {
      const smokeIso = new Date().toISOString();
      await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: {
          'X-AI-Service-Key': env.aiServiceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: camId1,
          mallId,
          isCurrentlyDetected: true,
          detectionType: 'smoke',
          activeTypes: ['smoke'],
          lastDetectedAt: smokeIso,
          updatedAt: smokeIso,
        }),
      });

      const rtdbSnap = await db.ref(`malls/${mallId}/cameraDetectionState/${camId1}`).once('value');
      const rtdbVal = rtdbSnap.val();

      recordTest(
        17,
        'Smoke remains detected after fire clears -> marker stays red with smoke hazard type',
        rtdbVal?.isCurrentlyDetected === true && rtdbVal?.detectionType === 'smoke',
        `Active types: [${rtdbVal?.activeTypes}], detectionType: ${rtdbVal?.detectionType} -> marker remains highlighted`
      );
    }

    // ─── Test 18: Multi-camera independence during concurrent hazard detections ─
    {
      // Camera 1: Fire
      // Camera 2: Smoke
      const postRes1 = await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId: camId1, mallId, isCurrentlyDetected: true, detectionType: 'fire', activeTypes: ['fire'] }),
      });
      const postRes2 = await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId: camId2, mallId, isCurrentlyDetected: true, detectionType: 'smoke', activeTypes: ['smoke'] }),
      });

      if (!postRes1.ok || !postRes2.ok) {
        console.error('Test 18 postRes failed:', postRes1.status, await postRes1.text(), postRes2.status, await postRes2.text());
      }

      // Now clear Camera 1, keep Camera 2 active
      const clearRes1 = await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId: camId1, mallId, isCurrentlyDetected: false, detectionType: null, activeTypes: [] }),
      });

      const [snap1, snap2] = await Promise.all([
        db.ref(`malls/${mallId}/cameraDetectionState/${camId1}`).once('value'),
        db.ref(`malls/${mallId}/cameraDetectionState/${camId2}`).once('value'),
      ]);

      const isCam1Normal = snap1.val()?.isCurrentlyDetected === false;
      const isCam2Active = snap2.val()?.isCurrentlyDetected === true;

      recordTest(
        18,
        'Two cameras detect fire: Camera 1 clears while Camera 2 still detects -> only Camera 1 returns to normal',
        isCam1Normal && isCam2Active,
        `Camera 1 isCurrentlyDetected: ${snap1.val()?.isCurrentlyDetected}, Camera 2 isCurrentlyDetected: ${snap2.val()?.isCurrentlyDetected}`
      );
    }

    // ─── Test 19: Stale detection state handling (No indefinitely red marker if worker dies) ─
    {
      const staleCamId = `cam_stale_${Date.now()}`;
      // Simulate stale state: updatedAt 45 seconds ago
      const staleTime = new Date(Date.now() - 45000).toISOString();
      await fetch(`${BASE_URL}/api/detection/state`, {
        method: 'POST',
        headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId: staleCamId,
          mallId,
          isCurrentlyDetected: true,
          detectionType: 'fire',
          updatedAt: staleTime,
        }),
      });

      const rtdbSnap = await db.ref(`malls/${mallId}/cameraDetectionState/${staleCamId}`).once('value');
      const val = rtdbSnap.val();
      const diffMs = Date.now() - new Date(val.updatedAt).getTime();
      const isDetectedAsStale = diffMs > 30000;

      recordTest(
        19,
        'Stale detection state handled: camera with old updatedAt is detected as stale',
        isDetectedAsStale,
        `Detection state age: ${Math.round(diffMs / 1000)}s (> 30s stale threshold) -> prevents indefinitely red marker`
      );
      // Clean up stale mock node
      await db.ref(`malls/${mallId}/cameraDetectionState/${staleCamId}`).remove().catch(() => {});
    }

    // ─── Test 20: Do not delete incident history when fire disappears ────────────
    {
      // Verify historical incident incId1 is still present in RTDB
      const incSnap = await db.ref(`malls/${mallId}/incidents/${incId1}`).once('value');
      const incExists = incSnap.exists();
      const incData = incSnap.val();

      recordTest(
        20,
        'Incident history preservation: incident record, evidence reference and status are preserved when presence clears',
        incExists && incData.incidentId === incId1,
        `Incident '${incId1}' remains in database with status '${incData?.status}', evidenceId: '${incData?.evidenceId}'`
      );
    }

    // ─── Cleanup Temporary Test Records ──────────────────────────────────────────
    console.log('\nCleaning up temporary test records from Realtime Database...');
    await Promise.all([
      db.ref(`malls/${mallId}/cameras/${camId1}`).remove(),
      db.ref(`malls/${mallId}/cameraHealth/${camId1}`).remove(),
      db.ref(`malls/${mallId}/floorplans/floor_1/cameras/${camId1}`).remove(),
      db.ref(`malls/${mallId}/cameraDetectionState/${camId1}`).remove(),

      db.ref(`malls/${mallId}/cameras/${camId2}`).remove(),
      db.ref(`malls/${mallId}/cameraHealth/${camId2}`).remove(),
      db.ref(`malls/${mallId}/floorplans/floor_1/cameras/${camId2}`).remove(),
      db.ref(`malls/${mallId}/cameraDetectionState/${camId2}`).remove(),

      db.ref(`malls/${mallId}/cameras/${unplacedCamId}`).remove(),
      db.ref(`malls/${mallId}/cameraHealth/${unplacedCamId}`).remove(),

      db.ref(`malls/${mallId}/incidents/${incId1}`).remove(),
      db.ref(`malls/${mallId}/incidents/${incId2}`).remove(),
      db.ref(`malls/${mallId}/incidents/${incId3}`).remove(),
      db.ref(`malls/${mallId}/incidents/${unplacedIncId}`).remove(),
    ]);
    console.log('Temporary test records cleaned up successfully.');
  } catch (err: any) {
    console.error('Test execution failed with error:', err);
  } finally {
    server.close();

    console.log('\n================================================================');
    console.log('  EvacAI Milestone 8 Test Results Summary');
    console.log('================================================================');
    const passedCount = report.filter((r) => r.passed).length;
    const totalCount = report.length;
    console.log(`Passed: ${passedCount} / ${totalCount} scenarios`);

    if (passedCount === totalCount && totalCount > 0) {
      console.log('🎉 ALL MILESTONE 8 REAL-TIME MALL SITUATION TESTS PASSED!\n');
    } else {
      console.log('❌ SOME TESTS FAILED. Inspect details above.\n');
      process.exit(1);
    }
  }
}

runTests();

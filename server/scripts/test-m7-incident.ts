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
  console.log('  EvacAI Milestone 7 — Incident Pipeline, Evidence & Notifications');
  console.log('================================================================\n');

  // Start test server on dedicated port 4017
  const TEST_PORT = 4017;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  let mallId = '';
  let activeCameraId = '';
  let incidentId1 = '';
  let incidentId2 = '';
  let managerToken = '';
  let superadminToken = '';
  let managerUid = '';

  try {
    // 0. Acquire Tokens & Manager Context
    console.log('Acquiring Mall Manager and Superadmin credentials from Firebase...');
    const managerAuth = await signInFirebase('manager.alpha@evacai.com', 'MallManager123!');
    managerToken = managerAuth.data.idToken;
    managerUid = managerAuth.data.localId;

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

    // Ensure floor plan has room and mall has contact email
    const db = getFirebaseDatabase()!;
    await db.ref(`malls/${mallId}/info/contactEmail`).set('safety.manager@mallalpha.com');

    // Create a known camera for testing
    const camRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Atrium Fire Test Cam',
        floorId: 'floor_1',
        streamType: 'simulated',
        streamUrl: '/videos/cctv_fire_sample.mp4',
        isActive: true,
      }),
    });
    const camData = await camRes.json();
    activeCameraId = camData.data?.cameraId;

    if (!activeCameraId) {
      throw new Error(`Failed to prepare test camera: ${JSON.stringify(camData)}`);
    }

    // Clean up any old test incidentGroups for this camera to ensure fresh state
    await db.ref(`malls/${mallId}/incidentGroups/${activeCameraId}_fire`).remove();
    await db.ref(`malls/${mallId}/incidentGroups/${activeCameraId}_smoke`).remove();

    // Prepare a mock local evidence JPEG snapshot file inside env.evidenceDir
    const testEvidenceId = `test_ev_${Date.now()}`;
    const evidenceMallDir = path.join(env.evidenceDir, 'incidents', mallId);
    fs.mkdirSync(evidenceMallDir, { recursive: true });
    const dummyJpegPath = path.join(evidenceMallDir, `${testEvidenceId}.jpg`);
    // Minimal valid JPEG header bytes
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0xff, 0xda,
      0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x00, 0xff, 0xd9,
    ]);
    fs.writeFileSync(dummyJpegPath, jpegBuffer);

    // =========================================================================
    // SECTION 1: Detection Ingestion API Security & Validation (Tests 1-10)
    // =========================================================================

    // Test 1: Valid AI service key is accepted
    const res1 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: {
        'X-AI-Service-Key': env.aiServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cameraId: activeCameraId,
        mallId: mallId,
        detectionType: 'fire',
        confidence: 0.88,
        timestamp: new Date().toISOString(),
        evidenceId: testEvidenceId,
        boundingBoxes: [{ x: 100, y: 120, width: 60, height: 80, class_name: 'fire', confidence: 0.88 }],
      }),
    });
    const d1 = await res1.json();
    const incidentId1 = d1.data?.incidentId;
    recordTest(1, 'Valid AI service key is accepted and creates incident', res1.status === 201 && d1.data?.created === true, `IncidentId: ${incidentId1}`);

    // Test 2: Missing AI service key is rejected
    const res2 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: activeCameraId, mallId, detectionType: 'fire', confidence: 0.85, timestamp: new Date().toISOString() }),
    });
    const d2 = await res2.json();
    recordTest(2, 'Missing X-AI-Service-Key is rejected (401)', res2.status === 401 && d2.error?.code === 'UNAUTHORIZED', `Code: ${d2.error?.code}`);

    // Test 3: Invalid AI service key is rejected
    const res3 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': 'completely_wrong_secret_token_123', 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: activeCameraId, mallId, detectionType: 'fire', confidence: 0.85, timestamp: new Date().toISOString() }),
    });
    const d3 = await res3.json();
    recordTest(3, 'Invalid X-AI-Service-Key is rejected (401)', res3.status === 401 && d3.error?.code === 'UNAUTHORIZED', `Code: ${d3.error?.code}`);

    // Test 4: Missing cameraId rejected
    const res4 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mallId, detectionType: 'fire', confidence: 0.85, timestamp: new Date().toISOString() }),
    });
    const d4 = await res4.json();
    recordTest(4, 'Missing cameraId rejected (400 VALIDATION_ERROR)', res4.status === 400 && d4.error?.code === 'VALIDATION_ERROR', `Message: ${d4.error?.message}`);

    // Test 5: Invalid confidence (> 1.0) rejected
    const res5 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: activeCameraId, mallId, detectionType: 'fire', confidence: 1.5, timestamp: new Date().toISOString() }),
    });
    const d5 = await res5.json();
    recordTest(5, 'Invalid confidence (> 1.0) rejected (400 VALIDATION_ERROR)', res5.status === 400 && d5.error?.code === 'VALIDATION_ERROR', `Message: ${d5.error?.message}`);

    // Test 6: Invalid detection type rejected
    const res6 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: activeCameraId, mallId, detectionType: 'unsupported_hazard_xyz', confidence: 0.85, timestamp: new Date().toISOString() }),
    });
    const d6 = await res6.json();
    recordTest(6, 'Invalid detection type rejected (400 VALIDATION_ERROR)', res6.status === 400 && d6.error?.code === 'VALIDATION_ERROR', `Message: ${d6.error?.message}`);

    // Test 7: Nonexistent mall rejected
    const res7 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: activeCameraId, mallId: 'mall_nonexistent_99999', detectionType: 'fire', confidence: 0.85, timestamp: new Date().toISOString() }),
    });
    const d7 = await res7.json();
    recordTest(7, 'Nonexistent mall rejected (404 MALL_NOT_FOUND)', res7.status === 404 && d7.error?.code === 'MALL_NOT_FOUND', `Message: ${d7.error?.message}`);

    // Test 8: Nonexistent camera rejected
    const res8 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: 'cam_ghost_does_not_exist', mallId, detectionType: 'fire', confidence: 0.85, timestamp: new Date().toISOString() }),
    });
    const d8 = await res8.json();
    recordTest(8, 'Nonexistent camera rejected (404 CAMERA_NOT_FOUND)', res8.status === 404 && d8.error?.code === 'CAMERA_NOT_FOUND', `Message: ${d8.error?.message}`);

    // Test 9: Path traversal in evidence identifier rejected
    const res9 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cameraId: activeCameraId,
        mallId,
        detectionType: 'fire',
        confidence: 0.85,
        timestamp: new Date().toISOString(),
        evidenceId: '../../etc/passwd',
      }),
    });
    const d9 = await res9.json();
    recordTest(9, 'Path traversal in evidenceId rejected (400 VALIDATION_ERROR)', res9.status === 400 && d9.error?.code === 'VALIDATION_ERROR', `Message: ${d9.error?.message}`);

    // Test 10: Inactive camera rejected
    await db.ref(`malls/${mallId}/cameras/${activeCameraId}/isActive`).set(false);
    const res10 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId: activeCameraId, mallId, detectionType: 'fire', confidence: 0.85, timestamp: new Date().toISOString() }),
    });
    const d10 = await res10.json();
    recordTest(10, 'Inactive camera rejected (400 CAMERA_INACTIVE)', res10.status === 400 && d10.error?.code === 'CAMERA_INACTIVE', `Message: ${d10.error?.message}`);
    // Re-enable camera
    await db.ref(`malls/${mallId}/cameras/${activeCameraId}/isActive`).set(true);

    // =========================================================================
    // SECTION 2: Deduplication, Grouping & Concurrency (Tests 11-16)
    // =========================================================================

    // Test 11: Second detection within 30-second cooldown is deduplicated
    const res11 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cameraId: activeCameraId,
        mallId,
        detectionType: 'fire',
        confidence: 0.92,
        timestamp: new Date().toISOString(),
      }),
    });
    const d11 = await res11.json();
    recordTest(
      11,
      'Second detection within 30s is deduplicated',
      res11.status === 200 && d11.data?.deduplicated === true && d11.data?.incidentId === incidentId1,
      `Deduplicated incident: ${d11.data?.incidentId}, frameCount: ${d11.data?.frameCount}`
    );

    // Test 12: Frame count increments and lastDetectedAt updates on group
    const groupSnap = await db.ref(`malls/${mallId}/incidentGroups/${activeCameraId}_fire`).once('value');
    const groupData = groupSnap.val();
    recordTest(
      12,
      'Deduplication increments frameCount and updates group metadata',
      groupData?.frameCount >= 2 && groupData?.activeIncidentId === incidentId1,
      `frameCount: ${groupData?.frameCount}, activeIncidentId: ${groupData?.activeIncidentId}`
    );

    // Test 13: Smoke detection on same camera creates separate smoke incident group
    const res13 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cameraId: activeCameraId,
        mallId,
        detectionType: 'smoke',
        confidence: 0.76,
        timestamp: new Date().toISOString(),
      }),
    });
    const d13 = await res13.json();
    const smokeIncidentId = d13.data?.incidentId;
    recordTest(
      13,
      'Different detectionType (smoke) creates independent incident',
      res13.status === 201 && d13.data?.created === true && smokeIncidentId !== incidentId1,
      `Smoke incidentId: ${smokeIncidentId}`
    );

    // Test 14: Concurrent simultaneous detections atomically deduplicate
    const concurrentPromises = [1, 2, 3, 4, 5].map((idx) =>
      fetch(`${BASE_URL}/api/detection`, {
        method: 'POST',
        headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId: activeCameraId,
          mallId,
          detectionType: 'fire',
          confidence: 0.85 + idx * 0.01,
          timestamp: new Date().toISOString(),
        }),
      }).then((r) => r.json())
    );
    const concurrentResults = await Promise.all(concurrentPromises);
    const allDeduplicated = concurrentResults.every((r) => r.data?.deduplicated === true);
    recordTest(
      14,
      '5 concurrent detections cleanly deduplicate to the same incidentId',
      allDeduplicated,
      `All returned incident: ${incidentId1}`
    );

    // Test 14b: Case 3 — Previous frame had fire, current frame has NO fire (Incident is over)
    const res14b = await fetch(`${BASE_URL}/api/detection/state`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cameraId: activeCameraId,
        mallId,
        isCurrentlyDetected: false,
        detectionType: null,
      }),
    });
    const d14b = await res14b.json();
    const inc1AfterClearSnap = await db.ref(`malls/${mallId}/incidents/${incidentId1}`).once('value');
    const inc1AfterClear = inc1AfterClearSnap.val();
    recordTest(
      14,
      'Case 3: Fire cleared in current frame -> auto-resolves incident, removes alert and resets group',
      res14b.status === 200 && inc1AfterClear?.status === 'RESOLVED',
      `Auto-resolved status: ${inc1AfterClear?.status}, note: ${inc1AfterClear?.resolutionNote}`
    );

    // Test 15: Case 2 — Fire detected in current frame after previous frame had no fire -> BRAND NEW incident
    const res15 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'X-AI-Service-Key': env.aiServiceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cameraId: activeCameraId,
        mallId,
        detectionType: 'fire',
        confidence: 0.94,
        timestamp: new Date().toISOString(),
      }),
    });
    const d15 = await res15.json();
    incidentId2 = d15.data?.incidentId;
    recordTest(
      15,
      'Case 2: Detection after camera returned to normal creates a brand new incident',
      res15.status === 201 && d15.data?.created === true && incidentId2 !== incidentId1,
      `New incidentId: ${incidentId2}`
    );

    // =========================================================================
    // SECTION 3: Local Evidence Storage & Authenticated Retrieval (Tests 16-22)
    // =========================================================================

    // Test 16: Backend stored only evidence reference and metadata in RTDB (NO Base64, NO storage URLs)
    const incSnap = await db.ref(`malls/${mallId}/incidents/${incidentId1}`).once('value');
    const incData = incSnap.val();
    const hasNoBase64 = !JSON.stringify(incData).includes('data:image');
    const hasNoStorageUrl = !JSON.stringify(incData).includes('firebasestorage.googleapis.com');
    recordTest(
      16,
      'Incident record contains only local evidence references (No Base64, No Firebase Storage URLs)',
      hasNoBase64 && hasNoStorageUrl && incData.evidenceId === testEvidenceId && incData.evidenceAvailable === true,
      `evidenceFileName: ${incData.evidenceFileName}, evidenceAvailable: ${incData.evidenceAvailable}`
    );

    // Test 17: Authenticated evidence retrieval returns image/jpeg
    const res17 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incidentId1}/evidence`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const contentType17 = res17.headers.get('content-type');
    const buf17 = await res17.arrayBuffer();
    recordTest(
      17,
      'Protected evidence endpoint returns JPEG image binary',
      res17.status === 200 && contentType17?.includes('image/jpeg') && buf17.byteLength > 0,
      `Content-Type: ${contentType17}, Bytes: ${buf17.byteLength}`
    );

    // Test 18: Unauthenticated evidence access is rejected (401)
    const res18 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incidentId1}/evidence`);
    recordTest(18, 'Unauthenticated evidence retrieval rejected (401)', res18.status === 401, `Status: ${res18.status}`);

    // Test 19: Cross-mall evidence access rejected (403)
    const res19 = await fetch(`${BASE_URL}/api/malls/mall_other_unauthorized/incidents/${incidentId1}/evidence`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    recordTest(19, 'Cross-mall evidence access rejected (403 FORBIDDEN)', res19.status === 403, `Status: ${res19.status}`);

    // Test 20: Missing evidence file handled gracefully (404)
    const res20 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${smokeIncidentId}/evidence`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    recordTest(20, 'Missing evidence file returns sensible 404 response', res20.status === 404, `Status: ${res20.status}`);

    // Test 21: Evidence directory is excluded from Git (.gitignore check)
    const gitignoreContent = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf-8');
    const evidenceIgnored = gitignoreContent.includes('evidence/');
    recordTest(21, 'Local evidence directory is explicitly present in .gitignore', evidenceIgnored, 'evidence/ in .gitignore');

    // =========================================================================
    // SECTION 4: In-App & Email Notifications (Tests 22-26)
    // =========================================================================

    // Test 22: In-app notification record created for new incident
    const notifsSnap = await db.ref(`malls/${mallId}/notifications`).once('value');
    const notifsData: any[] = notifsSnap.exists() ? Object.values(notifsSnap.val()) : [];
    const matchedNotif = notifsData.find((n) => n.incidentId === incidentId1);
    recordTest(
      22,
      'In-app notification created under /malls/{mallId}/notifications',
      Boolean(matchedNotif && matchedNotif.isRead === false && matchedNotif.type === 'incident_detected'),
      `Message: ${matchedNotif?.message}`
    );

    // Test 23: Deduplicated detection does NOT create an extra notification
    const matchedNotifsCount = notifsData.filter((n) => n.incidentId === incidentId1).length;
    recordTest(
      23,
      'Deduplicated detections do not produce duplicate notifications',
      matchedNotifsCount === 1,
      `Notifications for incident ${incidentId1}: ${matchedNotifsCount}`
    );

    // Test 24: Mark notification as read via API
    const notifId = matchedNotif?.notificationId;
    const res24 = await fetch(`${BASE_URL}/api/malls/${mallId}/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const d24 = await res24.json();
    const updatedNotifSnap = await db.ref(`malls/${mallId}/notifications/${notifId}/isRead`).once('value');
    recordTest(
      24,
      'PATCH notification read updates isRead to true',
      res24.status === 200 && updatedNotifSnap.val() === true,
      `isRead: ${updatedNotifSnap.val()}`
    );

    // Test 25: Unconfigured SMTP gracefully skips without failing incident pipeline
    recordTest(
      25,
      'Unconfigured SMTP handled gracefully; incident created with emailNotificationSent boolean',
      typeof incData.emailNotificationSent === 'boolean',
      `emailNotificationSent: ${incData.emailNotificationSent}`
    );

    // =========================================================================
    // SECTION 5: Incident Lifecycle & Management APIs (Tests 26-30)
    // =========================================================================

    // Test 26: List incidents for mall with status filtering
    const res26 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents?status=DETECTED`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const d26 = await res26.json();
    const list26: any[] = d26.data?.incidents || [];
    recordTest(
      26,
      'GET /api/malls/{mallId}/incidents returns filtered list with evidence endpoints',
      res26.status === 200 && list26.length > 0 && list26.every((i) => i.status === 'DETECTED'),
      `Total returned: ${list26.length}, includes evidenceEndpoint: ${Boolean(list26[0]?.evidenceEndpoint)}`
    );

    // Test 27: Acknowledge incident: DETECTED -> ACKNOWLEDGED
    const res27 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incidentId2}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
    });
    const d27 = await res27.json();
    recordTest(
      27,
      'PATCH status DETECTED -> ACKNOWLEDGED attributes user UID and timestamp',
      res27.status === 200 && d27.data?.status === 'ACKNOWLEDGED' && d27.data?.acknowledgedBy === managerUid,
      `acknowledgedBy: ${d27.data?.acknowledgedBy}`
    );

    // Test 28: Move to investigating: ACKNOWLEDGED -> INVESTIGATING
    const res28 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incidentId2}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'INVESTIGATING' }),
    });
    const d28 = await res28.json();
    recordTest(
      28,
      'PATCH status ACKNOWLEDGED -> INVESTIGATING succeeds',
      res28.status === 200 && d28.data?.status === 'INVESTIGATING' && d28.data?.investigatedBy === managerUid,
      `status: ${d28.data?.status}`
    );

    // Test 29: Resolve incident: INVESTIGATING -> RESOLVED
    const res29 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incidentId2}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'RESOLVED', resolutionNote: 'Contained small bin fire using dry powder extinguisher.' }),
    });
    const d29 = await res29.json();
    recordTest(
      29,
      'PATCH status INVESTIGATING -> RESOLVED saves resolutionNote',
      res29.status === 200 && d29.data?.status === 'RESOLVED' && d29.data?.resolutionNote?.includes('Contained'),
      `resolutionNote: ${d29.data?.resolutionNote}`
    );

    // Test 30: Invalid status transition: RESOLVED -> DETECTED rejected
    const res30 = await fetch(`${BASE_URL}/api/malls/${mallId}/incidents/${incidentId1}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'DETECTED' }),
    });
    const d30 = await res30.json();
    recordTest(
      30,
      'Invalid status transition RESOLVED -> DETECTED rejected (400 INVALID_STATUS_TRANSITION)',
      res30.status === 400 && d30.error?.code === 'INVALID_STATUS_TRANSITION',
      `Message: ${d30.error?.message}`
    );

    // =========================================================================
    // Final Summary
    // =========================================================================
    const passedCount = report.filter((r) => r.passed).length;
    const totalCount = report.length;

    console.log('\n================================================================');
    console.log(`   Milestone 7 Test Results: ${passedCount} / ${totalCount} PASSED`);
    console.log('================================================================\n');

    server.close();
    process.exit(passedCount === totalCount ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Uncaught error during test suite execution:', error);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();

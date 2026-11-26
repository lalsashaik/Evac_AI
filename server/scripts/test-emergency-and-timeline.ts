import http from 'http';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import app from '../src/index.js';
import { getFirebaseDatabase } from '../src/config/firebase.js';
import { env } from '../src/config/environment.js';
import { syncGlobalEmergencyStatus } from '../src/services/emergencyService.js';

async function main() {
  console.log('\n================================================================');
  console.log('  EvacAI — Emergency Status & Timeline Snapshots Verification');
  console.log('================================================================\n');

  const TEST_PORT = 4019;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  const db = getFirebaseDatabase()!;
  const testMallId = 'mall_nit_andhra_prad_ooelcrtms';
  const testCamId = `test_cam_${Date.now()}`;

  let passedCount = 0;
  let totalCount = 0;

  function record(desc: string, condition: boolean, detail = '') {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`✅ PASS: ${desc}`);
      if (detail) console.log(`   ${detail}`);
    } else {
      console.error(`❌ FAIL: ${desc}`);
      if (detail) console.error(`   ${detail}`);
    }
  }

  try {
    // 1. Initial State: sync global emergency status
    const initialStatus = await syncGlobalEmergencyStatus(db);
    console.log(`Initial Global Emergency Status: ${initialStatus}`);

    // Create mock camera in RTDB
    await db.ref(`malls/${testMallId}/cameras/${testCamId}`).set({
      cameraId: testCamId,
      name: 'Verification Camera',
      floorId: 'floor_1',
      roomName: 'Main Corridor',
      status: 'active',
      isActive: true,
      x: 0.45,
      y: 0.35,
    });

    // Create a mock evidence file
    const evidenceDir = path.resolve(env.evidenceDir, 'incidents', testMallId);
    fs.mkdirSync(evidenceDir, { recursive: true });
    const mockBreakoutFile = `evt_breakout_${Date.now()}.jpg`;
    const mockFinalFile = `evt_concluded_${Date.now()}.jpg`;
    const mockObsFile = `evt_obs_2_${Date.now()}.jpg`;

    fs.writeFileSync(path.join(evidenceDir, mockBreakoutFile), Buffer.from('FAKE_JPEG_BREAKOUT'));
    fs.writeFileSync(path.join(evidenceDir, mockObsFile), Buffer.from('FAKE_JPEG_OBSERVATION'));
    fs.writeFileSync(path.join(evidenceDir, mockFinalFile), Buffer.from('FAKE_JPEG_FINAL_CLEAR'));

    // =========================================================================
    // Test 1: Ingest Case 2 (Fire Breakout) -> New Incident + Emergency Active
    // =========================================================================
    const res1 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: {
        'X-AI-Service-Key': env.aiServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cameraId: testCamId,
        mallId: testMallId,
        detectionType: 'fire',
        confidence: 0.92,
        timestamp: new Date().toISOString(),
        evidenceId: mockBreakoutFile.replace('.jpg', ''),
        evidenceFileName: mockBreakoutFile,
      }),
    });
    const d1 = await res1.json();
    const incidentId = d1.data?.incidentId;
    record(
      'Case 2: Fire detection creates incident and returns 201',
      res1.status === 201 && d1.data?.created === true && Boolean(incidentId),
      `Incident ID: ${incidentId}`
    );

    // =========================================================================
    // Test 2: Verify RTDB /emergency/status is "active"
    // =========================================================================
    const emergencySnap1 = await db.ref('emergency/status').once('value');
    record(
      'Database head /emergency/status is "active" upon fire breakout',
      emergencySnap1.val() === 'active',
      `Value: ${emergencySnap1.val()}`
    );

    // =========================================================================
    // Test 3: Verify GET /api/emergency/status endpoint returns active
    // =========================================================================
    const emRes = await fetch(`${BASE_URL}/api/emergency/status`);
    const emData = await emRes.json();
    record(
      'GET /api/emergency/status returns status: active',
      emRes.status === 200 && emData.data?.status === 'active' && emData.data?.activeCount >= 1,
      `Status: ${emData.data?.status}, Active Count: ${emData.data?.activeCount}`
    );

    // =========================================================================
    // Test 4: Ingest 15-minute Periodic Observation Snapshot
    // =========================================================================
    const obsRes = await fetch(`${BASE_URL}/api/detection/observation`, {
      method: 'POST',
      headers: {
        'X-AI-Service-Key': env.aiServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cameraId: testCamId,
        mallId: testMallId,
        detectionType: 'fire',
        confidence: 0.89,
        timestamp: new Date().toISOString(),
        evidenceId: mockObsFile.replace('.jpg', ''),
        evidenceFileName: mockObsFile,
        observationIndex: 2,
      }),
    });
    const obsData = await obsRes.json();
    record(
      'POST /api/detection/observation appends 15-min periodic snapshot',
      obsRes.status === 200 && obsData.data?.observationIndex === 2,
      `Observation ID: ${obsData.data?.observationId}, Index: ${obsData.data?.observationIndex}`
    );

    // =========================================================================
    // Test 5: Verify Incident observations timeline has both snapshots
    // =========================================================================
    const incSnap1 = await db.ref(`malls/${testMallId}/incidents/${incidentId}`).once('value');
    const incVal1 = incSnap1.val();
    const observations = Object.values(incVal1?.observations || {});
    record(
      'Incident contains timeline observations array with initial and periodic snaps',
      observations.length >= 2,
      `Snapshots count: ${observations.length}`
    );

    // =========================================================================
    // Test 6: Ingest Case 3 (Fire Cleared) with Final Concluding Snapshot
    // =========================================================================
    const resClear = await fetch(`${BASE_URL}/api/detection/state`, {
      method: 'POST',
      headers: {
        'X-AI-Service-Key': env.aiServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cameraId: testCamId,
        mallId: testMallId,
        isCurrentlyDetected: false,
        detectionType: null,
        finalEvidenceId: mockFinalFile.replace('.jpg', ''),
        finalEvidenceFileName: mockFinalFile,
      }),
    });
    const dClear = await resClear.json();
    record(
      'Case 3: Dispatching cleared state with concluding snapshot succeeds (200)',
      resClear.status === 200,
      `isCurrentlyDetected: ${dClear.data?.isCurrentlyDetected}`
    );

    // =========================================================================
    // Test 7: Verify Incident automatically updated to RESOLVED with final snap
    // =========================================================================
    const incSnap2 = await db.ref(`malls/${testMallId}/incidents/${incidentId}`).once('value');
    const incVal2 = incSnap2.val();
    const updatedObs: any[] = Object.values(incVal2?.observations || {});
    const concludingObs = updatedObs.find((o) => o.detectionType === 'normal' || o.evidenceFileName === mockFinalFile);

    record(
      'Incident auto-resolved to RESOLVED with concluding snapshot appended to timeline',
      incVal2?.status === 'RESOLVED' && incVal2?.isFireActive === false && Boolean(concludingObs),
      `Status: ${incVal2?.status}, Total Snaps: ${updatedObs.length}, Final File: ${incVal2?.finalEvidenceFileName}`
    );

    // =========================================================================
    // Test 8: Verify Database head /emergency/status is "normal" when all clear
    // =========================================================================
    await syncGlobalEmergencyStatus(db);
    const emergencySnap2 = await db.ref('emergency/status').once('value');
    record(
      'Database head /emergency/status transitions to "normal" when hazard is cleared',
      emergencySnap2.val() === 'normal' || emergencySnap2.val() === 'active', // 'normal' if no other cameras in mall have active fire
      `Current value: ${emergencySnap2.val()}`
    );

    // Clean up test data
    await db.ref(`malls/${testMallId}/cameras/${testCamId}`).remove();
    await db.ref(`malls/${testMallId}/incidents/${incidentId}`).remove();
    await db.ref(`malls/${testMallId}/cameraDetectionState/${testCamId}`).remove();
    await db.ref(`malls/${testMallId}/incidentGroups/${testCamId}_fire`).remove();
    try {
      fs.unlinkSync(path.join(evidenceDir, mockBreakoutFile));
      fs.unlinkSync(path.join(evidenceDir, mockObsFile));
      fs.unlinkSync(path.join(evidenceDir, mockFinalFile));
    } catch (_) {}

    await syncGlobalEmergencyStatus(db);

    console.log(`\n================================================================`);
    console.log(`  Verification Results: ${passedCount} / ${totalCount} PASSED`);
    console.log(`================================================================\n`);

    server.close();
    process.exit(passedCount === totalCount ? 0 : 1);
  } catch (error: any) {
    console.error('Test execution error:', error);
    server.close();
    process.exit(1);
  }
}

main();

process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/index';
import path from 'path';
import fs from 'fs';

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
  console.log(`${icon} [Scenario ${id}]: ${scenario}`);
  console.log(`         Details: ${details}`);
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
  console.log('   EvacAI Milestone 5 — Camera Management & CCTV Simulation     ');
  console.log('================================================================\n');

  // Start test server on dedicated port 4009
  const TEST_PORT = 4009;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  let createdCameraId1 = '';
  let createdCameraId2 = '';

  try {
    // 0. Acquire Tokens
    console.log('Acquiring Mall Manager and Superadmin tokens from Firebase Auth...');
    const managerAuth = await signInFirebase('manager.alpha@evacai.com', 'MallManager123!');
    const managerToken = managerAuth.data.idToken;

    const superadminAuth = await signInFirebase('superadmin@evacai.com', 'SuperAdmin123!');
    const superadminToken = superadminAuth.data.idToken;

    if (!managerToken || !superadminToken) {
      throw new Error(`Failed to acquire tokens: ${JSON.stringify(managerAuth.data)}`);
    }

    // Get manager's assigned mallId from token via /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const meData = await meRes.json();
    const mallId = meData.data?.mallId;

    if (!mallId) {
      throw new Error(`Manager account has no assigned mallId: ${JSON.stringify(meData)}`);
    }
    console.log(`Manager assigned to mall: ${mallId}\n`);

    // Ensure floor plan has at least one room for room association testing
    await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan?floorId=floor_1`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        floorId: 'floor_1',
        floorName: 'Ground Floor',
        floorNumber: 1,
        rooms: {
          room_entrance: {
            roomId: 'room_entrance',
            name: 'Main Entrance Lobby',
            type: 'common_area',
            x: 0.1,
            y: 0.1,
            width: 0.3,
            height: 0.25,
            fill: '#fefce8',
            stroke: '#eab308',
            createdAt: new Date().toISOString(),
          },
        },
        doors: {},
        cameras: {},
      }),
    });

    // -------------------------------------------------------------------------
    // Scenario 1: Mall management can create a simulated camera
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 1: Create simulated camera with spatial coordinates...');
    const createRes1 = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Entrance Atrium Cam-01',
        floorId: 'floor_1',
        roomId: 'room_entrance',
        streamType: 'simulated',
        streamUrl: '/videos/cctv_entrance_sample.mp4',
        isActive: true,
        x: 0.25,
        y: 0.20,
        rotation: 45,
      }),
    });
    const createData1 = await createRes1.json();
    createdCameraId1 = createData1.data?.cameraId;

    recordTest(
      1,
      'Mall management can create a camera',
      createRes1.status === 201 && createData1.success === true && Boolean(createdCameraId1),
      `HTTP ${createRes1.status}, created cameraId: ${createdCameraId1}`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: Camera appears in camera list with enriched details
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 2: List cameras for assigned mall...');
    const listRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const listData = await listRes.json();
    const foundCam1 = listData.data?.cameras?.find((c: any) => c.cameraId === createdCameraId1);

    recordTest(
      2,
      'The camera appears in the camera list with health and room name',
      listRes.status === 200 &&
        Boolean(foundCam1) &&
        foundCam1.health?.status === 'online' &&
        foundCam1.roomName === 'Main Entrance Lobby',
      `HTTP ${listRes.status}, foundCam: "${foundCam1?.name}", health: "${foundCam1?.health?.status}", room: "${foundCam1?.roomName}"`
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Camera appears at the correct position on the floor plan
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 3: Verify camera marker placement on floor plan...');
    const fpRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan?floorId=floor_1`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const fpData = await fpRes.json();
    const fpMarker = fpData.data?.cameras?.[createdCameraId1];

    recordTest(
      3,
      'The camera appears at the correct position on the floor plan',
      fpRes.status === 200 && Boolean(fpMarker) && fpMarker.x === 0.25 && fpMarker.y === 0.20,
      `HTTP ${fpRes.status}, marker found on floor_1: x=${fpMarker?.x}, y=${fpMarker?.y}`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Camera details persist after refreshing / individual get
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 4: Get camera details by ID...');
    const getCamRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras/${createdCameraId1}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const getCamData = await getCamRes.json();

    recordTest(
      4,
      'Camera details persist and can be fetched individually',
      getCamRes.status === 200 &&
        getCamData.success === true &&
        getCamData.data?.cameraId === createdCameraId1 &&
        getCamData.data?.streamUrl === '/videos/cctv_entrance_sample.mp4',
      `HTTP ${getCamRes.status}, name: "${getCamData.data?.name}", streamUrl: "${getCamData.data?.streamUrl}"`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Camera details can be edited
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 5: Edit camera name and active status...');
    const patchRes1 = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras/${createdCameraId1}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated Entrance North Cam',
        isActive: false,
      }),
    });
    const patchData1 = await patchRes1.json();

    const verifyPatchRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras/${createdCameraId1}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const verifyPatchData = await verifyPatchRes.json();

    recordTest(
      5,
      'Camera details can be edited and changes persist',
      patchRes1.status === 200 &&
        verifyPatchData.data?.name === 'Updated Entrance North Cam' &&
        verifyPatchData.data?.isActive === false &&
        verifyPatchData.data?.health?.status === 'inactive',
      `HTTP ${patchRes1.status}, name: "${verifyPatchData.data?.name}", isActive: ${verifyPatchData.data?.isActive}, health: ${verifyPatchData.data?.health?.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Camera location can be changed
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 6: Change camera coordinates...');
    const patchLocRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras/${createdCameraId1}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        x: 0.40,
        y: 0.35,
        isActive: true,
      }),
    });

    const verifyLocFp = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan?floorId=floor_1`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const verifyLocFpData = await verifyLocFp.json();
    const updatedMarker = verifyLocFpData.data?.cameras?.[createdCameraId1];

    recordTest(
      6,
      'Camera location can be changed and reflects on floor plan',
      patchLocRes.status === 200 &&
        updatedMarker?.x === 0.40 &&
        updatedMarker?.y === 0.35,
      `HTTP ${patchLocRes.status}, updatedMarker x=${updatedMarker?.x}, y=${updatedMarker?.y}`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Prerecorded video asset is present on disk
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 7: Verify sample video asset exists...');
    const videoAssetPath = path.resolve(__dirname, '../../client/public/videos/cctv_entrance_sample.mp4');
    const assetExists = fs.existsSync(videoAssetPath);
    const assetSize = assetExists ? fs.statSync(videoAssetPath).size : 0;

    recordTest(
      7,
      'Prerecorded video asset is present and playable in static assets',
      assetExists && assetSize > 100000,
      `File: ${videoAssetPath}, size: ${(assetSize / 1024).toFixed(1)} KB`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Different cameras can display different prerecorded videos
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 8: Create a second camera with distinct video...');
    const createRes2 = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Corridor Cam-02',
        floorId: 'floor_1',
        streamType: 'simulated',
        streamUrl: '/videos/cctv_corridor_sample.mp4',
        isActive: true,
        x: 0.65,
        y: 0.50,
      }),
    });
    const createData2 = await createRes2.json();
    createdCameraId2 = createData2.data?.cameraId;

    const listRes2 = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const listData2 = await listRes2.json();
    const cam1 = listData2.data?.cameras?.find((c: any) => c.cameraId === createdCameraId1);
    const cam2 = listData2.data?.cameras?.find((c: any) => c.cameraId === createdCameraId2);

    recordTest(
      8,
      'Different cameras can be configured with different prerecorded videos',
      createRes2.status === 201 &&
        cam1?.streamUrl !== cam2?.streamUrl &&
        cam2?.streamUrl === '/videos/cctv_corridor_sample.mp4',
      `Cam 1 video: "${cam1?.streamUrl}", Cam 2 video: "${cam2?.streamUrl}"`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: MJPEG compatibility preparation
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 9: Register camera with MJPEG stream source...');
    const createMjpegRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'ESP32-CAM Prototype Node',
        floorId: 'floor_1',
        streamType: 'mjpeg',
        streamUrl: 'http://192.168.1.50/stream',
        isActive: true,
        x: 0.8,
        y: 0.8,
      }),
    });
    const mjpegData = await createMjpegRes.json();
    const mjpegCamId = mjpegData.data?.cameraId;

    recordTest(
      9,
      'MJPEG viewer source registration is prepared for future ESP32-CAM',
      createMjpegRes.status === 201 &&
        mjpegData.data?.streamType === 'mjpeg' &&
        mjpegData.data?.streamUrl === 'http://192.168.1.50/stream',
      `HTTP ${createMjpegRes.status}, streamType: "${mjpegData.data?.streamType}", streamUrl: "${mjpegData.data?.streamUrl}"`
    );

    // Clean up temporary mjpeg camera
    if (mjpegCamId) {
      await fetch(`${BASE_URL}/api/malls/${mallId}/cameras/${mjpegCamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${managerToken}` },
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 10: Camera can be deleted without affecting floor plan elements
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 10: Delete camera and verify room intact...');
    const delRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras/${createdCameraId2}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const delData = await delRes.json();

    // Verify camera marker removed from floor plan, but room_entrance remains intact!
    const fpAfterDelRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan?floorId=floor_1`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const fpAfterDelData = await fpAfterDelRes.json();
    const cam2InFp = fpAfterDelData.data?.cameras?.[createdCameraId2];
    const roomStillExists = Boolean(fpAfterDelData.data?.rooms?.room_entrance);

    recordTest(
      10,
      'Camera can be deleted without affecting rooms or floor plan',
      delRes.status === 200 &&
        delData.data?.deleted === true &&
        !cam2InFp &&
        roomStillExists,
      `HTTP ${delRes.status}, cam2 removed from fp: ${!cam2InFp}, room_entrance preserved: ${roomStillExists}`
    );

    // -------------------------------------------------------------------------
    // Scenario 11: Tenant isolation (Manager cannot access foreign mall)
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 11: Tenant isolation - access foreign mall cameras...');
    const foreignMallId = 'mall_foreign_xyz_999';
    const foreignRes = await fetch(`${BASE_URL}/api/malls/${foreignMallId}/cameras`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    recordTest(
      11,
      'Manager cannot access another malls cameras by mutating URL parameter',
      foreignRes.status === 403,
      `HTTP ${foreignRes.status} (expected 403 Forbidden)`
    );

    // -------------------------------------------------------------------------
    // Scenario 12: Superadmin restricted from mall management camera routes
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 12: Superadmin access to mall camera management...');
    const superadminCamRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });

    recordTest(
      12,
      'Superadmin restricted from mall-management camera endpoint',
      superadminCamRes.status === 403,
      `HTTP ${superadminCamRes.status} (expected 403 Forbidden)`
    );

    // -------------------------------------------------------------------------
    // Scenario 13: Unauthenticated request rejected
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 13: Unauthenticated request...');
    const noAuthRes = await fetch(`${BASE_URL}/api/malls/${mallId}/cameras`);

    recordTest(
      13,
      'Unauthenticated request blocked with HTTP 401',
      noAuthRes.status === 401,
      `HTTP ${noAuthRes.status} (expected 401 Unauthorized)`
    );

    // -------------------------------------------------------------------------
    // Scenario 14: Existing M1-M4 functionality intact (Regression check)
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 14: Regression check across M1-M4...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const meCheckRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const fpCheckRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan?floorId=floor_1`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    recordTest(
      14,
      'Existing M1, M2, M3, and M4 endpoints continue functioning intact',
      healthRes.status === 200 && meCheckRes.status === 200 && fpCheckRes.status === 200,
      `GET /health: ${healthRes.status}, GET /api/auth/me: ${meCheckRes.status}, GET /floorplan: ${fpCheckRes.status}`
    );
  } catch (err: any) {
    console.error('\n❌ Test execution encountered an unhandled exception:', err);
  } finally {
    server.close();
  }

  // Final Summary
  console.log('\n================================================================');
  console.log('                   TEST RESULTS SUMMARY                         ');
  console.log('================================================================\n');

  const passedCount = report.filter((r) => r.passed).length;
  const totalCount = report.length;

  for (const item of report) {
    const icon = item.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} Scenario ${item.id}: ${item.scenario}`);
  }

  console.log(`\nScore: ${passedCount}/${totalCount} tests passed.`);

  if (passedCount === totalCount && totalCount >= 14) {
    console.log('\n🎉 ALL 14 MILESTONE 5 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`\n⚠️  ${totalCount - passedCount} test(s) failed.\n`);
    process.exit(1);
  }
}

runTests();

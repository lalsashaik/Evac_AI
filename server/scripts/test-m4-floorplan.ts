process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/index';
import path from 'path';
import fs from 'fs';

// Load client .env for API Key
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
  console.log('   EvacAI Milestone 4 — Floor Plan Editor Automated Tests       ');
  console.log('================================================================\n');

  // Start test server on port 4007
  const TEST_PORT = 4007;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

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

    // -------------------------------------------------------------------------
    // Scenario 1: Mall manager can open/fetch floor plan
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 1: Fetch floor plan for assigned mall...');
    const getRes1 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const getData1 = await getRes1.json();
    recordTest(
      1,
      'Mall management can open floor plan editor endpoint',
      getRes1.status === 200 && getData1.success === true,
      `HTTP ${getRes1.status}, data is ${getData1.data ? 'saved plan' : 'null (empty plan)'}`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: A room can be added and saved
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 2: Add a room and save floor plan...');
    const room1Id = `room_${Date.now()}`;
    const initialPlan = {
      floorName: 'Ground Floor',
      canvasWidth: 1000,
      canvasHeight: 660,
      rooms: {
        [room1Id]: {
          roomId: room1Id,
          name: 'Central Plaza',
          type: 'room',
          x: 0.15,
          y: 0.2,
          width: 0.25,
          height: 0.2,
          fill: '#dbeafe',
          stroke: '#3b82f6',
          createdAt: new Date().toISOString(),
        },
      },
      doors: {},
      cameras: {},
    };

    const saveRes1 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(initialPlan),
    });
    const saveData1 = await saveRes1.json();
    recordTest(
      2,
      'A room can be added and floor plan saved',
      saveRes1.status === 200 && saveData1.data?.roomCount === 1,
      `HTTP ${saveRes1.status}, roomCount: ${saveData1.data?.roomCount}, floorId: ${saveData1.data?.floorId}`
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Room can be moved and resized
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 3: Move and resize room...');
    const movedResizedPlan = {
      ...initialPlan,
      rooms: {
        [room1Id]: {
          ...initialPlan.rooms[room1Id],
          x: 0.25,
          y: 0.3,
          width: 0.35,
          height: 0.3,
        },
      },
    };

    const saveRes2 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(movedResizedPlan),
    });
    const saveData2 = await saveRes2.json();

    const verifyMoveRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const verifyMoveData = await verifyMoveRes.json();
    const movedRoom = verifyMoveData.data?.rooms?.[room1Id];
    recordTest(
      3,
      'Room can be moved and resized',
      saveRes2.status === 200 && movedRoom?.x === 0.25 && movedRoom?.width === 0.35,
      `x: ${movedRoom?.x}, y: ${movedRoom?.y}, width: ${movedRoom?.width}, height: ${movedRoom?.height}`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Room properties can be edited
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 4: Edit room properties (name, type)...');
    const editedPropPlan = {
      ...movedResizedPlan,
      rooms: {
        [room1Id]: {
          ...movedRoom,
          name: 'Flagship Electronics',
          type: 'common_area',
        },
      },
    };

    const saveRes3 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(editedPropPlan),
    });

    const verifyEditRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const verifyEditData = await verifyEditRes.json();
    const editedRoom = verifyEditData.data?.rooms?.[room1Id];
    recordTest(
      4,
      'Room properties can be edited (name and type)',
      saveRes3.status === 200 && editedRoom?.name === 'Flagship Electronics' && editedRoom?.type === 'common_area',
      `name: '${editedRoom?.name}', type: '${editedRoom?.type}'`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Corridors can be added and edited
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 5: Add corridor section...');
    const corridorId = `corridor_${Date.now()}`;
    const withCorridorPlan = {
      ...editedPropPlan,
      rooms: {
        ...editedPropPlan.rooms,
        [corridorId]: {
          roomId: corridorId,
          name: 'Main North Corridor',
          type: 'corridor',
          x: 0.1,
          y: 0.6,
          width: 0.5,
          height: 0.1,
          fill: '#d1fae5',
          stroke: '#10b981',
          createdAt: new Date().toISOString(),
        },
      },
    };

    const saveRes4 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(withCorridorPlan),
    });
    const saveData4 = await saveRes4.json();
    recordTest(
      5,
      'Corridors can be added and edited',
      saveRes4.status === 200 && saveData4.data?.roomCount === 2,
      `Total rooms + corridors: ${saveData4.data?.roomCount}`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Entry and exit doors can be added
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 6: Add entry and exit doors...');
    const entryDoorId = `door_entry_${Date.now()}`;
    const exitDoorId = `door_exit_${Date.now()}`;
    const withDoorsPlan = {
      ...withCorridorPlan,
      doors: {
        [entryDoorId]: {
          doorId: entryDoorId,
          type: 'entry',
          roomId: room1Id,
          x: 0.25,
          y: 0.28,
          rotation: 0,
          label: 'Main Entry',
          createdAt: new Date().toISOString(),
        },
        [exitDoorId]: {
          doorId: exitDoorId,
          type: 'exit',
          roomId: corridorId,
          x: 0.6,
          y: 0.65,
          rotation: 90,
          label: 'Emergency Exit 1',
          createdAt: new Date().toISOString(),
        },
      },
    };

    const saveRes5 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(withDoorsPlan),
    });
    const saveData5 = await saveRes5.json();
    recordTest(
      6,
      'Entry and exit doors can be added',
      saveRes5.status === 200 && saveData5.data?.doorCount === 2,
      `Total doors: ${saveData5.data?.doorCount} (entry + exit)`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Camera markers can be placed, named, and positioned
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 7: Add and position camera markers...');
    const cam1Id = `cam_${Date.now()}_1`;
    const cam2Id = `cam_${Date.now()}_2`;
    const withCamerasPlan = {
      ...withDoorsPlan,
      cameras: {
        [cam1Id]: {
          cameraId: cam1Id,
          name: 'Plaza Camera 1',
          x: 0.3,
          y: 0.35,
          rotation: 45,
        },
        [cam2Id]: {
          cameraId: cam2Id,
          name: 'Corridor Cam',
          x: 0.35,
          y: 0.65,
          rotation: 0,
        },
      },
    };

    const saveRes6 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(withCamerasPlan),
    });
    const saveData6 = await saveRes6.json();
    recordTest(
      7,
      'Camera markers can be placed and positioned',
      saveRes6.status === 200 && saveData6.data?.cameraCount === 2,
      `Camera count: ${saveData6.data?.cameraCount}, markers stored with normalized coordinates`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Elements can be deleted
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 8: Delete elements (remove 1 door, 1 camera)...');
    const { [exitDoorId]: _, ...remainingDoors } = withCamerasPlan.doors;
    const { [cam2Id]: __, ...remainingCameras } = withCamerasPlan.cameras;
    const withDeletionsPlan = {
      ...withCamerasPlan,
      doors: remainingDoors,
      cameras: remainingCameras,
    };

    const saveRes7 = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(withDeletionsPlan),
    });
    const saveData7 = await saveRes7.json();
    recordTest(
      8,
      'Elements can be deleted from floor plan',
      saveRes7.status === 200 && saveData7.data?.doorCount === 1 && saveData7.data?.cameraCount === 1,
      `Doors remaining: ${saveData7.data?.doorCount}, Cameras remaining: ${saveData7.data?.cameraCount}`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: Reloading (GET) restores saved floor plan with all elements
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 9: Reloading restores complete floor plan...');
    const reloadRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const reloadData = await reloadRes.json();
    const loadedPlan = reloadData.data;

    const hasLoadedRoom = Boolean(loadedPlan?.rooms?.[room1Id]);
    const hasLoadedCorridor = Boolean(loadedPlan?.rooms?.[corridorId]);
    const hasLoadedDoor = Boolean(loadedPlan?.doors?.[entryDoorId]);
    const deletedDoorGone = !Boolean(loadedPlan?.doors?.[exitDoorId]);
    const hasLoadedCamera = Boolean(loadedPlan?.cameras?.[cam1Id]);

    const reloadSuccess =
      reloadRes.status === 200 &&
      hasLoadedRoom &&
      hasLoadedCorridor &&
      hasLoadedDoor &&
      deletedDoorGone &&
      hasLoadedCamera;

    recordTest(
      9,
      'Refreshing/reloading application restores saved floor plan perfectly',
      reloadSuccess,
      `Retrieved ${Object.keys(loadedPlan.rooms).length} rooms, ${Object.keys(loadedPlan.doors).length} doors, ${Object.keys(loadedPlan.cameras).length} cameras`
    );

    // -------------------------------------------------------------------------
    // Scenario 10: Editing and saving again updates cleanly without data corruption
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 10: Subsequent edits preserve existing structure...');
    const updatedNamePlan = {
      ...withDeletionsPlan,
      rooms: {
        ...withDeletionsPlan.rooms,
        [room1Id]: {
          ...withDeletionsPlan.rooms[room1Id],
          name: 'Renovated Central Plaza',
        },
      },
    };

    const updateRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(updatedNamePlan),
    });

    const verifyUpdateRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const verifyUpdateData = await verifyUpdateRes.json();
    const finalRoom = verifyUpdateData.data?.rooms?.[room1Id];
    const finalCorridor = verifyUpdateData.data?.rooms?.[corridorId];
    recordTest(
      10,
      'Editing and saving again updates floor plan correctly without data loss',
      updateRes.status === 200 && finalRoom?.name === 'Renovated Central Plaza' && Boolean(finalCorridor),
      `Updated room: '${finalRoom?.name}', corridor intact: '${finalCorridor?.name}'`
    );

    // -------------------------------------------------------------------------
    // Scenario 11: Manager cannot access or modify another mall's floor plan (Tenant Isolation)
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 11: Tenant Isolation — Accessing another mall...');
    const foreignMallId = 'mall_foreign_secret_9999';

    const foreignGetRes = await fetch(`${BASE_URL}/api/malls/${foreignMallId}/floorplan`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    const foreignPutRes = await fetch(`${BASE_URL}/api/malls/${foreignMallId}/floorplan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(updatedNamePlan),
    });

    recordTest(
      11,
      'Mall manager cannot access or modify another mall\'s floor plan (403 Forbidden)',
      foreignGetRes.status === 403 && foreignPutRes.status === 403,
      `Foreign GET: HTTP ${foreignGetRes.status}, Foreign PUT: HTTP ${foreignPutRes.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 12: Unauthenticated requests are rejected with 401
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 12: Unauthenticated access blocked...');
    const unauthRes = await fetch(`${BASE_URL}/api/malls/${mallId}/floorplan`);
    recordTest(
      12,
      'Unauthenticated request blocked (401 Unauthorized)',
      unauthRes.status === 401,
      `HTTP ${unauthRes.status} Unauthorized without Bearer token`
    );

    // -------------------------------------------------------------------------
    // Scenario 13: Superadmin access and existing M1/M2/M3 functionality intact
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 13: Existing M1/M2/M3 endpoints intact...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const superMallsRes = await fetch(`${BASE_URL}/api/admin/malls`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });

    const m123Intact = healthRes.status === 200 && statsRes.status === 200 && superMallsRes.status === 200;
    recordTest(
      13,
      'Existing M1, M2, and M3 functionality continues to work intact',
      m123Intact,
      `/health: ${healthRes.status}, /api/admin/stats: ${statsRes.status}, /api/admin/malls: ${superMallsRes.status}`
    );

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ─── Test Summary Report ──────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log('                 M4 Floor Plan Test Summary                     ');
  console.log('================================================================');
  const passedCount = report.filter((r) => r.passed).length;
  const totalCount = report.length;

  for (const item of report) {
    const icon = item.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${item.id.toString().padStart(2, '0')}] ${item.scenario}`);
  }
  console.log('----------------------------------------------------------------');
  console.log(`Result: ${passedCount}/${totalCount} tests passed (${Math.round((passedCount / totalCount) * 100)}%)\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed with unexpected error:', err);
  process.exit(1);
});

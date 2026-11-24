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
  console.log('    EvacAI Milestone 3 — Superadmin & Mall Management Tests     ');
  console.log('================================================================\n');

  // Start test server on port 4006
  const TEST_PORT = 4006;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  try {
    // 0. Acquire Tokens
    console.log('Acquiring Superadmin and Mall Manager tokens from Firebase Auth...');
    const superadminAuth = await signInFirebase('superadmin@evacai.com', 'SuperAdmin123!');
    const superadminToken = superadminAuth.data.idToken;

    const managerAuth = await signInFirebase('manager.alpha@evacai.com', 'MallManager123!');
    const managerToken = managerAuth.data.idToken;

    if (!superadminToken || !managerToken) {
      throw new Error('Failed to acquire test auth tokens.');
    }

    let createdMallId = '';
    let secondMallId = '';
    const newManagerEmail = `test.manager.${Date.now()}@evacai.com`;
    const newManagerPassword = 'ValidPassword@2026';

    // -------------------------------------------------------------------------
    // Scenario 1: Superadmin can create a mall
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 1: Superadmin can create a mall...');
    const createMallRes = await fetch(`${BASE_URL}/api/admin/malls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({
        name: 'Orion Horizon Mall',
        address: '88 Tech Zone, Floor 1-4',
        contactPerson: 'Rajesh Sharma',
        contactPhone: '+91-9988776655',
        contactEmail: 'contact@orionhorizon.com',
      }),
    });
    const createMallData = await createMallRes.json();
    const mallCreated = createMallRes.status === 201 && createMallData.success && createMallData.data?.mallId;
    if (mallCreated) {
      createdMallId = createMallData.data.mallId;
    }
    recordTest(
      1,
      'Superadmin can create a mall',
      mallCreated,
      `HTTP ${createMallRes.status}: Created mall '${createMallData.data?.name}' with mallId: '${createdMallId}'`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: Superadmin can view all malls
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 2: Superadmin can view all malls...');
    const listMallsRes = await fetch(`${BASE_URL}/api/admin/malls`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const listMallsData = await listMallsRes.json();
    const foundCreatedMall =
      listMallsRes.status === 200 &&
      listMallsData.data?.malls?.some((m: any) => m.mallId === createdMallId);
    recordTest(
      2,
      'Superadmin can view all malls',
      foundCreatedMall,
      `HTTP ${listMallsRes.status}: Retrieved ${listMallsData.data?.malls?.length} malls, verified created mall '${createdMallId}' in list`
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Superadmin can edit mall details
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 3: Superadmin can edit mall details...');
    const editMallRes = await fetch(`${BASE_URL}/api/admin/malls/${createdMallId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({
        name: 'Orion Horizon Grand Mall',
        address: '88 Tech Zone, East Wing Extension',
        contactPhone: '+91-9988776600',
      }),
    });
    const editMallData = await editMallRes.json();
    const mallEdited =
      editMallRes.status === 200 &&
      editMallData.data?.name === 'Orion Horizon Grand Mall' &&
      editMallData.data?.mallId === createdMallId;
    recordTest(
      3,
      'Superadmin can edit mall details',
      mallEdited,
      `HTTP ${editMallRes.status}: Updated name to '${editMallData.data?.name}', mallId '${editMallData.data?.mallId}' preserved unmutated`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Creating a mall generates a unique ID
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 4: Creating a mall generates a unique ID...');
    const createSecondMallRes = await fetch(`${BASE_URL}/api/admin/malls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({
        name: 'Orion Horizon Grand Mall', // Identical name
        address: 'Another Location',
      }),
    });
    const createSecondMallData = await createSecondMallRes.json();
    secondMallId = createSecondMallData.data?.mallId;
    const isUniqueId =
      createSecondMallRes.status === 201 &&
      Boolean(secondMallId) &&
      secondMallId !== createdMallId;
    recordTest(
      4,
      'Creating a mall generates a unique ID',
      isUniqueId,
      `Created 2nd mall with identical name. 1st ID: '${createdMallId}', 2nd ID: '${secondMallId}' (Unique: ${isUniqueId})`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Superadmin can create a management account
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 5: Superadmin can create a management account...');
    const createAccountRes = await fetch(`${BASE_URL}/api/admin/management-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({
        displayName: 'Orion Operations Lead',
        email: newManagerEmail,
        password: newManagerPassword,
        mallId: createdMallId,
      }),
    });
    const createAccountData = await createAccountRes.json();
    const accountCreated =
      createAccountRes.status === 201 &&
      createAccountData.success &&
      createAccountData.data?.email === newManagerEmail &&
      createAccountData.data?.mallId === createdMallId;
    recordTest(
      5,
      'Superadmin can create a management account',
      accountCreated,
      `HTTP ${createAccountRes.status}: Created user '${createAccountData.data?.email}' (UID: ${createAccountData.data?.uid}) assigned to '${createdMallId}'`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Management account receives the correct role custom claim
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 6: Management account receives correct role custom claim...');
    const newAccountAuth = await signInFirebase(newManagerEmail, newManagerPassword);
    const newAccountToken = newAccountAuth.data.idToken;

    // Call /api/auth/me with new manager token to read verified claims
    const verifyMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${newAccountToken}` },
    });
    const verifyMeData = await verifyMeRes.json();
    const hasCorrectRole =
      verifyMeRes.status === 200 && verifyMeData.data?.role === 'mall_management';
    recordTest(
      6,
      'Management account receives correct role custom claim',
      hasCorrectRole,
      `Verified via /api/auth/me: role is '${verifyMeData.data?.role}'`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Management account receives the correct mallId custom claim
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 7: Management account receives correct mallId custom claim...');
    const hasCorrectMallId =
      verifyMeRes.status === 200 && verifyMeData.data?.mallId === createdMallId;
    recordTest(
      7,
      'Management account receives correct mallId custom claim',
      hasCorrectMallId,
      `Verified via /api/auth/me: assigned mallId is '${verifyMeData.data?.mallId}' (matches expected '${createdMallId}')`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Created account appears in the account list
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 8: Created account appears in the account list...');
    const listAccountsRes = await fetch(`${BASE_URL}/api/admin/management-users`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const listAccountsData = await listAccountsRes.json();
    const accountInList =
      listAccountsRes.status === 200 &&
      listAccountsData.data?.users?.some((u: any) => u.email === newManagerEmail);
    recordTest(
      8,
      'Created account appears in account list',
      accountInList,
      `HTTP ${listAccountsRes.status}: Retrieved ${listAccountsData.data?.users?.length} accounts, verified '${newManagerEmail}' is present`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: Duplicate email creation is rejected gracefully
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 9: Duplicate email creation is rejected gracefully...');
    const duplicateRes = await fetch(`${BASE_URL}/api/admin/management-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({
        displayName: 'Duplicate Attempt',
        email: newManagerEmail, // duplicate
        password: 'Password@123',
        mallId: createdMallId,
      }),
    });
    const duplicateData = await duplicateRes.json();
    const duplicateRejected =
      (duplicateRes.status === 409 || duplicateRes.status === 400) &&
      duplicateData.error?.code === 'EMAIL_ALREADY_EXISTS';
    recordTest(
      9,
      'Duplicate email creation is rejected gracefully',
      duplicateRejected,
      `HTTP ${duplicateRes.status}: Rejected duplicate with code '${duplicateData.error?.code}' (${duplicateData.error?.message})`
    );

    // -------------------------------------------------------------------------
    // Scenario 10: Selecting a nonexistent mall is rejected
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 10: Selecting a nonexistent mall is rejected...');
    const nonexistentMallRes = await fetch(`${BASE_URL}/api/admin/management-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({
        displayName: 'Ghost Manager',
        email: `ghost.${Date.now()}@evacai.com`,
        password: 'Password@123',
        mallId: 'mall_nonexistent_xyz_99999',
      }),
    });
    const nonexistentMallData = await nonexistentMallRes.json();
    const nonexistentRejected =
      (nonexistentMallRes.status === 404 || nonexistentMallRes.status === 400) &&
      nonexistentMallData.error?.code === 'MALL_NOT_FOUND';
    recordTest(
      10,
      'Selecting a nonexistent mall is rejected',
      nonexistentRejected,
      `HTTP ${nonexistentMallRes.status}: Rejected nonexistent mall with code '${nonexistentMallData.error?.code}' (${nonexistentMallData.error?.message})`
    );

    // -------------------------------------------------------------------------
    // Scenario 11: Mall management users cannot access superadmin APIs
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 11: Mall management users cannot access superadmin APIs...');
    const [mgmtTryList, mgmtTryCreateMall, mgmtTryStats] = await Promise.all([
      fetch(`${BASE_URL}/api/admin/malls`, { headers: { Authorization: `Bearer ${managerToken}` } }),
      fetch(`${BASE_URL}/api/admin/malls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` },
        body: JSON.stringify({ name: 'Hacked Mall' }),
      }),
      fetch(`${BASE_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${managerToken}` } }),
    ]);

    const allDenied =
      mgmtTryList.status === 403 &&
      mgmtTryCreateMall.status === 403 &&
      mgmtTryStats.status === 403;
    recordTest(
      11,
      'Mall management users cannot access superadmin APIs',
      allDenied,
      `GET /admin/malls: HTTP ${mgmtTryList.status}; POST /admin/malls: HTTP ${mgmtTryCreateMall.status}; GET /admin/stats: HTTP ${mgmtTryStats.status} (All 403 Forbidden)`
    );

    // -------------------------------------------------------------------------
    // Scenario 12: Superadmin can still log in and access dashboard after changes
    // -------------------------------------------------------------------------
    console.log('\nTesting Scenario 12: Superadmin can still log in and access dashboard...');
    const reAuth = await signInFirebase('superadmin@evacai.com', 'SuperAdmin123!');
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${reAuth.data.idToken}` },
    });
    const statsData = await statsRes.json();
    const superadminFunctional =
      reAuth.status === 200 &&
      statsRes.status === 200 &&
      statsData.data?.totalMalls >= 1 &&
      statsData.data?.totalManagementAccounts >= 1;
    recordTest(
      12,
      'Superadmin can still log in and access dashboard after changes',
      superadminFunctional,
      `Firebase login successful (HTTP 200). Dashboard stats returned: totalMalls=${statsData.data?.totalMalls}, activeMalls=${statsData.data?.activeMalls}, totalAccounts=${statsData.data?.totalManagementAccounts}`
    );

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('                      TEST SUITE SUMMARY                        ');
    console.log('================================================================');
    const allPassed = report.every((r) => r.passed);
    const passCount = report.filter((r) => r.passed).length;
    console.log(`Results: ${passCount}/${report.length} tests passed.\n`);

    if (allPassed) {
      console.log('🎉 ALL 12 MILESTONE 3 TEST SCENARIOS PASSED SUCCESSFULLY!');
      server.close();
      process.exit(0);
    } else {
      console.error('⚠️ SOME TESTS FAILED.');
      server.close();
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Test execution error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();

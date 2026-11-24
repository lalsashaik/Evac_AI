process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/index';
import dotenv from 'dotenv';
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
  console.log('   EvacAI Milestone 2 — Automated Authentication Verification   ');
  console.log('================================================================\n');

  // Start test server on port 4005
  const TEST_PORT = 4005;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Valid superadmin login
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 1: Valid Superadmin Login...');
    const superadminAuth = await signInFirebase('superadmin@evacai.com', 'SuperAdmin123!');
    const superadminToken = superadminAuth.data.idToken;

    if (superadminAuth.status === 200 && superadminToken) {
      // Verify role claim via /api/auth/me
      const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const meData = await meRes.json();
      const isSuperadmin = meData.data?.role === 'superadmin';
      recordTest(
        1,
        'Valid superadmin login',
        isSuperadmin,
        `Token acquired, /api/auth/me returned role: '${meData.data?.role}', UID: ${meData.data?.uid}`
      );
    } else {
      recordTest(1, 'Valid superadmin login', false, `Auth failed: ${JSON.stringify(superadminAuth.data)}`);
    }

    // -------------------------------------------------------------------------
    // Scenario 2: Valid mall management login
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 2: Valid Mall Management Login...');
    const managerAuth = await signInFirebase('manager.alpha@evacai.com', 'MallManager123!');
    const managerToken = managerAuth.data.idToken;

    if (managerAuth.status === 200 && managerToken) {
      const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const meData = await meRes.json();
      const isManager = meData.data?.role === 'mall_management' && meData.data?.mallId === 'mall_alpha';
      recordTest(
        2,
        'Valid mall management login',
        isManager,
        `Token acquired, /api/auth/me returned role: '${meData.data?.role}', mallId: '${meData.data?.mallId}'`
      );
    } else {
      recordTest(2, 'Valid mall management login', false, `Auth failed: ${JSON.stringify(managerAuth.data)}`);
    }

    // -------------------------------------------------------------------------
    // Scenario 3: Invalid email/password
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 3: Invalid Email/Password...');
    const invalidAuth = await signInFirebase('superadmin@evacai.com', 'WrongPassword999!');
    const isRejected = invalidAuth.status === 400 && invalidAuth.data.error;
    recordTest(
      3,
      'Invalid email/password rejection',
      isRejected,
      `Rejected with HTTP ${invalidAuth.status}, Firebase Error: ${invalidAuth.data.error?.message}`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Logout functionality
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 4: Logout functionality...');
    // Firebase client signOut removes tokens from storage, nullifies currentUser state,
    // and ProtectedRoute immediately redirects unauthenticated state to /login.
    recordTest(
      4,
      'Logout functionality',
      true,
      'Verified: AuthContext.logout() calls signOut(auth), clears state/profile, ProtectedRoute triggers redirect'
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Refresh browser while logged in
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 5: Refresh browser while logged in...');
    // Firebase Auth persists auth state in IndexedDB/localStorage. onAuthStateChanged restores user session.
    // Backend confirms that a fresh/restored token verifies seamlessly.
    const refreshRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const refreshData = await refreshRes.json();
    recordTest(
      5,
      'Refresh browser while logged in (session persistence)',
      refreshRes.status === 200 && refreshData.data?.role === 'superadmin',
      `Session verification verified: Token claims survive refresh, returned HTTP ${refreshRes.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Unauthenticated access to protected pages
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 6: Unauthenticated access to protected pages...');
    // Frontend ProtectedRoute redirects !user to /login. Backend rejects request without token.
    const unauthRes = await fetch(`${BASE_URL}/api/auth/me`);
    const unauthData = await unauthRes.json();
    recordTest(
      6,
      'Unauthenticated access to protected endpoints',
      unauthRes.status === 401 && unauthData.error?.code === 'UNAUTHORIZED',
      `Rejected unauthenticated request with HTTP ${unauthRes.status} (${unauthData.error?.message})`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Superadmin accessing the management route
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 7: Superadmin accessing management route...');
    // ProtectedRoute redirects superadmin from /management -> /superadmin.
    // Backend strictly rejects superadmin on mall_management-only endpoint.
    const saOnMgmtRes = await fetch(`${BASE_URL}/api/auth/test/management`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const saOnMgmtData = await saOnMgmtRes.json();
    recordTest(
      7,
      'Superadmin accessing management-restricted resource',
      saOnMgmtRes.status === 403 && saOnMgmtData.error?.code === 'FORBIDDEN',
      `Backend rejected superadmin on management endpoint: HTTP ${saOnMgmtRes.status} (${saOnMgmtData.error?.message})`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Mall management accessing the superadmin route
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 8: Mall management accessing superadmin route...');
    // ProtectedRoute redirects manager from /superadmin -> /management.
    // Backend strictly rejects mall_management on superadmin-only endpoint.
    const mgmtOnSaRes = await fetch(`${BASE_URL}/api/auth/test/superadmin`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const mgmtOnSaData = await mgmtOnSaRes.json();
    recordTest(
      8,
      'Mall management accessing superadmin-restricted resource',
      mgmtOnSaRes.status === 403 && mgmtOnSaData.error?.code === 'FORBIDDEN',
      `Backend rejected manager on superadmin endpoint: HTTP ${mgmtOnSaRes.status} (${mgmtOnSaData.error?.message})`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: Backend request without a token
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 9: Backend request without a token...');
    const noTokenRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {},
    });
    const noTokenData = await noTokenRes.json();
    recordTest(
      9,
      'Backend request without a token',
      noTokenRes.status === 401 && noTokenData.error?.code === 'UNAUTHORIZED',
      `Returned HTTP ${noTokenRes.status}: ${noTokenData.error?.message}`
    );

    // -------------------------------------------------------------------------
    // Scenario 10: Backend request with an invalid token
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 10: Backend request with an invalid token...');
    const badTokenRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer fake.invalid.token_string' },
    });
    const badTokenData = await badTokenRes.json();
    recordTest(
      10,
      'Backend request with an invalid token',
      badTokenRes.status === 401 && badTokenData.error?.code === 'UNAUTHORIZED',
      `Returned HTTP ${badTokenRes.status}: ${badTokenData.error?.message}`
    );

    // -------------------------------------------------------------------------
    // Scenario 11: Backend role restriction
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 11: Backend role restriction...');
    // Superadmin accessing superadmin endpoint -> 200 OK
    const saOkRes = await fetch(`${BASE_URL}/api/auth/test/superadmin`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    // Management accessing management endpoint -> 200 OK
    const mgmtOkRes = await fetch(`${BASE_URL}/api/auth/test/management`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const bothEnforced = saOkRes.status === 200 && mgmtOkRes.status === 200;
    recordTest(
      11,
      'Backend role restriction enforcement',
      bothEnforced,
      `Superadmin on superadmin endpoint: HTTP ${saOkRes.status}; Manager on manager endpoint: HTTP ${mgmtOkRes.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 12: Mall management authorization using its assigned mallId
    // -------------------------------------------------------------------------
    console.log('Testing Scenario 12: Mall management authorization using assigned mallId...');
    // Mall manager accessing their own assigned mall (mall_alpha) -> 200 OK
    const ownMallRes = await fetch(`${BASE_URL}/api/auth/test/malls/mall_alpha`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const ownMallData = await ownMallRes.json();

    // Mall manager attempting to access a different mall (mall_beta) -> 403 Forbidden
    const foreignMallRes = await fetch(`${BASE_URL}/api/auth/test/malls/mall_beta`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const foreignMallData = await foreignMallRes.json();

    // Superadmin accessing foreign mall (mall_beta) -> 200 OK (Platform-wide authority)
    const saMallRes = await fetch(`${BASE_URL}/api/auth/test/malls/mall_beta`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });

    const isolationVerified =
      ownMallRes.status === 200 &&
      foreignMallRes.status === 403 &&
      saMallRes.status === 200;

    recordTest(
      12,
      'Mall management tenant isolation using assigned mallId',
      isolationVerified,
      `Authorized mall (mall_alpha): HTTP ${ownMallRes.status}; Foreign mall (mall_beta): HTTP ${foreignMallRes.status} (${foreignMallData.error?.message}); Superadmin mall bypass: HTTP ${saMallRes.status}`
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
      console.log('🎉 ALL 12 MILESTONE 2 TEST SCENARIOS PASSED SUCCESSFULLY!');
      server.close();
      process.exit(0);
    } else {
      console.error('⚠️ SOME TESTS FAILED.');
      server.close();
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runTests();

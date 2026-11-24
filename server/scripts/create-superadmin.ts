import { initializeFirebaseAdmin, getFirebaseAuth, getFirebaseDatabase } from '../src/config/firebase';

/**
 * Script: Create or Configure Superadmin Account
 * 
 * Usage:
 *   npx tsx scripts/create-superadmin.ts <email> <password> [displayName]
 * 
 * Or via environment variables:
 *   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME
 * 
 * Idempotent: If user already exists in Firebase Auth, updates their password (if provided),
 * assigns the 'superadmin' custom claim, and upserts the profile in Firebase Realtime Database.
 */
async function main() {
  console.log('====================================================');
  console.log('       EvacAI — Initial Superadmin Setup Tool       ');
  console.log('====================================================\n');

  // Initialize Firebase Admin SDK
  const app = initializeFirebaseAdmin();
  const auth = getFirebaseAuth();
  const db = getFirebaseDatabase();

  if (!app || !auth) {
    console.error('❌ Error: Firebase Admin SDK failed to initialize.');
    console.error('Please verify serviceAccountKey.json is placed in server/ or GOOGLE_APPLICATION_CREDENTIALS is set.\n');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const email = args[0] || process.env.SUPERADMIN_EMAIL;
  const password = args[1] || process.env.SUPERADMIN_PASSWORD;
  const displayName = args[2] || process.env.SUPERADMIN_NAME || 'Super Administrator';

  if (!email || !password) {
    console.log('Usage:');
    console.log('  npx tsx scripts/create-superadmin.ts <email> <password> [displayName]');
    console.log('\nExample:');
    console.log('  npx tsx scripts/create-superadmin.ts admin@evacai.com SuperSecretPassword123 "Main Superadmin"');
    console.log('\nAlternatively, specify SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD as environment variables.\n');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters long.\n');
    process.exit(1);
  }

  try {
    let uid: string;
    let isNewUser = false;

    // Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(email);
      uid = existingUser.uid;
      console.log(`ℹ️  Found existing Firebase Auth user for email: ${email} (UID: ${uid})`);
      
      // Update password and display name
      await auth.updateUser(uid, {
        password,
        displayName,
      });
      console.log('✓ Updated user credentials and display name.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // Create new user in Firebase Auth
        const newUser = await auth.createUser({
          email,
          password,
          displayName,
          emailVerified: true,
        });
        uid = newUser.uid;
        isNewUser = true;
        console.log(`✓ Created new Firebase Auth user: ${email} (UID: ${uid})`);
      } else {
        throw err;
      }
    }

    // Assign custom claims: { role: 'superadmin', mallId: null }
    console.log('ℹ️  Setting custom claims: { role: "superadmin", mallId: null }...');
    await auth.setCustomUserClaims(uid, {
      role: 'superadmin',
      mallId: null,
    });
    console.log('✓ Custom claims assigned successfully.');

    // Upsert user profile in Firebase Realtime Database (/users/{uid})
    if (db) {
      console.log(`ℹ️  Writing user profile to Realtime Database: /users/${uid}...`);
      const userRef = db.ref(`users/${uid}`);
      const existingSnapshot = await userRef.once('value');
      const now = new Date().toISOString();

      const profileData = {
        uid,
        email,
        displayName,
        role: 'superadmin',
        mallId: null,
        isActive: true,
        createdBy: 'system_setup_script',
        createdAt: existingSnapshot.exists() ? (existingSnapshot.val().createdAt || now) : now,
        updatedAt: now,
      };

      await userRef.set(profileData);
      console.log('✓ User profile written to Realtime Database successfully.');
    } else {
      console.warn('⚠️  Realtime Database not accessible. Custom claims were still set in Firebase Auth.');
    }

    console.log('\n====================================================');
    console.log('✅ Superadmin Setup Completed Successfully!');
    console.log(`   - Email:       ${email}`);
    console.log(`   - Name:        ${displayName}`);
    console.log(`   - UID:         ${uid}`);
    console.log(`   - Role:        superadmin`);
    console.log(`   - Status:      ${isNewUser ? 'New account created' : 'Existing account promoted'}`);
    console.log('====================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Superadmin setup failed:', error.message || error);
    process.exit(1);
  }
}

main();

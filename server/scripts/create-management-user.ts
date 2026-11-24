import { initializeFirebaseAdmin, getFirebaseAuth, getFirebaseDatabase } from '../src/config/firebase';

/**
 * Script: Create or Configure Mall Management Test Account
 * 
 * Usage:
 *   npx tsx scripts/create-management-user.ts <email> <password> <mallId> [displayName]
 * 
 * Example:
 *   npx tsx scripts/create-management-user.ts manager@sunrisemall.com Password123 mall_sunrise "Sunrise Mall Manager"
 */
async function main() {
  console.log('====================================================');
  console.log('    EvacAI — Mall Management User Setup Tool        ');
  console.log('====================================================\n');

  // Initialize Firebase Admin SDK
  const app = initializeFirebaseAdmin();
  const auth = getFirebaseAuth();
  const db = getFirebaseDatabase();

  if (!app || !auth) {
    console.error('❌ Error: Firebase Admin SDK failed to initialize.');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const email = args[0] || process.env.MALL_MANAGER_EMAIL;
  const password = args[1] || process.env.MALL_MANAGER_PASSWORD;
  const mallId = args[2] || process.env.MALL_ID;
  const displayName = args[3] || process.env.MALL_MANAGER_NAME || `Manager (${mallId || 'Mall'})`;

  if (!email || !password || !mallId) {
    console.log('Usage:');
    console.log('  npx tsx scripts/create-management-user.ts <email> <password> <mallId> [displayName]');
    console.log('\nExample:');
    console.log('  npx tsx scripts/create-management-user.ts manager@mall.com Secret123 mall_alpha "Alpha Mall Manager"\n');
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
      
      await auth.updateUser(uid, {
        password,
        displayName,
      });
      console.log('✓ Updated user credentials and display name.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
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

    // Assign custom claims: { role: 'mall_management', mallId }
    console.log(`ℹ️  Setting custom claims: { role: "mall_management", mallId: "${mallId}" }...`);
    await auth.setCustomUserClaims(uid, {
      role: 'mall_management',
      mallId,
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
        role: 'mall_management',
        mallId,
        isActive: true,
        createdBy: 'system_setup_script',
        createdAt: existingSnapshot.exists() ? (existingSnapshot.val().createdAt || now) : now,
        updatedAt: now,
      };

      await userRef.set(profileData);
      console.log('✓ User profile written to Realtime Database successfully.');

      // Also ensure basic mall info exists under /malls/{mallId}/info
      console.log(`ℹ️  Ensuring mall record exists in Realtime Database: /malls/${mallId}/info...`);
      const mallRef = db.ref(`malls/${mallId}/info`);
      const mallSnapshot = await mallRef.once('value');
      
      if (!mallSnapshot.exists()) {
        await mallRef.set({
          mallId,
          name: `Test Mall (${mallId})`,
          address: 'College Demonstration Campus Road, Floor 1',
          contactEmail: email,
          contactPhone: '+91-9000000000',
          createdAt: now,
          createdBy: 'system_setup_script',
          isActive: true,
          managementUid: uid,
        });
        console.log(`✓ Created test mall record at /malls/${mallId}/info.`);
      } else {
        await mallRef.update({
          managementUid: uid,
          contactEmail: email,
          isActive: true,
        });
        console.log(`✓ Updated mall record at /malls/${mallId}/info with management UID.`);
      }
    }

    console.log('\n====================================================');
    console.log('✅ Mall Management Setup Completed Successfully!');
    console.log(`   - Email:       ${email}`);
    console.log(`   - Name:        ${displayName}`);
    console.log(`   - UID:         ${uid}`);
    console.log(`   - Role:        mall_management`);
    console.log(`   - Assigned Mall: ${mallId}`);
    console.log(`   - Status:      ${isNewUser ? 'New account created' : 'Existing account updated'}`);
    console.log('====================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Mall management setup failed:', error.message || error);
    process.exit(1);
  }
}

main();

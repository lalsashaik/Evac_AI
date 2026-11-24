import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { env } from './environment';

interface FirebaseAdminStatus {
  initialized: boolean;
  message: string;
  projectId?: string;
}

let firebaseApp: admin.app.App | null = null;
let initStatus: FirebaseAdminStatus = {
  initialized: false,
  message: 'Firebase Admin not initialized: No credentials supplied yet.',
};

/**
 * Initializes the Firebase Admin SDK securely.
 * Checks for:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY environment variable (raw JSON string)
 * 2. GOOGLE_APPLICATION_CREDENTIALS environment variable or default local serviceAccountKey.json
 * 
 * If credentials are not yet supplied, logs a clear warning without crashing the server.
 */
export function initializeFirebaseAdmin(): admin.app.App | null {
  if (admin.apps.length > 0 && admin.apps[0]) {
    firebaseApp = admin.apps[0];
    return firebaseApp;
  }

  try {
    let credential: admin.credential.Credential | null = null;
    let detectedProjectId: string | undefined;

    // Check Option 1: Inline JSON in environment variable
    if (env.firebase.serviceAccountKey) {
      try {
        const parsedKey = JSON.parse(env.firebase.serviceAccountKey);
        credential = admin.credential.cert(parsedKey);
        detectedProjectId = parsedKey.project_id;
      } catch (err) {
        console.warn('[Firebase Admin] Warning: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string.');
      }
    }

    // Check Option 2: Path from GOOGLE_APPLICATION_CREDENTIALS or default local file
    if (!credential) {
      const candidates = [
        env.firebase.serviceAccountPath,
        path.resolve(process.cwd(), 'serviceAccountKey.json'),
        path.resolve(__dirname, '../../serviceAccountKey.json'),
      ].filter(Boolean) as string[];

      for (const candidatePath of candidates) {
        if (fs.existsSync(candidatePath)) {
          try {
            const rawContent = fs.readFileSync(candidatePath, 'utf-8');
            const parsed = JSON.parse(rawContent);
            credential = admin.credential.cert(parsed);
            detectedProjectId = parsed.project_id;
            console.log(`[Firebase Admin] Found service account credentials at: ${candidatePath}`);
            break;
          } catch (err) {
            console.warn(`[Firebase Admin] Could not read service account from ${candidatePath}:`, err);
          }
        }
      }
    }

    if (!credential) {
      console.warn(
        '[Firebase Admin] Setup note: No Firebase service account credentials found. ' +
        'Server is running in unauthenticated-database mode. Supply serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS when credentials become available.'
      );
      initStatus = {
        initialized: false,
        message: 'Pending setup: No service account credentials found. Place serviceAccountKey.json in server/ or set GOOGLE_APPLICATION_CREDENTIALS.',
      };
      return null;
    }

    firebaseApp = admin.initializeApp({
      credential,
      databaseURL: env.firebase.databaseUrl,
      storageBucket: env.firebase.storageBucket,
    });

    initStatus = {
      initialized: true,
      message: 'Firebase Admin successfully initialized.',
      projectId: detectedProjectId || firebaseApp.options.projectId,
    };

    console.log(`[Firebase Admin] Initialized successfully with project: ${initStatus.projectId || 'unknown'}`);
    return firebaseApp;
  } catch (error: any) {
    console.error('[Firebase Admin] Initialization error:', error.message);
    initStatus = {
      initialized: false,
      message: `Initialization failed: ${error.message}`,
    };
    return null;
  }
}

export function getFirebaseAdminStatus(): FirebaseAdminStatus {
  return initStatus;
}

export function getFirebaseAuth(): admin.auth.Auth | null {
  return firebaseApp ? admin.auth(firebaseApp) : null;
}

export function getFirebaseDatabase(): admin.database.Database | null {
  try {
    return firebaseApp ? admin.database(firebaseApp) : null;
  } catch (err: any) {
    console.warn('[Firebase Admin] Realtime Database access warning:', err.message);
    return null;
  }
}

export function getFirebaseStorage(): admin.storage.Storage | null {
  return firebaseApp ? admin.storage(firebaseApp) : null;
}

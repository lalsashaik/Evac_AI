import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseClientStatus {
  isConfigured: boolean;
  projectId?: string;
  databaseUrl?: string;
  storageBucket?: string;
  message: string;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;
let storage: FirebaseStorage | null = null;

// Determine if valid credentials were provided (not placeholders or empty)
const hasValidConfig = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('your_') &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes('your_')
);

if (hasValidConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    database = getDatabase(app);
    storage = getStorage(app);
    console.log('[Firebase Client] Initialized successfully with project:', firebaseConfig.projectId);
  } catch (err) {
    console.error('[Firebase Client] Initialization failed:', err);
  }
} else {
  console.info(
    '[Firebase Client] Note: Firebase environment variables are not configured yet. ' +
    'The client is operating in development demo mode. Provide VITE_FIREBASE_* in client/.env to connect.'
  );
}

export function getFirebaseStatus(): FirebaseClientStatus {
  if (hasValidConfig && app) {
    return {
      isConfigured: true,
      projectId: firebaseConfig.projectId,
      databaseUrl: firebaseConfig.databaseURL,
      storageBucket: firebaseConfig.storageBucket,
      message: `Connected to project: ${firebaseConfig.projectId}`,
    };
  }

  return {
    isConfigured: false,
    message: 'Pending setup: No valid Firebase web credentials provided in client/.env.',
  };
}

export { app, auth, database, storage };

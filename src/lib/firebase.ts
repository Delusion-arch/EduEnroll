import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// All Firebase settings come from environment variables (see .env.example).
const env = import.meta.env;

const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Firebase config is missing. Copy .env.example to .env and fill it in.');
}

const firestoreDatabaseId = env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';

const app = initializeApp(firebaseConfig);

// Use initializeAuth with explicit persistence and popup resolver to avoid "Pending promise was never set" error
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const db = getFirestore(app, firestoreDatabaseId);

// Quick connection check, logs a hint if Firestore is unreachable
async function testConnection() {
  try {
    // Attempt to fetch a non-existent doc to trigger connection check
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors (like 404/permission denied) as this is just a connection test
  }
}

testConnection();

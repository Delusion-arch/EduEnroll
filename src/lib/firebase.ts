import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '@/../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use initializeAuth with explicit persistence and popup resolver to avoid "Pending promise was never set" error
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// CRITICAL: Test connection to Firestore as per system instructions
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

import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ✅ best-effort persistence for iOS + Android
async function initPersistence() {
  try {
    // best option if supported
    await setPersistence(auth, indexedDBLocalPersistence);
    console.log("FIREBASE: persistence = indexedDBLocalPersistence");
    return;
  } catch (e) {
    console.warn("FIREBASE: indexedDB persistence failed", e);
  }

  try {
    // next best
    await setPersistence(auth, browserLocalPersistence);
    console.log("FIREBASE: persistence = browserLocalPersistence");
    return;
  } catch (e) {
    console.warn("FIREBASE: local persistence failed", e);
  }

  // last fallback (always works)
  await setPersistence(auth, inMemoryPersistence);
  console.log("FIREBASE: persistence = inMemoryPersistence");
}

export const authReady = initPersistence();

import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserSessionPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from "firebase/auth";

console.log("FIREBASE TS LOADED ✅ v2");

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ✅ Debug: confirms env vars exist in iOS/Android build
console.log("FIREBASE CONFIG CHECK", {
  apiKey: firebaseConfig.apiKey ? "OK" : "MISSING",
  authDomain: firebaseConfig.authDomain ? "OK" : "MISSING",
  projectId: firebaseConfig.projectId ? "OK" : "MISSING",
  storageBucket: firebaseConfig.storageBucket ? "OK" : "MISSING",
  messagingSenderId: firebaseConfig.messagingSenderId ? "OK" : "MISSING",
  appId: firebaseConfig.appId ? "OK" : "MISSING",
});

const app = initializeApp(firebaseConfig);

/**
 * ✅ Goal:
 * - Web: session-only (refresh keeps login, closing browser logs out)
 * - Capacitor: local persistence is safer for WKWebView / Android WebView
 *
 * We detect Capacitor by checking for window.Capacitor at runtime.
 */
const isCapacitor =
  typeof window !== "undefined" && (window as any)?.Capacitor?.isNativePlatform;

export const auth = initializeAuth(app, {
  persistence: isCapacitor ? browserLocalPersistence : browserSessionPersistence,

  // If you ever see issues with browserLocalPersistence on a specific device,
  // you can switch Capacitor to indexedDBLocalPersistence:
  // persistence: isCapacitor ? indexedDBLocalPersistence : browserSessionPersistence,
});
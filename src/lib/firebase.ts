// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

import { firebaseConfig } from "@/firebase/config";

// Override console.error on server-side to downgrade Firebase internal connection warnings to console.warn
// This prevents Next.js dev server overlay from showing red screens for offline/connecting notices.
if (typeof window === 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(arg => String(arg)).join(' ');
    if (msg.includes('@firebase/firestore') || msg.includes('Could not reach Cloud Firestore')) {
      console.warn(...args);
      return;
    }
    originalError(...args);
  };
}

let app: any = null;
let db: any = null;
let auth: any = null;
let analytics: any = null;

if (firebaseConfig && firebaseConfig.apiKey) {
  // Initialize Firebase
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);

  // Initialize Analytics (client-side only and if supported)
  if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    });
  }
}

export { app, db, auth, analytics };

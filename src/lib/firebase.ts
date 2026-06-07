// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "studio-9991475182-f90a3",
  "appId": "1:1091200686380:web:9b7682732c03c14f5cb489",
  "apiKey": "AIzaSyARK7JeEUkniloydMot525Efd6g0UJsrHo",
  "authDomain": "studio-9991475182-f90a3.firebaseapp.com",
  "measurementId": "G-5PYCLBLM4S",
  "messagingSenderId": "1091200686380"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize Analytics (client-side only and if supported)
let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, db, auth, analytics };

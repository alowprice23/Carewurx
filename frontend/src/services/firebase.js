import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Use environment variables for Firebase configuration.
// These variables are embedded during the build process.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Validate that all necessary Firebase config values are present
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);

let app;
let auth;
let db;

if (missingKeys.length > 0) {
  console.error(`Firebase initialization failed: Missing required environment variables: ${missingKeys.join(', ')}.`);
  // Prevent app initialization if config is missing
} else {
  // Initialize Firebase
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error);
      // Set app, auth, db to null or handle error appropriately
      app = null;
      auth = null;
      db = null;
    }
  } else {
    app = getApp(); // Get the default app if already initialized
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

export { app, auth, db };

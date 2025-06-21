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

if (missingKeys.length > 0) {
  console.error(`Firebase initialization failed: Missing required environment variables: ${missingKeys.join(', ')}`);
  // Optionally, you could throw an error here or prevent app initialization
  // For now, we'll log an error and let Firebase try to initialize,
  // which will likely fail and log its own more specific errors.
}

let app;
let auth;
let firestore;

if (missingKeys.length === 0) {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      firestore = getFirestore(app);
      console.log("Firebase initialized successfully with v9 modular SDK");
    } catch (error) {
      console.error("Firebase v9 initialization error:", error);
      // If initialization fails, app and auth will remain undefined.
      // Components using Firebase should handle this gracefully.
    }
  } else {
    app = getApp(); // Get the default app if already initialized
    auth = getAuth(app);
    firestore = getFirestore(app);
  }
} else {
  console.warn("Firebase initialization skipped due to missing configuration.");
  // app, auth, firestore will be undefined.
}

export { app, auth, firestore };

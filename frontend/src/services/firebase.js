import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Added for Firestore

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
let db; // Added for Firestore

if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase app initialized successfully");
  } catch (error) {
    console.error("Firebase app initialization error:", error);
    // If app initialization fails, we can't initialize auth or db
    // Exporting them as undefined or null might be one way to handle it,
    // or throw the error to stop the app.
    // For now, they will remain undefined if 'app' is not initialized.
  }
} else {
  app = getApp(); // Get the default app if already initialized
  console.log("Firebase app retrieved successfully");
}

// Initialize Auth and Firestore only if app was successfully initialized
if (app) {
  try {
    auth = getAuth(app);
    console.log("Firebase Auth initialized successfully");
  } catch (error) {
    console.error("Firebase Auth initialization error:", error);
  }

  try {
    db = getFirestore(app);
    console.log("Firebase Firestore initialized successfully");
  } catch (error) {
    console.error("Firebase Firestore initialization error:", error);
  }
}

export { app, auth, db }; // Export app, auth, and db

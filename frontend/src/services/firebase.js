import firebase from 'firebase/app';
import 'firebase/auth';

// Use environment variables if available, otherwise use default test values
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDZVU-iUTDIQr3HOYQOsJA-l7tT1hbXiAk",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "carewurx-test.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "carewurx-test",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "carewurx-test.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789012:web:abc123def456",
};

// Initialize Firebase
if (!firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

export { firebase };

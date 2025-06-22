// This file contains the Firebase configuration.
// IMPORTANT: This file SHOULD BE in .gitignore to prevent API keys from being committed.
// Create this file manually in your local environment or use environment variables.

export const firebaseConfig = {
  apiKey: "AIzaSyAyvrei7Vvj1dCnaSRS4GuLpj7GUHUd3ZM",
  authDomain: "carewurx-c23bd.firebaseapp.com",
  projectId: "carewurx-c23bd",
  storageBucket: "carewurx-c23bd.firebasestorage.app",
  messagingSenderId: "682228492065",
  appId: "1:682228492065:web:6c9da5f863668ad6ab8060",
  measurementId: "G-681RK65WP3"
};

// VAPID key for Firebase Cloud Messaging (push notifications)
export const vapidKey = "BANrZ5SQLWG0jpmF8u-YWHmQlWeaKVqGgLU9eYsgy6F2QzTcDX1gg4LGEJ5oVrG-CnzSV5tepL4UtKysNzVnWBw";

// Example of how to initialize Firebase in another file (e.g., firebase.js):
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// import { firebaseConfig } from "./firebaseConfig"; // Import the config
//
// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
//
// export { app, analytics }; // Export the initialized app and other services

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging, getToken } from "firebase/messaging";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";

// Import the centrally managed Firebase configuration
import { firebaseConfig, vapidKey } from "./firebaseConfig";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app); // Optional: if you use callable functions
const messaging = getMessaging(app); // For FCM push notifications

let analytics;
isAnalyticsSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
    console.log("Firebase Analytics initialized");
  } else {
    console.log("Firebase Analytics is not supported in this environment.");
  }
});

// Function to request notification permission and get token
const requestNotificationPermission = async () => {
  console.log("Requesting notification permission...");
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notification permission granted.");
      const currentToken = await getToken(messaging, { vapidKey: vapidKey });
      if (currentToken) {
        console.log("FCM Token:", currentToken);
        // TODO: Send this token to your server to subscribe the user to push notifications
        return currentToken;
      } else {
        console.log("No registration token available. Request permission to generate one.");
        return null;
      }
    } else {
      console.log("Unable to get permission to notify.");
      return null;
    }
  } catch (error) {
    console.error("An error occurred while requesting notification permission or getting token:", error);
    return null;
  }
};

// Export the initialized app and services
// Note: 'firebase' default export is from v8 SDK. For v9, we export individual services.
export { app, auth, db, storage, functions, messaging, analytics, requestNotificationPermission };

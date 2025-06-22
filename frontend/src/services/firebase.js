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

import { collection, getDocs, query, where, Timestamp } from "firebase/firestore"; // Added for Firestore queries

// Export the initialized app and services
// Note: 'firebase' default export is from v8 SDK. For v9, we export individual services.
export { app, auth, db, storage, functions, messaging, analytics, requestNotificationPermission };

// Function to fetch schedules for the calendar
export const getSchedulesForCalendar = async (startDate, endDate) => {
  if (!db) {
    console.error("Firestore DB not initialized");
    return [];
  }
  try {
    const schedulesCol = collection(db, "schedules");
    // Basic query: fetch all schedules.
    // TODO: Implement date range filtering if startDate and endDate are provided.
    // This would typically look like:
    // let q = query(schedulesCol);
    // if (startDate) {
    //   q = query(q, where("startTime", ">=", Timestamp.fromDate(new Date(startDate))));
    // }
    // if (endDate) {
    //   q = query(q, where("startTime", "<=", Timestamp.fromDate(new Date(endDate))));
    // }
    // For now, fetching all for simplicity in this step.
    const q = query(schedulesCol); // Remove this line when date filtering is added

    const scheduleSnapshot = await getDocs(q);
    const scheduleList = scheduleSnapshot.docs.map(doc => {
      const data = doc.data();
      // Transform data for react-big-calendar
      // Ensure startTime and endTime are Date objects
      const event = {
        id: doc.id,
        title: `${data.clientName || 'Unnamed Client'} - ${data.caregiverName || 'Unassigned'}`,
        start: data.startTime ? new Date(data.startTime.seconds ? data.startTime.toDate() : data.startTime) : new Date(),
        end: data.endTime ? new Date(data.endTime.seconds ? data.endTime.toDate() : data.endTime) : new Date(),
        allDay: data.allDay || false,
        resourceId: data.caregiverId, // For resource views by caregiver
        clientId: data.clientId,
        status: data.status,
        ...data // include other original data
      };
      // Validate dates
      if (isNaN(event.start.getTime()) || isNaN(event.end.getTime())) {
        console.warn("Invalid date found for schedule item:", doc.id, data);
        // Provide a default valid date range or skip the event
        return null;
      }
      if (event.end < event.start) {
        console.warn("End date is before start date for schedule item:", doc.id, data);
        // Adjust end date to be same as start or skip
        event.end = event.start;
      }
      return event;
    });
    return scheduleList.filter(event => event !== null); // Filter out any null (invalid) events
  } catch (error) {
    console.error("Error fetching schedules for calendar: ", error);
    throw error; // Re-throw to be handled by the calling component
  }
};

// Function to fetch a list of clients for filtering
export const getAllClientsList = async () => {
  if (!db) {
    console.error("Firestore DB not initialized");
    return [];
  }
  try {
    const clientsCol = collection(db, "clients");
    const clientSnapshot = await getDocs(clientsCol);
    const clientList = clientSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || `Client ${doc.id}`, // Fallback name
      // Add any other fields needed for display or filtering, e.g., data().label
    }));
    return clientList;
  } catch (error) {
    console.error("Error fetching client list: ", error);
    throw error;
  }
};

// Function to fetch a list of all caregivers
export const getAllCaregiversList = async () => {
  if (!db) {
    console.error("Firestore DB not initialized");
    return [];
  }
  try {
    const caregiversCol = collection(db, "caregivers");
    const caregiverSnapshot = await getDocs(caregiversCol);
    const caregiverList = caregiverSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || `Caregiver ${doc.id}`, // Fallback name
      skills: doc.data().skills || [],
      availabilitySummary: doc.data().availabilitySummary || 'Not specified', // Assuming a summary field
      isActive: doc.data().isActive !== undefined ? doc.data().isActive : true, // Default to active
      // Add any other fields needed
    }));
    return caregiverList;
  } catch (error) {
    console.error("Error fetching caregiver list: ", error);
    throw error;
  }
};

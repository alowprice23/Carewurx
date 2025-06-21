/**
 * Firebase Functions
 * Entry point for all cloud functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (admin.apps.length === 0) { // Ensure Firebase is initialized only once
  admin.initializeApp();
}

// Assuming firebaseService is set up for admin usage as in root services/firebase.js
// This path might need adjustment if firebaseService is not directly accessible
// or if a separate admin instance should be initialized here.
// For now, let's assume we need to use the existing one or replicate its core logic.
// const { firebaseService } = require('../services/firebase'); // This would be ideal if usable directly

// Placeholder for firebaseService if direct import is problematic:
// We'll use admin.firestore() directly for now, assuming firebaseService methods
// would eventually be refactored or made available here.
const db = admin.firestore();

const scheduleAnalysis = require('../services/schedule-analysis'); // This path is relative to functions/index.js

/**
 * A scheduled function that runs every hour to perform analysis
 */
exports.hourlyAnalysis = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  console.log('Running hourly analysis...');
  
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const summary = await scheduleAnalysis.getAnalyticsSummary(
      thirtyDaysAgo.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );
    
    // Save the summary to the database
    await admin.firestore().collection('analytics').doc('summary').set(summary);
    
    console.log('Hourly analysis completed successfully');
  } catch (error) {
    console.error('Error during hourly analysis:', error);
  }
});

/**
 * A database trigger that runs when a new schedule is created
 */
exports.onScheduleCreate = functions.firestore
  .document('schedules/{scheduleId}')
  .onCreate(async (snap, context) => {
    const newSchedule = snap.data();
    console.log('New schedule created:', newSchedule);
    
    // Create a notification for the new schedule
    const notification = {
      title: 'New Schedule Created',
      message: `A new schedule has been created for ${newSchedule.client_name} on ${newSchedule.date}.`,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    await admin.firestore().collection('notifications').add(notification);
  });

// Example HTTP Callable Functions

/**
 * Get a client document from Firestore.
 * @param {object} data - Data passed from the client.
 * @param {string} data.clientId - The ID of the client to fetch.
 * @param {functions.https.CallableContext} context - Context object.
 * @returns {Promise<object>} Client data.
 * @throws {Error} If not authenticated or client not found.
 */
exports.getClient = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const clientId = data.clientId;
  if (!clientId || typeof clientId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "clientId".');
  }

  try {
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Client with ID ${clientId} not found.`);
    }
    return { id: clientDoc.id, ...clientDoc.data() };
  } catch (error) {
    console.error('Error fetching client:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error fetching client data.');
  }
});

/**
 * Add a new client document to Firestore.
 * @param {object} data - Client data to add. Expected to match client schema.
 * @param {functions.https.CallableContext} context - Context object.
 * @returns {Promise<object>} Object containing the ID of the new client.
 * @throws {Error} If not authenticated or data is invalid.
 */
exports.addClient = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  // Basic validation (more thorough validation should be done based on schema)
  if (!data || typeof data.name !== 'string' || !data.name.trim()) { // Example: name is required
    throw new functions.https.HttpsError('invalid-argument', 'Client data is invalid. "name" is required.');
  }

  const clientData = {
    ...data,
    // Ensure uid of creator or relevant metadata is added if needed
    // createdBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const docRef = await db.collection('clients').add(clientData);
    console.log('Client added with ID:', docRef.id);
    return { clientId: docRef.id, ...clientData };
  } catch (error) {
    console.error('Error adding client:', error);
    throw new functions.https.HttpsError('internal', 'Error adding client.');
  }
});

/**
 * Sends a push notification via FCM when a new notification document is created
 * for a specific user and if the notification has fcm: true.
 */
exports.sendFcmOnNewNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();

    // Example: Only send FCM if a 'userId' field exists and an 'fcm' flag is true
    if (notification.userId && notification.fcm === true) {
      try {
        // Get the user's FCM tokens from their user profile (e.g., /users/{userId}/fcmTokens/)
        const tokensSnapshot = await db.collection('users').doc(notification.userId).collection('fcmTokens').get();
        if (tokensSnapshot.empty) {
          console.log('No FCM tokens found for user:', notification.userId);
          return null;
        }

        const tokens = tokensSnapshot.docs.map(doc => doc.id);

        const payload = {
          notification: {
            title: notification.title || 'New Notification',
            body: notification.message || 'You have a new notification.',
            // icon: 'your-icon-url', // Optional
            // click_action: 'FLUTTER_NOTIFICATION_CLICK' // Optional: for mobile app specific handling
          },
          // data: { // Optional: custom data to send with notification
          //   screen: notification.link || '/', // e.g. where to navigate in app
          //   notificationId: context.params.notificationId
          // }
        };

        console.log('Sending FCM to tokens:', tokens, 'for user:', notification.userId);
        const response = await admin.messaging().sendToDevice(tokens, payload);

        // Cleanup stale tokens
        response.results.forEach((result, index) => {
          const error = result.error;
          if (error) {
            console.error('Failure sending notification to', tokens[index], error);
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
              // db.collection('users').doc(notification.userId).collection('fcmTokens').doc(tokens[index]).delete();
              console.log('Stale token removed (or would be):', tokens[index]);
            }
          }
        });
        return response;
      } catch (error) {
        console.error('Error sending FCM notification:', error);
        return null;
      }
    }
    return null;
  });

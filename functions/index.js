/**
 * Firebase Functions
 * Entry point for all cloud functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
// initializeApp should only be called once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const functions = require('firebase-functions'); // Moved functions require lower
const cors = require('cors')({ origin: true });
const { verifyFirebaseToken } = require('./authMiddleware'); // Added
// Not using shared firebaseService for now, will use admin.firestore() directly.
// const { firebaseService } = require('../services/firebase');

const scheduleAnalysis = require('../services/schedule-analysis');

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

// --- Create Client HTTP Function ---
exports.createClient = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => { // Handle CORS
    await verifyFirebaseToken(req, res, async () => { // Apply auth middleware
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const clientData = req.body;

        // Basic validation (matches schema required fields for 'name', 'email' was conceptual)
        // Client schema has 'name' as required. Let's stick to that for now.
        if (!clientData || !clientData.name) {
          return res.status(400).send('Bad Request: Missing required client field (name).');
        }

        // Add server-side timestamps
        const dataToSave = {
          ...clientData,
          // Ensure JSDoc model fields are used: createdAt, updatedAt
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Using admin.firestore() directly, similar to firebaseService.addDocument
        const docRef = await admin.firestore().collection('clients').add(dataToSave);
        const newClient = { id: docRef.id, ...dataToSave }; // Reconstruct object to include ID

        // Timestamps will be unresolved serverTimestamps initially in this response.
        // Client should re-fetch or handle this.
        return res.status(201).json(newClient);

      } catch (error) {
        console.error("Error creating client in function:", error);
        // Check if headersSent to avoid "Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client"
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error creating client.');
        }
      }
    });
  });
});

// --- Delete Schedule HTTP Function ---
// Expects ID via query parameter: ?id=scheduleId
exports.deleteSchedule = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'DELETE') {
        return res.status(405).send('Method Not Allowed');
      }

      const scheduleId = req.query.id;
      if (!scheduleId) {
        return res.status(400).send('Bad Request: Missing schedule ID in query parameter (id).');
      }

      try {
        const scheduleRef = admin.firestore().collection('schedules').doc(scheduleId);
        const doc = await scheduleRef.get();

        if (!doc.exists) {
          return res.status(404).send('Schedule not found.');
        }

        await scheduleRef.delete();

        return res.status(200).send(`Schedule ${scheduleId} deleted successfully.`);
        // Alternative: return res.status(204).send();
      } catch (error) {
        console.error(`Error deleting schedule ${scheduleId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error deleting schedule.');
        }
      }
    });
  });
});

// --- Update Schedule HTTP Function ---
// Expects ID via query parameter: ?id=scheduleId
// Expects update data in request body
exports.updateSchedule = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
      }

      const scheduleId = req.query.id;
      if (!scheduleId) {
        return res.status(400).send('Bad Request: Missing schedule ID in query parameter (id).');
      }

      const updateData = req.body;
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).send('Bad Request: Missing update data in request body.');
      }
      if (updateData.id || updateData.createdAt) {
        return res.status(400).send('Bad Request: Cannot update id or createdAt fields.');
      }
      // Additional validation for schedule specific fields can be added here based on schema
      // e.g., if status is updated, is it a valid status enum?

      try {
        const scheduleRef = admin.firestore().collection('schedules').doc(scheduleId);
        const doc = await scheduleRef.get();

        if (!doc.exists) {
          return res.status(404).send('Schedule not found. Cannot update non-existent schedule.');
        }

        const dataToUpdate = {
          ...updateData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await scheduleRef.update(dataToUpdate);

        const updatedDoc = await scheduleRef.get();
        return res.status(200).json({ id: updatedDoc.id, ...updatedDoc.data() });

      } catch (error) {
        console.error(`Error updating schedule ${scheduleId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error updating schedule.');
        }
      }
    });
  });
});

// --- Get Schedule by ID HTTP Function ---
// Expects ID via query parameter: ?id=scheduleId
exports.getScheduleById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }

      const scheduleId = req.query.id;
      if (!scheduleId) {
        return res.status(400).send('Bad Request: Missing schedule ID in query parameter (id).');
      }

      try {
        const doc = await admin.firestore().collection('schedules').doc(scheduleId).get();
        if (!doc.exists) {
          return res.status(404).send('Schedule not found.');
        }
        return res.status(200).json({ id: doc.id, ...doc.data() });
      } catch (error) {
        console.error(`Error getting schedule ${scheduleId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error getting schedule.');
        }
      }
    });
  });
});

// --- Get All/Filtered Schedules HTTP Function ---
exports.getSchedules = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        let query = admin.firestore().collection('schedules');

        // Apply filters based on query parameters
        const { date, startDate, endDate, clientId, caregiverId, status } = req.query;

        if (date) {
          // Ensure date is in YYYY-MM-DD or a format Firestore can compare correctly.
          // Timestamps are more robust for exact date queries if time component is involved.
          // For simple YYYY-MM-DD string match:
          query = query.where('date', '==', date);
        } else if (startDate && endDate) {
          query = query.where('date', '>=', startDate).where('date', '<=', endDate);
        } else if (startDate) {
          query = query.where('date', '>=', startDate);
        } else if (endDate) {
          query = query.where('date', '<=', endDate);
        }

        if (clientId) {
          query = query.where('clientId', '==', clientId);
        }
        if (caregiverId) {
          query = query.where('caregiverId', '==', caregiverId);
        }
        if (status) {
          query = query.where('status', '==', status);
        }

        // TODO: Consider adding orderBy for consistent results, e.g., query.orderBy('date').orderBy('startTime');
        // Firestore may require composite indexes for complex queries involving multiple where clauses and orderBy.

        const snapshot = await query.get();
        const schedules = [];
        snapshot.forEach(doc => {
          schedules.push({ id: doc.id, ...doc.data() });
        });
        return res.status(200).json(schedules);

      } catch (error) {
        console.error("Error getting schedules:", error);
        if (error.message.includes("needs an index")) { // Firestore specific error for missing index
            return res.status(500).send('Internal Server Error: Database query requires a missing index. Please check Firebase console.');
        }
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error getting schedules.');
        }
      }
    });
  });
});

// --- Create Schedule HTTP Function ---
exports.createSchedule = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const scheduleData = req.body;

        // Validation based on schedule.schema.json required fields
        const requiredFields = ["clientId", "date", "startTime", "endTime", "tasks"];
        for (const field of requiredFields) {
          if (!scheduleData[field]) {
            return res.status(400).send(`Bad Request: Missing required schedule field (${field}).`);
          }
        }
        // TODO: Add more specific validation for date/time formats if needed.

        const dataToSave = {
          ...scheduleData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          // Ensure status defaults if not provided, as per schema
          status: scheduleData.status || 'pending',
        };

        const docRef = await admin.firestore().collection('schedules').add(dataToSave);
        const newSchedule = { id: docRef.id, ...dataToSave };

        return res.status(201).json(newSchedule);

      } catch (error) {
        console.error("Error creating schedule in function:", error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error creating schedule.');
        }
      }
    });
  });
});

// --- Delete Caregiver HTTP Function ---
// Expects ID via query parameter: ?id=caregiverId
exports.deleteCaregiver = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'DELETE') {
        return res.status(405).send('Method Not Allowed');
      }

      const caregiverId = req.query.id;
      if (!caregiverId) {
        return res.status(400).send('Bad Request: Missing caregiver ID in query parameter (id).');
      }

      try {
        const caregiverRef = admin.firestore().collection('caregivers').doc(caregiverId);
        const doc = await caregiverRef.get();

        if (!doc.exists) {
          return res.status(404).send('Caregiver not found.');
        }

        await caregiverRef.delete();

        return res.status(200).send(`Caregiver ${caregiverId} deleted successfully.`);
        // Alternative: return res.status(204).send(); for No Content
      } catch (error) {
        console.error(`Error deleting caregiver ${caregiverId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error deleting caregiver.');
        }
      }
    });
  });
});

// --- Update Caregiver HTTP Function ---
// Expects ID via query parameter: ?id=caregiverId
// Expects update data in request body
exports.updateCaregiver = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
      }

      const caregiverId = req.query.id;
      if (!caregiverId) {
        return res.status(400).send('Bad Request: Missing caregiver ID in query parameter (id).');
      }

      const updateData = req.body;
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).send('Bad Request: Missing update data in request body.');
      }
      if (updateData.id || updateData.createdAt) {
        return res.status(400).send('Bad Request: Cannot update id or createdAt fields.');
      }

      try {
        const caregiverRef = admin.firestore().collection('caregivers').doc(caregiverId);
        const doc = await caregiverRef.get();

        if (!doc.exists) {
          return res.status(404).send('Caregiver not found. Cannot update non-existent caregiver.');
        }

        const dataToUpdate = {
          ...updateData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await caregiverRef.update(dataToUpdate);

        const updatedDoc = await caregiverRef.get();
        return res.status(200).json({ id: updatedDoc.id, ...updatedDoc.data() });

      } catch (error) {
        console.error(`Error updating caregiver ${caregiverId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error updating caregiver.');
        }
      }
    });
  });
});

// --- Get Caregiver by ID HTTP Function ---
// Expects ID via query parameter: ?id=caregiverId
exports.getCaregiverById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }

      const caregiverId = req.query.id;
      if (!caregiverId) {
        return res.status(400).send('Bad Request: Missing caregiver ID in query parameter (id).');
      }

      try {
        const doc = await admin.firestore().collection('caregivers').doc(caregiverId).get();
        if (!doc.exists) {
          return res.status(404).send('Caregiver not found.');
        }
        return res.status(200).json({ id: doc.id, ...doc.data() });
      } catch (error) {
        console.error(`Error getting caregiver ${caregiverId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error getting caregiver.');
        }
      }
    });
  });
});

// --- Get All Caregivers HTTP Function ---
exports.getCaregivers = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const snapshot = await admin.firestore().collection('caregivers').get();
        const caregivers = [];
        snapshot.forEach(doc => {
          caregivers.push({ id: doc.id, ...doc.data() });
        });
        return res.status(200).json(caregivers);
      } catch (error) {
        console.error("Error getting caregivers:", error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error getting caregivers.');
        }
      }
    });
  });
});

// --- Create Caregiver HTTP Function ---
exports.createCaregiver = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const caregiverData = req.body;

        // Basic validation based on caregiver.schema.json (name, email are required)
        if (!caregiverData || !caregiverData.name || !caregiverData.email) {
          return res.status(400).send('Bad Request: Missing required caregiver fields (name, email).');
        }

        const dataToSave = {
          ...caregiverData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = await admin.firestore().collection('caregivers').add(dataToSave);
        const newCaregiver = { id: docRef.id, ...dataToSave };

        return res.status(201).json(newCaregiver);

      } catch (error) {
        console.error("Error creating caregiver in function:", error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error creating caregiver.');
        }
      }
    });
  });
});

// --- Delete Client HTTP Function ---
// Expects ID via query parameter: ?id=clientId
exports.deleteClient = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'DELETE') {
        return res.status(405).send('Method Not Allowed');
      }

      const clientId = req.query.id;
      if (!clientId) {
        return res.status(400).send('Bad Request: Missing client ID in query parameter (id).');
      }

      try {
        const clientRef = admin.firestore().collection('clients').doc(clientId);
        const doc = await clientRef.get();

        if (!doc.exists) {
          return res.status(404).send('Client not found.');
        }

        await clientRef.delete();

        return res.status(200).send(`Client ${clientId} deleted successfully.`);
        // Alternative: return res.status(204).send(); for No Content
      } catch (error) {
        console.error(`Error deleting client ${clientId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error deleting client.');
        }
      }
    });
  });
});

// --- Update Client HTTP Function ---
// Expects ID via query parameter: ?id=clientId
// Expects update data in request body
exports.updateClient = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
      }

      const clientId = req.query.id;
      if (!clientId) {
        return res.status(400).send('Bad Request: Missing client ID in query parameter (id).');
      }

      const updateData = req.body;
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).send('Bad Request: Missing update data in request body.');
      }
      // Basic validation: do not allow updating 'id', 'createdAt'
      if (updateData.id || updateData.createdAt) {
        return res.status(400).send('Bad Request: Cannot update id or createdAt fields.');
      }

      try {
        const clientRef = admin.firestore().collection('clients').doc(clientId);
        const doc = await clientRef.get();

        if (!doc.exists) {
          return res.status(404).send('Client not found. Cannot update non-existent client.');
        }

        const dataToUpdate = {
          ...updateData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await clientRef.update(dataToUpdate);

        // Fetch the updated document to return it
        const updatedDoc = await clientRef.get();
        return res.status(200).json({ id: updatedDoc.id, ...updatedDoc.data() });

      } catch (error) {
        console.error(`Error updating client ${clientId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error updating client.');
        }
      }
    });
  });
});

// --- Get Client by ID HTTP Function ---
// Expects ID via query parameter: ?id=clientId
exports.getClientById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }

      const clientId = req.query.id;
      if (!clientId) {
        return res.status(400).send('Bad Request: Missing client ID in query parameter (id).');
      }

      try {
        const doc = await admin.firestore().collection('clients').doc(clientId).get();
        if (!doc.exists) {
          return res.status(404).send('Client not found.');
        }
        return res.status(200).json({ id: doc.id, ...doc.data() });
      } catch (error) {
        console.error(`Error getting client ${clientId}:`, error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error getting client.');
        }
      }
    });
  });
});

// --- Get All Clients HTTP Function ---
exports.getClients = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await verifyFirebaseToken(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const snapshot = await admin.firestore().collection('clients').get();
        const clients = [];
        snapshot.forEach(doc => {
          clients.push({ id: doc.id, ...doc.data() });
        });
        return res.status(200).json(clients);
      } catch (error) {
        console.error("Error getting clients:", error);
        if (!res.headersSent) {
          return res.status(500).send('Internal Server Error getting clients.');
        }
      }
    });
  });
});

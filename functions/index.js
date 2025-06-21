/**
 * Firebase Functions
 * Entry point for all cloud functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const cors = require('cors')({origin: true});
const enhancedScheduler = require('../services/enhanced-scheduler');
const { firebaseService } = require('../services/firebase'); // Assuming it's exported as firebaseService
const scheduleAnalysis = require('../services/schedule-analysis');


// Helper function for auth middleware
const authenticate = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.');
    res.status(403).send('Unauthorized: No token provided.');
    return;
  }
  const idToken = req.headers.authorization.split('Bearer ')[1];
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedIdToken;
    next();
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized: Invalid token.');
  }
};

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

// --- Schedule HTTP Endpoints ---

/**
 * Create a new schedule.
 * POST /schedules
 * Body: { clientId, date, startTime, endTime, notes (optional), ...other schedule data }
 */
exports.createSchedule = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { clientId, date, startTime, endTime, notes } = req.body;

        if (!clientId || !date || !startTime || !endTime) {
          return res.status(400).json({ error: 'Missing required fields: clientId, date, startTime, endTime.' });
        }

        // Construct scheduleData, potentially fetching client details
        const client = await firebaseService.getClient(clientId);
        if (!client) {
            return res.status(404).json({ error: `Client with ID ${clientId} not found.`});
        }

        const scheduleData = {
          client_id: clientId,
          client_name: client.name,
          client_location: client.location,
          required_skills: client.required_skills || [],
          date,
          start_time: startTime,
          end_time: endTime,
          notes: notes || '',
          status: 'unassigned',
          created_by_user: req.user.uid, // Track user who created it via API
        };

        const newSchedule = await enhancedScheduler.createSchedule(scheduleData);
        return res.status(201).json(newSchedule);
      } catch (error) {
        console.error('Error creating schedule via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to create schedule.' });
      }
    });
  });
});

/**
 * Assign a caregiver to a schedule.
 * POST /schedules/:scheduleId/assignCaregiver
 * Body: { caregiverId }
 */
exports.assignCaregiverToSchedule = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { scheduleId } = req.params;
        const { caregiverId } = req.body;

        if (!caregiverId) {
          return res.status(400).json({ error: 'Missing required field: caregiverId.' });
        }
        if (!scheduleId) {
          return res.status(400).json({ error: 'Missing scheduleId in path.' });
        }

        const result = await enhancedScheduler.assignCaregiverToSchedule(scheduleId, caregiverId);
        if (result.success) {
          return res.status(200).json(result.schedule);
        } else {
          // This path might not be hit if assignCaregiverToSchedule throws on error
          return res.status(400).json({ error: result.message || 'Failed to assign caregiver.' });
        }
      } catch (error) {
        console.error('Error assigning caregiver via API:', error);
        // Check if it's a "not found" type error from the service
        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message || 'Failed to assign caregiver.' });
      }
    });
  });
});

// --- Placeholder for other CRUD endpoints for Clients, Caregivers etc. ---
// Example: GET /clients
exports.getClients = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const clients = await firebaseService.getAllClients();
        return res.status(200).json(clients);
      } catch (error) {
        console.error('Error getting clients via API:', error);
        return res.status(500).json({ error: 'Failed to get clients.' });
      }
    });
  });
});

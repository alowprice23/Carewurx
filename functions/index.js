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

// --- Client HTTP Endpoints ---

// GET /clients (already implemented)
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

/**
 * Create a new client.
 * POST /clients
 * Body: { name, location (optional), contact (optional), authorized_weekly_hours (optional), bus_line_access (optional), ... }
 */
exports.createClient = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const clientData = req.body;
        if (!clientData.name) { // Basic validation
          return res.status(400).json({ error: 'Missing required field: name.' });
        }
        // Add any other necessary default fields or server-side transformations
        clientData.created_by_user = req.user.uid;

        const newClient = await firebaseService.addClient(clientData);
        return res.status(201).json(newClient);
      } catch (error) {
        console.error('Error creating client via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to create client.' });
      }
    });
  });
});

/**
 * Get a specific client by ID.
 * GET /clients/:clientId
 */
exports.getClientById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { clientId } = req.params;
        if (!clientId) {
          return res.status(400).json({ error: 'Missing clientId in path.' });
        }
        const client = await firebaseService.getClient(clientId);
        if (!client) {
          return res.status(404).json({ error: `Client with ID ${clientId} not found.` });
        }
        return res.status(200).json(client);
      } catch (error) {
        console.error('Error getting client by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to get client.' });
      }
    });
  });
});

/**
 * Update a client's details.
 * PUT /clients/:clientId
 * Body: { fields to update }
 */
exports.updateClientById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { clientId } = req.params;
        const updateData = req.body;

        if (!clientId) {
          return res.status(400).json({ error: 'Missing clientId in path.' });
        }
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'Request body must contain fields to update.' });
        }
        // Prevent changing certain fields if necessary, e.g., created_by_user
        delete updateData.created_by_user;
        delete updateData.id; // Should not update ID

        // Check if client exists before update
        const clientExists = await firebaseService.getClient(clientId);
        if (!clientExists) {
            return res.status(404).json({ error: `Client with ID ${clientId} not found.`});
        }

        await firebaseService.updateClient(clientId, updateData);
        const updatedClient = await firebaseService.getClient(clientId); // Fetch updated doc
        return res.status(200).json(updatedClient);
      } catch (error) {
        console.error('Error updating client by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to update client.' });
      }
    });
  });
});

// --- Caregiver HTTP Endpoints ---

/**
 * Get all caregivers.
 * GET /caregivers
 */
exports.getCaregivers = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const caregivers = await firebaseService.getAllCaregivers();
        return res.status(200).json(caregivers);
      } catch (error) {
        console.error('Error getting all caregivers via API:', error);
        return res.status(500).json({ error: 'Failed to get caregivers.' });
      }
    });
  });
});

/**
 * Create a new caregiver.
 * POST /caregivers
 * Body: { name, skills (optional), drives_car (optional), ... }
 */
exports.createCaregiver = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const caregiverData = req.body;
        if (!caregiverData.name) { // Basic validation
          return res.status(400).json({ error: 'Missing required field: name.' });
        }
        // Add any other necessary default fields
        caregiverData.created_by_user = req.user.uid;

        const newCaregiver = await firebaseService.addCaregiver(caregiverData);
        // Availability would typically be set in a separate step/call
        return res.status(201).json(newCaregiver);
      } catch (error) {
        console.error('Error creating caregiver via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to create caregiver.' });
      }
    });
  });
});

/**
 * Get a specific caregiver by ID.
 * GET /caregivers/:caregiverId
 */
exports.getCaregiverById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { caregiverId } = req.params;
        if (!caregiverId) {
          return res.status(400).json({ error: 'Missing caregiverId in path.' });
        }
        const caregiver = await firebaseService.getCaregiver(caregiverId);
        if (!caregiver) {
          return res.status(404).json({ error: `Caregiver with ID ${caregiverId} not found.` });
        }
        return res.status(200).json(caregiver);
      } catch (error) {
        console.error('Error getting caregiver by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to get caregiver.' });
      }
    });
  });
});

/**
 * Update a caregiver's details.
 * PUT /caregivers/:caregiverId
 * Body: { fields to update } (Note: availability is updated via a separate endpoint)
 */
exports.updateCaregiverById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { caregiverId } = req.params;
        const updateData = req.body;

        if (!caregiverId) {
          return res.status(400).json({ error: 'Missing caregiverId in path.' });
        }
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'Request body must contain fields to update.' });
        }
        delete updateData.id; // Prevent changing ID
        delete updateData.created_by_user;
        delete updateData.availability; // Availability should be updated via its dedicated endpoint

        const caregiverExists = await firebaseService.getCaregiver(caregiverId);
        if (!caregiverExists) {
            return res.status(404).json({ error: `Caregiver with ID ${caregiverId} not found.`});
        }

        await firebaseService.updateCaregiver(caregiverId, updateData);
        const updatedCaregiver = await firebaseService.getCaregiver(caregiverId);
        return res.status(200).json(updatedCaregiver);
      } catch (error) {
        console.error('Error updating caregiver by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to update caregiver.' });
      }
    });
  });
});

/**
 * Get a caregiver's availability.
 * GET /caregivers/:caregiverId/availability
 */
exports.getCaregiverAvailabilityById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { caregiverId } = req.params;
        if (!caregiverId) {
          return res.status(400).json({ error: 'Missing caregiverId in path.' });
        }
        // Check if caregiver exists first
        const caregiver = await firebaseService.getCaregiver(caregiverId);
        if (!caregiver) {
          return res.status(404).json({ error: `Caregiver with ID ${caregiverId} not found.` });
        }

        const availability = await firebaseService.getCaregiverAvailability(caregiverId);
        if (availability === null) { // Explicitly null if not found by firebaseService
          return res.status(200).json({ availability: {} }); // Return empty object if no availability set
        }
        return res.status(200).json({ availability });
      } catch (error) {
        console.error('Error getting caregiver availability by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to get caregiver availability.' });
      }
    });
  });
});

/**
 * Update a caregiver's availability.
 * PUT /caregivers/:caregiverId/availability
 * Body: { availability: { specific_slots: [], general_rules: [], time_off: [] } }
 */
exports.updateCaregiverAvailabilityById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { caregiverId } = req.params;
        const { availability } = req.body; // Expects the full availability object

        if (!caregiverId) {
          return res.status(400).json({ error: 'Missing caregiverId in path.' });
        }
        if (!availability || typeof availability !== 'object') {
          return res.status(400).json({ error: 'Request body must contain an "availability" object.' });
        }
        // TODO: Add detailed validation for the availability object structure here if needed.
        // For now, assuming the frontend sends the correct structure based on documentation.

        const caregiverExists = await firebaseService.getCaregiver(caregiverId);
        if (!caregiverExists) {
            return res.status(404).json({ error: `Caregiver with ID ${caregiverId} not found.`});
        }

        await firebaseService.updateCaregiverAvailability(caregiverId, availability);
        const updatedAvailability = await firebaseService.getCaregiverAvailability(caregiverId);
        return res.status(200).json({ availability: updatedAvailability });
      } catch (error) {
        console.error('Error updating caregiver availability by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to update caregiver availability.' });
      }
    });
  });
});

// --- Remaining Schedule HTTP Endpoints ---

/**
 * Get a specific schedule by ID.
 * GET /schedules/:scheduleId
 */
exports.getScheduleById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { scheduleId } = req.params;
        if (!scheduleId) {
          return res.status(400).json({ error: 'Missing scheduleId in path.' });
        }
        const schedule = await firebaseService.getSchedule(scheduleId);
        if (!schedule) {
          return res.status(404).json({ error: `Schedule with ID ${scheduleId} not found.` });
        }
        return res.status(200).json(schedule);
      } catch (error) {
        console.error('Error getting schedule by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to get schedule.' });
      }
    });
  });
});

/**
 * Update general schedule details.
 * PUT /schedules/:scheduleId
 * Body: { notes (optional), status (optional), ... }
 * Note: For assigning/changing caregiver, use POST /schedules/:scheduleId/assignCaregiver
 */
exports.updateScheduleById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'PUT') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { scheduleId } = req.params;
        const updateData = req.body;

        if (!scheduleId) {
          return res.status(400).json({ error: 'Missing scheduleId in path.' });
        }
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: 'Request body must contain fields to update.' });
        }
        // Prevent changing critical fields like IDs directly through this generic update
        delete updateData.id;
        delete updateData.clientId;
        delete updateData.caregiverId; // Use assignCaregiver endpoint for this
        delete updateData.created_by_user;
        delete updateData.created_by_agent;


        const scheduleExists = await firebaseService.getSchedule(scheduleId);
        if (!scheduleExists) {
            return res.status(404).json({ error: `Schedule with ID ${scheduleId} not found.`});
        }

        // Using enhancedScheduler.updateSchedule as it might have more logic (like real-time updates)
        const updatedSchedule = await enhancedScheduler.updateSchedule(scheduleId, updateData);
        return res.status(200).json(updatedSchedule);
      } catch (error) {
        console.error('Error updating schedule by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to update schedule.' });
      }
    });
  });
});

/**
 * Delete a schedule by ID.
 * DELETE /schedules/:scheduleId
 */
exports.deleteScheduleById = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'DELETE') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { scheduleId } = req.params;
        if (!scheduleId) {
          return res.status(400).json({ error: 'Missing scheduleId in path.' });
        }

        const scheduleExists = await firebaseService.getSchedule(scheduleId);
        if (!scheduleExists) {
            return res.status(404).json({ error: `Schedule with ID ${scheduleId} not found.`});
        }

        await enhancedScheduler.deleteSchedule(scheduleId); // Use service for potential side effects
        return res.status(200).json({ message: `Schedule ${scheduleId} deleted successfully.`});
      } catch (error) {
        console.error('Error deleting schedule by ID via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to delete schedule.' });
      }
    });
  });
});

/**
 * Get schedules, filterable by clientId, caregiverId, startDate, endDate.
 * GET /schedules?clientId=X&caregiverId=Y&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getSchedules = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    await authenticate(req, res, async () => {
      if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
      }
      try {
        const { clientId, caregiverId, startDate, endDate } = req.query;
        let schedules = [];

        // Basic validation for date formats if provided
        const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (startDate && !dateFormatRegex.test(startDate)) {
            return res.status(400).json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' });
        }
        if (endDate && !dateFormatRegex.test(endDate)) {
            return res.status(400).json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' });
        }
        if (startDate && endDate && startDate > endDate) {
            return res.status(400).json({ error: 'startDate cannot be after endDate.' });
        }

        if (clientId && startDate && endDate) {
          schedules = await firebaseService.getSchedulesByClientIdInDateRange(clientId, startDate, endDate);
        } else if (caregiverId && startDate && endDate) {
          schedules = await firebaseService.getSchedulesByCaregiverIdInDateRange(caregiverId, startDate, endDate);
        } else if (startDate && endDate) { // All schedules in date range
          schedules = await firebaseService.getSchedulesInDateRange(startDate, endDate);
        } else if (clientId) {
            schedules = await firebaseService.getSchedulesByClientId(clientId);
        } else if (caregiverId) {
            schedules = await firebaseService.getSchedulesByCaregiverId(caregiverId);
        } else {
          // No filters, could be too broad. Consider requiring at least some filter,
          // or add pagination if truly fetching all. For now, let's disallow a wide-open GET.
          return res.status(400).json({ error: 'Please provide query parameters like clientId, caregiverId, or a dateRange to fetch schedules.' });
        }
        return res.status(200).json(schedules);
      } catch (error) {
        console.error('Error getting schedules via API:', error);
        return res.status(500).json({ error: error.message || 'Failed to get schedules.' });
      }
    });
  });
});

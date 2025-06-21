/**
 * Express Server
 * Replaces Electron's main process functionality for the web application.
 */

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const agentManager = require('./agents/core/agent-manager');
const scheduleScanner = require('./services/schedule-scanner');
const enhancedScheduler = require('./services/enhanced-scheduler');
const notificationService = require('./services/notification-service');
const { firebaseService } = require('./services/firebase');
// const realTimeUpdatesService = require('./app/services/real-time-updates'); // Will be needed for circular entity updates

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Use a different port than the React dev server

// Middleware
app.use(express.json()); // For parsing application/json

// Configure Content Security Policy
app.use((req, res, next) => {
  let scriptSrc = "'self'";
  let styleSrc = "'self' 'unsafe-inline'"; // 'unsafe-inline' for styles might be needed by some libs or older inline styles
  let connectSrc = "'self' https://*.firebaseio.com https://*.googleapis.com";
  // Allow connections for Firebase Realtime Database and Auth, and other Google APIs.

  if (process.env.NODE_ENV === 'development') {
    // For React development server (usually on localhost:3000)
    scriptSrc += " http://localhost:3000";
    styleSrc += " http://localhost:3000"; // If dev server serves styles that need it, or for styled-jsx in dev
    connectSrc += " http://localhost:3000 ws://localhost:3000"; // For HMR WebSockets
  }

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `connect-src ${connectSrc}`,
    "img-src 'self' data:", // Allows images from self and data URIs
    "font-src 'self' data:", // Allows fonts from self and data URIs
    "object-src 'none'", // Disallow <object>, <embed>, <applet>
    "frame-ancestors 'none'", // Disallow embedding in iframes from other origins
    "form-action 'self'", // Restrict where forms can submit data
    // "base-uri 'self'", // Uncomment if you have a <base> tag and want to restrict its href
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  next();
});

// Serve static files from the React app (production build)
app.use(express.static(path.join(__dirname, 'frontend/build')));

// API Endpoints will be defined here

/**
 * Validate input parameters to prevent injection attacks
 * @param {any} params - Parameters to validate
 * @returns {boolean} Whether the parameters are valid
 */
function validateParams(params) {
  // Check if params is undefined
  if (params === undefined) return false;

  // If params is an array, check each item
  if (Array.isArray(params)) {
    return params.every(param => validateParams(param));
  }

  // If params is an object, check each property
  if (typeof params === 'object' && params !== null) {
    return Object.values(params).every(value => validateParams(value));
  }

  // Check for potentially dangerous strings
  if (typeof params === 'string') {
    const dangerousPatterns = [
      /\s*<script\b[^>]*>/i, // script tags
      /\s*javascript\s*:/i,  // javascript: protocol
      /\s*data\s*:/i,        // data: URI
      /\beval\s*\(/i,        // eval() function
      /\bdocument\s*\.\s*write/i, // document.write
      /\bFunction\s*\(/i     // Function constructor
    ];

    return !dangerousPatterns.some(pattern => pattern.test(params));
  }

  // All other types are considered safe
  return true;
}


// --- Authentication Endpoints ---
app.post('/api/auth/signIn', async (req, res) => {
  const { email, password } = req.body;
  console.log('Received sign-in request via API');
  try {
    if (!validateParams(email) || !validateParams(password)) {
      return res.status(400).json({ error: 'Invalid input parameters' });
    }
    if (email && password && typeof email === 'string' && typeof password === 'string') {
      // In a real app, you would verify credentials against Firebase Auth
      res.json({
        user: {
          uid: 'test-user-123',
          email: email,
          displayName: email.split('@')[0],
          role: 'user'
        }
      });
    } else {
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    console.error('Sign-in error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/signOut', async (req, res) => {
  console.log('User signed out via API');
  // Placeholder for sign out functionality
  res.json({ success: true });
});

app.get('/api/auth/currentUser', async (req, res) => {
  // In a real implementation, you would validate the user session from a token
  res.json({
    uid: 'test-user-123',
    email: 'admin@carewurx.com',
    displayName: 'Admin User',
    role: 'admin'
  });
});


// --- Agent Manager Endpoints ---
app.post('/api/agent/processMessage', async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!validateParams(userId) || !validateParams(message)) {
        return res.status(400).json({ error: 'Invalid input parameters for agent message' });
    }
    const result = await agentManager.processMessage(userId, message);
    res.json(result);
  } catch (error) {
    console.error('Error processing agent message:', error);
    res.status(500).json({ error: error.message || 'Failed to process agent message' });
  }
});

app.post('/api/agent/scanForOpportunities', async (req, res) => {
  try {
    const { options } = req.body;
    if (!validateParams(options)) return res.status(400).json({ error: 'Invalid options' });
    const result = await agentManager.scanForOpportunities(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/agent/opportunityDetails/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    if (!validateParams(opportunityId)) return res.status(400).json({ error: 'Invalid opportunityId' });
    const result = await agentManager.getOpportunityDetails(opportunityId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/applyOpportunity/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { options } = req.body;
    if (!validateParams(opportunityId) || !validateParams(options)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await agentManager.applyOpportunity(opportunityId, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/rejectOpportunity/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { reason } = req.body;
    if (!validateParams(opportunityId) || !validateParams(reason)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await agentManager.rejectOpportunity(opportunityId, { reason });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/agent/insights/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!validateParams(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });
    const result = await agentManager.getInsightsForSchedule(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/agent/suggestions/:entityType/:entityId', async (req, res) => {
  try {
    const { entityId, entityType } = req.params;
    if (!validateParams(entityId) || !validateParams(entityType)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await agentManager.getSuggestions(entityId, entityType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/startConversation', async (req, res) => {
  try {
    const { agentName, initialMessage } = req.body;
    const userId = req.user ? req.user.uid : 'api-user'; // Assuming some user context, fallback
    if (!validateParams(agentName) || !validateParams(initialMessage)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await agentManager.startConversation(userId, agentName, initialMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/getResponse/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;
    if (!validateParams(conversationId) || !validateParams(message)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await agentManager.getResponse(conversationId, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Enhanced Scheduler Endpoints ---
app.post('/api/scheduler/createSchedule', async (req, res) => {
  try {
    const { scheduleData } = req.body;
    if (!validateParams(scheduleData)) return res.status(400).json({ error: 'Invalid scheduleData' });
    const result = await enhancedScheduler.createSchedule(scheduleData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/scheduler/updateSchedule/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { updatedData } = req.body;
    if (!validateParams(scheduleId) || !validateParams(updatedData)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await enhancedScheduler.updateSchedule(scheduleId, updatedData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/scheduler/deleteSchedule/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!validateParams(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });
    const result = await enhancedScheduler.deleteSchedule(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/scheduler/findBestCaregiver/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!validateParams(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });
    const result = await enhancedScheduler.findBestCaregiver(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scheduler/createClientSchedule/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { scheduleData } = req.body;
    if (!validateParams(clientId) || !validateParams(scheduleData)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await enhancedScheduler.createClientSchedule(clientId, scheduleData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scheduler/assignCaregiverToSchedule/:scheduleId/:caregiverId', async (req, res) => {
  try {
    const { scheduleId, caregiverId } = req.params;
    if (!validateParams(scheduleId) || !validateParams(caregiverId)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await enhancedScheduler.assignCaregiverToSchedule(scheduleId, caregiverId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/scheduler/findAvailableCaregivers/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!validateParams(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });
    const result = await enhancedScheduler.findAvailableCaregivers(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/scheduler/checkConflicts/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!validateParams(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });
    const result = await enhancedScheduler.checkScheduleConflicts(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scheduler/resolveConflict/:conflictId', async (req, res) => {
  try {
    const { conflictId } = req.params;
    const { resolution } = req.body;
    if (!validateParams(conflictId) || !validateParams(resolution)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await enhancedScheduler.resolveScheduleConflict(conflictId, resolution);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/scheduler/scheduleWithDetails/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!validateParams(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });
    const result = await enhancedScheduler.getScheduleWithDetails(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scheduler/optimizeSchedules', async (req, res) => { // Assuming date might be in body
  try {
    const { date } = req.body; // Or req.query if sent as query param
    if (!validateParams(date)) return res.status(400).json({ error: 'Invalid date' });
    const result = await enhancedScheduler.optimizeSchedules(date);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Notification Service Endpoints ---
app.get('/api/notifications', async (req, res) => { // Assuming options in query
  try {
    const options = req.query;
    if (!validateParams(options)) return res.status(400).json({ error: 'Invalid options' });
    const result = await notificationService.getNotifications(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/markAsRead/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (!validateParams(notificationId)) return res.status(400).json({ error: 'Invalid notificationId' });
    const result = await notificationService.markAsRead(notificationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/create', async (req, res) => {
  try {
    const { notificationData } = req.body;
    if (!validateParams(notificationData)) return res.status(400).json({ error: 'Invalid notificationData' });
    const result = await notificationService.createNotification(notificationData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notifications/delete/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (!validateParams(notificationId)) return res.status(400).json({ error: 'Invalid notificationId' });
    const result = await notificationService.deleteNotification(notificationId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/markAllAsRead', async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Firebase Service Endpoints (Direct Data Access) ---
// Note: Exposing direct Firebase access like this should be carefully reviewed for security.
// Consider if these operations should be more abstracted.

app.get('/api/firebase/schedulesInDateRange', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!validateParams(startDate) || !validateParams(endDate)) return res.status(400).json({ error: 'Invalid date parameters' });
    const result = await firebaseService.getSchedulesInDateRange(startDate, endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/opportunities', async (req, res) => {
  try {
    const options = req.query;
    if (!validateParams(options)) return res.status(400).json({ error: 'Invalid options' });
    const result = await firebaseService.getOpportunities(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!validateParams(clientId)) return res.status(400).json({ error: 'Invalid clientId' });
    const result = await firebaseService.getClient(clientId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/caregiver/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    if (!validateParams(caregiverId)) return res.status(400).json({ error: 'Invalid caregiverId' });
    const result = await firebaseService.getCaregiver(caregiverId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/clients', async (req, res) => { // Changed from getAllClients for RESTfulness
  try {
    const result = await firebaseService.getAllClients();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/caregivers', async (req, res) => { // Changed from getAllCaregivers
  try {
    const result = await firebaseService.getAllCaregivers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/schedulesByClientId/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;
    if (!validateParams(clientId) || (startDate && !validateParams(startDate)) || (endDate && !validateParams(endDate))) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }
    let result;
    if (startDate && endDate) {
      result = await firebaseService.getSchedulesByClientIdInDateRange(clientId, startDate, endDate);
    } else {
      result = await firebaseService.getSchedulesByClientId(clientId);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/schedulesByCaregiverId/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    const { startDate, endDate } = req.query;
     if (!validateParams(caregiverId) || (startDate && !validateParams(startDate)) || (endDate && !validateParams(endDate))) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }
    let result;
    if (startDate && endDate) {
      result = await firebaseService.getSchedulesByCaregiverIdInDateRange(caregiverId, startDate, endDate);
    } else {
      result = await firebaseService.getSchedulesByCaregiverId(caregiverId);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/firebase/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const data = req.body;
    if (!validateParams(clientId) || !validateParams(data)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await firebaseService.updateClient(clientId, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/firebase/caregiver/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    const data = req.body;
    if (!validateParams(caregiverId) || !validateParams(data)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await firebaseService.updateCaregiver(caregiverId, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/caregiverAvailability/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    if (!validateParams(caregiverId)) return res.status(400).json({ error: 'Invalid caregiverId' });
    const result = await firebaseService.getCaregiverAvailability(caregiverId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/firebase/caregiverAvailability/:caregiverId', async (req, res) => {
  try {
    const { caregiverId } = req.params;
    const availabilityData = req.body;
    if (!validateParams(caregiverId) || !validateParams(availabilityData)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await firebaseService.updateCaregiverAvailability(caregiverId, availabilityData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firebase/schedule/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    if (!validateParams(scheduleId)) return res.status(400).json({ error: 'Invalid scheduleId' });
    const result = await firebaseService.getSchedule(scheduleId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Schedule Scanner Endpoints ---
app.get('/api/scanner/status', async (req, res) => {
  try {
    const result = scheduleScanner.getStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scanner/start', async (req, res) => {
  try {
    const { intervalMinutes } = req.body;
    if (intervalMinutes !== undefined && !validateParams(intervalMinutes)) return res.status(400).json({ error: 'Invalid intervalMinutes' });
    const result = scheduleScanner.start(intervalMinutes); // Assuming this can be called with undefined
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scanner/stop', async (req, res) => {
  try {
    const result = scheduleScanner.stop();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scanner/forceScan', async (req, res) => {
  try {
    const { options } = req.body;
    if (options !== undefined && !validateParams(options)) return res.status(400).json({ error: 'Invalid options' });
    const result = await scheduleScanner.forceScan(options); // Assuming this can be called with undefined
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/scanner/history', async (req, res) => { // Assuming limit in query
  try {
    const { limit } = req.query;
    if (limit !== undefined && !validateParams(parseInt(limit, 10))) return res.status(400).json({ error: 'Invalid limit' });
    const result = scheduleScanner.getScanHistory(limit ? parseInt(limit, 10) : undefined);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- Circular Integration Model Endpoints ---
// These require the realTimeUpdatesService to be integrated if it's meant to publish updates.
// For now, just replicating the Firebase call.
const realTimeUpdatesService = require('./app/services/real-time-updates'); // Ensure this path is correct

app.put('/api/firebase/circularEntity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const data = req.body;
    if (!validateParams(entityType) || !validateParams(entityId) || !validateParams(data)) {
        return res.status(400).json({ error: 'Invalid parameters for circular entity update' });
    }
    const result = await firebaseService.updateDocument(entityType, entityId, data);
    // Publish the update to the real-time system to ensure circular data flow
    // The channel 'ipc-channel' might need to be re-evaluated in a web context (e.g., WebSocket topic)
    if (realTimeUpdatesService && realTimeUpdatesService.publish) {
        await realTimeUpdatesService.publish(entityType, { id: entityId, ...data }, 'api-update-channel');
    } else {
        console.warn('realTimeUpdatesService.publish is not available. Skipping real-time publish.');
    }
    res.json(result);
  } catch (error) {
    console.error('Error updating circular entity:', error);
    res.status(500).json({ error: error.message || 'Failed to update circular entity' });
  }
});

app.get('/api/firebase/circularEntities/:entityType', async (req, res) => { // Assuming filter in query
  try {
    const { entityType } = req.params;
    const filter = req.query; // This might need more specific parsing depending on filter structure
    if (!validateParams(entityType) || !validateParams(filter)) return res.status(400).json({ error: 'Invalid parameters' });
    const result = await firebaseService.getDocuments(entityType, filter);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Fallback to React app for client-side routing (production)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) { // If it's an API route that wasn't caught, it's a 404
    return res.status(404).send('API endpoint not found');
  }
  // For non-API routes, serve the frontend
  // This needs to be AFTER all your API routes
  res.sendFile(path.join(__dirname, 'frontend/build/index.html'), (err) => {
    if (err) {
      res.status(500).send(err);
    }
  });
});


// Initialize backend services and start the server
async function startServer() {
  try {
    await firebaseService.initialize();
    await agentManager.initialize(); // Assuming this is async
    scheduleScanner.start(); // Assuming this is sync or handles its own async init

    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      console.log('All services initialized successfully');
    });
  } catch (error) {
    console.error('Failed to initialize services or start server:', error);
    process.exit(1); // Exit if critical services fail
  }
}

startServer();

module.exports = app; // For potential testing

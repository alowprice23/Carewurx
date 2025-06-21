/**
 * Main Electron Process
 * Entry point for the application
 * 
 * SECURITY ENHANCED VERSION - Fixes multiple critical vulnerabilities
 */

const { app, BrowserWindow, ipcMain, session, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const agentManager = require('./agents/core/agent-manager');
const scheduleScanner = require('./services/schedule-scanner');
const enhancedScheduler = require('./services/enhanced-scheduler');
const notificationService = require('./services/notification-service');
const { firebaseService } = require('./services/firebase');

let mainWindow;

/**
 * Create the main browser window
 */
// Load environment variables
dotenv.config();

// Configure Content Security Policy
const setupCSP = () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com; img-src 'self' data:; font-src 'self' data:;"
        ]
      }
    });
  });
};

/**
 * Create the main browser window with enhanced security
 */
function createWindow() {
  // Set up strict CSP
  setupCSP();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableRemoteModule: false
    }
  });
  
  // Only open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Load the main HTML file
  try {
    // In development, load the React dev server
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:3000');
    } else {
      // In production, load the built file
      console.log('Loading frontend from:', path.join(__dirname, 'frontend/build/index.html'));
      const absolutePath = path.join(__dirname, 'frontend/build/index.html');
      console.log('Absolute path:', absolutePath);
      
      // Add event listener to catch load failures
      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
      // Try fallback immediately with a secure approach
      console.log('Attempting fallback to original app');
      mainWindow.loadFile(path.join(__dirname, 'app/index.html'));
    });
    
    // Add content loaded listener for logging only
    mainWindow.webContents.on('dom-ready', () => {
      console.log('DOM is ready');
      // No more insecure executeJavaScript
    });
      
      mainWindow.loadFile(absolutePath);
    }
  } catch (error) {
    console.error('Error loading frontend:', error);
    // Fallback to the original app as a last resort
    mainWindow.loadFile(path.join(__dirname, 'app/index.html'));
  }


  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * App ready event
 */
app.on('ready', async () => {
  createWindow();
  
  // Initialize backend services
  try {
    await firebaseService.initialize();
    await agentManager.initialize();
    scheduleScanner.start();
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
});

/**
 * App window-all-closed event
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * App activate event
 */
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * IPC Handlers
 * These handlers expose backend functionality to the renderer process
 */

// Agent Manager IPC
ipcMain.handle('agent:processMessage', async (event, userId, message) => {
  return await agentManager.processMessage(userId, message);
});

// Enhanced Scheduler IPC
ipcMain.handle('scheduler:createSchedule', async (event, scheduleData) => {
  return await enhancedScheduler.createSchedule(scheduleData);
});

ipcMain.handle('scheduler:updateSchedule', async (event, scheduleId, updatedData) => {
  return await enhancedScheduler.updateSchedule(scheduleId, updatedData);
});

ipcMain.handle('scheduler:deleteSchedule', async (event, scheduleId) => {
  return await enhancedScheduler.deleteSchedule(scheduleId);
});

ipcMain.handle('scheduler:findBestCaregiver', async (event, scheduleId) => {
  return await enhancedScheduler.findBestCaregiver(scheduleId);
});

// Notification Service IPC
ipcMain.handle('notifications:get', async (event, options) => {
  return await notificationService.getNotifications(options);
});

ipcMain.handle('notifications:markAsRead', async (event, notificationId) => {
  return await notificationService.markAsRead(notificationId);
});

// Firebase Service IPC (for direct data access)
ipcMain.handle('firebase:getSchedulesInDateRange', async (event, startDate, endDate) => {
  return await firebaseService.getSchedulesInDateRange(startDate, endDate);
});

ipcMain.handle('firebase:getOpportunities', async (event, options) => {
  return await firebaseService.getOpportunities(options);
});

ipcMain.handle('firebase:getClient', async (event, clientId) => {
  return await firebaseService.getClient(clientId);
});

ipcMain.handle('firebase:getCaregiver', async (event, caregiverId) => {
  return await firebaseService.getCaregiver(caregiverId);
});

ipcMain.handle('firebase:getAllClients', async (event) => {
  return await firebaseService.getAllClients();
});

ipcMain.handle('firebase:getAllCaregivers', async (event) => {
  return await firebaseService.getAllCaregivers();
});

ipcMain.handle('firebase:getSchedulesByClientId', async (event, clientId, startDate, endDate) => {
  // If date range provided, use it; otherwise get all schedules
  if (startDate && endDate) {
    return await firebaseService.getSchedulesByClientIdInDateRange(clientId, startDate, endDate);
  } else {
    return await firebaseService.getSchedulesByClientId(clientId);
  }
});

ipcMain.handle('firebase:getSchedulesByCaregiverId', async (event, caregiverId, startDate, endDate) => {
  // If date range provided, use it; otherwise get all schedules
  if (startDate && endDate) {
    return await firebaseService.getSchedulesByCaregiverIdInDateRange(caregiverId, startDate, endDate);
  } else {
    return await firebaseService.getSchedulesByCaregiverId(caregiverId);
  }
});

ipcMain.handle('firebase:updateClient', async (event, clientId, data) => {
  return await firebaseService.updateClient(clientId, data);
});

ipcMain.handle('firebase:updateCaregiver', async (event, caregiverId, data) => {
  return await firebaseService.updateCaregiver(caregiverId, data);
});

// Caregiver availability management
ipcMain.handle('firebase:getCaregiverAvailability', async (event, caregiverId) => {
  return await firebaseService.getCaregiverAvailability(caregiverId);
});

ipcMain.handle('firebase:updateCaregiverAvailability', async (event, caregiverId, availabilityData) => {
  return await firebaseService.updateCaregiverAvailability(caregiverId, availabilityData);
});

// Schedule assignment and management
ipcMain.handle('scheduler:createClientSchedule', async (event, clientId, scheduleData) => {
  return await enhancedScheduler.createClientSchedule(clientId, scheduleData);
});

ipcMain.handle('scheduler:assignCaregiverToSchedule', async (event, scheduleId, caregiverId) => {
  return await enhancedScheduler.assignCaregiverToSchedule(scheduleId, caregiverId);
});

ipcMain.handle('scheduler:findAvailableCaregivers', async (event, scheduleId) => {
  return await enhancedScheduler.findAvailableCaregivers(scheduleId);
});

// Agent-powered opportunity scanning and management
ipcMain.handle('agent:scanForOpportunities', async (event, options) => {
  return await agentManager.scanForOpportunities(options);
});

ipcMain.handle('agent:getOpportunityDetails', async (event, opportunityId) => {
  return await agentManager.getOpportunityDetails(opportunityId);
});

ipcMain.handle('agent:applyOpportunity', async (event, opportunityId, options) => {
  return await agentManager.applyOpportunity(opportunityId, options);
});

ipcMain.handle('agent:rejectOpportunity', async (event, opportunityId, reason) => {
  return await agentManager.rejectOpportunity(opportunityId, { reason });
});

// Schedule scanner management
ipcMain.handle('scanner:getStatus', async (event) => {
  return scheduleScanner.getStatus();
});

ipcMain.handle('scanner:start', async (event, intervalMinutes) => {
  return scheduleScanner.start(intervalMinutes);
});

ipcMain.handle('scanner:stop', async (event) => {
  return scheduleScanner.stop();
});

ipcMain.handle('scanner:forceScan', async (event, options) => {
  return await scheduleScanner.forceScan(options);
});

ipcMain.handle('scanner:getHistory', async (event, limit) => {
  return scheduleScanner.getScanHistory(limit);
});

// Enhanced notification management
ipcMain.handle('notifications:create', async (event, notificationData) => {
  return await notificationService.createNotification(notificationData);
});

ipcMain.handle('notifications:delete', async (event, notificationId) => {
  return await notificationService.deleteNotification(notificationId);
});

ipcMain.handle('notifications:markAllAsRead', async (event) => {
  return await notificationService.markAllAsRead();
});

// Agent-specific operations
ipcMain.handle('agent:getInsights', async (event, scheduleId) => {
  return await agentManager.getInsightsForSchedule(scheduleId);
});

ipcMain.handle('agent:getSuggestions', async (event, entityId, entityType) => {
  return await agentManager.getSuggestions(entityId, entityType);
});

ipcMain.handle('agent:startConversation', async (event, agentName, initialMessage) => {
  const userId = 'frontend-user'; // Use a default user ID for now
  return await agentManager.startConversation(userId, agentName, initialMessage);
});

ipcMain.handle('agent:getResponse', async (event, conversationId, message) => {
  return await agentManager.getResponse(conversationId, message);
});

// Schedule conflict detection and resolution
ipcMain.handle('scheduler:checkConflicts', async (event, scheduleId) => {
  return await enhancedScheduler.checkScheduleConflicts(scheduleId);
});

ipcMain.handle('scheduler:resolveConflict', async (event, conflictId, resolution) => {
  return await enhancedScheduler.resolveScheduleConflict(conflictId, resolution);
});

// Enhanced schedule management
ipcMain.handle('firebase:getSchedule', async (event, scheduleId) => {
  return await firebaseService.getSchedule(scheduleId);
});

ipcMain.handle('scheduler:getScheduleWithDetails', async (event, scheduleId) => {
  return await enhancedScheduler.getScheduleWithDetails(scheduleId);
});

ipcMain.handle('scheduler:optimizeSchedules', async (event, date) => {
  return await enhancedScheduler.optimizeSchedules(date);
});

// Database operations specifically for the circular integration model (C=2πr)
ipcMain.handle('firebase:updateCircularEntity', async (event, entityType, entityId, data) => {
  const result = await firebaseService.updateDocument(entityType, entityId, data);
  // Publish the update to the real-time system to ensure circular data flow
  const realTimeUpdatesService = require('./app/services/real-time-updates');
  await realTimeUpdatesService.publish(entityType, { id: entityId, ...data }, 'ipc-channel');
  return result;
});

ipcMain.handle('firebase:getCircularEntities', async (event, entityType, filter) => {
  return await firebaseService.getDocuments(entityType, filter);
});

// --- IPC Handlers for ConflictResolutionUI (to be implemented) ---
// ipcMain.handle('conflicts:getPending', async (event) => { /* ... call enhancedScheduler or firebaseService ... */ });
// ipcMain.handle('conflicts:getResolved', async (event) => { /* ... */ });
// ipcMain.handle('conflicts:getAll', async (event) => { /* ... */ });
// ipcMain.handle('conflicts:getHistory', async (event) => { /* ... */ });
// ipcMain.handle('conflicts:getOptions', async (event, conflictId) => { /* ... */ });
// ipcMain.handle('conflicts:resolve', async (event, resolutionData) => { /* ... */ });
// ipcMain.handle('conflicts:override', async (event, overrideData) => { /* ... */ });
// --- End of ConflictResolutionUI IPC Handlers ---

// --- IPC Handlers for ScheduleOptimizationControls (to be implemented) ---
// ipcMain.handle('scheduler:getSchedulesInRange', async (event, params) => { /* ... call firebaseService ... */ });
// ipcMain.handle('scheduler:getOptimizationHistory', async (event) => { /* ... call enhancedScheduler or firebaseService ... */ });
// ipcMain.handle('scheduler:runOptimization', async (event, params) => { /* ... call enhancedScheduler.optimizeSchedule(params) ... */ });
// ipcMain.handle('scheduler:applyOptimization', async (event, optimizationId) => { /* ... call enhancedScheduler.applyOptimizedSchedule(optimizationId) ... */ });
// ipcMain.handle('scheduler:getOptimizationDetails', async (event, optimizationId) => { /* ... call enhancedScheduler or firebaseService ... */ });
// ipcMain.handle('scheduler:optimizeSchedulesByDate', async (event, date) => { /* ... call enhancedScheduler.optimizeSchedules(date) ... */ }); // Original handler
// --- End of ScheduleOptimizationControls IPC Handlers ---

// --- IPC Handlers for CaregiverMatchingSystem (to be implemented, likely call enhancedScheduler) ---
// ipcMain.handle('scheduler:getMatchingHistory', async (event) => { /* ... */ });
// ipcMain.handle('scheduler:runAutomatedMatching', async (event, params) => { /* ... */ });
// ipcMain.handle('scheduler:applyMatches', async (event, params) => { /* ... */ });
// ipcMain.handle('scheduler:saveMatchingCriteria', async (event, criteria) => { /* ... */ });
// ipcMain.handle('scheduler:getDefaultMatchingCriteria', async (event) => { /* ... */ });
// ipcMain.handle('scheduler:getUnassignedClients', async (event) => { /* ... */ });
// ipcMain.handle('scheduler:getHistoricalMatches', async (event, historyId) => { /* ... */ });
// ipcMain.handle('scheduler:revertMatches', async (event, historyId) => { /* ... */ });
// --- End of CaregiverMatchingSystem IPC Handlers ---

// --- IPC Handlers for UniversalDataService (to be implemented) ---
// These would typically call methods on firebaseService (the admin one)
// Example: ipcMain.handle('data:getEntities', async (event, entityType, options) => firebaseService.getDocuments(entityType, options) );
// ipcMain.handle('data:getEntity', async (event, entityType, entityId) => firebaseService.getDocument(entityType, entityId) );
// ipcMain.handle('data:createEntity', async (event, entityType, data) => firebaseService.addDocument(entityType, data) );
// ipcMain.handle('data:updateEntity', async (event, entityType, entityId, data) => firebaseService.updateDocument(entityType, entityId, data) );
// ipcMain.handle('data:deleteEntity', async (event, entityType, entityId) => firebaseService.deleteDocument(entityType, entityId) );
// --- End of UniversalDataService IPC Handlers ---

// --- IPC Handlers for DataConsistencyChecker (to be implemented, likely call a new backend service) ---
// ipcMain.handle('dbHealth:getStatus', async (event) => { /* ... */ });
// ipcMain.handle('dbHealth:runCheck', async (event, config) => { /* ... */ });
// ipcMain.handle('dbHealth:getInconsistencies', async (event, filter) => { /* ... */ });
// ipcMain.handle('dbHealth:runRepairs', async (event, selectedIds, repairConfig) => { /* ... */ });
// ipcMain.handle('dbHealth:getStatistics', async (event) => { /* ... */ });
// --- End of DataConsistencyChecker IPC Handlers ---

// --- Additional IPC Handlers for NotificationCreator ---
// ipcMain.handle('notifications:getRecipients', async (event) => {
//   // const users = await firebaseService.getDocuments('users', { fields: ['name'] });
//   // const clients = await firebaseService.getDocuments('clients', { fields: ['name'] });
//   // const caregivers = await firebaseService.getDocuments('caregivers', { fields: ['name'] });
//   // return [...users.map(u=>({id:u.id, name:u.name, type:'user'})), ...];
//   return []; // Placeholder
// });
// --- End of NotificationCreator IPC Handlers ---

// Note: The mock 'auth:*' IPC handlers have been removed.
// Authentication is now handled by the Firebase Client SDK in the renderer (Login.jsx).
// If main process actions need to be performed on behalf of an authenticated user,
// the renderer should send the user's ID token via an IPC channel.
// The main process would then verify this ID token using the Firebase Admin SDK
// before performing the action. Example (conceptual):
// ipcMain.handle('some:secureAction', async (event, idToken, actionData) => {
//   try {
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     const uid = decodedToken.uid;
//     // Proceed with action using uid and actionData
//     // Example: return await someService.doSecureThingForUser(uid, actionData);
//   } catch (error) {
//     console.error('Secure action failed: Invalid ID token or other error', error);
//     throw new Error('Authentication required or token invalid.');
//   }
// });


/**
 * Apply security-related handlers and enhancements when the app is ready
 */
app.whenReady().then(() => {
  // Register a secure custom protocol if needed
  protocol.registerFileProtocol('secure-file', (request, callback) => {
    const url = request.url.substr(13);
    try {
      // Sanitize and validate the path
      const filePath = path.normalize(url);
      if (filePath.startsWith('..') || !filePath.startsWith(app.getAppPath())) {
        throw new Error('Invalid path');
      }
      callback({ path: path.normalize(`${app.getAppPath()}/${url}`) });
    } catch (error) {
      console.error('Protocol error:', error);
      callback({ error: -324 }); // NET::ERR_EMPTY_RESPONSE
    }
  });
  
  // Apply additional permission handlers
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const secureOrigins = ['file://', 'http://localhost'];
    const url = webContents.getURL();
    
    // Only allow permissions from secure origins
    if (secureOrigins.some(origin => url.startsWith(origin))) {
      // Restrict to only necessary permissions
      if (['notifications', 'media'].includes(permission)) {
        return callback(true);
      }
    }
    
    // Deny all other permissions
    callback(false);
  });
});

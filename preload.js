/**
 * Preload Script
 * Securely exposes backend functionality to the renderer process
 * with proper parameter validation and security measures
 */

const { ipcRenderer, contextBridge } = require('electron');

// Add minimal console log for debugging
console.log('Preload script starting...');

/**
 * Parameter validation to prevent security vulnerabilities
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
      /\s*data\s*:/i,        // data: URI scheme
      /\beval\s*\(/i,        // eval() function
      /\bdocument\s*\.\s*write/i, // document.write
      /\bFunction\s*\(/i     // Function constructor
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(params));
  }
  
  // All other types are considered safe
  return true;
}

/**
 * Securely invoke IPC with parameter validation
 * @param {string} channel - The IPC channel to invoke
 * @param  {...any} args - Arguments to pass to the channel
 * @returns {Promise<any>} The result of the IPC call
 */
async function secureIPCInvoke(channel, ...args) {
  // Validate all parameters
  if (!args.every(arg => validateParams(arg))) {
    throw new Error('Invalid parameters detected');
  }
  
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`Error in ${channel}:`, error.message);
    throw error;
  }
}

// Use contextBridge to securely expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Agent Manager
  processMessage: (userId, message) => secureIPCInvoke('agent:processMessage', userId, message),

  // Enhanced Scheduler
  createSchedule: (scheduleData) => secureIPCInvoke('scheduler:createSchedule', scheduleData),
  updateSchedule: (scheduleId, updatedData) => secureIPCInvoke('scheduler:updateSchedule', scheduleId, updatedData),
  deleteSchedule: (scheduleId) => secureIPCInvoke('scheduler:deleteSchedule', scheduleId),
  findBestCaregiver: (scheduleId) => secureIPCInvoke('scheduler:findBestCaregiver', scheduleId),

  // Notification Service
  getNotifications: (options) => secureIPCInvoke('notifications:get', options),
  markAsRead: (notificationId) => secureIPCInvoke('notifications:markAsRead', notificationId),

  // Firebase Service (for direct data access)
  getSchedulesInDateRange: (startDate, endDate) => secureIPCInvoke('firebase:getSchedulesInDateRange', startDate, endDate),
  getOpportunities: (options) => secureIPCInvoke('firebase:getOpportunities', options),
  getClient: (clientId) => secureIPCInvoke('firebase:getClient', clientId),
  getCaregiver: (caregiverId) => secureIPCInvoke('firebase:getCaregiver', caregiverId),
  getAllClients: () => secureIPCInvoke('firebase:getAllClients'),
  getAllCaregivers: () => secureIPCInvoke('firebase:getAllCaregivers'),
  
  // Enhanced schedule methods for profile-centric architecture
  getSchedulesByClientId: (clientId, startDate, endDate) => 
    secureIPCInvoke('firebase:getSchedulesByClientId', clientId, startDate, endDate),
  getSchedulesByCaregiverId: (caregiverId, startDate, endDate) => 
    secureIPCInvoke('firebase:getSchedulesByCaregiverId', caregiverId, startDate, endDate),
  
  // Client and Caregiver management
  createClient: (data) => secureIPCInvoke('firebase:createClient', data),
  getClient: (clientId) => secureIPCInvoke('firebase:getClient', clientId),
  getAllClients: () => secureIPCInvoke('firebase:getAllClients'),
  updateClient: (clientId, data) => secureIPCInvoke('firebase:updateClient', clientId, data),
  deleteClient: (id) => secureIPCInvoke('firebase:deleteClient', id),

  createCaregiver: (data) => secureIPCInvoke('firebase:createCaregiver', data),
  getCaregiver: (caregiverId) => secureIPCInvoke('firebase:getCaregiver', caregiverId),
  getAllCaregivers: () => secureIPCInvoke('firebase:getAllCaregivers'),
  updateCaregiver: (caregiverId, data) => secureIPCInvoke('firebase:updateCaregiver', caregiverId, data),
  deleteCaregiver: (id) => secureIPCInvoke('firebase:deleteCaregiver', id),
  
  // Caregiver availability management
  getCaregiverAvailability: (caregiverId) => secureIPCInvoke('firebase:getCaregiverAvailability', caregiverId),
  updateCaregiverAvailability: (caregiverId, availabilityData) => 
    secureIPCInvoke('firebase:updateCaregiverAvailability', caregiverId, availabilityData),
  
  // Schedule assignment and management
  createClientSchedule: (clientId, scheduleData) => 
    secureIPCInvoke('scheduler:createClientSchedule', clientId, scheduleData),
  assignCaregiverToSchedule: (scheduleId, caregiverId) => 
    secureIPCInvoke('scheduler:assignCaregiverToSchedule', scheduleId, caregiverId),
  findAvailableCaregivers: (scheduleId) => 
    secureIPCInvoke('scheduler:findAvailableCaregivers', scheduleId),
  
  // Agent-powered opportunity scanning and management
  scanForOpportunities: (options) => secureIPCInvoke('agent:scanForOpportunities', options),
  getOpportunityDetails: (opportunityId) => secureIPCInvoke('agent:getOpportunityDetails', opportunityId),
  applyOpportunity: (opportunityId, options) => secureIPCInvoke('agent:applyOpportunity', opportunityId, options),
  rejectOpportunity: (opportunityId, reason) => secureIPCInvoke('agent:rejectOpportunity', opportunityId, reason),
  
  // Schedule scanner management
  getScheduleScannerStatus: () => secureIPCInvoke('scanner:getStatus'),
  startScheduleScanner: (intervalMinutes) => secureIPCInvoke('scanner:start', intervalMinutes),
  stopScheduleScanner: () => secureIPCInvoke('scanner:stop'),
  forceScanSchedules: (options) => secureIPCInvoke('scanner:forceScan', options),
  getScanHistory: (limit) => secureIPCInvoke('scanner:getHistory', limit),
  
  // Enhanced notification management
  createNotification: (notificationData) => secureIPCInvoke('notifications:create', notificationData),
  deleteNotification: (notificationId) => secureIPCInvoke('notifications:delete', notificationId),
  markAllNotificationsAsRead: () => secureIPCInvoke('notifications:markAllAsRead'),
  getAvailableRecipients: () => secureIPCInvoke('notifications:getAvailableRecipients'),
  
  // Agent-specific operations
  getAgentInsights: (scheduleId) => secureIPCInvoke('agent:getInsights', scheduleId),
  getAgentSuggestions: (entityId, entityType) => secureIPCInvoke('agent:getSuggestions', entityId, entityType),
  startAgentConversation: (agentName, initialMessage) => secureIPCInvoke('agent:startConversation', agentName, initialMessage),
  getAgentResponse: (conversationId, message) => secureIPCInvoke('agent:getResponse', conversationId, message),

  // API Key Management (added under electronAPI directly, matching other agent: handlers)
  saveApiKey: (params) => secureIPCInvoke('agent:saveApiKey', params), // { provider, apiKey, idToken }
  getApiKeyStatuses: (params) => secureIPCInvoke('agent:getApiKeyStatuses', params), // { idToken }
  deleteApiKey: (params) => secureIPCInvoke('agent:deleteApiKey', params), // { provider, idToken }
  validateApiKey: (params) => secureIPCInvoke('agent:validateApiKey', params), // { provider, apiKeyToValidate, idToken }
  getApiUsageStats: (params) => secureIPCInvoke('agent:getApiUsageStats', params), // { idToken }
  
  // Schedule conflict detection and resolution
  checkScheduleConflicts: (scheduleId) => secureIPCInvoke('scheduler:checkConflicts', scheduleId),
  resolveScheduleConflict: (conflictId, resolutionData) => secureIPCInvoke('scheduler:resolveConflict', conflictId, resolutionData),
  getConflicts: (filterOptions) => secureIPCInvoke('scheduler:getConflicts', filterOptions),
  getConflictResolutionOptions: (conflictData) => secureIPCInvoke('scheduler:getConflictResolutionOptions', conflictData),
  overrideConflict: (overrideData) => secureIPCInvoke('scheduler:overrideConflict', overrideData), // overrideData = { conflictId, reason, userId }
  getConflictResolutionHistory: (limit) => secureIPCInvoke('scheduler:getConflictResolutionHistory', limit),
  
  // Enhanced schedule management
  getSchedule: (scheduleId) => secureIPCInvoke('firebase:getSchedule', scheduleId),
  getScheduleWithDetails: (scheduleId) => secureIPCInvoke('scheduler:getScheduleWithDetails', scheduleId),
  // Note: optimizeSchedules was removed from main.js in previous diff, if it's needed, it should be added back there and here.
  // optimizeSchedules: (date) => secureIPCInvoke('scheduler:optimizeSchedules', date), // Assuming it might be re-added or was missed.
  
  // Database operations for the circular integration model
  updateCircularEntity: (entityType, entityId, data) => secureIPCInvoke('firebase:updateCircularEntity', entityType, entityId, data),
  getCircularEntities: (entityType, filter) => secureIPCInvoke('firebase:getCircularEntities', entityType, filter),
  
  // --- Authentication methods ---
  // getCurrentUser is removed, frontend will rely on its own Firebase SDK state.

  /**
   * Notifies the backend that a user has successfully signed in on the client-side.
   * The backend will verify the token.
   * @param {object} params - Parameters object.
   * @param {string} params.idToken - The Firebase ID token of the signed-in user.
   * @returns {Promise<object>} Backend confirmation, e.g., { success: true, uid: '...' }.
   */
  userSignedIn: async (params) => { // Expects an object like { idToken: '...' }
    if (!params || !params.idToken || typeof params.idToken !== 'string') {
      console.error('[Preload:userSignedIn] Invalid parameters: idToken is required.');
      throw new Error('userSignedIn requires an idToken.');
    }
    try {
      // The args for secureIPCInvoke will be [{idToken: '...'}]
      const result = await secureIPCInvoke('auth:userSignedIn', params);
      window.dispatchEvent(new CustomEvent('auth-state-change', { 
        detail: { authenticated: true, user: result } // Pass user info if available
      }));
      return result;
    } catch (error) {
      // Ensure auth-state-change reflects failure if initial sign-in verification fails
      window.dispatchEvent(new CustomEvent('auth-state-change', {
        detail: { authenticated: false, error: error.message }
      }));
      console.error('[Preload:userSignedIn] Error:', error.message);
      throw error; // Rethrow the original error structure from main.js
    }
  },

  /**
   * Notifies the backend that a user has signed out on the client-side.
   * @param {object} [params] - Optional parameters object.
   * @param {string} [params.idToken] - Optionally pass the token for logging/revocation (if supported).
   * @returns {Promise<object>} Backend confirmation, e.g., { success: true }.
   */
  userSignedOut: async (params) => { // params is optional, e.g., { idToken: '...' }
    try {
      // If params are provided, they are passed. If not, no args beyond channel.
      const result = await secureIPCInvoke('auth:userSignedOut', ...(params ? [params] : []));
      window.dispatchEvent(new CustomEvent('auth-state-change', { 
        detail: { authenticated: false }
      }));
      return result;
    } catch (error) {
      console.error('[Preload:userSignedOut] Error:', error.message);
      throw error; // Rethrow the original error structure from main.js
    }
  },
  // --- End Authentication methods ---

  // Batch Upload
  // Note: This (and other protected handlers) will now need idToken passed in params
  // Example: electronAPI.uploadBatchFile({ idToken: '...', filePath: '...', ... })
  uploadBatchFile: (params) => secureIPCInvoke('upload-batch-file', params),
  getBatchUploadProgress: (batchId) => secureIPCInvoke('get-batch-upload-progress', batchId),
  cancelBatchUpload: (batchId) => secureIPCInvoke('cancel-batch-upload', batchId),
});

// Only enable additional debugging in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
}

// Log that preload script has completed
console.log('Preload script completed: APIs securely exposed via contextBridge');

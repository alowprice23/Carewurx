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
  updateClient: (clientId, data) => secureIPCInvoke('firebase:updateClient', clientId, data),
  updateCaregiver: (caregiverId, data) => secureIPCInvoke('firebase:updateCaregiver', caregiverId, data),
  
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
  
  // Agent-specific operations
  getAgentInsights: (scheduleId) => secureIPCInvoke('agent:getInsights', scheduleId),
  getAgentSuggestions: (entityId, entityType) => secureIPCInvoke('agent:getSuggestions', entityId, entityType),
  startAgentConversation: (agentName, initialMessage) => secureIPCInvoke('agent:startConversation', agentName, initialMessage),
  getAgentResponse: (conversationId, message) => secureIPCInvoke('agent:getResponse', conversationId, message),
  
  // Schedule conflict detection and resolution
  checkScheduleConflicts: (scheduleId) => secureIPCInvoke('scheduler:checkConflicts', scheduleId),
  resolveScheduleConflict: (conflictId, resolution) => secureIPCInvoke('scheduler:resolveConflict', conflictId, resolution),
  
  // Enhanced schedule management
  getSchedule: (scheduleId) => secureIPCInvoke('firebase:getSchedule', scheduleId),
  getScheduleWithDetails: (scheduleId) => secureIPCInvoke('scheduler:getScheduleWithDetails', scheduleId),
  optimizeSchedules: (date) => secureIPCInvoke('scheduler:optimizeSchedules', date),
  
  // Database operations for the circular integration model
  updateCircularEntity: (entityType, entityId, data) => secureIPCInvoke('firebase:updateCircularEntity', entityType, entityId, data),
  getCircularEntities: (entityType, filter) => secureIPCInvoke('firebase:getCircularEntities', entityType, filter),
  
  // --- IPC Channels for ConflictResolutionUI (to be implemented in main.js) ---
  // getPendingConflicts: () => secureIPCInvoke('conflicts:getPending'),
  // getResolvedConflicts: () => secureIPCInvoke('conflicts:getResolved'),
  // getAllConflicts: () => secureIPCInvoke('conflicts:getAll'),
  // getConflictResolutionHistory: () => secureIPCInvoke('conflicts:getHistory'),
  // getConflictResolutionOptions: (conflictId) => secureIPCInvoke('conflicts:getOptions', conflictId),
  // resolveConflict: (resolutionData) => secureIPCInvoke('conflicts:resolve', resolutionData),
  // overrideConflict: (overrideData) => secureIPCInvoke('conflicts:override'),
  // --- End of ConflictResolutionUI IPC Channels ---

  // --- IPC Channels for ScheduleOptimizationControls (to be implemented in main.js) ---
  // getSchedulesInRange: (params) => secureIPCInvoke('scheduler:getSchedulesInRange', params), // Note: getCircularEntities might be used by service
  // getOptimizationHistory: () => secureIPCInvoke('scheduler:getOptimizationHistory'),
  // runScheduleOptimization: (params) => secureIPCInvoke('scheduler:runOptimization', params), // Maps to optimizeSchedule in service
  // applyOptimizedSchedule: (optimizationId) => secureIPCInvoke('scheduler:applyOptimization', optimizationId),
  // getOptimizationDetails: (optimizationId) => secureIPCInvoke('scheduler:getOptimizationDetails', optimizationId),
  // optimizeSchedules: (date) => secureIPCInvoke('scheduler:optimizeSchedulesByDate', date), // Original optimizeSchedules by date
  // --- End of ScheduleOptimizationControls IPC Channels ---

  // --- IPC Channels for CaregiverMatchingSystem (to be implemented in main.js, likely call enhancedScheduler) ---
  // getMatchingHistory: () => secureIPCInvoke('scheduler:getMatchingHistory'),
  // runAutomatedMatching: (params) => secureIPCInvoke('scheduler:runAutomatedMatching', params),
  // applyMatches: (params) => secureIPCInvoke('scheduler:applyMatches', params),
  // saveMatchingCriteria: (criteria) => secureIPCInvoke('scheduler:saveMatchingCriteria', criteria),
  // getDefaultMatchingCriteria: () => secureIPCInvoke('scheduler:getDefaultMatchingCriteria'),
  // getUnassignedClients: () => secureIPCInvoke('scheduler:getUnassignedClients'), // Might use data:getEntities
  // getHistoricalMatches: (historyId) => secureIPCInvoke('scheduler:getHistoricalMatches', historyId),
  // revertMatches: (historyId) => secureIPCInvoke('scheduler:revertMatches', historyId),
  // --- End of CaregiverMatchingSystem IPC Channels ---

  // --- IPC Channels for UniversalDataService (to be implemented in main.js) ---
  // getEntities: (entityType, options) => secureIPCInvoke('data:getEntities', entityType, options),
  // getEntity: (entityType, entityId) => secureIPCInvoke('data:getEntity', entityType, entityId),
  // createEntity: (entityType, data) => secureIPCInvoke('data:createEntity', entityType, data),
  // updateEntity: (entityType, entityId, data) => secureIPCInvoke('data:updateEntity', entityType, entityId, data),
  // deleteEntity: (entityType, entityId) => secureIPCInvoke('data:deleteEntity', entityType, entityId),
  // --- End of UniversalDataService IPC Channels ---

  // --- IPC Channels for DataConsistencyChecker (to be implemented in main.js) ---
  // getDbHealthStatus: () => secureIPCInvoke('dbHealth:getStatus'),
  // runDbHealthCheck: (config) => secureIPCInvoke('dbHealth:runCheck', config),
  // getDbInconsistencies: (filter) => secureIPCInvoke('dbHealth:getInconsistencies', filter),
  // runDbRepairOperations: (selectedIds, repairConfig) => secureIPCInvoke('dbHealth:runRepairs', selectedIds, repairConfig),
  // getDbStatistics: () => secureIPCInvoke('dbHealth:getStatistics'),
  // --- End of DataConsistencyChecker IPC Channels ---

  // Authentication will be handled by the Firebase Client SDK in the renderer.
  // If main process actions need to be performed on behalf of the authenticated user,
  // the client can send the user's ID token over IPC for verification.
});

// Only enable additional debugging in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
}

// Log that preload script has completed
console.log('Preload script completed: APIs securely exposed via contextBridge');

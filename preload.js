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
  
  // Authentication methods with secure parameter validation
  getCurrentUser: async () => {
    return await secureIPCInvoke('auth:getCurrentUser');
  },
  signIn: async (email, password) => {
    // Don't log emails or passwords
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      throw new Error('Invalid email or password format');
    }
    
    try {
      const result = await secureIPCInvoke('auth:signIn', email, password);
      
      // Safely notify about authentication state change
      window.dispatchEvent(new CustomEvent('auth-state-change', { 
        detail: { authenticated: true }
      }));
      
      return result;
    } catch (error) {
      throw new Error('Authentication failed');
    }
  },
  signOut: async () => {
    try {
      const result = await secureIPCInvoke('auth:signOut');
      
      // Safely notify about authentication state change
      window.dispatchEvent(new CustomEvent('auth-state-change', { 
        detail: { authenticated: false }
      }));
      
      return result;
    } catch (error) {
      throw new Error('Sign out failed');
    }
  }
});

// Only enable additional debugging in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
}

// Log that preload script has completed
console.log('Preload script completed: APIs securely exposed via contextBridge');

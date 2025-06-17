/**
 * Agent Tools
 * Provides functionality for agents to interact with the system
 */

const { firebaseService } = require('../../services/firebase');
const enhancedScheduler = require('../../services/enhanced-scheduler');
const scheduleAnalysis = require('../../services/schedule-analysis');
const notificationService = require('../../services/notification-service');

/**
 * Tool registry containing all available tools for agents
 */
const tools = {
  /**
   * Look up a client in the database
   * @param {Object} params - Tool parameters
   * @param {string} params.clientId - The client ID to look up
   * @param {string} params.clientName - The client name to search for
   * @returns {Promise<Object>} The client data
   */
  lookupClient: async (params) => {
    try {
      console.log('Running lookupClient tool with params:', params);
      
      // If client ID is provided, get the client directly
      if (params.clientId) {
        return await firebaseService.getClient(params.clientId);
      }
      
      // If client name is provided, search by name
      if (params.clientName) {
        const allClients = await firebaseService.getAllClients();
        const matchingClients = allClients.filter(client => 
          client.name.toLowerCase().includes(params.clientName.toLowerCase())
        );
        
        if (matchingClients.length === 0) {
          return { error: 'No clients found matching that name' };
        }
        
        if (matchingClients.length === 1) {
          return matchingClients[0];
        }
        
        // Return a list of potential matches
        return { 
          matches: matchingClients.map(c => ({ id: c.id, name: c.name })),
          message: 'Multiple clients found. Please specify which one.'
        };
      }
      
      return { error: 'Missing required parameter: clientId or clientName' };
    } catch (error) {
      console.error('Error in lookupClient tool:', error);
      return { error: error.message };
    }
  },
  
  /**
   * Look up a caregiver in the database
   * @param {Object} params - Tool parameters
   * @param {string} params.caregiverId - The caregiver ID to look up
   * @param {string} params.caregiverName - The caregiver name to search for
   * @returns {Promise<Object>} The caregiver data
   */
  lookupCaregiver: async (params) => {
    try {
      console.log('Running lookupCaregiver tool with params:', params);
      
      // If caregiver ID is provided, get the caregiver directly
      if (params.caregiverId) {
        return await firebaseService.getCaregiver(params.caregiverId);
      }
      
      // If caregiver name is provided, search by name
      if (params.caregiverName) {
        const allCaregivers = await firebaseService.getAllCaregivers();
        const matchingCaregivers = allCaregivers.filter(caregiver => 
          caregiver.name.toLowerCase().includes(params.caregiverName.toLowerCase())
        );
        
        if (matchingCaregivers.length === 0) {
          return { error: 'No caregivers found matching that name' };
        }
        
        if (matchingCaregivers.length === 1) {
          return matchingCaregivers[0];
        }
        
        // Return a list of potential matches
        return { 
          matches: matchingCaregivers.map(c => ({ id: c.id, name: c.name })),
          message: 'Multiple caregivers found. Please specify which one.'
        };
      }
      
      return { error: 'Missing required parameter: caregiverId or caregiverName' };
    } catch (error) {
      console.error('Error in lookupCaregiver tool:', error);
      return { error: error.message };
    }
  },
  
  /**
   * Get schedules for a date range
   * @param {Object} params - Tool parameters
   * @param {string} params.startDate - The start date (YYYY-MM-DD)
   * @param {string} params.endDate - The end date (YYYY-MM-DD)
   * @param {string} params.clientId - Optional client ID to filter by
   * @param {string} params.caregiverId - Optional caregiver ID to filter by
   * @returns {Promise<Object>} The schedules
   */
  getSchedules: async (params) => {
    try {
      console.log('Running getSchedules tool with params:', params);
      
      if (!params.startDate || !params.endDate) {
        return { error: 'Missing required parameters: startDate and endDate' };
      }
      
      let schedules;
      
      // If client ID is provided, get schedules for that client
      if (params.clientId) {
        schedules = await firebaseService.getSchedulesByClientId(params.clientId);
        
        // Filter by date range
        schedules = schedules.filter(s => 
          s.date >= params.startDate && s.date <= params.endDate
        );
        
        return { schedules, clientId: params.clientId };
      }
      
      // If caregiver ID is provided, get schedules for that caregiver
      if (params.caregiverId) {
        schedules = await firebaseService.getSchedulesByCaregiverId(params.caregiverId);
        
        // Filter by date range
        schedules = schedules.filter(s => 
          s.date >= params.startDate && s.date <= params.endDate
        );
        
        return { schedules, caregiverId: params.caregiverId };
      }
      
      // Otherwise, get all schedules in the date range
      schedules = await firebaseService.getSchedulesInDateRange(params.startDate, params.endDate);
      
      return { schedules, dateRange: { startDate: params.startDate, endDate: params.endDate } };
    } catch (error) {
      console.error('Error in getSchedules tool:', error);
      return { error: error.message };
    }
  },
  
  /**
   * Analyze schedule utilization and coverage
   * @param {Object} params - Tool parameters
   * @param {string} params.startDate - The start date (YYYY-MM-DD)
   * @param {string} params.endDate - The end date (YYYY-MM-DD)
   * @param {string} params.type - The type of analysis ('utilization' or 'coverage')
   * @returns {Promise<Object>} The analysis results
   */
  analyzeSchedules: async (params) => {
    try {
      console.log('Running analyzeSchedules tool with params:', params);
      
      if (!params.startDate || !params.endDate) {
        return { error: 'Missing required parameters: startDate and endDate' };
      }
      
      if (params.type === 'utilization') {
        const utilization = await scheduleAnalysis.analyzeUtilization(params.startDate, params.endDate);
        return { 
          type: 'utilization',
          data: utilization,
          summary: {
            totalCaregivers: utilization.length,
            underutilized: utilization.filter(u => u.utilization < 50).length,
            optimal: utilization.filter(u => u.utilization >= 50 && u.utilization <= 85).length,
            overutilized: utilization.filter(u => u.utilization > 85).length
          }
        };
      }
      
      if (params.type === 'coverage') {
        const coverage = await scheduleAnalysis.analyzeClientCoverage(params.startDate, params.endDate);
        return { 
          type: 'coverage',
          data: coverage,
          summary: {
            totalClients: coverage.length,
            fullyCovered: coverage.filter(c => c.coverage === 100).length,
            partiallyCovered: coverage.filter(c => c.coverage > 0 && c.coverage < 100).length,
            notCovered: coverage.filter(c => c.coverage === 0).length
          }
        };
      }
      
      return { error: 'Invalid analysis type. Use "utilization" or "coverage".' };
    } catch (error) {
      console.error('Error in analyzeSchedules tool:', error);
      return { error: error.message };
    }
  },
  
  /**
   * Generate optimized schedule
   * @param {Object} params - Tool parameters
   * @param {Array} params.clients - The clients to schedule
   * @param {Array} params.caregivers - The available caregivers
   * @param {Object} params.constraints - Scheduling constraints
   * @returns {Promise<Object>} The optimized schedule
   */
  optimizeSchedule: async (params) => {
    try {
      console.log('Running optimizeSchedule tool with params:', params);
      
      if (!params.clients || !params.caregivers) {
        return { error: 'Missing required parameters: clients and caregivers' };
      }
      
      const constraints = params.constraints || {
        maxDistance: 5, // miles
        maxClientsPerCaregiver: 2,
        minHoursPerWeek: 16,
        maxHoursPerWeek: 50
      };
      
      const result = await enhancedScheduler.generateOptimizedSchedule(
        params.clients,
        params.caregivers,
        constraints
      );
      
      return result;
    } catch (error) {
      console.error('Error in optimizeSchedule tool:', error);
      return { error: error.message };
    }
  },
  
  /**
   * Create a notification
   * @param {Object} params - Tool parameters
   * @param {string} params.title - The notification title
   * @param {string} params.message - The notification message
   * @param {string} params.type - The notification type
   * @param {string} params.targetId - The target ID (client, caregiver, or schedule ID)
   * @returns {Promise<Object>} The created notification
   */
  createNotification: async (params) => {
    try {
      console.log('Running createNotification tool with params:', params);
      
      if (!params.title || !params.message) {
        return { error: 'Missing required parameters: title and message' };
      }
      
      const notificationData = {
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        targetId: params.targetId || null,
        created: new Date().toISOString(),
        read: false
      };
      
      const result = await notificationService.createNotification(notificationData);
      
      return result;
    } catch (error) {
      console.error('Error in createNotification tool:', error);
      return { error: error.message };
    }
  }
};

/**
 * Run a tool with the given name and parameters
 * @param {string} toolName - The name of the tool to run
 * @param {Object} params - The parameters to pass to the tool
 * @returns {Promise<Object>} The tool result
 */
async function runTool(toolName, params) {
  if (!tools[toolName]) {
    return { error: `Unknown tool: ${toolName}` };
  }
  
  try {
    return await tools[toolName](params);
  } catch (error) {
    console.error(`Error running tool ${toolName}:`, error);
    return { error: error.message };
  }
}

module.exports = {
  runTool,
  tools
};

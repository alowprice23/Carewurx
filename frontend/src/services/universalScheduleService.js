/**
 * Universal Schedule Service
 * Provides unified interface to schedule data from different sources.
 * Implements the C=2πr circular integration model and uses Electron IPC
 * with mock fallbacks for browser-only mode.
 */

import { isElectronAvailable } from './firebaseService';

// Mock data for browser-only mode
const MOCK_SCHEDULES_DB = {
  schedule1: { id: 'schedule1', description: 'Morning Visit', clientId: 'client1', caregiverId: 'cg1', date: '2024-08-01', startTime: '09:00', endTime: '11:00', status: 'Confirmed' },
  schedule2: { id: 'schedule2', description: 'Evening Care', clientId: 'client2', caregiverId: 'cg2', date: '2024-08-01', startTime: '17:00', endTime: '19:00', status: 'Pending' },
  schedule3: { id: 'schedule3', description: 'Client 1 follow-up', clientId: 'client1', caregiverId: 'cg1', date: '2024-08-02', startTime: '10:00', endTime: '11:00', status: 'Confirmed' },
};

const MOCK_AVAILABILITY_DB = {
  cg1: { regularSchedule: [{ dayOfWeek: 1, startTime: '08:00', endTime: '17:00' }], timeOff: [] }
};

let nextMockScheduleId = 4;

class UniversalScheduleService {
  /**
   * Get schedules with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} - List of schedules
   */
  async getSchedules(options = {}) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.getCircularEntities('schedules', options);
      } catch (error) {
        console.error('Error getting schedules via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Returning mock schedules', options);
      let schedules = Object.values(MOCK_SCHEDULES_DB);
      if (options.startDate) {
        schedules = schedules.filter(s => new Date(s.date) >= new Date(options.startDate));
      }
      if (options.endDate) {
        schedules = schedules.filter(s => new Date(s.date) <= new Date(options.endDate));
      }
      return Promise.resolve(schedules);
    }
  }

  /**
   * Get a specific schedule by ID
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object|null>} - Schedule data or null
   */
  async getSchedule(scheduleId) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.getSchedule(scheduleId);
      } catch (error) {
        console.error(`Error getting schedule ${scheduleId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Returning mock schedule for ID ${scheduleId}`);
      return Promise.resolve(MOCK_SCHEDULES_DB[scheduleId] || null);
    }
  }

  /**
   * Get schedules for a specific client
   * @param {string} clientId - Client ID
   * @param {Date} [startDate] - Start date (optional)
   * @param {Date} [endDate] - End date (optional)
   * @returns {Promise<Array>} - List of schedules
   */
  async getClientSchedules(clientId, startDate = null, endDate = null) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.getSchedulesByClientId(clientId, startDate, endDate);
      } catch (error) {
        console.error(`Error getting client schedules for ${clientId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Returning mock client schedules for ${clientId}`);
      let schedules = Object.values(MOCK_SCHEDULES_DB).filter(s => s.clientId === clientId);
      if (startDate) schedules = schedules.filter(s => new Date(s.date) >= new Date(startDate));
      if (endDate) schedules = schedules.filter(s => new Date(s.date) <= new Date(endDate));
      return Promise.resolve(schedules);
    }
  }

  /**
   * Get schedules for a specific caregiver
   * @param {string} caregiverId - Caregiver ID
   * @param {Date} [startDate] - Start date (optional)
   * @param {Date} [endDate] - End date (optional)
   * @returns {Promise<Array>} - List of schedules
   */
  async getCaregiverSchedules(caregiverId, startDate = null, endDate = null) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.getSchedulesByCaregiverId(caregiverId, startDate, endDate);
      } catch (error) {
        console.error(`Error getting caregiver schedules for ${caregiverId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Returning mock caregiver schedules for ${caregiverId}`);
      let schedules = Object.values(MOCK_SCHEDULES_DB).filter(s => s.caregiverId === caregiverId);
      if (startDate) schedules = schedules.filter(s => new Date(s.date) >= new Date(startDate));
      if (endDate) schedules = schedules.filter(s => new Date(s.date) <= new Date(endDate));
      return Promise.resolve(schedules);
    }
  }

  /**
   * Update a schedule
   * @param {string} scheduleId - Schedule ID
   * @param {Object} changes - Schedule changes
   * @returns {Promise<Object|null>} - Updated schedule or null if not found (mock)
   */
  async updateSchedule(scheduleId, changes) {
    if (isElectronAvailable) {
      try {
        // Assuming the IPC handler returns the updated schedule object or similar structure
        return await window.electronAPI.updateSchedule(scheduleId, changes);
      } catch (error) {
        console.error(`Error updating schedule ${scheduleId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Simulating update for mock schedule ${scheduleId}`);
      if (MOCK_SCHEDULES_DB[scheduleId]) {
        MOCK_SCHEDULES_DB[scheduleId] = { ...MOCK_SCHEDULES_DB[scheduleId], ...changes, updatedAt: new Date().toISOString() };
        return Promise.resolve(MOCK_SCHEDULES_DB[scheduleId]);
      }
      return Promise.resolve(null); // Or throw new Error('Mock schedule not found');
    }
  }

  /**
   * Find conflicts for a schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Array>} - List of conflicts
   */
  async findConflicts(scheduleId) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.checkScheduleConflicts(scheduleId);
      } catch (error) {
        console.error(`Error finding conflicts for schedule ${scheduleId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Simulating conflict check for mock schedule ${scheduleId}`);
      // Simple mock: no conflicts if schedule exists, or some mock conflict if ID is specific
      return Promise.resolve(MOCK_SCHEDULES_DB[scheduleId] ? [] : [{ type: 'availability', message: 'Mock: Caregiver not available' }]);
    }
  }

  /**
   * Get caregiver availability
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object|null>} - Availability data or null
   */
  async getCaregiverAvailability(caregiverId) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.getCaregiverAvailability(caregiverId);
      } catch (error) {
        console.error(`Error getting caregiver availability for ${caregiverId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Returning mock availability for caregiver ${caregiverId}`);
      return Promise.resolve(MOCK_AVAILABILITY_DB[caregiverId] || { regularSchedule: [], timeOff: [] });
    }
  }

  /**
   * Update caregiver availability
   * @param {string} caregiverId - Caregiver ID
   * @param {Object} availabilityData - Availability data
   * @returns {Promise<Object>} - Mock success response or IPC response
   */
  async updateCaregiverAvailability(caregiverId, availabilityData) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.updateCaregiverAvailability(caregiverId, availabilityData);
      } catch (error) {
        console.error(`Error updating caregiver availability for ${caregiverId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Simulating update for mock availability for caregiver ${caregiverId}`);
      MOCK_AVAILABILITY_DB[caregiverId] = { ...availabilityData };
      return Promise.resolve({ success: true });
    }
  }

  /**
   * Create a universal schedule
   * @param {Object} scheduleData - Schedule data
   * @returns {Promise<Object>} - Created schedule
   */
  async createSchedule(scheduleData) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.createSchedule(scheduleData);
      } catch (error) {
        console.error('Error creating schedule via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Simulating schedule creation');
      const newId = `schedule${nextMockScheduleId++}`;
      const newSchedule = { id: newId, ...scheduleData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      MOCK_SCHEDULES_DB[newId] = newSchedule;
      return Promise.resolve(newSchedule);
    }
  }

  /**
   * Delete a schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object|boolean>} - Success status or IPC response
   */
  async deleteSchedule(scheduleId) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.deleteSchedule(scheduleId);
      } catch (error) {
        console.error(`Error deleting schedule ${scheduleId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Simulating schedule deletion for ${scheduleId}`);
      if (MOCK_SCHEDULES_DB[scheduleId]) {
        delete MOCK_SCHEDULES_DB[scheduleId];
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: false, error: 'Mock schedule not found' });
    }
  }

  /**
   * Get schedule with detailed information
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object|null>} - Detailed schedule or null
   */
  async getScheduleWithDetails(scheduleId) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.getScheduleWithDetails(scheduleId);
      } catch (error) {
        console.error(`Error getting schedule details for ${scheduleId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Returning mock schedule details for ${scheduleId}`);
      const schedule = MOCK_SCHEDULES_DB[scheduleId];
      if (schedule) {
        // Simulate adding details
        return Promise.resolve({
          ...schedule,
          clientName: `Mock Client for ${schedule.clientId}`,
          caregiverName: `Mock Caregiver for ${schedule.caregiverId}`,
          extendedNotes: 'This is a mock detailed schedule.'
        });
      }
      return Promise.resolve(null);
    }
  }

  /**
   * Find best caregiver for a schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object|null>} - Best caregiver match or null
   */
  async findBestCaregiver(scheduleId) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.findBestCaregiver(scheduleId);
      } catch (error) {
        console.error(`Error finding best caregiver for schedule ${scheduleId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Simulating find best caregiver for ${scheduleId}`);
      if (MOCK_SCHEDULES_DB[scheduleId]) {
        return Promise.resolve({ caregiverId: 'cgMockSmart', name: 'Mock Smart Choice CG', score: 0.95 });
      }
      return Promise.resolve(null);
    }
  }

  /**
   * Optimize schedules for a given date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Promise<Object>} - Optimization results
   */
  async optimizeSchedules(date) {
    if (isElectronAvailable) {
      try {
        return await window.electronAPI.optimizeSchedules(date);
      } catch (error) {
        console.error(`Error optimizing schedules for date ${date} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Simulating schedule optimization for ${date}`);
      return Promise.resolve({ success: true, message: `Mock optimization complete for ${date}`, changes: 0 });
    }
  }
}

// Create and export singleton instance
const universalScheduleService = new UniversalScheduleService();
export default universalScheduleService;

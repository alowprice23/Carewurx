/**
 * Universal Schedule Service
 * Provides unified interface to schedule data from different sources.
 * Implements the C=2πr circular integration model and uses Electron IPC
 * with mock fallbacks for browser-only mode.
 */
import firebase from './firebase'; // For auth - Corrected path
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get schedules.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getCircularEntities('schedules', { idToken, options });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getSchedule({ idToken, scheduleId });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get client schedules.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getSchedulesByClientId({ idToken, clientId, startDate, endDate });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get caregiver schedules.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getSchedulesByCaregiverId({ idToken, caregiverId, startDate, endDate });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to update schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.updateSchedule({ idToken, scheduleId, changes });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to find conflicts.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.checkScheduleConflicts({ idToken, scheduleId });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get caregiver availability.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getCaregiverAvailability({ idToken, caregiverId });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to update caregiver availability.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.updateCaregiverAvailability({ idToken, caregiverId, availabilityData });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to create schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.createSchedule({ idToken, scheduleData });
      } catch (error) {
        console.error('Error creating schedule via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Simulating schedule creation');
      const newId = scheduleData.id || `schedule${nextMockScheduleId++}`; // Prioritize provided ID
      const newSchedule = { ...scheduleData, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to delete schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.deleteSchedule({ idToken, scheduleId });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get schedule details.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getScheduleWithDetails({ idToken, scheduleId });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to find best caregiver.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.findBestCaregiver({ idToken, scheduleId });
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
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to optimize schedules.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.optimizeSchedules({ idToken, date });
      } catch (error) {
        console.error(`Error optimizing schedules for date ${date} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalScheduleService: Simulating schedule optimization for ${date}`);
      return Promise.resolve({ success: true, message: `Mock optimization complete for ${date}`, changes: 0 });
    }
  }

  // --- Conflict Resolution Methods ---

  async getConflicts(filterOptions = { status: 'pending' }) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get conflicts.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.scheduler.getConflicts({ idToken, filterOptions });
      } catch (error) {
        console.error('Error getting conflicts via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Returning mock conflicts', filterOptions);
      const mockConflictBase = {
        id: `conflict-${Date.now()}`,
        detectedAt: new Date().toISOString(),
        client: { name: 'Mock Client' },
        caregivers: [{name: 'Mock CG1'}, {name: 'Mock CG2'}],
        scheduleDate: '2024-10-10',
        startTime: '10:00', endTime: '12:00',
        type: 'Double Booking',
        severity: 7,
        description: 'Mock conflict description.'
      };
      if (filterOptions.status === 'pending') return Promise.resolve([{ ...mockConflictBase, status: 'pending' }]);
      if (filterOptions.status === 'resolved') return Promise.resolve([{ ...mockConflictBase, status: 'resolved', resolutionNotes: 'Mock resolved' }]);
      return Promise.resolve([{ ...mockConflictBase, status: 'pending' }, { ...mockConflictBase, id: 'conflict-2', status: 'resolved' }]);
    }
  }

  async getConflictResolutionOptions(conflictData) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get conflict resolution options.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.scheduler.getConflictResolutionOptions({ idToken, conflictData });
      } catch (error) {
        console.error('Error getting conflict resolution options via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Returning mock conflict resolution options');
      return Promise.resolve([
        { id: 'opt1', description: 'Mock Option 1: Reschedule primary', impactLevel: 'medium' },
        { id: 'opt2', description: 'Mock Option 2: Reassign caregiver', impactLevel: 'low' },
      ]);
    }
  }

  async resolveConflict(resolutionData) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to resolve conflict.');
        const idToken = await user.getIdToken();
        // Backend expects (conflictId, resolutionData), pass as {conflictId, resolutionData} to match others
        return await window.electronAPI.scheduler.resolveConflict({idToken, conflictId: resolutionData.conflictId, resolutionData });
      } catch (error) {
        console.error('Error resolving conflict via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Simulating conflict resolution', resolutionData);
      return Promise.resolve({ success: true, message: 'Conflict resolved (mock).' });
    }
  }

  async overrideConflict(overrideData) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to override conflict.');
        const idToken = await user.getIdToken();
        // Add userId from token if backend expects it, current overrideData has userId from input
        return await window.electronAPI.scheduler.overrideConflict({ idToken, overrideData });
      } catch (error) {
        console.error('Error overriding conflict via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Simulating conflict override', overrideData);
      return Promise.resolve({ success: true, message: 'Conflict overridden (mock).' });
    }
  }

  async getConflictResolutionHistory(limit = 50) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get conflict resolution history.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.scheduler.getConflictResolutionHistory({ idToken, limit });
      } catch (error) {
        console.error('Error getting conflict resolution history via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalScheduleService: Returning mock conflict resolution history');
      return Promise.resolve([
        { id: 'hist1', resolvedAt: new Date().toISOString(), method: 'resolution', conflictType: 'Double Booking', resolvedBy: 'Admin', note: 'Rescheduled client A' }
      ]);
    }
  }
}

// Create and export singleton instance
const universalScheduleService = new UniversalScheduleService();
export default universalScheduleService;

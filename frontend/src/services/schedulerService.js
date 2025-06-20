/**
 * Scheduler Service
 * Provides interface to schedule management functionality
 */
import firebase from './firebase';
import { isElectronAvailable } from './firebaseService';

class SchedulerService {
  /**
   * Create a new schedule
   * @param {Object} scheduleData - The schedule data
   * @returns {Promise<Object>} - The created schedule
   */
  async createSchedule(scheduleData) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to create schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.createSchedule({ idToken, scheduleData });
      } catch (error) {
        console.error('Error creating schedule:', error);
        throw new Error(`Failed to create schedule: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: createSchedule called in non-Electron environment.');
      throw new Error('Electron API not available for schedule creation.');
    }
  }

  /**
   * Update an existing schedule
   * @param {string} scheduleId - The schedule ID
   * @param {Object} updatedData - The updated schedule data
   * @returns {Promise<Object>} - The updated schedule
   */
  async updateSchedule(scheduleId, updatedData) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to update schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.updateSchedule({ idToken, scheduleId, updatedData });
      } catch (error) {
        console.error('Error updating schedule:', error);
        throw new Error(`Failed to update schedule: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: updateSchedule called in non-Electron environment.');
      throw new Error('Electron API not available for schedule update.');
    }
  }

  /**
   * Delete a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSchedule(scheduleId) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to delete schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.deleteSchedule({ idToken, scheduleId });
      } catch (error) {
        console.error('Error deleting schedule:', error);
        throw new Error(`Failed to delete schedule: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: deleteSchedule called in non-Electron environment.');
      throw new Error('Electron API not available for schedule deletion.');
    }
  }

  /**
   * Find the best caregiver for a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Object>} - The best caregiver match
   */
  async findBestCaregiver(scheduleId) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to find best caregiver.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.findBestCaregiver({ idToken, scheduleId });
      } catch (error) {
        console.error('Error finding best caregiver:', error);
        throw new Error(`Failed to find best caregiver: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: findBestCaregiver called in non-Electron environment.');
      throw new Error('Electron API not available for finding best caregiver.');
    }
  }

  /**
   * Create a schedule for a client
   * @param {string} clientId - The client ID
   * @param {Object} scheduleData - The schedule data
   * @returns {Promise<Object>} - The created schedule
   */
  async createClientSchedule(clientId, scheduleData) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to create client schedule.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.createClientSchedule({ idToken, clientId, scheduleData });
      } catch (error) {
        console.error('Error creating client schedule:', error);
        throw new Error(`Failed to create client schedule: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: createClientSchedule called in non-Electron environment.');
      throw new Error('Electron API not available for creating client schedule.');
    }
  }

  /**
   * Assign a caregiver to a schedule
   * @param {string} scheduleId - The schedule ID
   * @param {string} caregiverId - The caregiver ID
   * @returns {Promise<Object>} - The updated schedule
   */
  async assignCaregiverToSchedule(scheduleId, caregiverId) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to assign caregiver.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.assignCaregiverToSchedule({ idToken, scheduleId, caregiverId });
      } catch (error) {
        console.error('Error assigning caregiver to schedule:', error);
        throw new Error(`Failed to assign caregiver to schedule: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: assignCaregiverToSchedule called in non-Electron environment.');
      throw new Error('Electron API not available for assigning caregiver.');
    }
  }

  /**
   * Find available caregivers for a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Array>} - List of available caregivers
   */
  async findAvailableCaregivers(scheduleId) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to find available caregivers.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.findAvailableCaregivers({ idToken, scheduleId });
      } catch (error) {
        console.error('Error finding available caregivers:', error);
        throw new Error(`Failed to find available caregivers: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: findAvailableCaregivers called in non-Electron environment.');
      throw new Error('Electron API not available for finding available caregivers.');
    }
  }

  /**
   * Check for schedule conflicts
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Array>} - List of conflicts
   */
  async checkConflicts(scheduleId) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to check conflicts.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.checkScheduleConflicts({ idToken, scheduleId });
      } catch (error) {
        console.error('Error checking schedule conflicts:', error);
        throw new Error(`Failed to check conflicts: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: checkConflicts called in non-Electron environment.');
      throw new Error('Electron API not available for checking conflicts.');
    }
  }

  /**
   * Resolve a schedule conflict
   * @param {string} conflictId - The conflict ID
   * @param {Object} resolution - The conflict resolution data
   * @returns {Promise<Object>} - Resolution result
   */
  async resolveConflict(conflictId, resolution) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to resolve conflict.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.resolveScheduleConflict({ idToken, conflictId, resolution });
      } catch (error) {
        console.error('Error resolving schedule conflict:', error);
        throw new Error(`Failed to resolve conflict: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: resolveConflict called in non-Electron environment.');
      throw new Error('Electron API not available for resolving conflict.');
    }
  }

  /**
   * Get a schedule with full details
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Object>} - Detailed schedule data
   */
  async getScheduleWithDetails(scheduleId) {
    if (isElectronAvailable()) {
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get schedule details.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getScheduleWithDetails({ idToken, scheduleId });
      } catch (error) {
        console.error('Error getting schedule details:', error);
        throw new Error(`Failed to get schedule with details: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: getScheduleWithDetails called in non-Electron environment.');
      throw new Error('Electron API not available for getting schedule details.');
    }
  }

  /**
   * Optimize schedules for a specific date
   * @param {string} date - The date to optimize (YYYY-MM-DD)
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
        console.error('Error optimizing schedules:', error);
        throw new Error(`Failed to optimize schedules: ${error.message}`);
      }
    } else {
      console.warn('SchedulerService: optimizeSchedules called in non-Electron environment.');
      throw new Error('Electron API not available for optimizing schedules.');
    }
  }
}

// Create and export singleton instance
const schedulerService = new SchedulerService();
export default schedulerService;

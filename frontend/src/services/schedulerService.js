/**
 * Scheduler Service
 * Provides interface to schedule management functionality
 */

class SchedulerService {
  /**
   * Create a new schedule
   * @param {Object} scheduleData - The schedule data
   * @returns {Promise<Object>} - The created schedule
   */
  async createSchedule(scheduleData) {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available - backend connection missing');
      }
      return await window.electronAPI.createSchedule(scheduleData);
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw new Error(`Failed to create schedule: ${error.message}`);
    }
  }

  /**
   * Update an existing schedule
   * @param {string} scheduleId - The schedule ID
   * @param {Object} updatedData - The updated schedule data
   * @returns {Promise<Object>} - The updated schedule
   */
  async updateSchedule(scheduleId, updatedData) {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available - backend connection missing');
      }
      return await window.electronAPI.updateSchedule(scheduleId, updatedData);
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw new Error(`Failed to update schedule: ${error.message}`);
    }
  }

  /**
   * Delete a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSchedule(scheduleId) {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available - backend connection missing');
      }
      return await window.electronAPI.deleteSchedule(scheduleId);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw new Error(`Failed to delete schedule: ${error.message}`);
    }
  }

  /**
   * Find the best caregiver for a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Object>} - The best caregiver match
   */
  async findBestCaregiver(scheduleId) {
    try {
      return await window.electronAPI.findBestCaregiver(scheduleId);
    } catch (error) {
      console.error('Error finding best caregiver:', error);
      throw error;
    }
  }

  /**
   * Create a schedule for a client
   * @param {string} clientId - The client ID
   * @param {Object} scheduleData - The schedule data
   * @returns {Promise<Object>} - The created schedule
   */
  async createClientSchedule(clientId, scheduleData) {
    try {
      return await window.electronAPI.createClientSchedule(clientId, scheduleData);
    } catch (error) {
      console.error('Error creating client schedule:', error);
      throw error;
    }
  }

  /**
   * Assign a caregiver to a schedule
   * @param {string} scheduleId - The schedule ID
   * @param {string} caregiverId - The caregiver ID
   * @returns {Promise<Object>} - The updated schedule
   */
  async assignCaregiverToSchedule(scheduleId, caregiverId) {
    try {
      return await window.electronAPI.assignCaregiverToSchedule(scheduleId, caregiverId);
    } catch (error) {
      console.error('Error assigning caregiver to schedule:', error);
      throw error;
    }
  }

  /**
   * Find available caregivers for a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Array>} - List of available caregivers
   */
  async findAvailableCaregivers(scheduleId) {
    try {
      return await window.electronAPI.findAvailableCaregivers(scheduleId);
    } catch (error) {
      console.error('Error finding available caregivers:', error);
      throw error;
    }
  }

  /**
   * Check for schedule conflicts
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Array>} - List of conflicts
   */
  async checkConflicts(scheduleId) {
    try {
      return await window.electronAPI.checkScheduleConflicts(scheduleId);
    } catch (error) {
      console.error('Error checking schedule conflicts:', error);
      throw error;
    }
  }

  /**
   * Resolve a schedule conflict
   * @param {string} conflictId - The conflict ID
   * @param {Object} resolution - The conflict resolution data
   * @returns {Promise<Object>} - Resolution result
   */
  async resolveConflict(conflictId, resolution) {
    try {
      return await window.electronAPI.resolveScheduleConflict(conflictId, resolution);
    } catch (error) {
      console.error('Error resolving schedule conflict:', error);
      throw error;
    }
  }

  /**
   * Get a schedule with full details
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Object>} - Detailed schedule data
   */
  async getScheduleWithDetails(scheduleId) {
    try {
      return await window.electronAPI.getScheduleWithDetails(scheduleId);
    } catch (error) {
      console.error('Error getting schedule details:', error);
      throw error;
    }
  }

  /**
   * Optimize schedules for a specific date
   * @param {string} date - The date to optimize (YYYY-MM-DD)
   * @returns {Promise<Object>} - Optimization results
   */
  async optimizeSchedules(date) {
    try {
      return await window.electronAPI.optimizeSchedules(date);
    } catch (error) {
      console.error('Error optimizing schedules:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const schedulerService = new SchedulerService();
export default schedulerService;

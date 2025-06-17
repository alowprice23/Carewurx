/**
 * Universal Schedule Service
 * Provides unified interface to schedule data from different sources
 * Implements the C=2πr circular integration model
 */

class UniversalScheduleService {
  /**
   * Get schedules with optional filtering
   * @param {Object} options - Filter options
   * @param {Date} options.startDate - Start date range
   * @param {Date} options.endDate - End date range
   * @param {Array} options.include - Related entities to include
   * @returns {Promise<Array>} - List of schedules
   */
  async getSchedules(options = {}) {
    try {
      return await window.electronAPI.getCircularEntities('schedules', options);
    } catch (error) {
      console.error('Error getting schedules:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific schedule by ID
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object>} - Schedule data
   */
  async getSchedule(scheduleId) {
    try {
      return await window.electronAPI.getSchedule(scheduleId);
    } catch (error) {
      console.error('Error getting schedule:', error);
      throw error;
    }
  }
  
  /**
   * Get schedules for a specific client
   * @param {string} clientId - Client ID
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @returns {Promise<Array>} - List of schedules
   */
  async getClientSchedules(clientId, startDate = null, endDate = null) {
    try {
      return await window.electronAPI.getSchedulesByClientId(clientId, startDate, endDate);
    } catch (error) {
      console.error('Error getting client schedules:', error);
      throw error;
    }
  }
  
  /**
   * Get schedules for a specific caregiver
   * @param {string} caregiverId - Caregiver ID
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @returns {Promise<Array>} - List of schedules
   */
  async getCaregiverSchedules(caregiverId, startDate = null, endDate = null) {
    try {
      return await window.electronAPI.getSchedulesByCaregiverId(caregiverId, startDate, endDate);
    } catch (error) {
      console.error('Error getting caregiver schedules:', error);
      throw error;
    }
  }
  
  /**
   * Update a schedule
   * @param {string} scheduleId - Schedule ID
   * @param {Object} changes - Schedule changes
   * @returns {Promise<Object>} - Updated schedule
   */
  async updateSchedule(scheduleId, changes) {
    try {
      return await window.electronAPI.updateSchedule(scheduleId, changes);
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  }
  
  /**
   * Find conflicts for a schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Array>} - List of conflicts
   */
  async findConflicts(scheduleId) {
    try {
      return await window.electronAPI.checkScheduleConflicts(scheduleId);
    } catch (error) {
      console.error('Error finding conflicts:', error);
      throw error;
    }
  }
  
  /**
   * Get caregiver availability
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} - Availability data
   */
  async getCaregiverAvailability(caregiverId) {
    try {
      return await window.electronAPI.getCaregiverAvailability(caregiverId);
    } catch (error) {
      console.error('Error getting caregiver availability:', error);
      throw error;
    }
  }
  
  /**
   * Update caregiver availability
   * @param {string} caregiverId - Caregiver ID
   * @param {Object} availabilityData - Availability data
   * @returns {Promise<Object>} - Updated availability
   */
  async updateCaregiverAvailability(caregiverId, availabilityData) {
    try {
      return await window.electronAPI.updateCaregiverAvailability(caregiverId, availabilityData);
    } catch (error) {
      console.error('Error updating caregiver availability:', error);
      throw error;
    }
  }
  
  /**
   * Create a universal schedule
   * @param {Object} scheduleData - Schedule data
   * @returns {Promise<Object>} - Created schedule
   */
  async createSchedule(scheduleData) {
    try {
      return await window.electronAPI.createSchedule(scheduleData);
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  }
  
  /**
   * Delete a schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSchedule(scheduleId) {
    try {
      return await window.electronAPI.deleteSchedule(scheduleId);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  }
  
  /**
   * Get schedule with detailed information
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object>} - Detailed schedule
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
   * Find best caregiver for a schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object>} - Best caregiver match
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
   * Optimize schedules for a given date
   * @param {string} date - Date string (YYYY-MM-DD)
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
const universalScheduleService = new UniversalScheduleService();
export default universalScheduleService;

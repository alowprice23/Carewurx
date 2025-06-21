/**
 * Scheduler Service
 * Provides interface to schedule management functionality
 */

class SchedulerService {
  constructor() {
    console.log('Scheduler Service initializing for web API communication.');
  }

  async _fetchAPI(endpoint, options = {}) {
    const { body, method = 'GET', params } = options;
    let url = `/api${endpoint}`;

    if (params) {
      url += `?${new URLSearchParams(params)}`;
    }

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`API Error (${response.status}) in ${method} ${url}: ${errorData.message || 'Unknown error'}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      // Re-throw the error to be handled by the caller, as this service currently has no mock fallbacks
      throw error;
    }
  }

  /**
   * Create a new schedule
   * @param {Object} scheduleData - The schedule data
   * @returns {Promise<Object>} - The created schedule
   */
  async createSchedule(scheduleData) {
    try {
      return await this._fetchAPI('/scheduler/createSchedule', {
        method: 'POST',
        body: { scheduleData }, // server.js expects { scheduleData: ... }
      });
    } catch (error) {
      console.error('Error creating schedule via API:', error);
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
      return await this._fetchAPI(`/scheduler/updateSchedule/${scheduleId}`, {
        method: 'PUT',
        body: { updatedData }, // server.js expects { updatedData: ... }
      });
    } catch (error) {
      console.error('Error updating schedule via API:', error);
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
      return await this._fetchAPI(`/scheduler/deleteSchedule/${scheduleId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting schedule via API:', error);
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
      return await this._fetchAPI(`/scheduler/findBestCaregiver/${scheduleId}`);
    } catch (error) {
      console.error('Error finding best caregiver via API:', error);
      throw error; // Re-throw as per original behavior
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
      return await this._fetchAPI(`/scheduler/createClientSchedule/${clientId}`, {
        method: 'POST',
        body: { scheduleData },
      });
    } catch (error) { // Added opening brace
      console.error('Error creating client schedule via API:', error);
      throw error; // Re-throw
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
      // The API endpoint expects both IDs in the URL.
      return await this._fetchAPI(`/scheduler/assignCaregiverToSchedule/${scheduleId}/${caregiverId}`, {
        method: 'POST', // Or PUT, depending on idempotency expectation
      });
    } catch (error) {
      console.error('Error assigning caregiver to schedule via API:', error);
      throw error; // Re-throw
    }
  }

  /**
   * Find available caregivers for a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Array>} - List of available caregivers
   */
  async findAvailableCaregivers(scheduleId) {
    try {
      return await this._fetchAPI(`/scheduler/findAvailableCaregivers/${scheduleId}`);
    } catch (error) {
      console.error('Error finding available caregivers via API:', error);
      throw error; // Re-throw
    }
  }

  /**
   * Check for schedule conflicts
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Array>} - List of conflicts
   */
  async checkConflicts(scheduleId) {
    try {
      return await this._fetchAPI(`/scheduler/checkConflicts/${scheduleId}`);
    } catch (error) {
      console.error('Error checking schedule conflicts via API:', error);
      throw error; // Re-throw
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
      return await this._fetchAPI(`/scheduler/resolveConflict/${conflictId}`, {
        method: 'POST',
        body: { resolution },
      });
    } catch (error) {
      console.error('Error resolving schedule conflict via API:', error);
      throw error; // Re-throw
    }
  }

  /**
   * Get a schedule with full details
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Object>} - Detailed schedule data
   */
  async getScheduleWithDetails(scheduleId) {
    try {
      return await this._fetchAPI(`/scheduler/scheduleWithDetails/${scheduleId}`);
    } catch (error) {
      console.error('Error getting schedule details via API:', error);
      throw error; // Re-throw
    }
  }

  /**
   * Optimize schedules for a specific date
   * @param {string} date - The date to optimize (YYYY-MM-DD)
   * @returns {Promise<Object>} - Optimization results
   */
  async optimizeSchedules(date) {
    try {
      return await this._fetchAPI('/scheduler/optimizeSchedules', {
        method: 'POST',
        body: { date },
      });
    } catch (error) {
      console.error('Error optimizing schedules via API:', error);
      throw error; // Re-throw
    }
  }
}

// Create and export singleton instance
const schedulerService = new SchedulerService();
export default schedulerService;

/**
 * Universal Schedule Service
 * Provides unified interface to schedule data from different sources
 * Implements the C=2πr circular integration model
 */

class UniversalScheduleService {
  constructor() {
    console.log('UniversalScheduleService initializing for web API communication.');
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
      throw error;
    }
  }

  /**
   * Get schedules with optional filtering
   * @param {Object} options - Filter options (e.g., startDate, endDate, include)
   * @returns {Promise<Array>} - List of schedules
   */
  async getSchedules(options = {}) {
    try {
      // Maps to GET /api/firebase/circularEntities/schedules
      return await this._fetchAPI('/firebase/circularEntities/schedules', { params: options });
    } catch (error) {
      console.error('Error getting schedules via API:', error);
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
      // Maps to GET /api/firebase/schedule/:scheduleId
      return await this._fetchAPI(`/firebase/schedule/${scheduleId}`);
    } catch (error) {
      console.error('Error getting schedule via API:', error);
      throw error;
    }
  }
  
  /**
   * Get schedules for a specific client
   * @param {string} clientId - Client ID
   * @param {Date | string} startDate - Start date (optional)
   * @param {Date | string} endDate - End date (optional)
   * @returns {Promise<Array>} - List of schedules
   */
  async getClientSchedules(clientId, startDate = null, endDate = null) {
    try {
      const params = {};
      if (startDate) params.startDate = typeof startDate === 'string' ? startDate : startDate.toISOString();
      if (endDate) params.endDate = typeof endDate === 'string' ? endDate : endDate.toISOString();
      // Maps to GET /api/firebase/schedulesByClientId/:clientId
      return await this._fetchAPI(`/firebase/schedulesByClientId/${clientId}`, { params });
    } catch (error) {
      console.error('Error getting client schedules via API:', error);
      throw error;
    }
  }
  
  /**
   * Get schedules for a specific caregiver
   * @param {string} caregiverId - Caregiver ID
   * @param {Date | string} startDate - Start date (optional)
   * @param {Date | string} endDate - End date (optional)
   * @returns {Promise<Array>} - List of schedules
   */
  async getCaregiverSchedules(caregiverId, startDate = null, endDate = null) {
    try {
      const params = {};
      if (startDate) params.startDate = typeof startDate === 'string' ? startDate : startDate.toISOString();
      if (endDate) params.endDate = typeof endDate === 'string' ? endDate : endDate.toISOString();
      // Maps to GET /api/firebase/schedulesByCaregiverId/:caregiverId
      return await this._fetchAPI(`/firebase/schedulesByCaregiverId/${caregiverId}`, { params });
    } catch (error) {
      console.error('Error getting caregiver schedules via API:', error);
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
      // Maps to PUT /api/scheduler/updateSchedule/:scheduleId
      return await this._fetchAPI(`/scheduler/updateSchedule/${scheduleId}`, {
        method: 'PUT',
        body: { updatedData: changes }, // server.js scheduler endpoint expects { updatedData: ... }
      });
    } catch (error) {
      console.error('Error updating schedule via API:', error);
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
      // Maps to GET /api/scheduler/checkConflicts/:scheduleId
      return await this._fetchAPI(`/scheduler/checkConflicts/${scheduleId}`);
    } catch (error) {
      console.error('Error finding conflicts via API:', error);
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
      // Maps to GET /api/firebase/caregiverAvailability/:caregiverId
      return await this._fetchAPI(`/firebase/caregiverAvailability/${caregiverId}`);
    } catch (error) {
      console.error('Error getting caregiver availability via API:', error);
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
      // Maps to PUT /api/firebase/caregiverAvailability/:caregiverId
      return await this._fetchAPI(`/firebase/caregiverAvailability/${caregiverId}`, {
        method: 'PUT',
        body: availabilityData, // server.js firebase endpoint expects the data directly
      });
    } catch (error) {
      console.error('Error updating caregiver availability via API:', error);
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
      // Maps to POST /api/scheduler/createSchedule
      return await this._fetchAPI('/scheduler/createSchedule', {
        method: 'POST',
        body: { scheduleData }, // server.js scheduler endpoint expects { scheduleData: ... }
      });
    } catch (error) {
      console.error('Error creating schedule via API:', error);
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
      // Maps to DELETE /api/scheduler/deleteSchedule/:scheduleId
      return await this._fetchAPI(`/scheduler/deleteSchedule/${scheduleId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error deleting schedule via API:', error);
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
      // Maps to GET /api/scheduler/scheduleWithDetails/:scheduleId
      return await this._fetchAPI(`/scheduler/scheduleWithDetails/${scheduleId}`);
    } catch (error) {
      console.error('Error getting schedule details via API:', error);
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
      // Maps to GET /api/scheduler/findBestCaregiver/:scheduleId
      return await this._fetchAPI(`/scheduler/findBestCaregiver/${scheduleId}`);
    } catch (error) {
      console.error('Error finding best caregiver via API:', error);
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
      // Maps to POST /api/scheduler/optimizeSchedules
      return await this._fetchAPI('/scheduler/optimizeSchedules', {
        method: 'POST',
        body: { date }, // server.js expects { date: ... }
      });
    } catch (error) {
      console.error('Error optimizing schedules via API:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const universalScheduleService = new UniversalScheduleService();
export default universalScheduleService;

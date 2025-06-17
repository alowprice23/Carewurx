/**
 * Schedule Model
 * Provides a domain model for working with schedules
 */

const { firebaseService } = require('../../services/firebase');

class Schedule {
  constructor(data = {}) {
    this.id = data.id || null;
    this.client_id = data.client_id || null;
    this.client_name = data.client_name || '';
    this.caregiver_id = data.caregiver_id || null;
    this.caregiver_name = data.caregiver_name || '';
    this.date = data.date || new Date().toISOString().split('T')[0];
    this.start_time = data.start_time || '09:00';
    this.end_time = data.end_time || '17:00';
    this.status = data.status || 'pending';
    this.notes = data.notes || '';
    this.recurring = data.recurring || false;
    this.recurrence_pattern = data.recurrence_pattern || null;
    this.recurrence_end_date = data.recurrence_end_date || null;
    this.created = data.created || new Date().toISOString();
    this.updated = data.updated || new Date().toISOString();
  }

  /**
   * Save the schedule to the database
   * @returns {Promise<Object>} The saved schedule
   */
  async save() {
    try {
      if (this.id) {
        // Update existing schedule
        await firebaseService.updateSchedule(this.id, this.toData());
        return { success: true, schedule: this.toData() };
      } else {
        // Create new schedule
        const result = await firebaseService.createScheduleEntry(this.toData());
        this.id = result.id;
        return { success: true, schedule: this.toData() };
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a schedule by ID
   * @param {string} id - The schedule ID
   * @returns {Promise<Schedule>} The schedule
   */
  static async getById(id) {
    try {
      // This assumes a getSchedule method exists in firebaseService
      // If not, you would need to implement it
      const scheduleData = await firebaseService.getScheduleById(id);
      
      if (!scheduleData) {
        throw new Error(`Schedule with ID ${id} not found`);
      }
      
      return new Schedule(scheduleData);
    } catch (error) {
      console.error('Error getting schedule by ID:', error);
      throw error;
    }
  }

  /**
   * Get schedules for a client
   * @param {string} clientId - The client ID
   * @returns {Promise<Array<Schedule>>} The schedules
   */
  static async getByClientId(clientId) {
    try {
      const schedulesData = await firebaseService.getSchedulesByClientId(clientId);
      return schedulesData.map(data => new Schedule(data));
    } catch (error) {
      console.error('Error getting schedules for client:', error);
      throw error;
    }
  }

  /**
   * Get schedules for a caregiver
   * @param {string} caregiverId - The caregiver ID
   * @returns {Promise<Array<Schedule>>} The schedules
   */
  static async getByCaregiverId(caregiverId) {
    try {
      const schedulesData = await firebaseService.getSchedulesByCaregiverId(caregiverId);
      return schedulesData.map(data => new Schedule(data));
    } catch (error) {
      console.error('Error getting schedules for caregiver:', error);
      throw error;
    }
  }

  /**
   * Get schedules for a date range
   * @param {string} startDate - The start date (YYYY-MM-DD)
   * @param {string} endDate - The end date (YYYY-MM-DD)
   * @returns {Promise<Array<Schedule>>} The schedules
   */
  static async getByDateRange(startDate, endDate) {
    try {
      const schedulesData = await firebaseService.getSchedulesInDateRange(startDate, endDate);
      return schedulesData.map(data => new Schedule(data));
    } catch (error) {
      console.error('Error getting schedules for date range:', error);
      throw error;
    }
  }

  /**
   * Create recurring schedules based on this schedule
   * @returns {Promise<Array<Object>>} The created schedules
   */
  async createRecurringSchedules() {
    if (!this.recurring || !this.recurrence_pattern || !this.recurrence_end_date) {
      return { success: false, error: 'Schedule is not recurring or missing recurrence data' };
    }
    
    try {
      const schedules = [];
      const startDate = new Date(this.date);
      const endDate = new Date(this.recurrence_end_date);
      
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        // Skip the original date, as we already have a schedule for it
        if (currentDate.toISOString().split('T')[0] !== this.date) {
          const scheduleData = {
            ...this.toData(),
            id: null, // New schedule will get a new ID
            date: currentDate.toISOString().split('T')[0],
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          };
          
          // Create the new schedule
          const newSchedule = new Schedule(scheduleData);
          const result = await newSchedule.save();
          
          if (result.success) {
            schedules.push(result.schedule);
          }
        }
        
        // Move to the next date based on recurrence pattern
        currentDate = this.getNextRecurrenceDate(currentDate);
      }
      
      return { success: true, schedules };
    } catch (error) {
      console.error('Error creating recurring schedules:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the next recurrence date
   * @param {Date} currentDate - The current date
   * @returns {Date} The next recurrence date
   */
  getNextRecurrenceDate(currentDate) {
    const nextDate = new Date(currentDate);
    
    switch (this.recurrence_pattern) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        // Default to weekly if pattern is unknown
        nextDate.setDate(nextDate.getDate() + 7);
    }
    
    return nextDate;
  }

  /**
   * Calculate the duration of this schedule in hours
   * @returns {number} The duration in hours
   */
  getDurationHours() {
    if (!this.start_time || !this.end_time) {
      return 0;
    }
    
    const [startHour, startMinute] = this.start_time.split(':').map(Number);
    const [endHour, endMinute] = this.end_time.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    return (endMinutes - startMinutes) / 60;
  }

  /**
   * Check if this schedule conflicts with another schedule
   * @param {Schedule} otherSchedule - The other schedule to check against
   * @returns {boolean} True if there is a conflict
   */
  conflictsWith(otherSchedule) {
    // If not on the same date, no conflict
    if (this.date !== otherSchedule.date) {
      return false;
    }
    
    // If same caregiver, check for time conflict
    if (this.caregiver_id && this.caregiver_id === otherSchedule.caregiver_id) {
      const [thisStartHour, thisStartMinute] = this.start_time.split(':').map(Number);
      const [thisEndHour, thisEndMinute] = this.end_time.split(':').map(Number);
      const [otherStartHour, otherStartMinute] = otherSchedule.start_time.split(':').map(Number);
      const [otherEndHour, otherEndMinute] = otherSchedule.end_time.split(':').map(Number);
      
      const thisStartMinutes = thisStartHour * 60 + thisStartMinute;
      const thisEndMinutes = thisEndHour * 60 + thisEndMinute;
      const otherStartMinutes = otherStartHour * 60 + otherStartMinute;
      const otherEndMinutes = otherEndHour * 60 + otherEndMinute;
      
      // Check if time ranges overlap
      return (thisStartMinutes < otherEndMinutes && thisEndMinutes > otherStartMinutes);
    }
    
    return false;
  }

  /**
   * Convert this schedule to a plain data object
   * @returns {Object} The schedule data
   */
  toData() {
    return {
      id: this.id,
      client_id: this.client_id,
      client_name: this.client_name,
      caregiver_id: this.caregiver_id,
      caregiver_name: this.caregiver_name,
      date: this.date,
      start_time: this.start_time,
      end_time: this.end_time,
      status: this.status,
      notes: this.notes,
      recurring: this.recurring,
      recurrence_pattern: this.recurrence_pattern,
      recurrence_end_date: this.recurrence_end_date,
      created: this.created,
      updated: this.updated
    };
  }
}

module.exports = Schedule;

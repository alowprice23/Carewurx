/**
 * Availability Service
 * 
 * This service handles interactions with caregiver availability data, 
 * connecting the frontend availability management interface with
 * the backend Firebase service.
 */

import firebaseService from './firebaseService';

class AvailabilityService {
  /**
   * Get a caregiver's availability settings
   * @param {string} caregiverId - The ID of the caregiver
   * @returns {Promise<Object>} Availability data including regularSchedule and timeOff
   */
  async getCaregiverAvailability(caregiverId) {
    try {
      // Call the backend service
      const response = await firebaseService.getCaregiverAvailability(caregiverId);
      
      // If no availability data exists yet, return empty defaults
      if (!response) {
        return {
          regularSchedule: [],
          timeOff: []
        };
      }
      
      // Process regular schedule to ensure dayOfWeek is a number
      const regularSchedule = (response.regularSchedule || []).map(entry => ({
        ...entry,
        dayOfWeek: typeof entry.dayOfWeek === 'number' ? entry.dayOfWeek : parseInt(entry.dayOfWeek, 10)
      }));
      
      // Process time off to convert timestamp objects to ISO strings for the UI
      const timeOff = (response.timeOff || []).map(entry => ({
        ...entry,
        startDate: this._formatFirebaseDate(entry.startDate),
        endDate: this._formatFirebaseDate(entry.endDate)
      }));
      
      return {
        regularSchedule,
        timeOff
      };
    } catch (error) {
      console.error('Error getting caregiver availability:', error);
      throw new Error(`Failed to get availability: ${error.message}`);
    }
  }
  
  /**
   * Update a caregiver's availability settings
   * @param {string} caregiverId - The ID of the caregiver
   * @param {Object} availabilityData - The availability data to save
   * @returns {Promise<Object>} Success response
   */
  async updateCaregiverAvailability(caregiverId, availabilityData) {
    try {
      // Format the data for Firebase
      const formattedData = {
        regularSchedule: availabilityData.regularSchedule,
        timeOff: availabilityData.timeOff
      };
      
      // Call the backend service
      return await firebaseService.updateCaregiverAvailability(caregiverId, formattedData);
    } catch (error) {
      console.error('Error updating caregiver availability:', error);
      throw new Error(`Failed to update availability: ${error.message}`);
    }
  }
  
  /**
   * Get caregivers available for a specific time slot
   * @param {string} date - The date in YYYY-MM-DD format
   * @param {string} startTime - The start time in HH:MM format
   * @param {string} endTime - The end time in HH:MM format
   * @param {Object} options - Additional options for filtering
   * @returns {Promise<Array<Object>>} Array of available caregivers
   */
  async getAvailableCaregivers(date, startTime, endTime, options = {}) {
    try {
      // Call the backend service
      const caregivers = await firebaseService.getAvailableCaregivers(date, startTime, endTime);
      
      // Apply additional filtering if needed
      let filteredCaregivers = caregivers;
      
      if (options.skills && options.skills.length > 0) {
        filteredCaregivers = filteredCaregivers.filter(caregiver => 
          this._hasMatchingSkills(caregiver, options.skills)
        );
      }
      
      if (options.requiresCar) {
        filteredCaregivers = filteredCaregivers.filter(caregiver => 
          caregiver.transportation && caregiver.transportation.hasCar
        );
      }
      
      if (options.nearbyOnly && options.clientLocation) {
        // This would involve more complex filtering based on location
        // For now, we'll just return all available caregivers
      }
      
      return filteredCaregivers;
    } catch (error) {
      console.error('Error getting available caregivers:', error);
      throw new Error(`Failed to get available caregivers: ${error.message}`);
    }
  }
  
  /**
   * Check if a specific time slot conflicts with a caregiver's existing schedule
   * @param {string} caregiverId - The ID of the caregiver
   * @param {string} date - The date in YYYY-MM-DD format
   * @param {string} startTime - The start time in HH:MM format
   * @param {string} endTime - The end time in HH:MM format
   * @returns {Promise<boolean>} True if there's a conflict, false otherwise
   */
  async checkScheduleConflict(caregiverId, date, startTime, endTime) {
    try {
      // Get the caregiver's availability
      const availability = await this.getCaregiverAvailability(caregiverId);
      
      // Check if the caregiver is available on this day
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay(); // 0-6, where 0 is Sunday
      
      // Check if caregiver is on time off
      const isOnTimeOff = (availability.timeOff || []).some(timeOff => {
        const startDate = new Date(timeOff.startDate);
        const endDate = new Date(timeOff.endDate);
        return dateObj >= startDate && dateObj <= endDate;
      });
      
      if (isOnTimeOff) {
        return true; // Conflict: caregiver is on time off
      }
      
      // Check if the time slot fits within the caregiver's regular schedule
      const hasAvailableSlot = (availability.regularSchedule || []).some(schedule => {
        // Check if this schedule applies to the requested day of week
        if (schedule.dayOfWeek !== dayOfWeek) {
          return false;
        }
        
        // Check if the time slot fits within this schedule
        return startTime >= schedule.startTime && endTime <= schedule.endTime;
      });
      
      if (!hasAvailableSlot) {
        return true; // Conflict: no available slot in regular schedule
      }
      
      // Check for existing appointments
      const existingSchedules = await firebaseService.getSchedulesByCaregiverAndDate(caregiverId, date);
      
      const hasScheduleConflict = existingSchedules.some(schedule => {
        // Check for overlap
        return (startTime < schedule.endTime && endTime > schedule.startTime);
      });
      
      return hasScheduleConflict; // True if there's a conflict with existing schedules
    } catch (error) {
      console.error('Error checking schedule conflict:', error);
      throw new Error(`Failed to check schedule conflict: ${error.message}`);
    }
  }
  
  /**
   * Get the next available time slots for a caregiver
   * @param {string} caregiverId - The ID of the caregiver
   * @param {number} daysToCheck - Number of days to check ahead
   * @param {number} minDurationHours - Minimum duration in hours
   * @returns {Promise<Array<Object>>} Array of available time slots
   */
  async getNextAvailableSlots(caregiverId, daysToCheck = 7, minDurationHours = 2) {
    try {
      // Get the caregiver's availability
      const availability = await this.getCaregiverAvailability(caregiverId);
      
      if (!availability.regularSchedule || availability.regularSchedule.length === 0) {
        return []; // No regular schedule, so no available slots
      }
      
      const availableSlots = [];
      const today = new Date();
      
      // Look ahead for the specified number of days
      for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() + dayOffset);
        
        const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const dayOfWeek = date.getDay(); // 0-6, where 0 is Sunday
        
        // Check if caregiver is on time off for this date
        const isOnTimeOff = (availability.timeOff || []).some(timeOff => {
          const startDate = new Date(timeOff.startDate);
          const endDate = new Date(timeOff.endDate);
          return date >= startDate && date <= endDate;
        });
        
        if (isOnTimeOff) {
          continue; // Skip this day if caregiver is on time off
        }
        
        // Get the regular schedule entries for this day of week
        const scheduleForDay = availability.regularSchedule.filter(
          schedule => schedule.dayOfWeek === dayOfWeek
        );
        
        // Get existing appointments for this day
        const existingSchedules = await firebaseService.getSchedulesByCaregiverAndDate(
          caregiverId, 
          formattedDate
        );
        
        // For each schedule entry on this day, find available slots
        for (const schedule of scheduleForDay) {
          // Convert times to minutes for easier comparison
          const startMinutes = this._timeToMinutes(schedule.startTime);
          const endMinutes = this._timeToMinutes(schedule.endTime);
          
          // Create a sorted list of busy periods
          const busyPeriods = existingSchedules.map(appt => ({
            start: this._timeToMinutes(appt.startTime),
            end: this._timeToMinutes(appt.endTime)
          })).sort((a, b) => a.start - b.start);
          
          // Find available gaps
          let currentStart = startMinutes;
          
          for (const period of busyPeriods) {
            // If there's a gap before this busy period
            if (period.start > currentStart) {
              const gapDuration = period.start - currentStart;
              
              // If the gap is long enough
              if (gapDuration >= minDurationHours * 60) {
                availableSlots.push({
                  date: formattedDate,
                  startTime: this._minutesToTime(currentStart),
                  endTime: this._minutesToTime(period.start),
                  duration: gapDuration / 60 // hours
                });
              }
            }
            
            // Move current start to the end of this busy period
            currentStart = Math.max(currentStart, period.end);
          }
          
          // Check for a gap after the last busy period
          if (currentStart < endMinutes) {
            const gapDuration = endMinutes - currentStart;
            
            // If the gap is long enough
            if (gapDuration >= minDurationHours * 60) {
              availableSlots.push({
                date: formattedDate,
                startTime: this._minutesToTime(currentStart),
                endTime: this._minutesToTime(endMinutes),
                duration: gapDuration / 60 // hours
              });
            }
          }
        }
      }
      
      // Sort by date and time
      return availableSlots.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return this._timeToMinutes(a.startTime) - this._timeToMinutes(b.startTime);
      });
    } catch (error) {
      console.error('Error getting next available slots:', error);
      throw new Error(`Failed to get next available slots: ${error.message}`);
    }
  }
  
  // Utility functions
  
  /**
   * Check if a caregiver has matching skills
   * @param {Object} caregiver - Caregiver object
   * @param {Array<string>} requiredSkills - Array of required skill codes
   * @returns {boolean} True if caregiver has all required skills
   * @private
   */
  _hasMatchingSkills(caregiver, requiredSkills) {
    if (!caregiver.skills || !caregiver.skills.length) {
      return false;
    }
    
    return requiredSkills.every(skill => caregiver.skills.includes(skill));
  }
  
  /**
   * Format a Firebase timestamp or date object to YYYY-MM-DD
   * @param {Object|string} date - Firebase timestamp, Date object, or date string
   * @returns {string} Formatted date string
   * @private
   */
  _formatFirebaseDate(date) {
    if (!date) return null;
    
    // Handle Firebase Timestamp objects
    if (date && typeof date.toDate === 'function') {
      date = date.toDate();
    }
    
    // Handle Date objects
    if (date instanceof Date) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    
    // Handle strings
    return date;
  }
  
  /**
   * Convert time string (HH:MM) to minutes since midnight
   * @param {string} time - Time in HH:MM format
   * @returns {number} Minutes since midnight
   * @private
   */
  _timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  /**
   * Convert minutes since midnight to time string (HH:MM)
   * @param {number} minutes - Minutes since midnight
   * @returns {string} Time in HH:MM format
   * @private
   */
  _minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

// Create and export singleton instance
const availabilityService = new AvailabilityService();
export default availabilityService;

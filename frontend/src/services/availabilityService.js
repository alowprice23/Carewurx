/**
 * Availability Service
 *
 * This service handles interactions with caregiver availability data,
 * connecting the frontend availability management interface with
 * the backend (via Electron IPC) or using mock data in browser-only mode.
 */

import { isElectronAvailable } from './firebaseService'; // For checking Electron environment
// We will need to mock getAllCaregivers and getSchedulesByCaregiverId for the browser mode.
// For simplicity, mock data will be handled directly within the methods.

const MOCK_AVAILABILITY = {
  'cg1': {
    regularSchedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }], // Monday 9-5
    timeOff: [{ startDate: '2024-12-25', endDate: '2024-12-25' }],
  },
};

const MOCK_SCHEDULES = {
  'cg1': [
    { id: 'sch1', caregiverId: 'cg1', date: '2024-07-15', startTime: '10:00', endTime: '12:00', clientId: 'client1' },
  ],
};

const MOCK_CAREGIVERS = [
    { id: 'cg1', name: 'Mock Caregiver 1', skills: ['first-aid'], transportation: { hasCar: true } },
    { id: 'cg2', name: 'Mock Caregiver 2', skills: ['cpr'], transportation: { hasCar: false } },
];


class AvailabilityService {
  /**
   * Get a caregiver's availability settings
   * @param {string} caregiverId - The ID of the caregiver
   * @returns {Promise<Object>} Availability data including regularSchedule and timeOff
   */
  async getCaregiverAvailability(caregiverId) {
    console.log(`AvailabilityService: getCaregiverAvailability for ${caregiverId}`);
    if (isElectronAvailable) {
      try {
        const response = await window.electronAPI.getCaregiverAvailability(caregiverId);
        // Assuming response is the raw availability data or null
        if (!response) {
          return { regularSchedule: [], timeOff: [] };
        }
        // Process dates/timestamps if necessary (match original logic)
        const regularSchedule = (response.regularSchedule || []).map(entry => ({
          ...entry,
          dayOfWeek: typeof entry.dayOfWeek === 'number' ? entry.dayOfWeek : parseInt(entry.dayOfWeek, 10)
        }));
        const timeOff = (response.timeOff || []).map(entry => ({
          ...entry,
          startDate: this._formatFirebaseDate(entry.startDate), // Ensure dates are strings
          endDate: this._formatFirebaseDate(entry.endDate)
        }));
        return { regularSchedule, timeOff };
      } catch (error) {
        console.error('Error getting caregiver availability via Electron API:', error);
        throw new Error(`Failed to get availability: ${error.message}`);
      }
    } else {
      console.log(`AvailabilityService: Returning mock availability for ${caregiverId}`);
      const availability = MOCK_AVAILABILITY[caregiverId] || { regularSchedule: [], timeOff: [] };
      // Ensure mock data structure matches expected (dates as strings)
      const timeOff = (availability.timeOff || []).map(entry => ({
        ...entry,
        startDate: this._formatFirebaseDate(entry.startDate),
        endDate: this._formatFirebaseDate(entry.endDate)
      }));
      return Promise.resolve({ ...availability, timeOff });
    }
  }

  /**
   * Update a caregiver's availability settings
   * @param {string} caregiverId - The ID of the caregiver
   * @param {Object} availabilityData - The availability data to save
   * @returns {Promise<Object>} Success response
   */
  async updateCaregiverAvailability(caregiverId, availabilityData) {
    console.log(`AvailabilityService: updateCaregiverAvailability for ${caregiverId}`);
    if (isElectronAvailable) {
      try {
        // Format data if needed (original service did this)
        const formattedData = {
          regularSchedule: availabilityData.regularSchedule,
          timeOff: availabilityData.timeOff // Dates should be in a format backend expects (e.g., ISO string)
        };
        const response = await window.electronAPI.updateCaregiverAvailability(caregiverId, formattedData);
        // The backend handler returns { success: true } or throws an error.
        // To maintain consistency or provide more info, one might adjust this.
        if (response && response.success) {
            return response;
        }
        throw new Error(response.error || 'Failed to update availability via Electron API');

      } catch (error) {
        console.error('Error updating caregiver availability via Electron API:', error);
        throw new Error(`Failed to update availability: ${error.message}`);
      }
    } else {
      console.log(`AvailabilityService: Simulating update for mock availability for ${caregiverId}`);
      MOCK_AVAILABILITY[caregiverId] = { ...availabilityData };
      return Promise.resolve({ success: true });
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
    console.log(`AvailabilityService: getAvailableCaregivers for ${date} ${startTime}-${endTime}`);
    let caregivers = [];
    if (isElectronAvailable) {
      try {
        // Per plan, using getAllCaregivers and then filtering.
        // This is suboptimal; a dedicated backend endpoint would be better.
        // The IPC 'scheduler:findAvailableCaregivers' takes scheduleId, not a time slot.
        caregivers = await window.electronAPI.getAllCaregivers() || [];
         console.log(`AvailabilityService: Electron - Received ${caregivers.length} total caregivers. Filtering locally.`);
      } catch (error) {
        console.error('Error getting all caregivers via Electron API for availability check:', error);
        throw new Error(`Failed to get caregivers for availability check: ${error.message}`);
      }
    } else {
      console.log('AvailabilityService: Using mock caregivers for availability check.');
      caregivers = [...MOCK_CAREGIVERS];
    }

    // Perform local filtering based on availability and schedules
    // This requires fetching availability and schedules for each caregiver.
    const availableCaregivers = [];
    for (const cg of caregivers) {
        try {
            const isConflict = await this.checkScheduleConflict(cg.id, date, startTime, endTime);
            if (!isConflict) {
                availableCaregivers.push(cg);
            }
        } catch(error) {
            console.warn(`Could not check availability for caregiver ${cg.id}: ${error.message}. Skipping.`);
        }
    }

    // Apply additional filtering (skills, car, etc.) from original method
    let filteredCaregivers = availableCaregivers;
    if (options.skills && options.skills.length > 0) {
      filteredCaregivers = filteredCaregivers.filter(cg => this._hasMatchingSkills(cg, options.skills));
    }
    if (options.requiresCar) {
      filteredCaregivers = filteredCaregivers.filter(cg => cg.transportation && cg.transportation.hasCar);
    }
    // NearbyOnly logic would require location data and is complex for this mock/refactor.

    return filteredCaregivers;
  }


  /**
   * Helper to get schedules for a caregiver on a specific date.
   * This abstracts the IPC call or mock data retrieval.
   */
  async _getSchedulesByCaregiverAndDate(caregiverId, date) {
    if (isElectronAvailable) {
        try {
            // Use existing IPC handler: getSchedulesByCaregiverId(caregiverId, startDate, endDate)
            // Pass the same date for startDate and endDate to simulate fetching for a single day.
            const isoDate = this._formatFirebaseDate(date); // Ensure date is YYYY-MM-DD string
            return await window.electronAPI.getSchedulesByCaregiverId(caregiverId, isoDate, isoDate) || [];
        } catch (error) {
            console.error(`Error getting schedules for ${caregiverId} on ${date} via Electron API:`, error);
            throw error;
        }
    } else {
        const schedulesForCaregiver = MOCK_SCHEDULES[caregiverId] || [];
        const isoDate = this._formatFirebaseDate(date);
        return Promise.resolve(schedulesForCaregiver.filter(s => s.date === isoDate));
    }
  }

  /**
   * Check if a specific time slot conflicts with a caregiver's existing schedule
   * @param {string} caregiverId - The ID of the caregiver
   * @param {string} date - The date in YYYY-MM-DD format or Date object
   * @param {string} startTime - The start time in HH:MM format
   * @param {string} endTime - The end time in HH:MM format
   * @returns {Promise<boolean>} True if there's a conflict, false otherwise
   */
  async checkScheduleConflict(caregiverId, date, startTime, endTime) {
    console.log(`AvailabilityService: checkScheduleConflict for ${caregiverId} on ${date} ${startTime}-${endTime}`);
    try {
      const availability = await this.getCaregiverAvailability(caregiverId);
      const dateObj = (date instanceof Date) ? date : new Date(date);
      const dayOfWeek = dateObj.getDay(); // 0 is Sunday

      const isOnTimeOff = (availability.timeOff || []).some(timeOff => {
        const offStartDate = new Date(timeOff.startDate);
        const offEndDate = new Date(timeOff.endDate);
        // Ensure dateObj is compared correctly (ignoring time part for date range)
        const dateObjDayOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        return dateObjDayOnly >= offStartDate && dateObjDayOnly <= offEndDate;
      });

      if (isOnTimeOff) return true;

      const hasRegularSlot = (availability.regularSchedule || []).some(schedule =>
        schedule.dayOfWeek === dayOfWeek && startTime >= schedule.startTime && endTime <= schedule.endTime
      );

      if (!hasRegularSlot) return true;

      const existingSchedules = await this._getSchedulesByCaregiverAndDate(caregiverId, dateObj);
      const hasScheduleConflict = existingSchedules.some(schedule =>
        startTime < schedule.endTime && endTime > schedule.startTime
      );

      return hasScheduleConflict;
    } catch (error) {
      console.error('Error checking schedule conflict:', error);
      // Default to conflict if there's an error to be safe
      return true; // Or rethrow: throw new Error(`Failed to check schedule conflict: ${error.message}`);
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
    console.log(`AvailabilityService: getNextAvailableSlots for ${caregiverId}`);
    try {
      const availability = await this.getCaregiverAvailability(caregiverId);
      if (!availability.regularSchedule || availability.regularSchedule.length === 0) {
        return [];
      }

      const availableSlots = [];
      const today = new Date();
      today.setHours(0,0,0,0); // Start from the beginning of today

      for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + dayOffset);

        const formattedDate = this._formatFirebaseDate(currentDate);
        const dayOfWeek = currentDate.getDay();

        const isOnTimeOff = (availability.timeOff || []).some(timeOff => {
          const offStartDate = new Date(timeOff.startDate);
          const offEndDate = new Date(timeOff.endDate);
          return currentDate >= offStartDate && currentDate <= offEndDate;
        });
        if (isOnTimeOff) continue;

        const scheduleForDay = availability.regularSchedule.filter(s => s.dayOfWeek === dayOfWeek);
        if (!scheduleForDay.length) continue;
        
        const existingSchedules = await this._getSchedulesByCaregiverAndDate(caregiverId, currentDate);

        for (const schedule of scheduleForDay) {
          const startMinutes = this._timeToMinutes(schedule.startTime);
          const endMinutes = this._timeToMinutes(schedule.endTime);
          const busyPeriods = existingSchedules
            .filter(appt => appt.date === formattedDate) // Ensure only for the current date string
            .map(appt => ({
              start: this._timeToMinutes(appt.startTime),
              end: this._timeToMinutes(appt.endTime),
            }))
            .sort((a, b) => a.start - b.start);

          let currentSlotStart = startMinutes;
          for (const period of busyPeriods) {
            if (period.start > currentSlotStart) {
              const duration = (period.start - currentSlotStart) / 60;
              if (duration >= minDurationHours) {
                availableSlots.push({
                  date: formattedDate,
                  startTime: this._minutesToTime(currentSlotStart),
                  endTime: this._minutesToTime(period.start),
                  duration,
                });
              }
            }
            currentSlotStart = Math.max(currentSlotStart, period.end);
          }

          if (currentSlotStart < endMinutes) {
            const duration = (endMinutes - currentSlotStart) / 60;
            if (duration >= minDurationHours) {
              availableSlots.push({
                date: formattedDate,
                startTime: this._minutesToTime(currentSlotStart),
                endTime: this._minutesToTime(endMinutes),
                duration,
              });
            }
          }
        }
      }
      return availableSlots.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return this._timeToMinutes(a.startTime) - this._timeToMinutes(b.startTime);
      });
    } catch (error) {
      console.error('Error getting next available slots:', error);
      throw new Error(`Failed to get next available slots: ${error.message}`);
    }
  }

  // Utility functions (kept from original)
  _hasMatchingSkills(caregiver, requiredSkills) {
    if (!caregiver.skills || !caregiver.skills.length) return false;
    return requiredSkills.every(skill => caregiver.skills.includes(skill));
  }

  _formatFirebaseDate(dateInput) {
    if (!dateInput) return null;
    let date = dateInput;
    if (date && typeof date.toDate === 'function') { // Firebase Timestamp
      date = date.toDate();
    } else if (typeof date === 'string' && !isNaN(new Date(date).getTime())) { // Date string
        date = new Date(date);
    }


    if (date instanceof Date && !isNaN(date.valueOf())) {
      // Pad month and day with leading zeros if necessary
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // if it's already a YYYY-MM-DD string
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
    }
    console.warn("Could not format date:", dateInput);
    return String(dateInput); // Fallback or handle error appropriately
  }

  _timeToMinutes(time) {
    if (typeof time !== 'string' || !time.includes(':')) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  _minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
}

const availabilityService = new AvailabilityService();
export default availabilityService;

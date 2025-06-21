/**
 * Enhanced Scheduler Service
 * Provides advanced scheduling functionalities, including conflict checking and optimization
 * Integrates with the circular integration model (C=2πr) to provide intelligent scheduling
 */

const { firebaseService } = require('./firebase');
const realTimeUpdatesService = require('../app/services/real-time-updates');
const distanceCalculator = require('../utils/distance-calculator');

class EnhancedScheduler {
  constructor() {
    this.init();
  }

  /**
   * Initialize the service
   */
  init() {
    console.log('Initializing Enhanced Scheduler');
  }

  /**
   * Create a new schedule
   * @param {Object} scheduleData - The data for the new schedule
   * @returns {Promise<Object>} The created schedule
   */
  async createSchedule(scheduleData) {
    console.log('Creating schedule:', scheduleData);
    
    try {
      // Add a unique ID and timestamps
      const schedule = {
        id: `sched-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...scheduleData
      };
      
      // Save to Firebase
      const savedSchedule = await firebaseService.addSchedule(schedule);
      
      // Publish the new schedule through the circular integration system
      await realTimeUpdatesService.publish('schedule', { ...savedSchedule, isNew: true }, 'enhanced-scheduler');
      
      return savedSchedule;
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  }

  /**
   * Update an existing schedule
   * @param {string} scheduleId - The ID of the schedule to update
   * @param {Object} updatedData - The data to update
   * @returns {Promise<Object>} The updated schedule
   */
  async updateSchedule(scheduleId, updatedData) {
    console.log(`Updating schedule ${scheduleId}:`, updatedData);
    
    try {
      // Update the timestamp
      const scheduleUpdate = {
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      
      // Update in Firebase
      await firebaseService.updateSchedule(scheduleId, scheduleUpdate);
      
      // Get the full updated schedule
      const updatedSchedule = await firebaseService.getSchedule(scheduleId);
      
      // Publish the updated schedule through the circular integration system
      await realTimeUpdatesService.publish('schedule', updatedSchedule, 'enhanced-scheduler');
      
      return updatedSchedule;
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  }

  /**
   * Delete a schedule
   * @param {string} scheduleId - The ID of the schedule to delete
   * @returns {Promise<void>}
   */
  async deleteSchedule(scheduleId) {
    console.log(`Deleting schedule ${scheduleId}`);
    
    try {
      // Delete from Firebase
      await firebaseService.deleteSchedule(scheduleId);
      
      // Publish the deletion through the circular integration system
      await realTimeUpdatesService.publish('schedule', { id: scheduleId, deleted: true }, 'enhanced-scheduler');
      
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  }
  
  /**
   * Create a schedule directly from a client profile
   * @param {string} clientId - The ID of the client to create a schedule for
   * @param {Object} scheduleData - The data for the new schedule
   * @returns {Promise<Object>} The created schedule
   */
  async createClientSchedule(clientId, scheduleData) {
    console.log(`Creating schedule for client ${clientId}:`, scheduleData);
    
    try {
      // Get client information
      const client = await firebaseService.getClient(clientId);
      if (!client) {
        throw new Error(`Client ${clientId} not found`);
      }
      
      // Build complete schedule object
      const completeScheduleData = {
        ...scheduleData,
        client_id: clientId,
        client_name: client.name,
        client_location: client.location,
        required_skills: client.required_skills || [],
        status: 'unassigned' // Initially unassigned
      };
      
      // Create the schedule using the existing method
      return await this.createSchedule(completeScheduleData);
    } catch (error) {
      console.error('Error creating client schedule:', error);
      throw error;
    }
  }
  
  /**
   * Assign a caregiver to an existing schedule using a Firestore transaction
   * to prevent race conditions
   * @param {string} scheduleId - The ID of the schedule to update
   * @param {string} caregiverId - The ID of the caregiver to assign
   * @returns {Promise<Object>} The updated schedule
   */
  async assignCaregiverToSchedule(scheduleId, caregiverId) {
    console.log(`Assigning caregiver ${caregiverId} to schedule ${scheduleId}`);
    
    try {
      // Use a Firestore transaction to ensure atomicity
      return await firebaseService.db.runTransaction(async (transaction) => {
        // Get schedule document reference
        const scheduleRef = firebaseService.db.collection('schedules').doc(scheduleId);
        
        // Get schedule within the transaction
        const scheduleDoc = await transaction.get(scheduleRef);
        if (!scheduleDoc.exists) {
          throw new Error(`Schedule ${scheduleId} not found`);
        }
        
        // Get the schedule data
        const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() };
        
        // Get caregiver information
        const caregiverRef = firebaseService.db.collection('caregivers').doc(caregiverId);
        const caregiverDoc = await transaction.get(caregiverRef);
        if (!caregiverDoc.exists) {
          throw new Error(`Caregiver ${caregiverId} not found`);
        }
        
        const caregiver = { id: caregiverDoc.id, ...caregiverDoc.data() };
        
        // Check for conflicts (this needs to be inside the transaction as well)
        // Note: Since we can't run a query inside a transaction, we'll check conflicts
        // after the transaction if needed
        
        // Update the schedule with caregiver information
        const updateData = {
          caregiver_id: caregiverId,
          caregiver_name: caregiver.name,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Update the schedule within the transaction
        transaction.update(scheduleRef, updateData);
        
        // Return the updated schedule data
        return {
          success: true,
          schedule: {
            ...schedule,
            ...updateData
          }
        };
      });
      
      // Note: After the transaction completes, we could check for conflicts
      // and roll back the assignment if conflicts exist, but this would require
      // another transaction
      
    } catch (error) {
      console.error('Error assigning caregiver to schedule:', error);
      throw new Error(`Failed to assign caregiver: ${error.message}`);
    }
  }
  
  /**
   * Find available caregivers for a specific schedule
   * @param {string} scheduleId - The ID of the schedule to find caregivers for
   * @returns {Promise<Array>} A list of available caregivers with scores
   */
  async findAvailableCaregivers(scheduleId) {
    console.log(`Finding available caregivers for schedule ${scheduleId}`);
    
    try {
      const schedule = await firebaseService.getSchedule(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }
      
      const client = await firebaseService.getClient(schedule.client_id);
      const allCaregivers = await firebaseService.getAllCaregivers();
      
      const availableCaregivers = [];
      
      for (const caregiver of allCaregivers) {
        // Check availability
        const availability = await firebaseService.getCaregiverAvailability(caregiver.id);
        const isAvailable = this.isCaregiverAvailable(
          availability, 
          schedule.date, 
          schedule.start_time, 
          schedule.end_time
        );
        
        // Check conflicts
        const conflicts = await this.checkScheduleConflictsWithCaregiver(schedule, caregiver.id);
        
        if (isAvailable && conflicts.length === 0) {
          const score = await this.calculateCaregiverScore(caregiver, schedule, client);
          
          availableCaregivers.push({
            caregiver,
            score,
            conflicts: []
          });
        }
      }
      
      // Sort by score (highest first)
      availableCaregivers.sort((a, b) => b.score - a.score);
      
      return availableCaregivers;
    } catch (error) {
      console.error('Error finding available caregivers:', error);
      throw error;
    }
  }

  /**
   * Check for conflicts for a given schedule with improved error handling
   * @param {string} scheduleId - The ID of the schedule to check
   * @returns {Promise<Array>} A list of conflicts
   * @throws {Error} If there's an issue checking conflicts
   */
  async checkScheduleConflicts(scheduleId) {
    console.log(`Checking conflicts for schedule ${scheduleId}`);
    
    try {
      const schedule = await firebaseService.getSchedule(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }
      
      if (!schedule.caregiver_id) {
        return []; // No caregiver assigned, no conflicts
      }
      
      // Use the Firebase caching for better performance
      const caregiverSchedules = await firebaseService.executeQuery(
        () => firebaseService.db.collection('schedules')
          .where('caregiver_id', '==', schedule.caregiver_id)
          .where('date', '==', schedule.date),
        `conflicts_${scheduleId}_${schedule.caregiver_id}_${schedule.date}`
      );
      
      const conflicts = [];
      
      // Check for overlaps with other schedules
      for (const otherSchedule of caregiverSchedules) {
        if (otherSchedule.id === schedule.id) continue;
        
        if (this.timesOverlap(
          schedule.start_time, schedule.end_time,
          otherSchedule.start_time, otherSchedule.end_time
        )) {
          conflicts.push({
            type: 'time_overlap',
            conflictingScheduleId: otherSchedule.id,
            conflictingSchedule: otherSchedule,
            description: `Time conflict with schedule for ${otherSchedule.client_name} from ${otherSchedule.start_time} to ${otherSchedule.end_time}.`
          });
        }
      }
      
      return conflicts;
    } catch (error) {
      console.error('Error checking schedule conflicts:', error);
      throw new Error(`Failed to check schedule conflicts: ${error.message}`);
    }
  }

  /**
   * Find the best caregiver for a given schedule
   * @param {string} scheduleId - The ID of the schedule to find a caregiver for
   * @returns {Promise<Array>} A list of recommended caregivers
   */
  async findBestCaregiver(scheduleId) {
    console.log(`Finding best caregiver for schedule ${scheduleId}`);
    
    try {
      const schedule = await firebaseService.getSchedule(scheduleId);
      if (!schedule) {
        throw new Error('Schedule not found');
      }
      
      const client = await firebaseService.getClient(schedule.client_id);
      const allCaregivers = await firebaseService.getAllCaregivers();
      
      const recommendations = [];
      
      for (const caregiver of allCaregivers) {
        const score = await this.calculateCaregiverScore(caregiver, schedule, client);
        recommendations.push({
          caregiver,
          score
        });
      }
      
      // Sort by score (highest first)
      recommendations.sort((a, b) => b.score - a.score);
      
      return recommendations.slice(0, 5); // Return top 5
    } catch (error) {
      console.error('Error finding best caregiver:', error);
      throw error;
    }
  }

  /**
   * Calculate a score for a caregiver for a given schedule with proper null checks
   * @param {Object} caregiver - The caregiver object
   * @param {Object} schedule - The schedule object
   * @param {Object} client - The client object
   * @returns {Promise<number>} The calculated score
   */
  async calculateCaregiverScore(caregiver, schedule, client) {
    try {
      let score = 100;
      
      // Check if all required objects are provided
      if (!caregiver || !schedule || !client) {
        console.error('Missing required objects for caregiver score calculation');
        return 0;
      }
      
      // Check availability
      const availability = await firebaseService.getCaregiverAvailability(caregiver.id);
      // If availability is null (not found), consider the caregiver unavailable
      if (!availability) {
        return 0;
      }
      
      const isAvailable = this.isCaregiverAvailable(availability, schedule.date, schedule.start_time, schedule.end_time);
      if (!isAvailable) {
        return 0; // Not available, score is 0
      }
      
      // Check for conflicts using cache-aware query
      const conflicts = await this.checkScheduleConflictsWithCaregiver(schedule, caregiver.id);
      if (conflicts.length > 0) {
        score -= 50; // Major penalty for conflicts
      }
      
      // Check skills match with proper null handling
      if (client.required_skills && client.required_skills.length > 0) {
        const caregiverSkills = caregiver.skills || [];
        const matchingSkills = client.required_skills.filter(skill => 
          caregiverSkills.includes(skill)
        );
        const skillMatchPercent = (matchingSkills.length / client.required_skills.length) * 100;
        score -= (100 - skillMatchPercent) * 0.2; // 20% weight for skills
      }
      
      // Check geographic proximity with proper null handling
      if (client.location && caregiver.location && 
          client.location.latitude && client.location.longitude &&
          caregiver.location.latitude && caregiver.location.longitude) {
        
        const distance = distanceCalculator.calculateDistance(
          client.location.latitude, client.location.longitude,
          caregiver.location.latitude, caregiver.location.longitude
        );
        
        // Penalize for distance (up to 30 points)
        if (distance > 50) {
          score -= 30;
        } else {
          score -= (distance / 50) * 30;
        }
      }
      
      // Check client preferences with proper null handling
      if (client.preferences && client.preferences.preferred_caregivers && 
          Array.isArray(client.preferences.preferred_caregivers)) {
        if (client.preferences.preferred_caregivers.includes(caregiver.id)) {
          score += 10; // Bonus for preferred caregiver
        }
      }
      
      return Math.max(0, Math.round(score));
    } catch (error) {
      console.error('Error calculating caregiver score:', error);
      return 0; // Return 0 as a safe fallback
    }
  }

  /**
   * Check if a caregiver is available for a given time slot with improved error handling
   * @param {Array} availability - The caregiver's availability array
   * @param {string} date - The date of the schedule
   * @param {string} startTime - The start time of the schedule
   * @param {string} endTime - The end time of the schedule
   * @returns {boolean} Whether the caregiver is available
   */
  isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr) {
    try {
      if (!availabilityData || !requestedDateStr || !requestedStartTimeStr || !requestedEndTimeStr) {
        console.warn('Missing required parameters for availability check');
        return false;
      }

      const requestedDate = new Date(requestedDateStr + 'T00:00:00'); // Ensure date is parsed correctly, ideally in UTC or a consistent timezone
      const requestedStartMinutes = this.timeToMinutes(requestedStartTimeStr);
      const requestedEndMinutes = this.timeToMinutes(requestedEndTimeStr);

      if (requestedStartMinutes === null || requestedEndMinutes === null) {
        console.warn('Invalid requested start or end time format');
        return false;
      }

      // 1. Check time_off (highest precedence)
      if (availabilityData.time_off && Array.isArray(availabilityData.time_off)) {
        for (const pto of availabilityData.time_off) {
          const ptoStart = new Date(pto.start_datetime);
          const ptoEnd = new Date(pto.end_datetime);
          // Simple date check for now; could be more granular if time_off includes times
          if (requestedDate >= new Date(ptoStart.toDateString()) && requestedDate <= new Date(ptoEnd.toDateString())) {
             // More precise check if requested slot overlaps with PTO period
            const scheduleStartDateTime = new Date(`${requestedDateStr}T${requestedStartTimeStr}`);
            const scheduleEndDateTime = new Date(`${requestedDateStr}T${requestedEndTimeStr}`);
            if (scheduleStartDateTime < ptoEnd && scheduleEndDateTime > ptoStart) {
                console.log(`Caregiver unavailable due to time off: ${pto.reason}`);
                return false;
            }
          }
        }
      }
      
      const dayOfWeek = requestedDate.getDay(); // 0 for Sunday, 1 for Monday, etc.
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

      // 2. Check specific_slots
      if (availabilityData.specific_slots && Array.isArray(availabilityData.specific_slots)) {
        for (const slot of availabilityData.specific_slots) {
          if (slot && slot.day && slot.day.toLowerCase() === dayName.toLowerCase()) {
            const slotStartMinutes = this.timeToMinutes(slot.start);
            const slotEndMinutes = this.timeToMinutes(slot.end);
            if (slotStartMinutes !== null && slotEndMinutes !== null) {
              if (requestedStartMinutes >= slotStartMinutes && requestedEndMinutes <= slotEndMinutes) {
                return true; // Available due to a specific slot
              }
            }
          }
        }
      }

      // 3. Check general_rules
      if (availabilityData.general_rules && Array.isArray(availabilityData.general_rules)) {
        for (const rule of availabilityData.general_rules) {
          if (!rule || rule.type !== 'weekly_recurring') continue; // Only handle weekly_recurring for now

          // Check effective dates
          if (rule.effective_start_date && new Date(rule.effective_start_date) > requestedDate) continue;
          if (rule.effective_end_date && new Date(rule.effective_end_date) < requestedDate) continue;

          const ruleAppliesToDay = rule.days_of_week && rule.days_of_week.some(d => d.toLowerCase() === dayName.toLowerCase());
          if (!ruleAppliesToDay) continue;

          const ruleStartMinutes = this.timeToMinutes(rule.start_time);
          const ruleEndMinutes = this.timeToMinutes(rule.end_time);

          if (ruleStartMinutes === null || ruleEndMinutes === null) continue;

          if (requestedStartMinutes >= ruleStartMinutes && requestedEndMinutes <= ruleEndMinutes) {
            // Now check exceptions for this rule
            let isException = false;
            if (rule.exceptions && Array.isArray(rule.exceptions)) {
              for (const ex of rule.exceptions) {
                if (ex.date && new Date(ex.date).toDateString() === requestedDate.toDateString()) {
                  if (ex.start_time && ex.end_time) { // Specific time exception
                    const exStartMinutes = this.timeToMinutes(ex.start_time);
                    const exEndMinutes = this.timeToMinutes(ex.end_time);
                    if (exStartMinutes !== null && exEndMinutes !== null) {
                      // Check for overlap: (ReqStart < ExEnd) and (ReqEnd > ExStart)
                      if (requestedStartMinutes < exEndMinutes && requestedEndMinutes > exStartMinutes) {
                        isException = true;
                        break;
                      }
                    }
                  } else { // Full day exception
                    isException = true;
                    break;
                  }
                }
              }
            }
            if (!isException) {
              return true; // Available due to a general rule
            }
          }
        }
      }
      return false; // Not available by any rule
    } catch (error) {
      console.error('Error checking caregiver availability:', error);
      return false; // Default to unavailable on error
    }
  }

  /**
   * Check for conflicts with a given caregiver for a schedule
   * @param {Object} schedule - The schedule to check
   * @param {string} caregiverId - The ID of the caregiver to check
   * @returns {Promise<Array>} A list of conflicts
   */
  async checkScheduleConflictsWithCaregiver(schedule, caregiverId) {
    const caregiverSchedules = await firebaseService.getSchedulesByCaregiverAndDate(
      caregiverId,
      schedule.date
    );
    
    const conflicts = [];
    
    for (const otherSchedule of caregiverSchedules) {
      if (this.timesOverlap(
        schedule.start_time, schedule.end_time,
        otherSchedule.start_time, otherSchedule.end_time
      )) {
        conflicts.push(otherSchedule);
      }
    }
    
    return conflicts;
  }

  /**
   * Helper function to check if two time ranges overlap
   * @param {string} start1 - First range start time (HH:MM)
   * @param {string} end1 - First range end time (HH:MM)
   * @param {string} start2 - Second range start time (HH:MM)
   * @param {string} end2 - Second range end time (HH:MM)
   * @returns {boolean} Whether the time ranges overlap
   */
  timesOverlap(start1, end1, start2, end2) {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);
    
    return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
  }

  /**
   * Helper function to convert a time string (HH:MM) to minutes from midnight
   * with improved error handling
   * @param {string} timeString - The time string to convert
   * @returns {number|null} The number of minutes from midnight or null if invalid
   */
  timeToMinutes(timeString) {
    try {
      if (!timeString || typeof timeString !== 'string' || !timeString.includes(':')) {
        return null;
      }
      
      const parts = timeString.split(':');
      if (parts.length !== 2) {
        return null;
      }
      
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }
      
      return hours * 60 + minutes;
    } catch (error) {
      console.error('Error converting time to minutes:', error);
      return null; // Return null on error
    }
  }

  /**
   * Main function to optimize schedules based on client needs and caregiver availability.
   * Aims to cover client authorized hours using the fewest caregivers, respecting constraints.
   *
   * @param {Array<Object>} clientShiftsToFill - Array of discrete shift objects that need to be filled.
   *   Each shift object: { id (unique shiftId), clientId, clientName, date, startTime, endTime, durationHours, requiredSkills, location, clientBusLineAccess }
   * @param {Array<Object>} availableCaregivers - Array of caregiver objects.
   *   Each caregiver: { id, name, skills, availabilityData (from getCaregiverAvailability), drives_car,
   *                    max_days_per_week, max_hours_per_week, target_weekly_hours, employment_type,
   *                    current_assignments_this_period: [{ date, startTime, endTime, shiftId }] (to track daily/weekly limits) }
   * @param {Object} optimizationParams - Parameters like { primaryGoal: 'maximizeCoverageFewestCaregivers' }
   * @returns {Promise<Object>} - { assignments: [], unmetShifts: [], optimization_summary: {} }
   */
  async optimizeSchedules(clientShiftsToFill, availableCaregiversInput, optimizationParams = {}) {
    console.log(`Starting schedule optimization. Shifts to fill: ${clientShiftsToFill.length}, Caregivers available: ${availableCaregiversInput.length}`);
    const assignments = [];
    let unmetShifts = [...clientShiftsToFill]; // Start with all shifts needing to be met

    // Initialize/normalize caregiver data for tracking during optimization
    const caregivers = availableCaregiversInput.map(cg => ({
      ...cg,
      assignedShiftsThisPeriod: [], // Tracks shifts assigned in this optimization run
      workedHoursThisPeriod: 0,
      workedDaysThisPeriod: new Set(), // Using a Set to count unique days
    }));

    // Sort shifts: Maybe by priority? Or by earliest start time? For now, process as is.
    // TODO: Consider sorting strategies for shifts (e.g., by client priority, by earliest time)

    // Sort caregivers: Maybe by preference, or fewest current hours?
    // For "fewest caregivers", we might prefer those who can take more hours.
    // For now, a simple sort or use as is.
    // TODO: Consider caregiver scoring/sorting for selection priority.

    for (const shift of clientShiftsToFill) {
      if (!unmetShifts.find(s => s.id === shift.id)) {
        continue; // Already assigned in this run by some logic (e.g. linked shifts)
      }

      let bestCandidate = null;
      let bestCandidateScore = -1; // Or some other scoring mechanism

      for (const caregiver of caregivers) {
        // 1. Check hard constraints
        // Max weekly hours
        const shiftDuration = (this.timeToMinutes(shift.endTime) - this.timeToMinutes(shift.startTime)) / 60;
        if (caregiver.workedHoursThisPeriod + shiftDuration > caregiver.max_hours_per_week) {
          continue;
        }

        // Max daily shifts (rule: no multiple shifts in a day)
        if (caregiver.assignedShiftsThisPeriod.some(s => s.date === shift.date)) {
          continue;
        }

        // Max weekly days
        const tempWorkedDays = new Set(caregiver.workedDaysThisPeriod);
        tempWorkedDays.add(shift.date);
        if (tempWorkedDays.size > caregiver.max_days_per_week) {
          continue;
        }

        // 2. Check availability (using the refined isCaregiverAvailable)
        const isAvailable = this.isCaregiverAvailable(caregiver.availabilityData, shift.date, shift.startTime, shift.endTime);
        if (!isAvailable) {
          continue;
        }

        // 3. Check skill match
        const hasRequiredSkills = (shift.requiredSkills || []).every(skill => (caregiver.skills || []).includes(skill));
        if (!hasRequiredSkills) {
          continue;
        }

        // 4. Check travel/transportation match (simplified)
        if (!caregiver.drives_car && !shift.clientBusLineAccess) {
          // If caregiver doesn't drive and client isn't on bus line, assume it's a no-match for now
          // More complex distance/travel time logic could be here
          continue;
        }

        // TODO: Add actual scoring based on preferences, travel distance (if locations available), continuity etc.
        // For now, any valid caregiver is a candidate. We'll just pick the first one.
        // A better approach would be to score all valid candidates and pick the best.
        let currentScore = 100; // Base score if all checks pass

        // Example: Penalize if caregiver is already working many hours (to balance load initially)
        currentScore -= caregiver.workedHoursThisPeriod;

        if (currentScore > bestCandidateScore) {
          bestCandidate = caregiver;
          bestCandidateScore = currentScore;
        }
      }

      if (bestCandidate) {
        // Assign shift to bestCandidate
        const newAssignment = {
          shiftId: shift.id, // Link to the original client shift ID
          scheduleId: `opt-sched-${Date.now()}-${Math.floor(Math.random() * 10000)}`, // Generate a new schedule ID
          clientId: shift.clientId,
          clientName: shift.clientName,
          caregiverId: bestCandidate.id,
          caregiverName: bestCandidate.name,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          durationHours: shiftDuration,
          status: 'pending_confirmation', // Or 'assigned' if auto-confirming
        };
        assignments.push(newAssignment);

        // Update caregiver's tracking info
        bestCandidate.assignedShiftsThisPeriod.push({
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            shiftId: shift.id
        });
        bestCandidate.workedHoursThisPeriod += shiftDuration;
        bestCandidate.workedDaysThisPeriod.add(shift.date);

        // Remove from unmetShifts
        unmetShifts = unmetShifts.filter(s => s.id !== shift.id);
        console.log(`Assigned shift ${shift.id} for ${shift.clientName} to ${bestCandidate.name}`);
      } else {
        console.log(`Could not find suitable caregiver for shift ${shift.id} for ${shift.clientName}`);
      }
    }

    // TODO: Implement "Last Resort" for simultaneous clients if unmetShifts is still large.

    const optimization_summary = {
      totalShiftsToFill: clientShiftsToFill.length,
      shiftsAssigned: assignments.length,
      shiftsUnmet: unmetShifts.length,
      caregiversUtilized: new Set(assignments.map(a => a.caregiverId)).size,
      // More summary stats can be added here
    };
    console.log('Optimization attempt finished.', optimization_summary);

    return {
      assignments,
      unmetShifts,
      optimization_summary
    };
  }
}

module.exports = new EnhancedScheduler();

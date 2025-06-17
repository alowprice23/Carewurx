/**
 * Firebase Service Extensions
 * Extends the core Firebase service with enhanced data models for scheduling system
 * 
 * IMPORTANT: This integrates directly with the live Firebase database
 */

const { firebaseService } = require('./firebase');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');

class FirebaseExtensionsService {
  constructor(baseService) {
    this.firebase = baseService;
    this.db = baseService.db; // Direct access to Firestore database for real-time operations
  }

  /**
   * Extends a caregiver profile with enhanced fields for scheduling
   * @param {string} caregiverId - The ID of the caregiver to extend
   * @param {Object} enhancedData - The enhanced data fields
   * @returns {Promise<Object>} The result with success status
   */
  async extendCaregiverProfile(caregiverId, enhancedData = {}) {
    try {
      // Get the existing caregiver data first
      const existingCaregiver = await this.firebase.getCaregiver(caregiverId);
      
      if (!existingCaregiver) {
        throw new Error(`Caregiver with ID ${caregiverId} not found`);
      }
      
      // Prepare the transportation data
      const transportation = {
        hasCar: enhancedData.hasCar || false,
        hasLicense: enhancedData.hasLicense || false,
        usesPublicTransport: enhancedData.usesPublicTransport || false,
        travelRadius: enhancedData.travelRadius || 10, // Default 10 miles/km
        notes: enhancedData.transportationNotes || ''
      };
      
      // Prepare the skills and certifications
      const skills = enhancedData.skills || [];
      const certifications = (enhancedData.certifications || []).map(cert => ({
        type: cert.type,
        issuedDate: cert.issuedDate ? Timestamp.fromDate(new Date(cert.issuedDate)) : Timestamp.now(),
        expiryDate: cert.expiryDate ? Timestamp.fromDate(new Date(cert.expiryDate)) : null,
        verificationStatus: cert.verificationStatus || 'Pending'
      }));
      
      // Update the caregiver document with enhanced fields
      return this.firebase.updateDocument('caregivers', caregiverId, {
        transportation,
        skills,
        certifications,
        assignmentStatus: enhancedData.assignmentStatus || 'Available',
        preferredWorkingHours: enhancedData.preferredWorkingHours || {
          minHoursPerWeek: 0,
          maxHoursPerWeek: 40,
          preferredShiftLength: 4
        },
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error extending caregiver profile:', error);
      throw new Error(`Failed to extend caregiver profile: ${error.message}`);
    }
  }

  /**
   * Updates a caregiver's availability settings
   * @param {string} caregiverId - The ID of the caregiver
   * @param {Object} availabilityData - The availability data
   * @returns {Promise<Object>} The result with success status
   */
  async updateCaregiverAvailability(caregiverId, availabilityData) {
    try {
      // Validate that the caregiver exists
      const existingCaregiver = await this.firebase.getCaregiver(caregiverId);
      
      if (!existingCaregiver) {
        throw new Error(`Caregiver with ID ${caregiverId} not found`);
      }
      
      // Format the regular schedule entries
      const regularSchedule = (availabilityData.regularSchedule || []).map(entry => ({
        dayOfWeek: entry.dayOfWeek, // 0-6 (Sunday-Saturday)
        startTime: entry.startTime,
        endTime: entry.endTime,
        recurrenceType: entry.recurrenceType || 'Weekly'
      }));
      
      // Format the time off entries
      const timeOff = (availabilityData.timeOff || []).map(entry => ({
        startDate: entry.startDate ? Timestamp.fromDate(new Date(entry.startDate)) : null,
        endDate: entry.endDate ? Timestamp.fromDate(new Date(entry.endDate)) : null,
        reason: entry.reason || 'Time Off',
        status: entry.status || 'Approved'
      }));
      
      // Update the availability document
      await this.firebase.db.collection('caregiver_availability').doc(caregiverId).set({
        caregiverId: caregiverId,
        regularSchedule,
        timeOff,
        lastUpdated: Timestamp.now()
      }, { merge: true });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating caregiver availability:', error);
      throw new Error(`Failed to update caregiver availability: ${error.message}`);
    }
  }

  /**
   * Extends a client profile with enhanced fields for scheduling
   * @param {string} clientId - The ID of the client to extend
   * @param {Object} enhancedData - The enhanced data fields
   * @returns {Promise<Object>} The result with success status
   */
  async extendClientProfile(clientId, enhancedData = {}) {
    try {
      // Get the existing client data first
      const existingClient = await this.firebase.getClient(clientId);
      
      if (!existingClient) {
        throw new Error(`Client with ID ${clientId} not found`);
      }
      
      // Prepare the care needs
      const careNeeds = (enhancedData.careNeeds || []).map(need => ({
        type: need.type,
        description: need.description || '',
        priority: need.priority || 3, // 1-5 scale
        requiresCertification: need.requiresCertification || false
      }));
      
      // Prepare the transportation data
      const transportation = {
        onBusLine: enhancedData.onBusLine || false,
        requiresDriverCaregiver: enhancedData.requiresDriverCaregiver || false,
        mobilityEquipment: enhancedData.mobilityEquipment || [],
        notes: enhancedData.transportationNotes || ''
      };
      
      // Prepare the service hours
      const serviceHours = {
        hoursPerWeek: enhancedData.hoursPerWeek || 0,
        preferredDays: enhancedData.preferredDays || [], // 0-6 (Sunday-Saturday)
        preferredTimeRanges: (enhancedData.preferredTimeRanges || []).map(range => ({
          startTime: range.startTime,
          endTime: range.endTime
        }))
      };
      
      // Prepare the waitlist entry if applicable
      const waitlistEntry = enhancedData.waitlistEntry ? {
        joinedDate: enhancedData.waitlistEntry.joinedDate ? 
          Timestamp.fromDate(new Date(enhancedData.waitlistEntry.joinedDate)) : Timestamp.now(),
        priority: enhancedData.waitlistEntry.priority || 3, // 1-5 scale
        notes: enhancedData.waitlistEntry.notes || '',
        estimatedAssignmentDate: enhancedData.waitlistEntry.estimatedAssignmentDate ? 
          Timestamp.fromDate(new Date(enhancedData.waitlistEntry.estimatedAssignmentDate)) : null
      } : null;
      
      // Update the client document with enhanced fields
      return this.firebase.updateDocument('clients', clientId, {
        careNeeds,
        transportation,
        serviceStatus: enhancedData.serviceStatus || 'Active',
        preferredCaregivers: enhancedData.preferredCaregivers || [],
        serviceHours,
        waitlistEntry,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error extending client profile:', error);
      throw new Error(`Failed to extend client profile: ${error.message}`);
    }
  }

  /**
   * Extends a schedule with enhanced fields
   * @param {string} scheduleId - The ID of the schedule to extend
   * @param {Object} enhancedData - The enhanced data fields
   * @returns {Promise<Object>} The result with success status
   */
  async extendSchedule(scheduleId, enhancedData = {}) {
    try {
      // Get the existing schedule data first
      const existingSchedule = await this.firebase.getSchedule(scheduleId);
      
      if (!existingSchedule) {
        throw new Error(`Schedule with ID ${scheduleId} not found`);
      }
      
      // Prepare the care needs addressed
      const careNeedsAddressed = enhancedData.careNeedsAddressed || [];
      
      // Prepare the required skills
      const requiredSkills = enhancedData.requiredSkills || [];
      
      // Prepare the required certifications
      const requiredCertifications = enhancedData.requiredCertifications || [];
      
      // Prepare the transportation details
      const transportation = {
        method: enhancedData.transportationMethod || 'Unspecified',
        estimatedTravelTime: enhancedData.estimatedTravelTime || 0,
        travelDetails: enhancedData.travelDetails || ''
      };
      
      // Prepare the recurring schedule details
      const recurring = {
        isRecurring: enhancedData.isRecurring || false,
        frequency: enhancedData.recurringFrequency || 'Weekly',
        endDate: enhancedData.recurringEndDate ? 
          Timestamp.fromDate(new Date(enhancedData.recurringEndDate)) : null,
        exceptions: (enhancedData.recurringExceptions || []).map(date => 
          Timestamp.fromDate(new Date(date))
        )
      };
      
      // Prepare the conflict status
      const conflictStatus = {
        hasConflict: enhancedData.hasConflict || false,
        conflictType: enhancedData.conflictType || '',
        resolutionStatus: enhancedData.resolutionStatus || 'No Conflict'
      };
      
      // Update the schedule document with enhanced fields
      return this.firebase.updateDocument('schedules', scheduleId, {
        careNeedsAddressed,
        requiredSkills,
        requiredCertifications,
        transportation,
        recurring,
        conflictStatus,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error extending schedule:', error);
      throw new Error(`Failed to extend schedule: ${error.message}`);
    }
  }

  /**
   * Get caregivers available for a specific time slot
   * @param {string} date - The date in YYYY-MM-DD format
   * @param {string} startTime - The start time in HH:MM format
   * @param {string} endTime - The end time in HH:MM format
   * @returns {Promise<Array<Object>>} Array of available caregivers
   */
  async getAvailableCaregivers(date, startTime, endTime) {
    try {
      // First, get all caregivers
      const allCaregivers = await this.firebase.getAllCaregivers({ skipCache: true });
      
      // Convert the date string to a day of week (0-6, where 0 is Sunday)
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      
      // For each caregiver, check their availability
      const availableCaregivers = [];
      
      for (const caregiver of allCaregivers) {
        // Get the caregiver's availability
        const availabilityDoc = await this.firebase.db.collection('caregiver_availability')
          .doc(caregiver.id).get();
        
        if (!availabilityDoc.exists) {
          continue; // Skip if no availability document exists
        }
        
        const availability = availabilityDoc.data();
        
        // Check if caregiver is on time off for this date
        const isOnTimeOff = (availability.timeOff || []).some(timeOff => {
          const startDate = timeOff.startDate?.toDate() || new Date(0);
          const endDate = timeOff.endDate?.toDate() || new Date(9999, 11, 31);
          return dateObj >= startDate && dateObj <= endDate;
        });
        
        if (isOnTimeOff) {
          continue; // Skip if caregiver is on time off
        }
        
        // Check if the time slot fits within the caregiver's regular schedule
        const isAvailable = (availability.regularSchedule || []).some(schedule => {
          // Check if this schedule applies to the requested day of week
          if (schedule.dayOfWeek !== dayOfWeek) {
            return false;
          }
          
          // Check if the time slot fits within this schedule
          return startTime >= schedule.startTime && endTime <= schedule.endTime;
        });
        
        if (isAvailable) {
          // Check if the caregiver is already scheduled for this time
          const existingSchedules = await this.firebase.getSchedulesByCaregiverAndDate(caregiver.id, date);
          
          const hasConflict = existingSchedules.some(schedule => {
            // Check for overlap
            return (startTime < schedule.endTime && endTime > schedule.startTime);
          });
          
          if (!hasConflict) {
            availableCaregivers.push(caregiver);
          }
        }
      }
      
      return availableCaregivers;
    } catch (error) {
      console.error('Error getting available caregivers:', error);
      throw new Error(`Failed to get available caregivers: ${error.message}`);
    }
  }

  /**
   * Find matching caregivers for a client based on care needs and other criteria
   * @param {string} clientId - The ID of the client
   * @param {Object} options - Additional matching options
   * @returns {Promise<Array<Object>>} Array of matching caregivers with scores
   */
  async findMatchingCaregivers(clientId, options = {}) {
    try {
      // Get the client data
      const client = await this.firebase.getClient(clientId);
      
      if (!client) {
        throw new Error(`Client with ID ${clientId} not found`);
      }
      
      // Get all caregivers
      const allCaregivers = await this.firebase.getAllCaregivers({ skipCache: true });
      
      // Prepare the results array
      const matches = [];
      
      // For each caregiver, calculate a match score
      for (const caregiver of allCaregivers) {
        // Skip caregivers who are fully booked
        if (caregiver.assignmentStatus === 'Fully Booked') {
          continue;
        }
        
        // Calculate match score components
        
        // 1. Skills match (0-50 points)
        const skillsScore = this._calculateSkillsMatchScore(client.careNeeds || [], caregiver.skills || []);
        
        // 2. Transportation compatibility (0-20 points)
        const transportScore = this._calculateTransportationScore(
          client.transportation || {},
          caregiver.transportation || {}
        );
        
        // 3. Location proximity (0-15 points)
        const proximityScore = await this._calculateProximityScore(
          client.address || '',
          caregiver.address || ''
        );
        
        // 4. Availability match (0-10 points)
        const availabilityScore = await this._calculateAvailabilityScore(
          client.serviceHours || {},
          caregiver.id
        );
        
        // 5. Preferences match (0-5 points)
        const preferencesScore = this._calculatePreferencesScore(
          client.preferredCaregivers || [],
          caregiver.id
        );
        
        // Calculate total score (0-100)
        const totalScore = 
          (skillsScore * 50) + 
          (transportScore * 20) + 
          (proximityScore * 15) + 
          (availabilityScore * 10) + 
          (preferencesScore * 5);
        
        // Add to matches if score is above threshold
        if (totalScore >= (options.minScore || 30)) { // Default threshold of 30%
          matches.push({
            caregiver,
            score: totalScore,
            skillsScore: skillsScore * 50,
            transportScore: transportScore * 20,
            proximityScore: proximityScore * 15,
            availabilityScore: availabilityScore * 10,
            preferencesScore: preferencesScore * 5
          });
        }
      }
      
      // Sort matches by score (highest first)
      matches.sort((a, b) => b.score - a.score);
      
      // Limit results if specified
      if (options.limit && matches.length > options.limit) {
        return matches.slice(0, options.limit);
      }
      
      return matches;
    } catch (error) {
      console.error('Error finding matching caregivers:', error);
      throw new Error(`Failed to find matching caregivers: ${error.message}`);
    }
  }
  
  /**
   * Get clients waiting for caregiver assignment
   * @returns {Promise<Array<Object>>} Array of clients on waitlist
   */
  async getWaitlistedClients() {
    try {
      // Query clients with waitlistEntry
      const snapshot = await this.firebase.db.collection('clients')
        .where('serviceStatus', '==', 'Waiting for Caregiver')
        .orderBy('waitlistEntry.priority', 'desc') // Higher priority first
        .orderBy('waitlistEntry.joinedDate', 'asc') // Oldest first
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting waitlisted clients:', error);
      throw new Error(`Failed to get waitlisted clients: ${error.message}`);
    }
  }
  
  /**
   * Get caregivers seeking assignments
   * @returns {Promise<Array<Object>>} Array of available caregivers
   */
  async getCaregiverSeekingAssignments() {
    try {
      // Query caregivers with seeking assignments status
      const snapshot = await this.firebase.db.collection('caregivers')
        .where('assignmentStatus', '==', 'Seeking Assignments')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting caregivers seeking assignments:', error);
      throw new Error(`Failed to get caregivers seeking assignments: ${error.message}`);
    }
  }
  
  // Private helper methods
  
  /**
   * Calculate skill match score between client care needs and caregiver skills
   * @param {Array} careNeeds - Client care needs
   * @param {Array} caregiverSkills - Caregiver skills
   * @returns {number} Match score from 0-1
   * @private
   */
  _calculateSkillsMatchScore(careNeeds, caregiverSkills) {
    if (!careNeeds.length) return 1; // If no care needs specified, perfect match
    
    // Extract skill types from care needs
    const neededSkills = careNeeds.map(need => need.type);
    
    // Count matches
    const matchCount = neededSkills.filter(skill => 
      caregiverSkills.includes(skill)
    ).length;
    
    // Calculate score (0-1)
    return neededSkills.length ? (matchCount / neededSkills.length) : 1;
  }
  
  /**
   * Calculate transportation compatibility score
   * @param {Object} clientTransport - Client transportation requirements
   * @param {Object} caregiverTransport - Caregiver transportation capabilities
   * @returns {number} Match score from 0-1
   * @private
   */
  _calculateTransportationScore(clientTransport, caregiverTransport) {
    // If client requires a driver
    if (clientTransport.requiresDriverCaregiver) {
      return caregiverTransport.hasCar ? 1 : 0;
    }
    
    // If client is on bus line
    if (clientTransport.onBusLine) {
      return 1; // Both car and public transit work
    }
    
    // Client not on bus line and doesn't specifically require driver
    return caregiverTransport.hasCar ? 1 : 0.5; // Car preferred but not required
  }
  
  /**
   * Calculate proximity score based on addresses
   * @param {string} clientAddress - Client address
   * @param {string} caregiverAddress - Caregiver address
   * @returns {Promise<number>} Match score from 0-1
   * @private
   */
  async _calculateProximityScore(clientAddress, caregiverAddress) {
    // This would ideally use a geocoding and distance calculation service
    // For now, we'll return a placeholder value
    return 0.8; // Placeholder value
  }
  
  /**
   * Calculate availability match score
   * @param {Object} clientHours - Client service hours preferences
   * @param {string} caregiverId - Caregiver ID to check availability
   * @returns {Promise<number>} Match score from 0-1
   * @private
   */
  async _calculateAvailabilityScore(clientHours, caregiverId) {
    try {
      // Get caregiver availability
      const availabilityDoc = await this.firebase.db.collection('caregiver_availability')
        .doc(caregiverId).get();
      
      if (!availabilityDoc.exists) {
        return 0.5; // Unknown availability
      }
      
      const availability = availabilityDoc.data();
      
      // If client has no preferred days, return 0.5
      if (!clientHours.preferredDays || !clientHours.preferredDays.length) {
        return 0.5;
      }
      
      // Count how many preferred days the caregiver is available
      let matchingDays = 0;
      
      for (const preferredDay of clientHours.preferredDays) {
        const dayAvailable = (availability.regularSchedule || []).some(schedule => 
          schedule.dayOfWeek === preferredDay
        );
        
        if (dayAvailable) {
          matchingDays++;
        }
      }
      
      // Calculate score (0-1)
      return clientHours.preferredDays.length ? 
        (matchingDays / clientHours.preferredDays.length) : 0.5;
    } catch (error) {
      console.error('Error calculating availability score:', error);
      return 0.5; // Default to medium score on error
    }
  }
  
  /**
   * Calculate preferences match score
   * @param {Array} preferredCaregivers - Client's preferred caregivers IDs
   * @param {string} caregiverId - Caregiver ID to check
   * @returns {number} Match score from 0-1
   * @private
   */
  _calculatePreferencesScore(preferredCaregivers, caregiverId) {
    // If client has preferred caregivers and this caregiver is one of them
    if (preferredCaregivers && preferredCaregivers.length && 
        preferredCaregivers.includes(caregiverId)) {
      return 1;
    }
    
    // If client has no preferences
    if (!preferredCaregivers || !preferredCaregivers.length) {
      return 0.5;
    }
    
    // Client has preferences but this caregiver is not one of them
    return 0;
  }
}

// Create and export the extension service instance
const firebaseExtensions = new FirebaseExtensionsService(firebaseService);

module.exports = {
  firebaseExtensions
};

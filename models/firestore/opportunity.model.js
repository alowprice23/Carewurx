/**
 * @typedef {Object} OpportunityTimeDetails
 * @property {Date | firebase.firestore.Timestamp} date - The specific date of the opportunity, or start date for recurring.
 * @property {string} startTime - e.g., "10:00" (24-hour format)
 * @property {string} endTime - e.g., "14:00" (24-hour format)
 * @property {number} durationHours - Calculated duration in hours
 */

/**
 * @typedef {Object} OpportunityLocation
 * @property {string} address - Full address
 * @property {string} [notes] - e.g., "Parking available at the back"
 */

/**
 * @typedef {Object} OpportunityDocument
 * @property {string} opportunityId - Document ID
 * @property {string} clientId - ID of the client needing care
 * @property {OpportunityTimeDetails} timeDetails
 * @property {OpportunityLocation} location
 * @property {string[]} requiredSkills - e.g., ["medication administration", "mobility support"]
 * @property {string[]} careNeeds - Detailed list of care tasks required
 * @property {string} status - e.g., "open", "assigned", "pending_confirmation", "completed", "cancelled"
 * @property {string} [assignedCaregiverId] - ID of the caregiver assigned (if any)
 * @property {string} [assignedBy] - UID of the admin/scheduler who assigned the opportunity
 * @property {Date | firebase.firestore.Timestamp} [assignmentDate] - When the opportunity was assigned
 * @property {string} [notesForCaregiver] - Specific instructions or notes for the assigned caregiver
 * @property {number} [compensationRate] - Hourly rate or fixed amount for the opportunity
 * @property {string} [urgency] - e.g., "high", "medium", "low"
 * @property {firebase.firestore.Timestamp} createdAt
 * @property {firebase.firestore.Timestamp} updatedAt
 * @property {string} createdBy - UID of the user who created the opportunity (typically an admin)
 */

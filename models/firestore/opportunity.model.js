/**
 * @typedef {Object} OpportunityLocation
 * @property {string} address - Full address where the opportunity is located.
 * @property {string} [city] - City, can be extracted or provided separately.
 * @property {string} [zipCode] - Zip code for filtering.
 * @property {number} [latitude]
 * @property {number} [longitude]
 */

/**
 * @typedef {Object} RequiredSkill
 * @property {string} skillName - e.g., "Dementia Care", "Hoyer Lift Operation".
 * @property {string} [proficiencyLevel] - e.g., "Experienced", "Certified".
 */

/**
 * @typedef {Object} OpportunityDocument
 * @property {string} opportunityId - Unique identifier for the opportunity (Firestore document ID).
 * @property {string} clientId - ID of the client for whom the opportunity exists.
 * @property {string} [clientName] - Denormalized client name.
 * @property {firebase.firestore.Timestamp} serviceStartTime - Proposed start time for the service/shift.
 * @property {firebase.firestore.Timestamp} serviceEndTime - Proposed end time for the service/shift.
 * @property {OpportunityLocation} location - Location details for the service.
 * @property {string[]} careNeeds - List of specific care needs for this opportunity, similar to ClientDocument.careNeeds.
 * @property {RequiredSkill[]} [requiredSkills] - Specific skills required from the caregiver.
 * @property {string} description - Detailed description of the opportunity, tasks involved, client preferences.
 * @property {string} status - Status of the opportunity (e.g., "open", "pending_assignment", "assigned", "in_progress", "completed", "cancelled", "expired").
 * @property {number} [offeredRate] - Hourly rate or fixed amount offered for this opportunity.
 * @property {string} [rateType] - "hourly" or "fixed".
 * @property {string[]} [interestedCaregiverIds] - List of caregiver IDs who have expressed interest.
 * @property {string} [assignedCaregiverId] - ID of the caregiver to whom this opportunity is assigned.
 * @property {string} [assignedCaregiverName] - Denormalized name of assigned caregiver.
 * @property {firebase.firestore.Timestamp} [assignmentTimestamp] - When the caregiver was assigned.
 * @property {string} [scheduleId] - If a schedule is created from this opportunity, its ID.
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when the opportunity was created.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when the opportunity was last updated.
 * @property {string} [createdBy] - User ID or role who created the opportunity (e.g., "admin", "system", "client_request").
 * @property {firebase.firestore.Timestamp} [expiryDate] - Optional date when the opportunity will expire if not filled.
 * @property {string} [priority] - e.g., "low", "medium", "high", "urgent".
 * @property {string} [notes] - Internal notes about the opportunity.
 */

// This file is for schema definition using JSDoc. No functional class implementation is needed here.

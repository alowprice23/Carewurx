/**
 * @typedef {Object} CaregiverContactInfo
 * @property {string} phone - Caregiver's primary phone number.
 * @property {string} [secondaryPhone] - Optional secondary phone number.
 * @property {string} email - Caregiver's email address (should match their User document email).
 */

/**
 * @typedef {Object} CaregiverAddress
 * @property {string} street
 * @property {string} city
 * @property {string} state
 * @property {string} zipCode
 * @property {string} [country] - Defaults to US if not specified.
 */

/**
 * @typedef {Object} Certification
 * @property {string} name - Name of the certification (e.g., "Certified Nursing Assistant").
 * @property {string} authority - Issuing authority (e.g., "State Board of Nursing").
 * @property {string} [licenseNumber] - License or certification number.
 * @property {string} [validFrom] - Date the certification became valid (ISO 8601).
 * @property {string} [validUntil] - Expiration date of the certification (ISO 8601).
 * @property {string} [documentUrl] - Link to a scanned copy of the certificate.
 */

/**
 * @typedef {Object} CaregiverPreferences
 * @property {number} [maxTravelDistance] - Maximum distance in miles (or km) the caregiver is willing to travel.
 * @property {string[]} [preferredClientAges] - e.g., ["pediatric", "adult", "senior"].
 * @property {string[]} [preferredClientConditions] - e.g., ["dementia care", "post-operative care"].
 */

/**
 * @typedef {Object} CaregiverDocument
 * @property {string} caregiverId - Unique identifier for the caregiver (usually the Firestore document ID, may also be linked from User.caregiverId).
 * @property {string} userId - Corresponding User UID for authentication and basic user info.
 * @property {string} firstName - Caregiver's first name.
 * @property {string} lastName - Caregiver's last name.
 * @property {string} dateOfBirth - Caregiver's date of birth (ISO 8601 YYYY-MM-DD).
 * @property {CaregiverContactInfo} contactInfo - Contact details.
 * @property {CaregiverAddress} address - Residential address.
 * @property {string[]} skills - List of skills (e.g., "Medication Administration", "Wound Care", "Bathing Assistance").
 * @property {Certification[]} certifications - Array of certifications.
 * @property {number} yearsOfExperience - Total years of caregiving experience.
 * @property {CaregiverPreferences} [preferences] - Caregiver's work preferences.
 * @property {string[]} [languagesSpoken] - e.g., ["English", "Spanish"].
 * @property {boolean} isActive - Whether the caregiver is currently active and available for assignments.
 * @property {string} [profileImageUrl] - URL to a professional photo of the caregiver.
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when the caregiver record was created.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when the caregiver record was last updated.
 * @property {string} [emergencyContactName]
 * @property {string} [emergencyContactPhone]
 * @property {Object} [backgroundCheck] - e.g., { status: "completed", date: "YYYY-MM-DD", reportUrl: "..." }
 * @property {string[]} [assignedClientIds] - List of current client IDs.
 */

/**
 * Represents a single block of availability for a caregiver on a specific day.
 * Stored in /caregivers/{caregiverId}/availability/{availabilityId}
 * where {availabilityId} could be the date string (YYYY-MM-DD) or a unique ID if multiple blocks per day are allowed.
 * For simplicity, we can use YYYY-MM-DD as the document ID if only one general availability entry per day.
 * Or, have documents with specific start/end times if more granularity is needed per day.
 * Let's assume a daily record with time slots for now.
 *
 * @typedef {Object} AvailabilitySlot
 * @property {string} startTime - Start time in HH:MM format (24-hour).
 * @property {string} endTime - End time in HH:MM format (24-hour).
 * @property {string} status - e.g., "available", "booked", "unavailable".
 */

/**
 * @typedef {Object} CaregiverAvailabilityDocument
 * @property {string} availabilityId - Document ID (e.g., YYYY-MM-DD for daily entries, or a unique ID for specific slots).
 * @property {string} caregiverId - The ID of the caregiver this availability belongs to.
 * @property {string} date - The specific date for this availability entry (YYYY-MM-DD).
 * @property {AvailabilitySlot[]} slots - Array of time slots for the day. Example: [{startTime: "09:00", endTime: "12:00", status: "available"}, {startTime: "13:00", endTime: "17:00", status: "available"}]
 * @property {boolean} [isRecurring] - If true, indicates this availability is part of a recurring pattern (logic for recurrence would be handled separately).
 * @property {string} [notes] - Any notes for this day's availability (e.g., "Morning preferred", "Not available for new clients this day").
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when this availability entry was created.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when this availability entry was last updated.
 */

// This file is for schema definition using JSDoc. No functional class implementation is needed here.

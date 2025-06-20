/**
 * @typedef {Object} ClientContactInfo
 * @property {string} phone - Client's primary phone number.
 * @property {string} email - Client's primary email address.
 */

/**
 * @typedef {Object} EmergencyContact
 * @property {string} name - Full name of the emergency contact.
 * @property {string} relationship - Relationship to the client (e.g., Spouse, Sibling, Friend).
 * @property {string} phone - Phone number of the emergency contact.
 */

/**
 * @typedef {Object} ClientDocument
 * @property {string} clientId - Unique identifier for the client (usually the Firestore document ID).
 * @property {string} name - Full name of the client.
 * @property {string} address - Full residential address of the client.
 * @property {ClientContactInfo} contactInfo - Client's contact information.
 * @property {string[]} careNeeds - List of specific care needs or services required by the client (e.g., "Medication Reminders", "Meal Preparation", "Mobility Assistance").
 * @property {EmergencyContact[]} emergencyContacts - Array of emergency contacts for the client.
 * @property {Object} schedulePreferences - Object detailing preferred days, times, or caregiver characteristics. (e.g., { preferredDays: ["Monday", "Wednesday"], preferredTimeSlots: ["Morning", "Afternoon"], notes: "Prefers female caregiver" })
 * @property {boolean} isActive - Current status of the client (true for active, false for inactive).
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when the client record was created.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when the client record was last updated.
 * @property {string} [additionalNotes] - Any other relevant notes about the client.
 * @property {string} [managedBy] - ID of the care coordinator or staff member responsible for this client.
 * @property {string} [familyContactId] - Optional User ID for a family member who can access limited information.
 */

// This file is for schema definition using JSDoc. No functional class implementation is needed here.
// If these models were to have methods, then a class would be appropriate.

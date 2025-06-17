/**
 * @typedef {Object} ClientContactInfo
 * @property {string} phone
 * @property {string} email
 */

/**
 * @typedef {Object} EmergencyContact
 * @property {string} name
 * @property {string} relationship
 * @property {string} phone
 */

/**
 * @typedef {Object} ClientDocument
 * @property {string} clientId - Document ID (usually the auto-generated ID)
 * @property {string} name
 * @property {string} address
 * @property {ClientContactInfo} contactInfo
 * @property {string[]} careNeeds - e.g., ["medication reminder", "meal prep"]
 * @property {EmergencyContact[]} emergencyContacts
 * @property {Object} schedulePreferences - e.g., { preferredDays: ["Monday", "Wednesday"], preferredTimeOfDay: "morning" }
 * @property {boolean} isActive - Whether the client's profile is currently active
 * @property {firebase.firestore.Timestamp} createdAt
 * @property {firebase.firestore.Timestamp} updatedAt
 * @property {string} [additionalNotes]
 */

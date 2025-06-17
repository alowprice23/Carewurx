/**
 * @typedef {Object} UserDocument
 * @property {string} uid - User ID (typically from Firebase Authentication)
 * @property {string} email - User's email address
 * @property {string} displayName - User's display name
 * @property {string} role - e.g., "admin", "caregiver", "clientContact"
 * @property {boolean} isDisabled - Whether the user account is disabled
 * @property {firebase.firestore.Timestamp} createdAt
 * @property {firebase.firestore.Timestamp} updatedAt
 * @property {string} [photoURL] - URL to the user's profile picture
 * @property {string} [phoneNumber] - User's phone number
 */

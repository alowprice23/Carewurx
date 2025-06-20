/**
 * @typedef {Object} UserProfile
 * @property {string} [displayName] - User's preferred display name.
 * @property {string} [photoURL] - URL to the user's profile picture.
 * @property {string} [timezone] - User's preferred timezone (e.g., "America/New_York").
 */

/**
 * @typedef {Object} UserPreferences
 * @property {string} [language] - Preferred language for the UI (e.g., "en", "es").
 * @property {boolean} [receiveNotifications] - Whether the user wishes to receive notifications.
 * @property {string} [notificationChannel] - Preferred channel for notifications (e.g., "email", "sms", "in-app").
 */

/**
 * @typedef {Object} UserDocument
 * @property {string} uid - Unique identifier for the user (usually the Firebase Auth UID).
 * @property {string} email - User's email address (should match Firebase Auth email).
 * @property {boolean} emailVerified - Whether the user's email address has been verified.
 * @property {string} role - Role of the user within the system (e.g., "admin", "caregiver", "clientFamily").
 * @property {UserProfile} [profile] - Optional user profile information.
 * @property {UserPreferences} [preferences] - Optional user preferences.
 * @property {string[]} [assignedClientIds] - For caregivers or care coordinators, a list of client IDs they are associated with.
 * @property {string} [caregiverId] - If the user is a caregiver, this links to their caregiver-specific record in the 'caregivers' collection.
 * @property {boolean} isDisabled - Whether the user's account is disabled.
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when the user account was created.
 * @property {firebase.firestore.Timestamp} lastLoginAt - Timestamp of the user's last login.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when the user record was last updated.
 * @property {Object} [customClaims] - Custom claims set on the Firebase Auth token, mirrored here for easier querying if needed.
 */

// This file is for schema definition using JSDoc. No functional class implementation is needed here.

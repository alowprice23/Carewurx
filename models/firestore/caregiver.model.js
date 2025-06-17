/**
 * @typedef {Object} CaregiverContactInfo
 * @property {string} phone
 * @property {string} email
 */

/**
 * @typedef {Object} Certification
 * @property {string} name
 * @property {string} issuingOrganization
 * @property {Date} issueDate
 * @property {Date} [expiryDate]
 * @property {string} [credentialId]
 */

/**
 * @typedef {Object} AvailabilitySlot
 * @property {string} dayOfWeek - e.g., "Monday", "Tuesday"
 * @property {string} startTime - e.g., "09:00" (24-hour format)
 * @property {string} endTime - e.g., "17:00" (24-hour format)
 */

/**
 * @typedef {Object} AvailabilityDocument
 * @property {string} availabilityId - Document ID (usually the auto-generated ID or a specific format)
 * @property {string} caregiverId - ID of the caregiver this availability belongs to
 * @property {AvailabilitySlot[]} slots - Array of available time slots
 * @property {firebase.firestore.Timestamp} lastUpdated - When this availability was last updated
 */

/**
 * @typedef {Object} CaregiverDocument
 * @property {string} caregiverId - Document ID (can be the same as the user UID if caregiver is a user)
 * @property {string} userId - Link to the UserDocument (uid)
 * @property {string} name - Full name of the caregiver
 * @property {string} address
 * @property {CaregiverContactInfo} contactInfo
 * @property {Date} dateOfBirth
 * @property {string[]} skills - e.g., ["dementia care", "CPR certified"]
 * @property {Certification[]} certifications
 * @property {number} yearsOfExperience
 * @property {string[]} preferredClientGroups - e.g., ["elderly", "children with disabilities"]
 * @property {boolean} isActive - Whether the caregiver is currently available for assignments
 * @property {string} [profilePictureUrl]
 * @property {firebase.firestore.Timestamp} createdAt
 * @property {firebase.firestore.Timestamp} updatedAt
 * @property {string} [additionalNotes]
 * // Availability will be a subcollection, so it's not directly in the document.
 */

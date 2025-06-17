/**
 * @typedef {Object} ScheduleTime
 * @property {string} startTime - e.g., "09:00" (24-hour format)
 * @property {string} endTime - e.g., "17:00" (24-hour format)
 */

/**
 * @typedef {Object} RecurringInfo
 * @property {string} frequency - e.g., "daily", "weekly", "bi-weekly"
 * @property {string[]} [daysOfWeek] - e.g., ["Monday", "Wednesday", "Friday"] (if weekly/bi-weekly)
 * @property {Date} [endDate] - When the recurrence ends
 */

/**
 * @typedef {Object} ScheduleDocument
 * @property {string} scheduleId - Document ID
 * @property {string} clientId - ID of the client receiving care
 * @property {string} caregiverId - ID of the assigned caregiver
 * @property {Date} date - The specific date of the service, or start date for recurring services
 * @property {ScheduleTime} time - Start and end time for the service
 * @property {string[]} tasks - List of tasks to be performed
 * @property {string} status - e.g., "pending", "confirmed", "completed", "cancelled"
 * @property {boolean} [isRecurring] - Whether this is a recurring schedule
 * @property {RecurringInfo} [recurringInfo] - Details if it's a recurring schedule
 * @property {string} [notes] - Any specific notes for this schedule entry
 * @property {firebase.firestore.Timestamp} createdAt
 * @property {firebase.firestore.Timestamp} updatedAt
 * @property {string} [opportunityId] - If this schedule was created from an opportunity
 */

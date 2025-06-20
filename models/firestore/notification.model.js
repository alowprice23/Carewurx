/**
 * @typedef {Object} NotificationAction
 * @property {string} label - Text for the action button/link (e.g., "View Schedule", "Accept Opportunity").
 * @property {string} type - Type of action to perform (e.g., "navigate", "api_call").
 * @property {Object} payload - Data needed for the action (e.g., { path: "/schedules/123" } or { apiEndpoint: "/opportunities/456/accept" }).
 */

/**
 * @typedef {Object} NotificationSender
 * @property {string} [id] - User ID of the sender, if applicable (e.g., admin who sent a message). Could also be "system".
 * @property {string} name - Display name of the sender (e.g., "System Alert", "Admin Name").
 */

/**
 * @typedef {Object} NotificationDocument
 * @property {string} notificationId - Unique identifier for the notification (Firestore document ID).
 * @property {string} userId - ID of the user who should receive this notification.
 * @property {string} type - Type of notification (e.g., "new_opportunity", "schedule_update", "message", "system_alert", "reminder").
 * @property {string} title - The main title of the notification.
 * @property {string} message - The detailed message content of the notification.
 * @property {boolean} isRead - True if the user has read the notification, false otherwise.
 * @property {firebase.firestore.Timestamp} [readAt] - Timestamp when the notification was marked as read.
 * @property {string} [priority] - Priority of the notification (e.g., "low", "medium", "high", "urgent").
 * @property {NotificationSender} [sender] - Information about who sent the notification.
 * @property {Object} [metadata] - Any additional data related to the notification (e.g., { scheduleId: "123", opportunityId: "456" }).
 * @property {NotificationAction[]} [actions] - Possible actions the user can take directly from the notification.
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when the notification was created.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when the notification was last updated (e.g., when marked as read).
 * @property {firebase.firestore.Timestamp} [expiresAt] - Optional timestamp for when the notification should no longer be displayed or considered valid.
 */

// This file is for schema definition using JSDoc. No functional class implementation is needed here.

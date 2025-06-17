/**
 * @typedef {Object} NotificationDocument
 * @property {string} notificationId - Document ID
 * @property {string} userId - ID of the user this notification is for
 * @property {string} type - e.g., "new_opportunity", "schedule_update", "reminder", "system_alert"
 * @property {string} title - A short title for the notification
 * @property {string} message - The main content of the notification
 * @property {boolean} isRead - Whether the user has read the notification
 * @property {firebase.firestore.Timestamp} createdAt
 * @property {firebase.firestore.Timestamp} [readAt] - When the notification was marked as read
 * @property {Object} [relatedEntity] - Information about the entity this notification relates to
 * @property {string} [relatedEntity.id] - ID of the related entity (e.g., opportunityId, scheduleId)
 * @property {string} [relatedEntity.type] - Type of the related entity (e.g., "opportunity", "schedule")
 * @property {string} [ctaLink] - Call to action link (e.g., a link to view the opportunity)
 */

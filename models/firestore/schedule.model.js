/**
 * @typedef {Object} Location
 * @property {string} address - Full address of the service location.
 * @property {number} [latitude] - GPS latitude.
 * @property {number} [longitude] - GPS longitude.
 * @property {string} [notes] - Any specific instructions for the location (e.g., "Side door entry").
 */

/**
 * @typedef {Object} CheckInOutRecord
 * @property {firebase.firestore.Timestamp} time - Timestamp of check-in or check-out.
 * @property {string} [method] - Method of check-in/out (e.g., "gps", "manual", "qr_scan").
 * @property {Location} [location] - GPS location at check-in/out, if available.
 * @property {string} [userId] - User ID who performed the check-in/out (usually caregiver).
 * @property {string} [verifiedBy] - If manual, admin/staff ID who verified.
 */

/**
 * @typedef {Object} ScheduleDocument
 * @property {string} scheduleId - Unique identifier for the schedule entry (usually Firestore document ID).
 * @property {string} clientId - ID of the client receiving care.
 * @property {string} [clientName] - Denormalized client name for quick display.
 * @property {string} [caregiverId] - ID of the assigned caregiver.
 * @property {string} [caregiverName] - Denormalized caregiver name for quick display.
 * @property {firebase.firestore.Timestamp} startTime - Scheduled start time and date of the service.
 * @property {firebase.firestore.Timestamp} endTime - Scheduled end time and date of the service.
 * @property {string} status - Status of the schedule (e.g., "pending", "confirmed", "assigned", "in-progress", "completed", "cancelled", "missed_visit").
 * @property {string[]} tasks - List of tasks to be performed during the visit.
 * @property {Location} location - Location where the service is to be provided (usually client's home).
 * @property {string} [notesForCaregiver] - Specific notes for the caregiver regarding this visit.
 * @property {string} [notesForClient] - Notes for the client or family regarding this visit.
 * @property {boolean} [isRecurring] - True if this schedule is part of a recurring series.
 * @property {string} [recurrenceRule] - If isRecurring, specifies the rule (e.g., RRULE string or a custom format like "weekly_on_mondays_and_wednesdays_at_10am").
 * @property {string} [originalScheduleId] - If part of a recurring series that was modified, this links to the original template or first instance.
 * @property {firebase.firestore.Timestamp} [actualStartTime] - Actual check-in time by caregiver.
 * @property {firebase.firestore.Timestamp} [actualEndTime] - Actual check-out time by caregiver.
 * @property {CheckInOutRecord[]} [checkIns] - Record of check-ins (could be multiple if system allows re-check-in).
 * @property {CheckInOutRecord[]} [checkOuts] - Record of check-outs.
 * @property {string} [cancellationReason] - Reason if the schedule was cancelled.
 * @property {string} [cancelledBy] - User ID or role (e.g. "client", "caregiver", "admin") who cancelled.
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when the schedule was created.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when the schedule was last updated.
 * @property {string} [createdBy] - User ID or role who created the schedule.
 * @property {string} [updatedBy] - User ID or role who last updated the schedule.
 * @property {number} [expectedDurationMinutes] - Calculated or specified duration of the visit.
 * @property {number} [actualDurationMinutes] - Calculated duration based on actual check-in/out.
 * @property {string} [relatedOpportunityId] - If this schedule was created from an opportunity.
 */

// This file is for schema definition using JSDoc. No functional class implementation is needed here.

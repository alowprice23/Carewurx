/**
 * @typedef {Object} UploadedFileRecord
 * @property {string} fileName - Original name of the uploaded file.
 * @property {string} storagePath - Path to the file in Firebase Storage or other storage.
 * @property {string} fileType - MIME type of the file (e.g., "text/csv", "application/json").
 * @property {number} fileSize - Size of the file in bytes.
 */

/**
 * @typedef {Object} ProcessedItemDetail
 * @property {string} itemId - Identifier of the item within the batch (e.g., row number, an ID from the data).
 * @property {string} status - Status of processing for this item (e.g., "success", "error", "skipped").
 * @property {string} [message] - Any message related to this item's processing (e.g., error details, reason for skipping).
 * @property {string} [documentId] - If a Firestore document was created/updated, its ID.
 */

/**
 * @typedef {Object} BatchUploadDocument
 * @property {string} batchId - Unique identifier for the batch upload job (Firestore document ID).
 * @property {string} uploadedByUserId - User ID of the person who initiated the batch upload.
 * @property {firebase.firestore.Timestamp} uploadTimestamp - When the batch file was uploaded.
 * @property {UploadedFileRecord} originalFile - Details of the originally uploaded file.
 * @property {string} entityType - The type of data being imported (e.g., "clients", "caregivers", "schedules").
 * @property {string} status - Overall status of the batch job (e.g., "pending", "processing", "completed", "failed", "partially_completed").
 * @property {number} totalItems - Total number of items detected in the batch.
 * @property {number} processedItems - Number of items processed so far.
 * @property {number} successfulItems - Number of items that were successfully processed.
 * @property {number} failedItems - Number of items that failed processing.
 * @property {firebase.firestore.Timestamp} [processingStartTime] - When processing of the batch began.
 * @property {firebase.firestore.Timestamp} [processingEndTime] - When processing of the batch concluded.
 * @property {string} [errorLogPath] - Path to a more detailed error log file if many errors occurred.
 * @property {ProcessedItemDetail[]} [itemDetails] - Optional: Array containing details for each processed item (might be too large for a single document if batches are huge; consider a subcollection or separate logs if so). For now, including it for smaller batches.
 * @property {Object} [summary] - A summary of the batch operation (e.g., { clientsAdded: 10, clientsUpdated: 5 }).
 * @property {firebase.firestore.Timestamp} createdAt - Timestamp of when the batch record was created.
 * @property {firebase.firestore.Timestamp} updatedAt - Timestamp of when the batch record was last updated.
 */

// This file is for schema definition using JSDoc. No functional class implementation is needed here.

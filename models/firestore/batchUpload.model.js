/**
 * @typedef {Object} ProcessedItem
 * @property {string} itemId - Identifier for the item within the batch (e.g., row number, or an ID from the source data)
 * @property {string} status - "success", "error"
 * @property {string} [errorDetails] - Message if processing failed for this item
 * @property {string} [documentId] - Firestore document ID if successfully created/updated
 */

/**
 * @typedef {Object} BatchUploadDocument
 * @property {string} batchId - Document ID
 * @property {string} uploadedByUserId - UID of the user who initiated the upload
 * @property {firebase.firestore.Timestamp} uploadTimestamp - When the batch was uploaded
 * @property {string} originalFileName - Name of the uploaded file
 * @property {string} fileType - e.g., "client_csv", "caregiver_json" (indicates the type of data and expected processing)
 * @property {string} status - "pending", "processing", "completed", "failed"
 * @property {number} totalItems - Total number of items in the batch
 * @property {number} processedItemsCount - Number of items processed so far
 * @property {number} successCount - Number of items successfully processed
 * @property {number} errorCount - Number of items that failed to process
 * @property {string} [storagePath] - Path to the uploaded file in Cloud Storage (if applicable)
 * @property {ProcessedItem[]} [processingResults] - Array containing results for each item (might be too large for a single document if many items, consider a subcollection or separate logging for very large batches)
 * @property {string} [errorLog] - General error message if the batch processing itself failed (e.g., couldn't read file)
 * @property {firebase.firestore.Timestamp} [completedTimestamp] - When processing was completed or definitively failed
 */

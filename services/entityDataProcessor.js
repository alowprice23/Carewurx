// This service is responsible for taking structured entity data
// (e.g., from LLMDocumentProcessor) and persisting it to Firestore.

class EntityDataProcessor {
  /**
   * @param {Object} firebaseServiceInstance - An instance of the admin FirebaseService.
   */
  constructor(firebaseServiceInstance) {
    if (!firebaseServiceInstance) {
      throw new Error('FirebaseService instance is required for EntityDataProcessor.');
    }
    this.firebaseService = firebaseServiceInstance;
  }

  /**
   * Maps an entity type string to its corresponding Firestore collection name.
   * @param {string} entityType - The type of entity (e.g., "client", "caregiver", "schedule").
   * @returns {string} The Firestore collection name.
   * @throws {Error} If the entityType is unknown.
   * @private
   */
  _getCollectionName(entityType) {
    const type = entityType.toLowerCase();
    switch (type) {
      case 'client':
        return 'clients';
      case 'caregiver':
        return 'caregivers';
      case 'schedule':
        return 'schedules';
      // Add other entity types and their collection names as needed
      default:
        throw new Error(`Unknown entity type: "${entityType}"`);
    }
  }

  /**
   * Processes an array of structured entity objects and persists them to Firestore.
   * It either adds new documents or updates existing ones based on the presence of an 'id' field.
   *
   * @param {Array<Object>} entities - An array of entity objects to process.
   * @param {string} entityType - The type of entities being processed (e.g., "client", "caregiver").
   * @returns {Promise<Object>} A promise that resolves to an object containing counts and errors:
   *                            { addedCount, updatedCount, failedCount, errors: [{ entityData, errorMessage }] }.
   */
  async processEntities(entities, entityType) {
    if (!Array.isArray(entities)) {
      console.error('EntityDataProcessor: "entities" argument must be an array.');
      // Or throw new Error('"entities" argument must be an array.');
      return { addedCount: 0, updatedCount: 0, failedCount: 0, errors: [{ entityData: null, errorMessage: '"entities" argument must be an array.' }] };
    }
    if (!entities.length) {
        return { addedCount: 0, updatedCount: 0, failedCount: 0, errors: [] };
    }

    let collectionName;
    try {
      collectionName = this._getCollectionName(entityType);
    } catch (error) {
      console.error(`EntityDataProcessor: ${error.message}`);
      // Fail all entities if the type is wrong, as we don't know where to save them.
      return {
        addedCount: 0,
        updatedCount: 0,
        failedCount: entities.length,
        errors: entities.map(entity => ({ entityData: entity, errorMessage: error.message })),
      };
    }

    let addedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const entity of entities) {
      if (!entity || typeof entity !== 'object') {
        console.warn('EntityDataProcessor: Encountered invalid entity object. Skipping.', entity);
        failedCount++;
        errors.push({ entityData: entity, errorMessage: 'Invalid entity object encountered.' });
        continue;
      }

      try {
        const entityId = entity.id; // Assume ID might be part of the entity data.

        if (entityId) {
          // If an ID is present, try to get the document to see if it exists.
          // Note: firebaseService.getDocument might return null if not found, or throw. Assuming it returns null.
          const existingDoc = await this.firebaseService.getDocument(collectionName, entityId);

          if (existingDoc) {
            // Document exists, update it.
            // Ensure 'id' is not part of the data payload sent for update if firebaseService handles it separately.
            const updateData = { ...entity };
            delete updateData.id; // Firestore update should not contain the ID in the data payload itself.

            await this.firebaseService.updateDocument(collectionName, entityId, updateData);
            updatedCount++;
          } else {
            // Document with this ID does not exist, so we'll add it, respecting the provided ID.
            // This requires addDocument to support saving with a specific ID.
            // If firebaseService.addDocument always generates an ID, this logic needs adjustment
            // or a different method like `setDocument(collection, id, data)`.
            // For now, assuming addDocument can take data that includes an ID to be used,
            // or that we'd use a setDocument method if available.
            // Let's assume firebaseService.addDocument is for new docs with auto-generated IDs,
            // and we need a way to create a document with a *specific* ID if one was provided but doc didn't exist.
            // This is a common pattern for data import/sync.
            // If firebaseService.addDocument is strictly for auto-ID, this is an "add" but with a known ID.
            // Re-evaluating based on typical Firestore patterns: use setDocument for known IDs.
            // If firebaseService doesn't have setDocument, this part of logic might be flawed.
            // Let's assume an `addDocumentWithId` or `setDocument` exists or that `addDocument` can handle it.
            // For the sake of this implementation, let's assume we simply add it, and if an ID collision happens,
            // it's an issue for the specific firebaseService implementation or data cleanliness.
            // A safer 'add' if ID is from external source but doc not found: treat as new, let Firestore make ID.
            // This means we ignore `entity.id` if the doc isn't found by that `id`.
            // The task says "add the entity as a new document", implying Firestore generates the ID.

            const addData = { ...entity };
            delete addData.id; // Let Firestore generate ID for truly new records.
                               // If the intent was to use the provided ID for a new doc, setDoc would be better.
                               // For now, this means if an ID is provided but doc not found, we create a *new* record with a *new* ID.

            await this.firebaseService.addDocument(collectionName, addData);
            addedCount++; // This is a new document, regardless of input ID not found.
          }
        } else {
          // No ID provided, add as a new document.
          await this.firebaseService.addDocument(collectionName, entity);
          addedCount++;
        }
      } catch (error) {
        console.error(`EntityDataProcessor: Error processing entity in collection "${collectionName}":`, entity, error);
        failedCount++;
        errors.push({ entityData: entity, errorMessage: error.message });
      }
    }

    return { addedCount, updatedCount, failedCount, errors };
  }
}

module.exports = EntityDataProcessor;

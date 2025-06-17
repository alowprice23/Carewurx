const fs = require('fs').promises; // Use promises API for async file reading
const path = require('path');

class LLMDocumentProcessor {
  constructor(llmServiceInstance) {
    if (!llmServiceInstance) {
      throw new Error('LLMService instance is required for LLMDocumentProcessor.');
    }
    this.llmService = llmServiceInstance;
    this.schemaCache = new Map(); // Cache for loaded schemas
  }

  /**
   * Loads a JSON schema for a given entity type.
   * Schemas are cached after first load.
   * @param {string} entityType - The type of entity (e.g., "client", "caregiver").
   * @returns {Promise<Object>} The JSON schema object.
   * @throws {Error} If the schema file is not found or cannot be parsed.
   * @private
   */
  async _loadSchema(entityType) {
    if (this.schemaCache.has(entityType)) {
      return this.schemaCache.get(entityType);
    }

    const schemaFileName = `${entityType.toLowerCase()}.schema.json`;
    // Assuming this service file is in 'services/' and schemas in 'models/firestore/'
    const schemaPath = path.join(__dirname, '../models/firestore', schemaFileName);

    try {
      const schemaString = await fs.readFile(schemaPath, 'utf8');
      const schema = JSON.parse(schemaString);
      this.schemaCache.set(entityType, schema);
      return schema;
    } catch (error) {
      console.error(`Error loading schema for entity type "${entityType}" from ${schemaPath}:`, error);
      throw new Error(`Schema not found or invalid for entity type "${entityType}". Details: ${error.message}`);
    }
  }

  /**
   * Processes document content (either structured from Excel or raw text from PDF/Word)
   * using an LLM to ensure data conforms to a specified entity schema.
   *
   * @param {Array<Object> | { text: string }} documentContent - The content to process.
   *        - Array<Object>: Data from sources like Excel, already somewhat structured.
   *        - { text: string }: Raw text content from sources like PDF or Word.
   * @param {string} entityType - The type of entity to process (e.g., "client", "caregiver", "schedule").
   *                               This determines which JSON schema to use.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of processed entity objects.
   *                                   Returns an empty array if processing fails or yields no valid entities.
   * @throws {Error} If schema loading fails or critical LLM processing errors occur.
   */
  async processDocument(documentContent, entityType) {
    if (!documentContent || !entityType) {
      console.error('LLMDocumentProcessor: Document content and entity type are required.');
      return []; // Or throw new Error('Document content and entity type are required.');
    }

    const schema = await this._loadSchema(entityType); // Can throw if schema not found

    if (Array.isArray(documentContent)) { // Structured data (e.g., from Excel)
      console.log(`LLMDocumentProcessor: Normalizing ${documentContent.length} structured entries for type "${entityType}".`);
      try {
        // Use LLM to normalize/validate each record against the schema
        // This assumes llmService.normalizeData can handle an array of objects.
        // If it handles one by one, we would loop.
        // For now, let's assume it can take an array or we adapt.
        // A simpler approach for Excel data might be to just validate it here if LLM normalization is too slow/costly
        // and only use LLM for text extraction.
        // However, the task asks to potentially use normalizeData.

        // Simulating one-by-one normalization for now as it's a common pattern.
        const processedEntities = [];
        for (const record of documentContent) {
          // Adapt to use generateStructuredResponse for normalization/validation of single records
          const normalizePrompt = `
            You are a data validation and normalization expert.
            The following JSON object is intended to represent an entity of type "${entityType}".
            Please validate it against the provided JSON schema.
            If it's valid, return the JSON object, potentially correcting minor formatting issues (e.g., date formats, trimming whitespace) to conform to the schema.
            If it's invalid or cannot be reasonably conformed, return null.
            Do not include any explanations or conversational text. Only return the JSON object or null.

            JSON Schema:
            ${JSON.stringify(schema, null, 2)}

            JSON Object to normalize/validate:
            ---
            ${JSON.stringify(record, null, 2)}
            ---
            Result (JSON object or null):
          `;
          // generateStructuredResponse should ideally return a single object or null for this kind of prompt.
          // The current implementation of processDocument expects an array from generateStructuredResponse when processing raw text.
          // This needs careful handling of what generateStructuredResponse returns.
          // For now, let's assume it can return a single object if the prompt implies one, or we adapt the service.
          // Let's assume generateStructuredResponse returns the object directly, not an array containing one object.
          const llmCallResult = await this.llmService.generateStructuredResponse(normalizePrompt);

          // Check if llmCallResult is the actual object or needs parsing (if it's a string)
          let normalizedRecord = null;
          if (typeof llmCallResult === 'string') {
            try {
              normalizedRecord = JSON.parse(llmCallResult);
            } catch (e) {
              console.warn(`LLMDocumentProcessor: Failed to parse normalization response for record:`, record, e);
            }
          } else if (typeof llmCallResult === 'object' && llmCallResult !== null) {
            normalizedRecord = llmCallResult;
          }

          if (normalizedRecord) { // Check if it's not null and is an object
            processedEntities.push(normalizedRecord);
          } else {
            console.warn(`LLMDocumentProcessor: Record failed normalization or LLM returned null/invalid:`, record);
          }
        }
        return processedEntities;
      } catch (error) {
        console.error(`LLMDocumentProcessor: Error normalizing structured data for type "${entityType}":`, error);
        // Depending on desired behavior, could return partial results or throw
        throw new Error(`Failed to normalize structured data for ${entityType}. ${error.message}`);
      }
    } else if (documentContent && typeof documentContent.text === 'string') { // Raw text data (e.g., from PDF/Word)
      console.log(`LLMDocumentProcessor: Processing raw text for type "${entityType}".`);
      const rawText = documentContent.text;
      if (!rawText.trim()) {
        console.log('LLMDocumentProcessor: Raw text is empty, returning no entities.');
        return [];
      }

      // Construct a generic prompt for the LLM
      const prompt = `
        You are an expert data extraction assistant.
        Extract all pieces of information for entities of type "${entityType}" from the following text.
        The output must be an array of JSON objects. Each object in the array must strictly conform to the provided JSON schema.
        If multiple distinct entities are found, return them as separate objects in the array.
        If no relevant information for any entity is found, return an empty array [].
        Do not include any explanations or conversational text outside of the JSON array.

        JSON Schema:
        ${JSON.stringify(schema, null, 2)}

        Text for extraction:
        ---
        ${rawText}
        ---
        Extracted JSON array:
      `;

      try {
        const structuredResponse = await this.llmService.generateStructuredResponse(
          prompt, // The full prompt including text and schema instruction
          // Some LLM services might take schema separately for structured output.
          // Adjusting based on a hypothetical llmService.generateStructuredResponse signature:
          // generateStructuredResponse(textToProcess, instructions, outputSchema)
          // For now, embedding schema in prompt.
        );

        // generateStructuredResponse is expected to return an array of objects
        // or handle parsing of the LLM's string response into an array.
        if (!Array.isArray(structuredResponse)) {
            console.warn('LLMDocumentProcessor: LLM did not return an array. Attempting to parse if it is a string.');
            // This part depends heavily on how llmService.generateStructuredResponse actually works.
            // If it returns a string, we might need to parse it.
            // For robustness, this parsing should be within llmService or handled carefully.
            // Assuming it's meant to return an array directly or null/undefined on failure.
            if (typeof structuredResponse === 'string') {
                try {
                    const parsed = JSON.parse(structuredResponse);
                    if (Array.isArray(parsed)) return parsed;
                    console.error('LLMDocumentProcessor: Parsed LLM response is not an array.');
                    return [];
                } catch (parseError) {
                    console.error('LLMDocumentProcessor: Failed to parse string response from LLM:', parseError, structuredResponse);
                    return [];
                }
            }
            console.error('LLMDocumentProcessor: LLM response was not an array or a parsable JSON string array.');
            return [];
        }
        return structuredResponse; // Expected to be an array of entity objects
      } catch (error) {
        console.error(`LLMDocumentProcessor: Error generating structured response from LLM for type "${entityType}":`, error);
        throw new Error(`LLM processing failed for ${entityType}. ${error.message}`);
      }
    } else {
      console.warn('LLMDocumentProcessor: Invalid document content format. Expected Array or { text: string }.');
      return [];
    }
  }
}

module.exports = LLMDocumentProcessor;

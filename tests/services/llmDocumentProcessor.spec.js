const LLMDocumentProcessor = require('../../services/llmDocumentProcessor');
const fs = require('fs').promises;

// Mock LLMService
const mockLLMService = {
  normalizeData: jest.fn(),
  generateStructuredResponse: jest.fn(),
};

// Mock fs.readFile
jest.mock('fs', () => ({
    promises: {
      readFile: jest.fn(),
    },
    // Keep other fs methods like existsSync if needed by other modules, though not directly by llmDocumentProcessor
    // For this test, only readFile is critical for schema loading.
    existsSync: jest.fn(() => true), // Assume files exist unless specified by a test
}));


describe('LLMDocumentProcessor', () => {
  let processor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new LLMDocumentProcessor(mockLLMService);
    // Clear schema cache in processor for each test
    processor.schemaCache.clear();
  });

  const mockClientSchema = {
    type: 'object',
    properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' } },
    required: ['name', 'email'],
  };
  const mockCaregiverSchema = {
    type: 'object',
    properties: { name: { type: 'string' }, phone: { type: 'string' } },
    required: ['name'],
  };

  // --- Schema Loading Tests ---
  describe('_loadSchema', () => {
    it('should load and parse a JSON schema successfully', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockClientSchema));
      const schema = await processor._loadSchema('client');
      expect(schema).toEqual(mockClientSchema);
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('client.schema.json'), 'utf8');
    });

    it('should use cached schema on subsequent calls', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockClientSchema));
      await processor._loadSchema('client'); // First call
      const schema = await processor._loadSchema('client'); // Second call
      expect(schema).toEqual(mockClientSchema);
      expect(fs.readFile).toHaveBeenCalledTimes(1); // readFile only called once
    });

    it('should throw if schema file is not found', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      await expect(processor._loadSchema('nonexistent')).rejects.toThrow('Schema not found or invalid');
    });

    it('should throw if schema content is invalid JSON', async () => {
      fs.readFile.mockResolvedValue('this is not json');
      await expect(processor._loadSchema('invalidjson')).rejects.toThrow('Schema not found or invalid');
    });
  });

  // --- processDocument Tests ---
  describe('processDocument', () => {
    it('should return empty array if documentContent or entityType is missing', async () => {
      expect(await processor.processDocument(null, 'client')).toEqual([]);
      expect(await processor.processDocument({ text: 'abc' }, null)).toEqual([]);
    });

    it('should throw if schema loading fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Schema load failed'));
      const excelData = [{ name: 'Test' }];
      await expect(processor.processDocument(excelData, 'client')).rejects.toThrow('Schema not found or invalid');
    });

    // Test with Excel-like structured input
    describe('with structured (Excel-like) data', () => {
      const excelData = [
        { Name: 'Client A', Email: 'a@example.com' },
        { Name: 'Client B', Email: 'b@example.com' },
      ];
      const entityType = 'client';

      beforeEach(() => {
        fs.readFile.mockResolvedValue(JSON.stringify(mockClientSchema));
      });

      it('should call llmService.normalizeData for each record', async () => {
        mockLLMService.normalizeData.mockImplementation(async (record, schema) => ({ ...record, normalized: true }));

        const result = await processor.processDocument(excelData, entityType);

        expect(mockLLMService.normalizeData).toHaveBeenCalledTimes(excelData.length);
        expect(mockLLMService.normalizeData).toHaveBeenCalledWith(excelData[0], mockClientSchema, entityType);
        expect(mockLLMService.normalizeData).toHaveBeenCalledWith(excelData[1], mockClientSchema, entityType);
        expect(result.length).toBe(excelData.length);
        expect(result[0]).toHaveProperty('normalized', true);
      });

      it('should filter out records that fail normalization (return null/undefined)', async () => {
        mockLLMService.normalizeData
          .mockResolvedValueOnce({ ...excelData[0], normalized: true }) // First record good
          .mockResolvedValueOnce(null); // Second record fails

        const result = await processor.processDocument(excelData, entityType);
        expect(result.length).toBe(1);
        expect(result[0].Name).toBe('Client A');
      });

      it('should throw if normalizeData throws an error', async () => {
        mockLLMService.normalizeData.mockRejectedValue(new Error('Normalization failed'));
        await expect(processor.processDocument(excelData, entityType))
            .rejects.toThrow('Failed to normalize structured data for client. Normalization failed');
      });
    });

    // Test with raw text (PDF/Word-like) input
    describe('with raw text (PDF/Word-like) data', () => {
      const textData = { text: 'Client Name: Caregiver C, Phone: 123-456-7890. Another person: Client D, Phone: 987-654-3210' };
      const entityType = 'caregiver'; // Use caregiver schema for this test
      const mockExtractedCaregivers = [
        { name: 'Caregiver C', phone: '123-456-7890', extracted: true },
        { name: 'Client D', phone: '987-654-3210', extracted: true }, // LLM might extract this if prompt is general
      ];

      beforeEach(() => {
        fs.readFile.mockResolvedValue(JSON.stringify(mockCaregiverSchema));
      });

      it('should call llmService.generateStructuredResponse with correct prompt and schema', async () => {
        mockLLMService.generateStructuredResponse.mockResolvedValue(mockExtractedCaregivers);

        const result = await processor.processDocument(textData, entityType);

        expect(mockLLMService.generateStructuredResponse).toHaveBeenCalledTimes(1);
        const calledPrompt = mockLLMService.generateStructuredResponse.mock.calls[0][0];
        expect(calledPrompt).toContain(`entities of type "${entityType}"`);
        expect(calledPrompt).toContain(JSON.stringify(mockCaregiverSchema, null, 2));
        expect(calledPrompt).toContain(textData.text);
        expect(result).toEqual(mockExtractedCaregivers);
      });

      it('should return empty array if raw text is empty or whitespace', async () => {
        const emptyTextData = { text: '   ' };
        const result = await processor.processDocument(emptyTextData, entityType);
        expect(result).toEqual([]);
        expect(mockLLMService.generateStructuredResponse).not.toHaveBeenCalled();
      });

      it('should throw if llmService.generateStructuredResponse fails', async () => {
        mockLLMService.generateStructuredResponse.mockRejectedValue(new Error('LLM generation error'));
        await expect(processor.processDocument(textData, entityType))
          .rejects.toThrow('LLM processing failed for caregiver. LLM generation error');
      });

      it('should handle stringified JSON array from LLM', async () => {
        const stringifiedResponse = JSON.stringify(mockExtractedCaregivers);
        mockLLMService.generateStructuredResponse.mockResolvedValue(stringifiedResponse);
        const result = await processor.processDocument(textData, entityType);
        expect(result).toEqual(mockExtractedCaregivers);
      });

      it('should return empty array if LLM returns non-array non-string', async () => {
        mockLLMService.generateStructuredResponse.mockResolvedValue({ not: 'an array' });
        const result = await processor.processDocument(textData, entityType);
        expect(result).toEqual([]);
      });

      it('should return empty array if LLM returns unparsable string', async () => {
        mockLLMService.generateStructuredResponse.mockResolvedValue("this is not json array");
        const result = await processor.processDocument(textData, entityType);
        expect(result).toEqual([]);
      });
    });

    it('should return empty array for invalid documentContent format', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockClientSchema));
      const invalidContent = { notTextProperty: "some value" };
      const result = await processor.processDocument(invalidContent, 'client');
      expect(result).toEqual([]);
    });
  });
});

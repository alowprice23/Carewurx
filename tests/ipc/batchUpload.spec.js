const path = require('path');
const fs = require('fs');

// Import services to be used (real ones, but their dependencies will be mocked)
const fileProcessors = require('../../services/fileProcessors');
const LLMDocumentProcessor = require('../../services/llmDocumentProcessor');
const EntityDataProcessor = require('../../services/entityDataProcessor');

// Mock LLMService (dependency for LLMDocumentProcessor)
const mockLLMServiceInstance = {
  generateStructuredResponse: jest.fn(),
};
jest.mock('../../agents/core/llm-service', () => {
  return jest.fn().mockImplementation(() => mockLLMServiceInstance);
});

// Mock FirebaseService (admin, dependency for EntityDataProcessor)
const mockFirebaseServiceInstance = {
  getDocument: jest.fn(),
  addDocument: jest.fn(),
  updateDocument: jest.fn(),
};
jest.mock('../../services/firebase', () => ({
  firebaseService: mockFirebaseServiceInstance,
}));

// Instantiate services with mocks
// Need to ensure llmService is instantiated for LLMDocumentProcessor if it's used internally for 'new LLMService()'
// My LLMDocumentProcessor takes an instance, so this is fine.
const llmDocumentProcessor = new LLMDocumentProcessor(mockLLMServiceInstance);
const entityDataProcessor = new EntityDataProcessor(mockFirebaseServiceInstance);

// The IPC Handler logic from main.js
const handleUploadBatchFile = async ({ filePath, entityType, fileType }) => {
  console.log(`[Test IPC] Received 'upload-batch-file': filePath=${filePath}, entityType=${entityType}, fileType=${fileType}`);
  try {
    let fileOutput;
    switch (fileType.toLowerCase()) {
      case 'excel':
        fileOutput = await fileProcessors.processExcelFile(filePath);
        break;
      case 'pdf':
        fileOutput = await fileProcessors.processPdfFile(filePath);
        break;
      case 'word':
        fileOutput = await fileProcessors.processWordFile(filePath);
        break;
      default:
        console.error(`[Test IPC] Unsupported file type: ${fileType}`);
        return { success: false, error: `Unsupported file type: ${fileType}` };
    }
    console.log(`[Test IPC] File processing output for ${fileType}:`, fileOutput);

    if (!fileOutput || (Array.isArray(fileOutput) && fileOutput.length === 0 && fileType.toLowerCase() !== 'excel') || (typeof fileOutput.text === 'string' && !fileOutput.text.trim() && fileType.toLowerCase() !== 'excel')) {
        if (fileType.toLowerCase() !== 'excel' || !Array.isArray(fileOutput)) {
             console.log('[Test IPC] No content extracted from file or file was empty.');
             return { success: true, addedCount: 0, updatedCount: 0, failedCount: 0, errors: [], message: "No content extracted from file or file was empty." };
        }
    }

    const llmData = await llmDocumentProcessor.processDocument(fileOutput, entityType);
    console.log(`[Test IPC] LLM processing output for ${entityType}:`, llmData);
     if (!llmData || llmData.length === 0) {
        console.log('[Test IPC] LLM processing yielded no data.');
        return { success: true, addedCount: 0, updatedCount: 0, failedCount: 0, errors: [], message: "LLM processing yielded no data to save." };
    }

    const result = await entityDataProcessor.processEntities(llmData, entityType);
    console.log(`[Test IPC] Entity processing result for ${entityType}:`, result);
    return { success: true, ...result };

  } catch (error) {
    console.error(`[Test IPC] Error during batch upload processing for ${entityType} - ${fileType}:`, error);
    return { success: false, error: error.message, details: error.stack };
  }
};

describe('Batch Upload IPC Handler Integration Tests (upload-batch-file)', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');
  const sampleExcelPath = path.join(fixturesDir, 'sample.xlsx');
  const samplePdfPath = path.join(fixturesDir, 'sample.pdf');
  const sampleDocxPath = path.join(fixturesDir, 'sample.docx');

  const mockClientSchema = { type: "object", properties: { name: { type: "string" }, email: { type: "string" } } };
  const mockCaregiverSchema = { type: "object", properties: { name: { type: "string" }, phone: { type: "string" } } };
  const mockScheduleSchema = { type: "object", properties: { clientId: { type: "string" }, date: { type: "string" } } };

  beforeAll(() => {
     jest.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath.endsWith('client.schema.json')) return JSON.stringify(mockClientSchema);
        if (filePath.endsWith('caregiver.schema.json')) return JSON.stringify(mockCaregiverSchema);
        if (filePath.endsWith('schedule.schema.json')) return JSON.stringify(mockScheduleSchema);
        // For actual file reads by fileProcessors, let them through if not schema
        const actualFs = jest.requireActual('fs').promises;
        return actualFs.readFile(filePath);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fs.readFile mock for schemas specifically for each test if needed, but general mock is above
     (fs.promises.readFile).mockImplementation(async (filePath) => {
        if (filePath.endsWith('client.schema.json')) return JSON.stringify(mockClientSchema);
        if (filePath.endsWith('caregiver.schema.json')) return JSON.stringify(mockCaregiverSchema);
        if (filePath.endsWith('schedule.schema.json')) return JSON.stringify(mockScheduleSchema);
        // Fallback to actual readFile for non-schema files (like fixtures)
        const actualFs = jest.requireActual('fs').promises;
        try {
            return await actualFs.readFile(filePath);
        } catch (e) {
            // This catch is important if a test expects a file to not exist for fileProcessors
            if (e.code === 'ENOENT') throw new Error(`File not found: ${filePath}`);
            throw e;
        }
    });
  });

  it('should process a valid Excel file for clients end-to-end', async () => {
    const entityType = 'client';
    const mockLLMOutput = [{ name: 'Excel Client 1', email: 'excel1@example.com', normalizedByLLM: true }];
    const mockEntityProcessorResult = { addedCount: 1, updatedCount: 0, failedCount: 0, errors: [] };

    mockLLMServiceInstance.generateStructuredResponse.mockResolvedValue(mockLLMOutput[0]); // For each row
    mockFirebaseServiceInstance.addDocument.mockResolvedValue({ id: 'newId', ...mockLLMOutput[0] });

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });

    expect(result.success).toBe(true);
    // sample.xlsx has 10 data rows. If LLM normalizes all successfully, 10 should be added.
    // The mockLLMOutput only has one item, and generateStructuredResponse is mocked to return that for *each* call.
    expect(result.addedCount).toBe(10);
    expect(mockLLMServiceInstance.generateStructuredResponse).toHaveBeenCalledTimes(10); // Called for each of 10 rows
    expect(mockFirebaseServiceInstance.addDocument).toHaveBeenCalledTimes(10);
  });

  it('should correctly handle PDF processing failure because sample.pdf is a text file', async () => {
    const entityType = 'caregiver';
    const result = await handleUploadBatchFile({ filePath: samplePdfPath, entityType, fileType: 'pdf' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to process PDF file.*Invalid PDF structure|PDFDocument: stream must have data/i);
    expect(mockLLMServiceInstance.generateStructuredResponse).not.toHaveBeenCalled();
    expect(mockFirebaseServiceInstance.addDocument).not.toHaveBeenCalled();
  });

  it('should return error if DOCX processing fails (mammoth expecting real docx)', async () => {
    const entityType = 'schedule';
    const result = await handleUploadBatchFile({ filePath: sampleDocxPath, entityType, fileType: 'word' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to process Word file');
  });

  it('should handle error if file processing fails (e.g., file not found)', async () => {
    // Mock fs.promises.readFile to throw ENOENT for the specific path
     (fs.promises.readFile).mockImplementation(async (filePath) => {
        if (filePath === 'nonexistent.xlsx') throw new Error('File not found: nonexistent.xlsx');
        // Default behavior for other files (like schemas)
        if (filePath.endsWith('client.schema.json')) return JSON.stringify(mockClientSchema);
        // ... other schemas
        const actualFs = jest.requireActual('fs').promises;
        return actualFs.readFile(filePath);
    });

    const result = await handleUploadBatchFile({ filePath: 'nonexistent.xlsx', entityType: 'client', fileType: 'excel' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found: nonexistent.xlsx');
  });

  it('should handle error if LLM processing fails during structured data normalization', async () => {
    const entityType = 'client';
    mockLLMServiceInstance.generateStructuredResponse.mockRejectedValue(new Error('LLM API Error for normalization'));

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('LLM API Error for normalization');
  });

  it('should handle error if entity processing (Firestore) fails', async () => {
    const entityType = 'client';
    const mockLLMOutputRow = { name: 'Client X', email: 'x@example.com', normalizedOrExtracted: true };
    mockLLMServiceInstance.generateStructuredResponse.mockResolvedValue(mockLLMOutputRow); // LLM part succeeds for all rows

    mockFirebaseServiceInstance.addDocument.mockRejectedValue(new Error('Firestore Error')); // Firestore part fails

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Firestore Error');
    expect(mockLLMServiceInstance.generateStructuredResponse.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle unsupported file type', async () => {
    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType: 'client', fileType: 'txt' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unsupported file type: txt');
  });

  it('should return gracefully with message if LLM yields no data (e.g. all rows fail normalization)', async () => {
    const entityType = 'client';
    mockLLMServiceInstance.generateStructuredResponse.mockResolvedValue(null); // All rows from Excel fail normalization

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });
    expect(result.success).toBe(true);
    expect(result.message).toBe("LLM processing yielded no data to save.");
    expect(result.addedCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });

  it('should return gracefully if file processing yields no usable content (e.g. empty PDF text)', async () => {
    const emptyTextPdf = path.join(fixturesDir, 'empty_text.pdf');
    // For this test, we need processPdfFile to succeed but return empty text
    // This requires a valid (even minimal) PDF structure that pdf-parse can read, but contains no text.
    // The current text fixture "   " will make pdf-parse fail.
    // Let's mock processPdfFile directly for this specific test case.
    const originalProcessPdfFile = fileProcessors.processPdfFile;
    fileProcessors.processPdfFile = jest.fn().mockResolvedValue({ text: "   " });

    const result = await handleUploadBatchFile({ filePath: emptyTextPdf, entityType: 'client', fileType: 'pdf' });

    expect(result.success).toBe(true);
    expect(result.message).toBe("LLM processing yielded no data to save.");
    expect(result.addedCount).toBe(0);

    fileProcessors.processPdfFile = originalProcessPdfFile; // Restore
  });
});

// Tests for stub progress/cancel handlers (copied from previous step, should be fine)
describe('Batch Upload Stub IPC Handlers', () => {
    const handleGetProgress = async (batchId) => {
        return { batchId, status: 'processing', progress: 50, message: 'Processing file (stub response).', recordsProcessed: 0, totalRecords: 0 };
    };
    const handleCancelUpload = async (batchId) => {
        return { success: true, batchId, message: 'Cancellation requested (stub response).' };
    };

    it('get-batch-upload-progress should return stubbed progress', async () => {
        const result = await handleGetProgress('batch123');
        expect(result.status).toBe('processing');
        expect(result.progress).toBe(50);
        expect(result.batchId).toBe('batch123');
    });

    it('cancel-batch-upload should return stubbed cancellation confirmation', async () => {
        const result = await handleCancelUpload('batch123');
        expect(result.success).toBe(true);
        expect(result.message).toContain('Cancellation requested');
        expect(result.batchId).toBe('batch123');
    });
});

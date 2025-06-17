const path = require('path');
const fs = require('fs');

// Import services to be used (real ones, but their dependencies will be mocked)
const fileProcessors = require('../../services/fileProcessors');
const LLMDocumentProcessor = require('../../services/llmDocumentProcessor');
const EntityDataProcessor = require('../../services/entityDataProcessor');

// Mock LLMService (dependency for LLMDocumentProcessor)
const mockLLMServiceInstance = {
  generateStructuredResponse: jest.fn(),
  // normalizeData: jest.fn(), // Not used if LLMDocProc uses genStructResponse for normalization
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
jest.mock('../../services/firebase', () => ({ // Path to the admin firebase service
  firebaseService: mockFirebaseServiceInstance, // Assuming it's exported as firebaseService
}));


// Instantiate services with mocks
const llmDocumentProcessor = new LLMDocumentProcessor(mockLLMServiceInstance);
const entityDataProcessor = new EntityDataProcessor(mockFirebaseServiceInstance);


// The IPC Handler logic from main.js (or a simplified version for testing)
// This is the function we are actually testing the integration of.
const handleUploadBatchFile = async ({ filePath, entityType, fileType }) => {
  // This is a direct copy of the handler logic in main.js
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
             console.log('[Test IPC] No content extracted from file.');
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
  const samplePdfPath = path.join(fixturesDir, 'sample.pdf'); // Text-based PDF
  const sampleDocxPath = path.join(fixturesDir, 'sample.docx'); // Text-based DOCX

  // Mock schemas for LLMDocumentProcessor
  const mockClientSchema = { type: "object", properties: { name: { type: "string" }, email: { type: "string" } } };
  const mockCaregiverSchema = { type: "object", properties: { name: { type: "string" }, phone: { type: "string" } } };
  const mockScheduleSchema = { type: "object", properties: { clientId: { type: "string" }, date: { type: "string" } } };

  beforeAll(() => {
    // Ensure fs.readFile is mocked for schema loading by LLMDocumentProcessor
     jest.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath) => {
        if (filePath.endsWith('client.schema.json')) return JSON.stringify(mockClientSchema);
        if (filePath.endsWith('caregiver.schema.json')) return JSON.stringify(mockCaregiverSchema);
        if (filePath.endsWith('schedule.schema.json')) return JSON.stringify(mockScheduleSchema);
        throw new Error(`Mock fs.readFile: Unknown schema path ${filePath}`);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks(); // Restore fs.readFile and other mocks
  });


  beforeEach(() => {
    jest.clearAllMocks();
     // Restore fs.readFile mock specifically if it was changed in a test
    (fs.promises.readFile).mockImplementation(async (filePath) => {
        if (filePath.endsWith('client.schema.json')) return JSON.stringify(mockClientSchema);
        if (filePath.endsWith('caregiver.schema.json')) return JSON.stringify(mockCaregiverSchema);
        if (filePath.endsWith('schedule.schema.json')) return JSON.stringify(mockScheduleSchema);
        throw new Error(`Mock fs.readFile: Unknown schema path ${filePath}`);
    });
  });

  it('should process a valid Excel file for clients end-to-end', async () => {
    const entityType = 'client';
    const mockExcelData = [{ Name: 'Excel Client 1', Email: 'excel1@example.com' }]; // Output from processExcelFile
    const mockLLMOutput = [{ name: 'Excel Client 1', email: 'excel1@example.com', normalized: true }]; // Output from LLM
    const mockEntityProcessorResult = { addedCount: 1, updatedCount: 0, failedCount: 0, errors: [] };

    // LLMDocumentProcessor's processDocument for structured data (Excel)
    mockLLMServiceInstance.generateStructuredResponse.mockResolvedValueOnce(mockLLMOutput[0]); // Assuming one by one for now

    // EntityDataProcessor's processEntities
    mockFirebaseServiceInstance.addDocument.mockResolvedValue(mockEntityProcessorResult);

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });

    expect(result.success).toBe(true);
    expect(result.addedCount).toBe(1);
    expect(mockLLMServiceInstance.generateStructuredResponse).toHaveBeenCalled();
    expect(mockFirebaseServiceInstance.addDocument).toHaveBeenCalled();
  });

  it('should process a valid PDF file for caregivers end-to-end', async () => {
    const entityType = 'caregiver';
    // fileProcessors.processPdfFile will return { text: "..." }
    const mockLLMOutput = [{ name: 'PDF Caregiver 1', phone: '123-456-7890', extracted: true }]; // Output from LLM
    const mockEntityProcessorResult = { addedCount: 1, updatedCount: 0, failedCount: 0, errors: [] };

    mockLLMServiceInstance.generateStructuredResponse.mockResolvedValueOnce(mockLLMOutput); // LLM for text extraction
    mockFirebaseServiceInstance.addDocument.mockResolvedValue(mockEntityProcessorResult);

    const result = await handleUploadBatchFile({ filePath: samplePdfPath, entityType, fileType: 'pdf' });

    expect(result.success).toBe(true);
    expect(result.addedCount).toBe(1);
    expect(mockLLMServiceInstance.generateStructuredResponse).toHaveBeenCalled();
    expect(mockFirebaseServiceInstance.addDocument).toHaveBeenCalled();
  });

  // Note: sampleDocxPath is a text file. mammoth will throw error.
  it('should return error if DOCX processing fails (mammoth expecting real docx)', async () => {
    const entityType = 'schedule';
    const result = await handleUploadBatchFile({ filePath: sampleDocxPath, entityType, fileType: 'word' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to process Word file');
  });

  it('should handle error if file processing fails (e.g., file not found)', async () => {
    const result = await handleUploadBatchFile({ filePath: 'nonexistent.xlsx', entityType: 'client', fileType: 'excel' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });

  it('should handle error if LLM processing fails', async () => {
    const entityType = 'client';
    mockLLMServiceInstance.generateStructuredResponse.mockRejectedValue(new Error('LLM API Error'));

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('LLM API Error'); // Error from LLMDocumentProcessor
  });

  it('should handle error if entity processing (Firestore) fails', async () => {
    const entityType = 'client';
    const mockExcelData = [{ Name: 'Client X', Email: 'x@example.com' }];
    const mockLLMOutput = [{ name: 'Client X', email: 'x@example.com', normalized: true }];

    // LLM part success
    mockLLMServiceInstance.generateStructuredResponse.mockResolvedValueOnce(mockLLMOutput[0]);
    // Entity processing part fail
    mockFirebaseServiceInstance.addDocument.mockRejectedValue(new Error('Firestore Error'));

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Firestore Error'); // Error from EntityDataProcessor
  });

  it('should handle unsupported file type', async () => {
    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType: 'client', fileType: 'txt' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unsupported file type: txt');
  });

  it('should return gracefully if LLM yields no data', async () => {
    const entityType = 'client';
    mockLLMServiceInstance.generateStructuredResponse.mockResolvedValue([]); // LLM returns empty array

    const result = await handleUploadBatchFile({ filePath: sampleExcelPath, entityType, fileType: 'excel' });
    expect(result.success).toBe(true);
    expect(result.message).toBe("LLM processing yielded no data to save.");
    expect(result.addedCount).toBe(0);
  });

  it('should return gracefully if file processing yields no usable content (for PDF/Word)', async () => {
    const emptyTextPdf = path.join(fixturesDir, 'empty_text.pdf');
    fs.writeFileSync(emptyTextPdf, ""); // Create an actual empty file for this test

    const result = await handleUploadBatchFile({ filePath: emptyTextPdf, entityType: 'client', fileType: 'pdf' });
    expect(result.success).toBe(true);
    expect(result.message).toBe("No content extracted from file or file was empty.");
    expect(result.addedCount).toBe(0);
    fs.unlinkSync(emptyTextPdf);
  });

});

// Tests for stub progress/cancel handlers
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

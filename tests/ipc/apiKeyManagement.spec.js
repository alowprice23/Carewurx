// --- LLMService Mock (Crucial for preventing Groq constructor error during main.js loading) ---
const mockLLMServiceInstance = {
  initialize: jest.fn().mockResolvedValue(undefined),
  // Add any other methods of LLMService that might be called by other services during main.js init
  // For example, if llmDocumentProcessor(llmService) in main.js calls llmService.someMethod() in its constructor
};
jest.mock('../../agents/core/llm-service', () => {
  return jest.fn().mockImplementation(() => mockLLMServiceInstance);
});
// --- End LLMService Mock ---

const { ipcMain, safeStorage } = require('electron');
// Import main.js to ensure handlers are registered with the mocked ipcMain
// We need to be careful about how main.js is structured and what it executes on require.
// For this test, we'll assume main.js can be required and its IPC setup will run.

// Mock Electron components
jest.mock('electron', () => ({
  app: {
    getAppPath: jest.fn(() => '/mock/app/path'),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    isReady: jest.fn(() => true),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      session: { webRequest: { onHeadersReceived: jest.fn() } },
      on: jest.fn(),
    },
    on: jest.fn(),
  })),
  ipcMain: {
    handle: jest.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn(),
  },
  session: {
    defaultSession: {
      webRequest: { onHeadersReceived: jest.fn() },
      setPermissionRequestHandler: jest.fn(),
    },
  },
  protocol: {
    registerFileProtocol: jest.fn(),
  },
}));

// Mock services used in main.js that are not directly part of this test's core focus
// but are initialized in main.js
jest.mock('../../services/firebase', () => ({
  firebaseService: {
    db: {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [], forEach: jest.fn() }),
    },
    initialize: jest.fn().mockResolvedValue(undefined),
    getAllClients: jest.fn().mockResolvedValue([]),
    getAllCaregivers: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-uid', email: 'test@example.com' }),
  }),
  credential: { cert: jest.fn(), applicationDefault: jest.fn() },
  initializeApp: jest.fn(),
  apps: [],
}));

// Set GROQ_API_KEY to prevent errors during LLMService initialization in main.js
process.env.GROQ_API_KEY = 'mock-test-api-key-for-main';

// Mock LLM SDKs that will be imported by main.js
const mockGroqModelsList = jest.fn().mockResolvedValue({ data: [{ id: 'llama3-70b-8192' }] });
jest.mock('groq-sdk', () => jest.fn(() => ({ models: { list: mockGroqModelsList } })));

const mockOpenAIModelsList = jest.fn().mockResolvedValue({ data: [{ id: 'gpt-4' }] });
jest.mock('openai', () => jest.fn(() => ({ models: { list: mockOpenAIModelsList } })));

// For Anthropic, the validation in main.js is just SDK initialization.
// We can mock the constructor or a simple method if one were called.
const mockAnthropicClient = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => mockAnthropicClient));


// Now, require main.js to register IPC handlers with our mocked ipcMain
require('../../main');

// Helper to directly get the handler function from the ipcMain.handle mock
const getIpcHandler = (channel) => {
  const call = ipcMain.handle.mock.calls.find(c => c[0] === channel);
  return call ? call[1] : null;
};

describe('API Key Management IPC Handlers', () => {
  let saveApiKeyHandler, getApiKeyStatusesHandler, deleteApiKeyHandler, validateApiKeyHandler, getApiUsageStatsHandler;
  const mockIdToken = 'mock-id-token';

  beforeAll(() => {
    saveApiKeyHandler = getIpcHandler('agent:saveApiKey');
    getApiKeyStatusesHandler = getIpcHandler('agent:getApiKeyStatuses');
    deleteApiKeyHandler = getIpcHandler('agent:deleteApiKey');
    validateApiKeyHandler = getIpcHandler('agent:validateApiKey');
    getApiUsageStatsHandler = getIpcHandler('agent:getApiUsageStats');

    // Ensure all handlers were found (basic check)
    if (!saveApiKeyHandler || !getApiKeyStatusesHandler || !deleteApiKeyHandler || !validateApiKeyHandler || !getApiUsageStatsHandler) {
      console.error('IPC Main handle calls:', ipcMain.handle.mock.calls.map(c => c[0]));
      throw new Error('One or more API key management IPC handlers were not registered by main.js. Check main.js IPC setup and jest mocks.');
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset in-memory stores in main.js by re-requiring it (a bit heavy, but simple for non-exported stores)
    // This is tricky. Ideally, main.js would export a reset function for these stores for testing.
    // For now, we assume they are reset or manage their state in a way that tests don't interfere badly.
    // Or, we can access them if main.js somehow exposes them (not ideal for encapsulation).
    // Given they are simple Maps, they will persist between tests in the same suite run unless reset.
    // The task uses global Maps in main.js: apiKeyStore, apiKeyStatusStore. We can't directly clear them here
    // without changing main.js. Tests will need to be mindful of this or we accept this limitation.
    // For now, tests will run sequentially and might build on previous state for apiKeyStore/apiKeyStatusStore.

    // Mock safeStorage behavior for each test
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    safeStorage.encryptString.mockImplementation(str => Buffer.from(str + '_encrypted', 'utf8'));
  });

  describe('agent:saveApiKey', () => {
    it('should save an encrypted API key if safeStorage is available', async () => {
      const result = await saveApiKeyHandler({}, { provider: 'groq', apiKey: 'test-groq-key', idToken: mockIdToken });
      expect(result.success).toBe(true);
      expect(result.message).toContain('saved securely');
      // We can't directly check apiKeyStore from here without exposing it from main.js
      // But we can infer from getApiKeyStatuses in a subsequent test.
    });

    it('should save an unencrypted API key if safeStorage is not available', async () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);
      const result = await saveApiKeyHandler({}, { provider: 'openai', apiKey: 'test-openai-key', idToken: mockIdToken });
      expect(result.success).toBe(true);
      expect(result.message).toContain('stored in memory for session (unencrypted)');
      expect(result.needsAcknowledgement).toBe(true);
    });

    it('should clear an API key if an empty key is provided', async () => {
      // First, save a key
      await saveApiKeyHandler({}, { provider: 'groq', apiKey: 'test-groq-key-to-delete', idToken: mockIdToken });
      // Then, clear it
      const result = await saveApiKeyHandler({}, { provider: 'groq', apiKey: '', idToken: mockIdToken });
      expect(result.success).toBe(true);
      expect(result.message).toContain('API key cleared');
    });
  });

  describe('agent:getApiKeyStatuses', () => {
    it('should return statuses, reflecting saved and cleared keys', async () => {
      // Clear initially for a clean state for this test (assuming sequential execution)
      await deleteApiKeyHandler({}, { provider: 'groq', idToken: mockIdToken });
      await deleteApiKeyHandler({}, { provider: 'openai', idToken: mockIdToken });
      await deleteApiKeyHandler({}, { provider: 'anthropic', idToken: mockIdToken });

      await saveApiKeyHandler({}, { provider: 'groq', apiKey: 'a-groq-key', idToken: mockIdToken });

      const statuses = await getApiKeyStatusesHandler({}, { idToken: mockIdToken });
      expect(statuses.groq.isSet).toBe(true);
      expect(statuses.groq.isValid).toBe(false); // Not validated yet
      expect(statuses.openai.isSet).toBe(false);
      expect(statuses.anthropic.isSet).toBe(false);
    });
  });

  describe('agent:deleteApiKey', () => {
    it('should delete an API key and update its status', async () => {
      await saveApiKeyHandler({}, { provider: 'openai', apiKey: 'key-to-be-deleted', idToken: mockIdToken });
      let statuses = await getApiKeyStatusesHandler({}, { idToken: mockIdToken });
      expect(statuses.openai.isSet).toBe(true);

      const result = await deleteApiKeyHandler({}, { provider: 'openai', idToken: mockIdToken });
      expect(result.success).toBe(true);

      statuses = await getApiKeyStatusesHandler({}, { idToken: mockIdToken });
      expect(statuses.openai.isSet).toBe(false);
    });
  });

  describe('agent:validateApiKey', () => {
    it('should validate a Groq API key successfully', async () => {
      mockGroqModelsList.mockResolvedValueOnce({ data: [] }); // Simulate successful API call
      const result = await validateApiKeyHandler({}, { provider: 'groq', apiKeyToValidate: 'valid-groq-key', idToken: mockIdToken });
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('Groq API key is valid');
      const statuses = await getApiKeyStatusesHandler({}, { idToken: mockIdToken });
      expect(statuses.groq.isValid).toBe(true);
      expect(statuses.groq.lastValidated).not.toBeNull();
    });

    it('should handle Groq API key validation failure', async () => {
      mockGroqModelsList.mockRejectedValueOnce(new Error('Invalid Groq Key'));
      const result = await validateApiKeyHandler({}, { provider: 'groq', apiKeyToValidate: 'invalid-groq-key', idToken: mockIdToken });
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('invalid');
      const statuses = await getApiKeyStatusesHandler({}, { idToken: mockIdToken });
      expect(statuses.groq.isValid).toBe(false);
    });

    it('should validate an OpenAI API key successfully', async () => {
      mockOpenAIModelsList.mockResolvedValueOnce({ data: [] });
      const result = await validateApiKeyHandler({}, { provider: 'openai', apiKeyToValidate: 'valid-openai-key', idToken: mockIdToken });
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('OpenAI API key is valid');
    });

    it('should simulate Anthropic API key validation successfully', async () => {
      // The mock for Anthropic constructor doesn't throw, so it's considered "valid" by main.js logic
      const result = await validateApiKeyHandler({}, { provider: 'anthropic', apiKeyToValidate: 'any-anthropic-key', idToken: mockIdToken });
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('Anthropic API key initialized (simulated validation)');
    });

    it('should return error for unsupported provider validation', async () => {
      const result = await validateApiKeyHandler({}, { provider: 'unsupported', apiKeyToValidate: 'some-key', idToken: mockIdToken });
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not implemented');
    });

    it('should return error if no API key is provided for validation', async () => {
      const result = await validateApiKeyHandler({}, { provider: 'groq', apiKeyToValidate: '', idToken: mockIdToken });
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('API key to validate was not provided');
    });
  });

  describe('agent:getApiUsageStats', () => {
    it('should return mock API usage stats', async () => {
      const result = await getApiUsageStatsHandler({}, { idToken: mockIdToken });
      expect(result).toHaveProperty('groq');
      expect(result).toHaveProperty('openai');
      expect(result).toHaveProperty('anthropic');
      expect(result.groq.requests).toBe(0);
    });
  });
});

// frontend/src/services/__tests__/agentService.spec.js
import agentService from '../agentService';
import firebase from '../firebase'; // To be mocked

// Mock firebase for auth
const mockGetIdToken = jest.fn().mockResolvedValue('test-id-token');
let mockCurrentUser = null;

jest.mock('../firebase', () => ({
  auth: () => ({
    currentUser: mockCurrentUser, // Dynamically set in tests
  }),
}));

// Mock window.electronAPI for all agent methods
const mockElectronAPIAgent = {
  processMessage: jest.fn(),
  startAgentConversation: jest.fn(),
  getAgentResponse: jest.fn(),
  scanForOpportunities: jest.fn(),
  getOpportunityDetails: jest.fn(),
  applyOpportunity: jest.fn(),
  rejectOpportunity: jest.fn(),
  getAgentInsights: jest.fn(),
  getAgentSuggestions: jest.fn(),
  // Add new API key management methods
  getApiKeyStatuses: jest.fn(),
  saveApiKey: jest.fn(),
  deleteApiKey: jest.fn(),
  validateApiKey: jest.fn(),
  getApiUsageStats: jest.fn(),
};

global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPIAgent, // Attach all agent mocks
  writable: true,
});

describe('AgentService', () => {
  const mockToken = 'test-id-token';
  let originalIsElectronAvailable;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
    mockGetIdToken.mockClear().mockResolvedValue('test-id-token');

    for (const key in mockElectronAPIAgent) {
      mockElectronAPIAgent[key].mockReset();
    }
    // Store original and then mock isElectronAvailable on the instance for each test as needed
    // This is because the service instance sets this in its constructor.
    originalIsElectronAvailable = agentService.isElectronAvailable;
  });

  afterEach(() => {
    agentService.isElectronAvailable = originalIsElectronAvailable; // Restore
  });

  // --- Protected Methods ---
  describe('startConversation', () => {
    const userId = 'user123';
    const agentName = 'Bruce';
    const initialMessage = 'Hello';

    it('should call electronAPI.startAgentConversation with idToken if in Electron and authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { uid: userId, getIdToken: mockGetIdToken };
      const mockResponse = { conversationId: 'conv1', initialResponse: 'Hi there' };
      mockElectronAPIAgent.startAgentConversation.mockResolvedValue(mockResponse);

      const result = await agentService.startConversation(userId, agentName, initialMessage);

      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIAgent.startAgentConversation).toHaveBeenCalledWith({
        idToken: mockToken,
        agentName,
        initialMessage,
        userId // Service passes this along
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error in Electron mode if not authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = null;

      await expect(agentService.startConversation(userId, agentName, initialMessage))
        .rejects.toThrow('Authentication required');
      expect(mockElectronAPIAgent.startAgentConversation).not.toHaveBeenCalled();
    });

    it('should use mock logic in browser mode', async () => {
      agentService.isElectronAvailable = false;
      const result = await agentService.startConversation(userId, agentName, initialMessage);
      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('initialResponse');
      expect(mockElectronAPIAgent.startAgentConversation).not.toHaveBeenCalled();
    });
  });

  describe('getResponse', () => {
    const conversationId = 'conv1';
    const message = 'Tell me more.';

    it('should call electronAPI.getAgentResponse with idToken if in Electron and authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockTextResponse = 'This is more.';
      mockElectronAPIAgent.getAgentResponse.mockResolvedValue(mockTextResponse);

      const result = await agentService.getResponse(conversationId, message);

      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIAgent.getAgentResponse).toHaveBeenCalledWith({
        idToken: mockToken,
        conversationId,
        message
      });
      expect(result).toEqual(mockTextResponse);
    });

    it('should throw error in Electron mode if not authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = null;

      await expect(agentService.getResponse(conversationId, message))
        .rejects.toThrow('Authentication required');
      expect(mockElectronAPIAgent.getAgentResponse).not.toHaveBeenCalled();
    });
  });

  describe('applyOpportunity', () => {
    const opportunityId = 'opp1';
    const options = { notes: 'I am available' };

    it('should call electronAPI.applyOpportunity with idToken if in Electron and authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockResponse = { success: true, message: 'Applied' };
      mockElectronAPIAgent.applyOpportunity.mockResolvedValue(mockResponse);

      const result = await agentService.applyOpportunity(opportunityId, options);

      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIAgent.applyOpportunity).toHaveBeenCalledWith({
        idToken: mockToken,
        opportunityId,
        options
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error in Electron mode if not authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = null;

      await expect(agentService.applyOpportunity(opportunityId, options))
        .rejects.toThrow('Authentication required');
      expect(mockElectronAPIAgent.applyOpportunity).not.toHaveBeenCalled();
    });
  });

  describe('rejectOpportunity', () => {
    const opportunityId = 'opp2';
    const reason = 'Not available';

    it('should call electronAPI.rejectOpportunity with idToken if in Electron and authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockResponse = { success: true, message: 'Rejected' };
      mockElectronAPIAgent.rejectOpportunity.mockResolvedValue(mockResponse);

      const result = await agentService.rejectOpportunity(opportunityId, reason);

      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIAgent.rejectOpportunity).toHaveBeenCalledWith({
        idToken: mockToken,
        opportunityId,
        reason
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error in Electron mode if not authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = null;

      await expect(agentService.rejectOpportunity(opportunityId, reason))
        .rejects.toThrow('Authentication required');
      expect(mockElectronAPIAgent.rejectOpportunity).not.toHaveBeenCalled();
    });
  });

  // --- Non-Protected Methods (Example) ---
  describe('scanForOpportunities (example of non-protected)', () => {
    it('should call electronAPI.scanForOpportunities in Electron mode (no auth check here)', async () => {
      agentService.isElectronAvailable = true;
      // No mockCurrentUser needed as this method is not (yet) protected in the service
      const mockResponse = [{ id: 'opp1' }];
      mockElectronAPIAgent.scanForOpportunities.mockResolvedValue(mockResponse);

      const result = await agentService.scanForOpportunities({});
      expect(mockElectronAPIAgent.scanForOpportunities).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResponse);
    });

    it('should use mock logic in browser mode', async () => {
      agentService.isElectronAvailable = false;
      const result = await agentService.scanForOpportunities({});
      expect(result).toEqual(expect.any(Array)); // Returns mock opportunities
      expect(mockElectronAPIAgent.scanForOpportunities).not.toHaveBeenCalled();
    });
  });

  // --- New API Key Management Method Tests ---

  describe('getApiKeyStatuses', () => {
    it('should call electronAPI.getApiKeyStatuses with idToken in Electron mode when authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockStatuses = { groq: { isSet: true, isValid: true, lastValidated: 'timestamp' }};
      mockElectronAPIAgent.getApiKeyStatuses.mockResolvedValue(mockStatuses);

      const result = await agentService.getApiKeyStatuses();
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
      expect(mockElectronAPIAgent.getApiKeyStatuses).toHaveBeenCalledWith({ idToken: mockToken });
      expect(result).toEqual(mockStatuses);
    });

    it('should throw auth error for getApiKeyStatuses in Electron mode if not authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = null;
      await expect(agentService.getApiKeyStatuses()).rejects.toThrow('Authentication required');
      expect(mockElectronAPIAgent.getApiKeyStatuses).not.toHaveBeenCalled();
    });

    it('should return mock statuses for getApiKeyStatuses in browser mode', async () => {
      agentService.isElectronAvailable = false;
      const result = await agentService.getApiKeyStatuses();
      expect(result).toEqual({
        groq: { isSet: false, isValid: false, lastValidated: null },
        openai: { isSet: false, isValid: false, lastValidated: null },
        anthropic: { isSet: false, isValid: false, lastValidated: null },
      });
      expect(mockElectronAPIAgent.getApiKeyStatuses).not.toHaveBeenCalled();
    });

    it('should throw error if electronAPI.getApiKeyStatuses call fails', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      mockElectronAPIAgent.getApiKeyStatuses.mockRejectedValueOnce(new Error('IPC Error'));
      await expect(agentService.getApiKeyStatuses()).rejects.toThrow('IPC Error');
    });
  });

  describe('saveApiKey', () => {
    const provider = 'groq';
    const apiKey = 'test-key';

    it('should call electronAPI.saveApiKey with params in Electron mode when authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      mockElectronAPIAgent.saveApiKey.mockResolvedValue({ success: true });

      const result = await agentService.saveApiKey(provider, apiKey);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
      expect(mockElectronAPIAgent.saveApiKey).toHaveBeenCalledWith({ provider, apiKey, idToken: mockToken });
      expect(result).toEqual({ success: true });
    });

    it('should return mock success for saveApiKey in browser mode', async () => {
      agentService.isElectronAvailable = false;
      const result = await agentService.saveApiKey(provider, apiKey);
      expect(result.success).toBe(true);
      expect(result.message).toContain('(mock)');
      expect(mockElectronAPIAgent.saveApiKey).not.toHaveBeenCalled();
    });
  });

  describe('deleteApiKey', () => {
    const provider = 'openai';

    it('should call electronAPI.deleteApiKey with params in Electron mode when authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      mockElectronAPIAgent.deleteApiKey.mockResolvedValue({ success: true });

      const result = await agentService.deleteApiKey(provider);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
      expect(mockElectronAPIAgent.deleteApiKey).toHaveBeenCalledWith({ provider, idToken: mockToken });
      expect(result).toEqual({ success: true });
    });

     it('should return mock success for deleteApiKey in browser mode', async () => {
      agentService.isElectronAvailable = false;
      const result = await agentService.deleteApiKey(provider);
      expect(result.success).toBe(true);
      expect(result.message).toContain('(mock)');
      expect(mockElectronAPIAgent.deleteApiKey).not.toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    const provider = 'anthropic';
    const apiKeyToValidate = 'validate-this-key';

    it('should call electronAPI.validateApiKey with params in Electron mode when authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      mockElectronAPIAgent.validateApiKey.mockResolvedValue({ isValid: true });

      const result = await agentService.validateApiKey(provider, apiKeyToValidate);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
      expect(mockElectronAPIAgent.validateApiKey).toHaveBeenCalledWith({ provider, apiKeyToValidate, idToken: mockToken });
      expect(result).toEqual({ isValid: true });
    });

    it('should return mock validation for validateApiKey in browser mode', async () => {
      agentService.isElectronAvailable = false;
      const result = await agentService.validateApiKey(provider, apiKeyToValidate);
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('(mock)');
      expect(mockElectronAPIAgent.validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe('getApiUsageStats', () => {
    it('should call electronAPI.getApiUsageStats with idToken in Electron mode when authenticated', async () => {
      agentService.isElectronAvailable = true;
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockStats = { groq: { requests: 10, tokens: 1000 }};
      mockElectronAPIAgent.getApiUsageStats.mockResolvedValue(mockStats);

      const result = await agentService.getApiUsageStats();
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
      expect(mockElectronAPIAgent.getApiUsageStats).toHaveBeenCalledWith({ idToken: mockToken });
      expect(result).toEqual(mockStats);
    });

    it('should return mock stats for getApiUsageStats in browser mode', async () => {
      agentService.isElectronAvailable = false;
      const result = await agentService.getApiUsageStats();
      expect(result).toHaveProperty('groq');
      expect(result.openai.requests).toBe(0);
      expect(mockElectronAPIAgent.getApiUsageStats).not.toHaveBeenCalled();
    });
  });
});

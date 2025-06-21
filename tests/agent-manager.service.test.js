// tests/agent-manager.service.test.js
const AgentManager = require('../agents/core/agent-manager');
const { firebaseService } = require('../services/firebase'); // Will be mocked

// Mock firebaseService
jest.mock('../services/firebase', () => ({
  firebaseService: {
    addDocument: jest.fn().mockResolvedValue({ id: 'new-opportunity-id' }),
    // Add any other methods from firebaseService that might be touched indirectly or during setup
    getClient: jest.fn().mockResolvedValue(null),
    getCaregiver: jest.fn().mockResolvedValue(null),
    getCaregiverAvailability: jest.fn().mockResolvedValue(null),
    getAllCaregivers: jest.fn().mockResolvedValue([]),
    getAllClients: jest.fn().mockResolvedValue([]),
    getSchedulesInDateRange: jest.fn().mockResolvedValue([]),
    db: { // if agentManager directly uses db, e.g. for unassignedSchedules query in scanForOpportunities
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [] }),
    }
  }
}));

// Mock LLMService to prevent actual API key reads or SDK instantiation
jest.mock('../agents/core/llm-service', () => {
  return jest.fn().mockImplementation(() => {
    return {
      // Mock methods of LLMService if AgentManager calls them during its own setup or globally
      generateChatResponse: jest.fn().mockResolvedValue("Mocked LLM response"),
      generateStructuredResponse: jest.fn().mockResolvedValue({}),
      processAgentResponse: jest.fn().mockResolvedValue({ text: "processed"}),
      analyzeOpportunity: jest.fn().mockResolvedValue({ recommendation: "mock"}),
    };
  });
});

// Mock Agent Models (Bruce, Lexxi)
jest.mock('../agents/models/bruce', () => {
  return jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn().mockResolvedValue("Bruce's response"),
    getConfidenceScore: jest.fn().mockReturnValue(0.5),
  }));
});
jest.mock('../agents/models/lexxi', () => {
  return jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn().mockResolvedValue("Lexxi's response"),
    getConfidenceScore: jest.fn().mockReturnValue(0.5),
  }));
});

// Mock Utility classes if their constructors do heavy work
jest.mock('../agents/utils/context-builder', () => {
  return jest.fn().mockImplementation(() => ({
    buildContext: jest.fn().mockResolvedValue({}),
  }));
});
jest.mock('../agents/utils/response-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue({ text: "parsed response", actions: [] }),
  }));
});

// Mock enhancedScheduler
jest.mock('../services/enhanced-scheduler', () => ({
    findAvailableCaregivers: jest.fn().mockResolvedValue([]),
    timeToMinutes: jest.fn(timeStr => {
        if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
        const parts = timeStr.split(':');
        if (parts.length !== 2) return null;
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        return hours * 60 + minutes;
    }),
    // Add other necessary mocks if called by AgentManager methods that might get triggered
}));

// Get the original implementation of AgentManager to extract identifyAndReportShortages
const originalAgentManager = jest.requireActual('../agents/core/agent-manager');

// Mock the AgentManager module itself
jest.mock('../agents/core/agent-manager', () => {
  // This mock factory is called when AgentManager is required.
  // We return a mock object that has all methods mocked by default,
  // except for the one we are testing (identifyAndReportShortages).
  const actualAgentManagerInstance = jest.requireActual('../agents/core/agent-manager');

  return {
    // Keep the actual identifyAndReportShortages method
    identifyAndReportShortages: actualAgentManagerInstance.identifyAndReportShortages,
    // Mock other methods to be lightweight or no-ops to prevent side-effects/timeouts
    initialize: jest.fn().mockImplementation(async function() { this.isInitialized = true; return Promise.resolve(); }),
    processMessage: jest.fn().mockResolvedValue({ text: 'mocked process message' }),
    determineAgent: jest.fn().mockReturnValue('bruce'),
    getOrCreateConversation: jest.fn().mockReturnValue({ history: [], currentAgent: 'bruce' }),
    updateConversation: jest.fn(),
    handleResponseActions: jest.fn().mockResolvedValue(undefined),
    handleInitiateScheduleOptimizationTask: jest.fn().mockResolvedValue({ success: true, status: 'mocked_initiated' }),
    handleScheduleCreate: jest.fn().mockResolvedValue({ id: 'mock-sch-create' }),
    handleScheduleUpdate: jest.fn().mockResolvedValue({ id: 'mock-sch-update' }),
    handleCaregiverAssign: jest.fn().mockResolvedValue({ success: true, schedule: { id: 'mock-assign' } }),
    scanForOpportunities: jest.fn().mockResolvedValue([]), // Crucial for this test file
    // Add mocks for any other methods on AgentManager that might be called or cause issues
    // Ensure all methods from the actual instance are either mocked here or intended to be real.
  };
});


// Now, when we require AgentManager, we get our controlled mock (with real identifyAndReportShortages)
const agentManagerInstance = require('../agents/core/agent-manager');

describe('AgentManager Service - Shortage Identification', () => {
  // No longer need agentManagerInstance from beforeEach for the singleton, as we get the mocked one.
  // let initializeSpy; // No longer needed due to module-level mock of initialize

  beforeEach(() => {
    firebaseService.addDocument.mockClear();
    // If other mocks need clearing specific to AgentManager's mocked methods:
    if (agentManagerInstance.initialize.mockClear) agentManagerInstance.initialize.mockClear();
    // ... and so on for other mocked methods if they track calls.
  });

  // afterEach(() => { // No longer needed for initializeSpy
  // });

  describe('identifyAndReportShortages', () => {
    const mockAllCaregivers = [ // Provide some caregiver data if the function logic evolves to use it
        {id: 'cg1', name: 'Caregiver Alpha', skills: ['skillA', 'skillB']},
        {id: 'cg2', name: 'Caregiver Beta', skills: ['skillC']},
    ];

    it('should return an empty array if no unmet shifts are provided', async () => {
      const shortages = await agentManagerInstance.identifyAndReportShortages([], mockAllCaregivers);
      expect(shortages).toEqual([]);
      expect(firebaseService.addDocument).not.toHaveBeenCalled();
    });

    it('should create a shortage alert opportunity for a single unmet shift', async () => {
      const unmetShifts = [
        {
          clientId: 'client1', clientName: 'Client One', date: '2024-07-20',
          startTime: '09:00', endTime: '12:00', requiredSkills: ['skillA'],
          location: { city: 'Northwood' }
        },
      ];
      const shortages = await agentManagerInstance.identifyAndReportShortages(unmetShifts, mockAllCaregivers);

      expect(shortages.length).toBe(1);
      expect(firebaseService.addDocument).toHaveBeenCalledTimes(1);

      const opportunityCall = firebaseService.addDocument.mock.calls[0][1];
      expect(opportunityCall.type).toBe('caregiver_shortage_alert');
      expect(opportunityCall.date).toBe('2024-07-20');
      expect(opportunityCall.required_skills).toEqual(['skillA']);
      expect(opportunityCall.number_of_shifts_affected).toBe(1);
      expect(opportunityCall.summary).toContain("Potential shortage of 1 shift(s) on 2024-07-20 requiring skills: skillA");
      expect(opportunityCall.affected_clients_sample[0].clientName).toBe('Client One');
    });

    it('should group multiple unmet shifts by date and skills', async () => {
      const unmetShifts = [
        { clientId: 'c1', clientName: 'C1', date: '2024-07-21', startTime: '10:00', endTime: '12:00', requiredSkills: ['skillX'] },
        { clientId: 'c2', clientName: 'C2', date: '2024-07-21', startTime: '14:00', endTime: '16:00', requiredSkills: ['skillX'] },
        { clientId: 'c3', clientName: 'C3', date: '2024-07-22', startTime: '09:00', endTime: '11:00', requiredSkills: ['skillY'] },
      ];
      const shortages = await agentManagerInstance.identifyAndReportShortages(unmetShifts, mockAllCaregivers);

      expect(shortages.length).toBe(2); // Two groups: 2024-07-21/skillX and 2024-07-22/skillY
      expect(firebaseService.addDocument).toHaveBeenCalledTimes(2);

      const opportunity1 = firebaseService.addDocument.mock.calls.find(call => call[1].date === '2024-07-21')[1];
      const opportunity2 = firebaseService.addDocument.mock.calls.find(call => call[1].date === '2024-07-22')[1];

      expect(opportunity1.number_of_shifts_affected).toBe(2);
      expect(opportunity1.required_skills).toEqual(['skillX']);
      expect(opportunity1.summary).toContain("2 shift(s) on 2024-07-21 requiring skills: skillX");

      expect(opportunity2.number_of_shifts_affected).toBe(1);
      expect(opportunity2.required_skills).toEqual(['skillY']);
      expect(opportunity2.summary).toContain("1 shift(s) on 2024-07-22 requiring skills: skillY");
    });

    it('should handle shifts with no specific required skills', async () => {
      const unmetShifts = [
        { clientId: 'c1', clientName: 'C1', date: '2024-07-23', startTime: '10:00', endTime: '12:00', requiredSkills: [] },
        { clientId: 'c2', clientName: 'C2', date: '2024-07-23', startTime: '13:00', endTime: '15:00' }, // Undefined requiredSkills
      ];
      const shortages = await agentManagerInstance.identifyAndReportShortages(unmetShifts, mockAllCaregivers);

      expect(shortages.length).toBe(1);
      expect(firebaseService.addDocument).toHaveBeenCalledTimes(1);

      const opportunity = firebaseService.addDocument.mock.calls[0][1];
      expect(opportunity.number_of_shifts_affected).toBe(2);
      expect(opportunity.required_skills).toEqual([]);
      expect(opportunity.summary).toContain("general care");
    });
  });
});

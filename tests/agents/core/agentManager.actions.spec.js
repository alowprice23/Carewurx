// tests/agents/core/agentManager.actions.spec.js

// --- Mock Dependencies ---
const mockCreateSchedule = jest.fn();
const mockUpdateSchedule = jest.fn();
const mockAssignCaregiverToSchedule = jest.fn();
const mockFindAvailableCaregivers = jest.fn().mockResolvedValue([]);

jest.mock('../../../services/enhanced-scheduler', () => {
  return jest.fn().mockImplementation(() => {
    return {
      createSchedule: mockCreateSchedule,
      updateSchedule: mockUpdateSchedule,
      assignCaregiverToSchedule: mockAssignCaregiverToSchedule,
      findAvailableCaregivers: mockFindAvailableCaregivers,
    };
  });
});

const mockFirebaseDbCollection = {
  where: jest.fn().mockReturnThis(), // Ensure 'where' returns 'this' for chaining
  get: jest.fn().mockResolvedValue({ docs: [] }), // Default to empty results
};
const mockFirebaseService = {
  db: {
    collection: jest.fn(() => mockFirebaseDbCollection),
  },
  initialize: jest.fn().mockResolvedValue(undefined),
  addDocument: jest.fn().mockResolvedValue({ id: 'new-opportunity-id' }),
  getDocument: jest.fn().mockResolvedValue(null), // Default to not found
  updateDocument: jest.fn().mockResolvedValue({ success: true }),
  getSchedule: jest.fn().mockResolvedValue(null),
  getClient: jest.fn().mockResolvedValue(null),
  getCaregiver: jest.fn().mockResolvedValue(null),
  getSchedulesByClientId: jest.fn().mockResolvedValue([]),
  getSchedulesByCaregiverId: jest.fn().mockResolvedValue([]),
  getCaregiverAvailability: jest.fn().mockResolvedValue({ regularSchedule: [], timeOff: [] }),
  getSchedulesInDateRange: jest.fn().mockResolvedValue([]),
};
jest.mock('../../../services/firebase', () => ({
  firebaseService: mockFirebaseService
}));

jest.mock('../../../agents/core/llm-service');
jest.mock('../../../agents/utils/context-builder');
jest.mock('../../../agents/utils/response-parser');
jest.mock('../../../agents/models/bruce');
jest.mock('../../../agents/models/lexxi');
jest.mock('fs');
const fs = require('fs'); // Import the mocked fs module

// --- End Mocks ---

const AgentManager = require('../../../agents/core/agent-manager');
const EnhancedScheduler = require('../../../services/enhanced-scheduler');

describe('AgentManager Action Handlers and Refactored Methods', () => {
  let agentManager;
  let consoleErrorSpy;
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeEach(async () => {
    jest.clearAllMocks();
    EnhancedScheduler.mockClear();
    mockCreateSchedule.mockClear().mockResolvedValue({ id: 'sched_mock_123', status: 'pending_confirmation' });
    mockUpdateSchedule.mockClear().mockResolvedValue({ id: 'sched-updated-id', status: 'confirmed', success: true });
    mockAssignCaregiverToSchedule.mockClear().mockResolvedValue({ success: true, scheduleId: 'sched-assigned-id' });
    mockFindAvailableCaregivers.mockClear().mockResolvedValue([]);

    // Reset firebaseService mocks that return values
    mockFirebaseService.getDocument.mockResolvedValue(null);
    mockFirebaseService.db.collection().where().get.mockResolvedValue({ docs: [] });


    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');
    process.env.GROQ_API_KEY = 'mock-env-api-key';

    agentManager = new AgentManager();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await agentManager.initialize();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  const userId = 'user-test-123';

  describe('Action Handlers', () => {
    describe('handleScheduleCreate', () => {
      const baseParams = {
        clientId: 'client-001',
        date: '2024-09-15',
        startTime: '09:00',
        endTime: '11:00',
        notes: 'Check blood pressure.',
        clientName: 'John Doe',
        tasks: ['task1', 'task2']
      };

      it('should create schedule if all required parameters are present', async () => {
        await agentManager.handleScheduleCreate(userId, baseParams);

        expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
        expect(mockCreateSchedule).toHaveBeenCalledWith(
          expect.objectContaining({
            ...baseParams,
            caregiverId: null,
            status: 'pending_confirmation',
            createdBy: userId,
          })
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'AgentManager: Calling enhancedScheduler.createSchedule for user user-test-123 with data:',
          expect.any(Object)
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          `AgentManager: Schedule creation action for user ${userId} processed by EnhancedScheduler. Result:`,
          expect.objectContaining({ id: 'sched_mock_123' })
        );
      });

      it('should use provided caregiverId and status if present', async () => {
        const paramsWithCaregiver = { ...baseParams, caregiverId: 'cg-007', status: 'Confirmed' };
        await agentManager.handleScheduleCreate(userId, paramsWithCaregiver);

        expect(mockCreateSchedule).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: paramsWithCaregiver.clientId,
            caregiverId: paramsWithCaregiver.caregiverId,
            date: paramsWithCaregiver.date,
            startTime: paramsWithCaregiver.startTime,
            endTime: paramsWithCaregiver.endTime,
            notes: paramsWithCaregiver.notes,
            clientName: paramsWithCaregiver.clientName,
            tasks: paramsWithCaregiver.tasks,
            status: 'Confirmed', // Explicitly check for 'Confirmed'
            createdBy: userId,
          })
        );
      });

      it('should log error and not call scheduler if required parameters (clientId) are missing', async () => {
        const { clientId, ...incompleteParams } = baseParams;
        await agentManager.handleScheduleCreate(userId, incompleteParams);

        expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required parameters for schedule creation:', incompleteParams);
        expect(mockCreateSchedule).not.toHaveBeenCalled();
      });

      it('should call initialize if services are not ready (simulated by clearing scheduler)', async () => {
        agentManager.enhancedScheduler = null;
        agentManager.isInitialized = false;

        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.enhancedScheduler = new EnhancedScheduler();
            this.firebaseService = mockFirebaseService;
            this.isInitialized = true;
        });

        await agentManager.handleScheduleCreate(userId, baseParams);

        expect(initializeSpy).toHaveBeenCalled();
        // Check the mock on the instance that would be created by initialize
        expect(EnhancedScheduler.mock.results[initializeSpy.mock.calls.length -1].value.createSchedule).toHaveBeenCalled();
        initializeSpy.mockRestore();
      });

      it('should log error if EnhancedScheduler.createSchedule call fails', async () => {
        const schedulerError = new Error('Scheduler failed to create');
        mockCreateSchedule.mockRejectedValue(schedulerError);

        await agentManager.handleScheduleCreate(userId, baseParams);

        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in AgentManager.handleScheduleCreate for user ${userId}:`, schedulerError);
      });
    });

    describe('handleScheduleUpdate', () => {
      const scheduleId = 'sched-001';
      const baseUpdatePayload = {
        startTime: '10:00',
        notes: 'Updated notes.'
      };
      const validUpdateParams = { scheduleId, ...baseUpdatePayload };

      it('should update schedule if parameters are valid', async () => {
        await agentManager.handleScheduleUpdate(userId, validUpdateParams);

        expect(mockUpdateSchedule).toHaveBeenCalledWith(
          scheduleId,
          expect.objectContaining({
            ...baseUpdatePayload,
            updatedBy: userId,
          })
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Schedule update action for user ${userId} (schedule ${scheduleId}) processed. Result:`),
            expect.any(Object) // For the result object
        );
      });

      it('should log error and not call scheduler if scheduleId is missing', async () => {
        const { scheduleId, ...updatesOnly } = validUpdateParams;
        await agentManager.handleScheduleUpdate(userId, updatesOnly );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Missing scheduleId or update data for schedule update:', updatesOnly);
        expect(mockUpdateSchedule).not.toHaveBeenCalled();
      });

      it('should log error and not call scheduler if updates are empty', async () => {
        await agentManager.handleScheduleUpdate(userId, { scheduleId });

        expect(consoleErrorSpy).toHaveBeenCalledWith('Missing scheduleId or update data for schedule update:', { scheduleId });
        expect(mockUpdateSchedule).not.toHaveBeenCalled();
      });

      it('should log error if EnhancedScheduler.updateSchedule call fails', async () => {
        const schedulerError = new Error('Scheduler update failed');
        mockUpdateSchedule.mockRejectedValue(schedulerError);
        await agentManager.handleScheduleUpdate(userId, validUpdateParams);

        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in AgentManager.handleScheduleUpdate for user ${userId} (schedule ${scheduleId}):`, schedulerError);
      });

      it('should call initialize if services are not ready', async () => {
        agentManager.enhancedScheduler = null;
        agentManager.isInitialized = false;
        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.enhancedScheduler = new EnhancedScheduler();
            this.firebaseService = mockFirebaseService;
            this.isInitialized = true;
        });

        await agentManager.handleScheduleUpdate(userId, validUpdateParams);
        expect(initializeSpy).toHaveBeenCalled();
        expect(EnhancedScheduler.mock.results[initializeSpy.mock.calls.length -1].value.updateSchedule).toHaveBeenCalled();
        initializeSpy.mockRestore();
      });
    });

    describe('handleCaregiverAssign', () => {
      const params = {
        scheduleId: 'sched-002',
        caregiverId: 'cg-008'
      };

      it('should assign caregiver if parameters are valid', async () => {
        await agentManager.handleCaregiverAssign(userId, params);

        expect(mockAssignCaregiverToSchedule).toHaveBeenCalledWith(
          params.scheduleId,
          params.caregiverId
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Caregiver assignment action for user ${userId} (schedule ${params.scheduleId}, caregiver ${params.caregiverId}) processed. Result:`),
            expect.any(Object)
        );
      });

      it('should log error if scheduleId or caregiverId is missing', async () => {
        await agentManager.handleCaregiverAssign(userId, { scheduleId: 'sched-002' });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Missing scheduleId or caregiverId for assignment:', { scheduleId: 'sched-002' });
        expect(mockAssignCaregiverToSchedule).not.toHaveBeenCalled();

        jest.clearAllMocks();
        await agentManager.handleCaregiverAssign(userId, { caregiverId: 'cg-008' });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Missing scheduleId or caregiverId for assignment:', { caregiverId: 'cg-008' });
        expect(mockAssignCaregiverToSchedule).not.toHaveBeenCalled();
      });

      it('should log error if EnhancedScheduler.assignCaregiverToSchedule call fails', async () => {
        const assignError = new Error('Assignment failed');
        mockAssignCaregiverToSchedule.mockRejectedValue(assignError);
        await agentManager.handleCaregiverAssign(userId, params);

        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error in AgentManager.handleCaregiverAssign for user ${userId}:`, assignError);
      });

      it('should call initialize if services are not ready', async () => {
        agentManager.enhancedScheduler = null;
        agentManager.isInitialized = false;
        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.enhancedScheduler = new EnhancedScheduler();
            this.firebaseService = mockFirebaseService;
            this.isInitialized = true;
        });

        await agentManager.handleCaregiverAssign(userId, params);
        expect(initializeSpy).toHaveBeenCalled();
        expect(EnhancedScheduler.mock.results[initializeSpy.mock.calls.length -1].value.assignCaregiverToSchedule).toHaveBeenCalled();
        initializeSpy.mockRestore();
      });
    });
  });

  describe('handleResponseActions Routing', () => {
    const userId = 'user-route-test';
    let handleScheduleCreateSpy, handleScheduleUpdateSpy, handleCaregiverAssignSpy;

    beforeEach(() => {
      handleScheduleCreateSpy = jest.spyOn(agentManager, 'handleScheduleCreate');
      handleScheduleUpdateSpy = jest.spyOn(agentManager, 'handleScheduleUpdate');
      handleCaregiverAssignSpy = jest.spyOn(agentManager, 'handleCaregiverAssign');
    });

    // afterEach spy restoration handled by jest.clearAllMocks() in outer beforeEach

    it('should route schedule_create to handleScheduleCreate', async () => {
      const action = { type: 'schedule_create', parameters: { clientId: 'c1' } };
      await agentManager.handleResponseActions(userId, { actions: [action] }, {});
      expect(handleScheduleCreateSpy).toHaveBeenCalledWith(userId, action.parameters);
    });

    it('should route schedule_update to handleScheduleUpdate', async () => {
      const action = { type: 'schedule_update', parameters: { scheduleId: 's1' } };
      await agentManager.handleResponseActions(userId, { actions: [action] }, {});
      expect(handleScheduleUpdateSpy).toHaveBeenCalledWith(userId, action.parameters);
    });

    it('should route caregiver_assign to handleCaregiverAssign', async () => {
      const action = { type: 'caregiver_assign', parameters: { scheduleId: 's1', caregiverId: 'cg1' } };
      await agentManager.handleResponseActions(userId, { actions: [action] }, {});
      expect(handleCaregiverAssignSpy).toHaveBeenCalledWith(userId, action.parameters);
    });

    it('should log unknown action type', async () => {
      const action = { type: 'unknown_action', parameters: {} };
      await agentManager.handleResponseActions(userId, { actions: [action] }, {});
      expect(consoleLogSpy).toHaveBeenCalledWith('Unknown action type: unknown_action');
    });

    it('should do nothing if actions array is empty or undefined', async () => {
      await agentManager.handleResponseActions(userId, { actions: [] }, {});
      expect(handleScheduleCreateSpy).not.toHaveBeenCalled();
      // ... check other spies ...

      await agentManager.handleResponseActions(userId, {}, {}); // No actions property
      expect(handleScheduleCreateSpy).not.toHaveBeenCalled();
    });

    it('should process multiple actions', async () => {
        const action1 = { type: 'schedule_create', parameters: { clientId: 'c1' } };
        const action2 = { type: 'caregiver_assign', parameters: { scheduleId: 's1', caregiverId: 'cg1' } };
        await agentManager.handleResponseActions(userId, { actions: [action1, action2] }, {});
        expect(handleScheduleCreateSpy).toHaveBeenCalledWith(userId, action1.parameters);
        expect(handleCaregiverAssignSpy).toHaveBeenCalledWith(userId, action2.parameters);
    });
  });

  describe('scanForOpportunities (Refactored Method)', () => {
    it('should use initialized firebaseService and enhancedScheduler', async () => {
      const mockUnassignedSchedule = { id: 'unassigned-sched-1', clientId: 'client-x', status: 'Pending', date: '2024-01-01', startTime: '10:00', endTime: '11:00' };
      mockFirebaseService.db.collection().where().get.mockResolvedValue({
        docs: [{ id: mockUnassignedSchedule.id, data: () => mockUnassignedSchedule }]
      });
      mockFindAvailableCaregivers.mockResolvedValue([{ id: 'cg-available', name: 'Available CG', score: 90 }]);

      await agentManager.scanForOpportunities();

      expect(mockFirebaseService.db.collection).toHaveBeenCalledWith('schedules');
      expect(agentManager.enhancedScheduler.findAvailableCaregivers).toHaveBeenCalledWith(mockUnassignedSchedule.id);
      expect(mockFirebaseService.addDocument).toHaveBeenCalledWith('opportunities', expect.objectContaining({
        schedule_id: mockUnassignedSchedule.id
      }));
    });

     it('should call initialize if services are not ready', async () => {
        agentManager.isInitialized = false;
        agentManager.firebaseService = null;
        agentManager.enhancedScheduler = null;

        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.firebaseService = mockFirebaseService;
            this.enhancedScheduler = new EnhancedScheduler();
            this.isInitialized = true;
        });

        mockFirebaseService.db.collection().where().get.mockResolvedValue({ docs: [] });

        await agentManager.scanForOpportunities();

        expect(initializeSpy).toHaveBeenCalled();
        expect(mockFirebaseService.db.collection).toHaveBeenCalledWith('schedules');

        initializeSpy.mockRestore();
    });

    it('should handle error during scanForOpportunities gracefully and re-throw', async () => {
        const dbError = new Error("Firestore unavailable");
        mockFirebaseService.db.collection().where().get.mockRejectedValue(dbError);

        await expect(agentManager.scanForOpportunities()).rejects.toThrow(dbError);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error scanning for opportunities:", dbError);
    });

    it('should warn and skip a schedule if it has no ID during scanForOpportunities', async () => {
      const mockScheduleWithId = { id: 'sched-1', data: () => ({ clientId: 'client-a', status: 'Pending' }) };
      const mockScheduleWithoutId = { data: () => ({ clientId: 'client-b', status: 'Pending' }) }; // No id property

      mockFirebaseService.db.collection().where().get.mockResolvedValue({
        docs: [mockScheduleWithId, mockScheduleWithoutId]
      });
      mockFindAvailableCaregivers.mockResolvedValue([]); // No caregivers needed for this test logic

      await agentManager.scanForOpportunities();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Skipping schedule due to missing ID:", { clientId: 'client-b', status: 'Pending' });
      // Ensure it still processes schedules with IDs (or tries to)
      expect(mockFindAvailableCaregivers).toHaveBeenCalledWith(mockScheduleWithId.id);
      // Ensure addDocument is not called for the one without ID, and potentially not for the one with ID if no caregivers
      expect(mockFirebaseService.addDocument).not.toHaveBeenCalledWith('opportunities', expect.objectContaining({
        // Check properties that would only exist if derived from schedule without ID
        clientId: 'client-b'
      }));
    });
  });

  describe('applyOpportunity (Refactored Method)', () => {
    const opportunityId = 'opp-123';
    const userIdForApply = 'user-applying';
    const mockOpportunity = {
        id: opportunityId,
        type: 'caregiver_assignment',
        schedule_id: 'sched-abc',
        candidates: [{ caregiverId: 'cg-xyz', score: 90 }]
    };
     const options = { appliedBy: userIdForApply, reason: 'test apply' };


    it('should use initialized services and apply opportunity', async () => {
        mockFirebaseService.getDocument.mockResolvedValue(mockOpportunity);
        mockAssignCaregiverToSchedule.mockResolvedValue({ success: true });

        await agentManager.applyOpportunity(opportunityId, options);

        expect(mockFirebaseService.getDocument).toHaveBeenCalledWith('opportunities', opportunityId);
        expect(mockAssignCaregiverToSchedule).toHaveBeenCalledWith('sched-abc', 'cg-xyz');
        expect(mockFirebaseService.updateDocument).toHaveBeenCalledWith('opportunities', opportunityId, expect.objectContaining({
            status: 'applied',
            applied_by: userIdForApply,
            selected_caregiver_id: 'cg-xyz'
        }));
    });

    it('should call initialize if services are not ready for applyOpportunity', async () => {
        agentManager.isInitialized = false;
        agentManager.firebaseService = null;
        agentManager.enhancedScheduler = null;
        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.firebaseService = mockFirebaseService;
            this.enhancedScheduler = new EnhancedScheduler();
            this.isInitialized = true;
        });

        mockFirebaseService.getDocument.mockResolvedValue(mockOpportunity);
        mockAssignCaregiverToSchedule.mockResolvedValue({ success: true });

        await agentManager.applyOpportunity(opportunityId, options);
        expect(initializeSpy).toHaveBeenCalled();
        expect(mockAssignCaregiverToSchedule).toHaveBeenCalled();
        initializeSpy.mockRestore();
    });

    it('should throw error if opportunity not found', async () => {
        mockFirebaseService.getDocument.mockResolvedValue(null);
        await expect(agentManager.applyOpportunity(opportunityId, options))
            .rejects.toThrow(`Opportunity ${opportunityId} not found`);
    });

    it('should throw error if no candidates for caregiver_assignment opportunity', async () => {
        mockFirebaseService.getDocument.mockResolvedValue({ ...mockOpportunity, candidates: [] });
        await expect(agentManager.applyOpportunity(opportunityId, options))
            .rejects.toThrow(`No candidates found for opportunity ${opportunityId}`);
    });

    it('should throw error if schedule_id or caregiverId is missing in opportunity data', async () => {
        mockFirebaseService.getDocument.mockResolvedValue({ ...mockOpportunity, schedule_id: null });
        await expect(agentManager.applyOpportunity(opportunityId, options))
            .rejects.toThrow(`Missing schedule_id or valid caregiverId in opportunity data for ${opportunityId}`);
    });
  });

  describe('rejectOpportunity (Refactored Method)', () => {
    const opportunityId = 'opp-to-reject-123';
    const userIdForReject = 'user-rejecting';
    const reason = 'Caregiver unavailable';

    it('should use initialized firebaseService and reject opportunity', async () => {
      mockFirebaseService.updateDocument.mockResolvedValue({ success: true }); // Assume update is successful

      const result = await agentManager.rejectOpportunity(opportunityId, { rejectedBy: userIdForReject, reason });

      expect(mockFirebaseService.updateDocument).toHaveBeenCalledWith('opportunities', opportunityId, expect.objectContaining({
        status: 'rejected',
        rejected_by: userIdForReject,
        rejection_reason: reason,
        rejected_at: expect.any(String), // ISOString
      }));
      expect(result).toEqual({ success: true, opportunityId });
      expect(consoleLogSpy).toHaveBeenCalledWith(`Rejecting opportunity ${opportunityId}`);
    });

    it('should call initialize if services are not ready for rejectOpportunity', async () => {
      agentManager.isInitialized = false;
      agentManager.firebaseService = null;
      const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
        this.firebaseService = mockFirebaseService;
        this.isInitialized = true;
      });

      mockFirebaseService.updateDocument.mockResolvedValue({ success: true });
      await agentManager.rejectOpportunity(opportunityId, { rejectedBy: userIdForReject, reason });

      expect(initializeSpy).toHaveBeenCalled();
      expect(mockFirebaseService.updateDocument).toHaveBeenCalled();
      initializeSpy.mockRestore();
    });

    it('should throw error if firebaseService.updateDocument fails', async () => {
      const dbError = new Error("Firestore update failed");
      mockFirebaseService.updateDocument.mockRejectedValue(dbError);

      await expect(agentManager.rejectOpportunity(opportunityId, { rejectedBy: userIdForReject, reason }))
        .rejects.toThrow(dbError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(`Error rejecting opportunity ${opportunityId}:`, dbError);
    });

    it('should use default rejection reason if none provided', async () => {
      mockFirebaseService.updateDocument.mockResolvedValue({ success: true });
      await agentManager.rejectOpportunity(opportunityId, { rejectedBy: userIdForReject }); // No reason

      expect(mockFirebaseService.updateDocument).toHaveBeenCalledWith('opportunities', opportunityId, expect.objectContaining({
        rejection_reason: '', // Default empty string
      }));
    });

    it('should use "system" as rejectedBy if not provided in options', async () => {
        // This test assumes 'userId' is not globally available in AgentManager for this method
        // and relies on the default 'system' if options.rejectedBy is not set.
        // The actual 'userId' passed to handleOpportunityAction would be the source if called from there.
        // Here, we are testing rejectOpportunity directly.
        mockFirebaseService.updateDocument.mockResolvedValue({ success: true });
        await agentManager.rejectOpportunity(opportunityId, { reason: 'test reason' }); // No rejectedBy

        expect(mockFirebaseService.updateDocument).toHaveBeenCalledWith('opportunities', opportunityId, expect.objectContaining({
            rejected_by: 'system',
        }));
    });
  });

  describe('getOpportunityDetails (Refactored Method)', () => {
    const opportunityId = 'opp-details-123';
    const mockOpportunity = {
      id: opportunityId,
      type: 'caregiver_assignment',
      schedule_id: 'sched-abc',
      candidates: [{ caregiverId: 'cg-xyz', name: 'Test CG', score: 90 }]
    };
    const mockSchedule = { id: 'sched-abc', clientId: 'client-123', details: 'Schedule Details' };
    const mockClient = { id: 'client-123', name: 'Test Client', preferences: ['pref1'] };
    const mockCaregiver = { id: 'cg-xyz', name: 'Test CG', skills: ['skill1', 'pref1'] };

    it('should get opportunity details and enhance them for caregiver_assignment type', async () => {
      mockFirebaseService.getDocument.mockResolvedValueOnce(mockOpportunity); // For opportunity
      mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
      mockFirebaseService.getClient.mockResolvedValueOnce(mockClient);
      mockFirebaseService.getCaregiver.mockResolvedValueOnce(mockCaregiver); // For candidate enhancement

      const details = await agentManager.getOpportunityDetails(opportunityId);

      expect(mockFirebaseService.getDocument).toHaveBeenCalledWith('opportunities', opportunityId);
      expect(mockFirebaseService.getSchedule).toHaveBeenCalledWith(mockOpportunity.schedule_id);
      expect(mockFirebaseService.getClient).toHaveBeenCalledWith(mockSchedule.clientId);
      expect(mockFirebaseService.getCaregiver).toHaveBeenCalledWith(mockOpportunity.candidates[0].caregiverId);

      expect(details).toHaveProperty('schedule_details', mockSchedule);
      expect(details).toHaveProperty('client_details', mockClient);
      expect(details.enhanced_candidates[0]).toHaveProperty('caregiver_details', mockCaregiver);
      expect(details).toHaveProperty('ai_recommendation');
      expect(consoleLogSpy).toHaveBeenCalledWith(`Getting details for opportunity ${opportunityId}`);
    });

    it('should return opportunity as is if type is not caregiver_assignment', async () => {
      const nonCaregiverOpp = { ...mockOpportunity, type: 'other_type' };
      mockFirebaseService.getDocument.mockResolvedValueOnce(nonCaregiverOpp);

      const details = await agentManager.getOpportunityDetails(opportunityId);

      expect(details).toEqual(nonCaregiverOpp);
      expect(mockFirebaseService.getSchedule).not.toHaveBeenCalled();
    });

    it('should return opportunity as is if schedule_id is missing for caregiver_assignment type', async () => {
      const oppWithoutScheduleId = { ...mockOpportunity, schedule_id: null };
      mockFirebaseService.getDocument.mockResolvedValueOnce(oppWithoutScheduleId);

      const details = await agentManager.getOpportunityDetails(opportunityId);
      expect(details).toEqual(expect.objectContaining(oppWithoutScheduleId)); // It will still have ai_recommendation
      expect(details.schedule_details).toBeUndefined();
      expect(details.client_details).toBeUndefined();
      expect(mockFirebaseService.getSchedule).not.toHaveBeenCalled();
    });


    it('should handle missing schedule for caregiver_assignment type', async () => {
      mockFirebaseService.getDocument.mockResolvedValueOnce(mockOpportunity);
      mockFirebaseService.getSchedule.mockResolvedValueOnce(null); // Schedule not found

      const details = await agentManager.getOpportunityDetails(opportunityId);
      expect(details.schedule_details).toBeNull();
      expect(details.client_details).toBeNull(); // Since client depends on schedule
      expect(mockFirebaseService.getClient).not.toHaveBeenCalled();
    });

    it('should handle missing client for caregiver_assignment type', async () => {
      mockFirebaseService.getDocument.mockResolvedValueOnce(mockOpportunity);
      mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
      mockFirebaseService.getClient.mockResolvedValueOnce(null); // Client not found

      const details = await agentManager.getOpportunityDetails(opportunityId);
      expect(details.client_details).toBeNull();
    });

    it('should handle missing caregiver details for candidates', async () => {
      mockFirebaseService.getDocument.mockResolvedValueOnce(mockOpportunity);
      mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
      mockFirebaseService.getClient.mockResolvedValueOnce(mockClient);
      mockFirebaseService.getCaregiver.mockResolvedValueOnce(null); // Caregiver for candidate not found

      const details = await agentManager.getOpportunityDetails(opportunityId);
      expect(details.enhanced_candidates[0].caregiver_details).toBeNull();
    });

    it('should handle opportunity with no candidates', async () => {
        const oppNoCandidates = { ...mockOpportunity, candidates: [] };
        mockFirebaseService.getDocument.mockResolvedValueOnce(oppNoCandidates);
        mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
        mockFirebaseService.getClient.mockResolvedValueOnce(mockClient);

        const details = await agentManager.getOpportunityDetails(opportunityId);
        expect(details.enhanced_candidates).toEqual([]);
        expect(mockFirebaseService.getCaregiver).not.toHaveBeenCalled();
    });


    it('should throw error if opportunity is not found', async () => {
      mockFirebaseService.getDocument.mockResolvedValueOnce(null);
      await expect(agentManager.getOpportunityDetails(opportunityId))
        .rejects.toThrow(`Opportunity ${opportunityId} not found`);
      expect(consoleErrorSpy).toHaveBeenCalledWith(`Error getting opportunity details for ${opportunityId}:`, expect.any(Error));
    });

    it('should call initialize if services are not ready', async () => {
      agentManager.isInitialized = false;
      agentManager.firebaseService = null;
      const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
        this.firebaseService = mockFirebaseService;
        this.isInitialized = true;
      });

      mockFirebaseService.getDocument.mockResolvedValueOnce(mockOpportunity);
      // Prevent further calls due to null firebaseService if not re-mocked for internal calls
      mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
      mockFirebaseService.getClient.mockResolvedValueOnce(mockClient);
      mockFirebaseService.getCaregiver.mockResolvedValueOnce(mockCaregiver);

      await agentManager.getOpportunityDetails(opportunityId);
      expect(initializeSpy).toHaveBeenCalled();
      expect(mockFirebaseService.getDocument).toHaveBeenCalled();
      initializeSpy.mockRestore();
    });

    it('should handle error during firebaseService.getSchedule call', async () => {
        mockFirebaseService.getDocument.mockResolvedValueOnce(mockOpportunity);
        const scheduleError = new Error("Failed to get schedule");
        mockFirebaseService.getSchedule.mockRejectedValueOnce(scheduleError);

        await expect(agentManager.getOpportunityDetails(opportunityId))
            .rejects.toThrow(scheduleError);
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error getting opportunity details for ${opportunityId}:`, scheduleError);
    });
  });

  describe('getInsightsForSchedule (Refactored Method)', () => {
    const scheduleId = 'sched-insights-123';
    const mockSchedule = {
      id: scheduleId,
      clientId: 'client-abc',
      caregiverId: 'cg-def',
      date: '2024-10-01',
      location: { address: '123 Main St' }
    };
    const mockClient = { id: 'client-abc', name: 'Client Alpha', preferences: ['pref1', 'skill2'] };
    const mockCaregiver = { id: 'cg-def', name: 'Caregiver Delta', skills: ['skill1', 'skill2'] };
    const mockUnassignedSchedule = { ...mockSchedule, caregiverId: null, id: 'sched-unassigned-456' };

    beforeEach(() => {
        mockFirebaseService.getSchedule.mockResolvedValue(null); // Default to not found
        mockFirebaseService.getClient.mockResolvedValue(null);
        mockFirebaseService.getCaregiver.mockResolvedValue(null);
        mockFirebaseService.getSchedulesInDateRange.mockResolvedValue([]);
        mockFindAvailableCaregivers.mockResolvedValue([]);
        // Mock areLocationsClose if it's used and not just a placeholder
        jest.spyOn(agentManager, 'areLocationsClose').mockReturnValue(false);
    });

    it('should get insights for an assigned schedule', async () => {
      mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
      mockFirebaseService.getClient.mockResolvedValueOnce(mockClient);
      mockFirebaseService.getCaregiver.mockResolvedValueOnce(mockCaregiver);

      const insights = await agentManager.getInsightsForSchedule(scheduleId);

      expect(mockFirebaseService.getSchedule).toHaveBeenCalledWith(scheduleId);
      expect(mockFirebaseService.getClient).toHaveBeenCalledWith(mockSchedule.clientId);
      expect(mockFirebaseService.getCaregiver).toHaveBeenCalledWith(mockSchedule.caregiverId);
      expect(insights.insights).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'status', message: expect.stringContaining('assigned to Caregiver Delta') }),
        expect.objectContaining({ type: 'preference_match' })
      ]));
      expect(consoleLogSpy).toHaveBeenCalledWith(`Getting insights for schedule ${scheduleId}`);
    });

    it('should get insights for an unassigned schedule with available caregivers', async () => {
      mockFirebaseService.getSchedule.mockResolvedValueOnce(mockUnassignedSchedule);
      mockFirebaseService.getClient.mockResolvedValueOnce(mockClient); // Client info still relevant
      mockFindAvailableCaregivers.mockResolvedValueOnce([
        { id: 'cg-1', name: 'Caregiver Gamma', score: 90 },
        { id: 'cg-2', name: 'Caregiver Beta', score: 80 }
      ]);

      const insights = await agentManager.getInsightsForSchedule(mockUnassignedSchedule.id);

      expect(mockFindAvailableCaregivers).toHaveBeenCalledWith(mockUnassignedSchedule.id);
      expect(insights.insights).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'status', message: expect.stringContaining('unassigned') }),
        expect.objectContaining({ type: 'available_caregivers', caregivers: expect.any(Array) })
      ]));
    });

    it('should handle schedule not found', async () => {
        mockFirebaseService.getSchedule.mockResolvedValueOnce(null);
        await expect(agentManager.getInsightsForSchedule(scheduleId))
            .rejects.toThrow(`Schedule ${scheduleId} not found`);
        expect(consoleErrorSpy).toHaveBeenCalledWith(`Error getting insights for schedule ${scheduleId}:`, expect.any(Error));
    });

    it('should handle missing client or caregiver details gracefully', async () => {
        mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
        mockFirebaseService.getClient.mockResolvedValueOnce(null); // Client not found
        mockFirebaseService.getCaregiver.mockResolvedValueOnce(null); // Caregiver not found

        const insights = await agentManager.getInsightsForSchedule(scheduleId);
        // Status message should reflect missing caregiver name
        expect(insights.insights).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'status', message: expect.stringContaining('assigned to a caregiver') })
        ]));
        // Preference match should not be attempted or should indicate missing data
        const preferenceInsight = insights.insights.find(i => i.type === 'preference_match' || i.type === 'preference_mismatch');
        expect(preferenceInsight).toBeUndefined(); // Or check for a specific message if handled differently
    });

    it('should include nearby schedules insight if applicable', async () => {
        mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
        mockFirebaseService.getClient.mockResolvedValueOnce(mockClient);
        mockFirebaseService.getCaregiver.mockResolvedValueOnce(mockCaregiver);
        const nearbySchedule = { id: 'nearby-sched-001', date: mockSchedule.date, location: { address: '125 Main St'} };
        mockFirebaseService.getSchedulesInDateRange.mockResolvedValueOnce([mockSchedule, nearbySchedule]);
        agentManager.areLocationsClose.mockReturnValue(true); // Simulate they are close

        const insights = await agentManager.getInsightsForSchedule(scheduleId);
        expect(mockFirebaseService.getSchedulesInDateRange).toHaveBeenCalledWith(mockSchedule.date, mockSchedule.date);
        expect(insights.insights).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'nearby_schedules' })
        ]));
    });

    it('should call initialize if services are not ready', async () => {
        agentManager.isInitialized = false;
        agentManager.firebaseService = null;
        agentManager.enhancedScheduler = null;
        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.firebaseService = mockFirebaseService;
            this.enhancedScheduler = new EnhancedScheduler(); // Use the mock constructor
            this.isInitialized = true;
        });

        mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
        // Mock other calls to prevent errors due to null services if not re-mocked by actual initialize
        mockFirebaseService.getClient.mockResolvedValueOnce(mockClient);
        mockFirebaseService.getCaregiver.mockResolvedValueOnce(mockCaregiver);


        await agentManager.getInsightsForSchedule(scheduleId);
        expect(initializeSpy).toHaveBeenCalled();
        expect(mockFirebaseService.getSchedule).toHaveBeenCalledWith(scheduleId);
        initializeSpy.mockRestore();
    });

    it('should generate preference_mismatch insight if client preferences do not match caregiver skills', async () => {
      const clientWithDifferentPrefs = { ...mockClient, preferences: ['unique_pref_client'] };
      const caregiverWithDifferentSkills = { ...mockCaregiver, skills: ['unique_skill_caregiver'] };
      mockFirebaseService.getSchedule.mockResolvedValueOnce(mockSchedule);
      mockFirebaseService.getClient.mockResolvedValueOnce(clientWithDifferentPrefs);
      mockFirebaseService.getCaregiver.mockResolvedValueOnce(caregiverWithDifferentSkills);

      const insights = await agentManager.getInsightsForSchedule(scheduleId);
      expect(insights.insights).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'preference_mismatch', message: expect.stringContaining('may not match all client preferences') })
      ]));
    });

     it('should return error insight if services are not initialized after attempt', async () => {
        agentManager.isInitialized = false;
        agentManager.firebaseService = null;
        agentManager.enhancedScheduler = null;

        // Make initialize fail to set services
        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.isInitialized = true; // Mark as initialized but don't set services
            this.firebaseService = null;
            this.enhancedScheduler = null;
        });

        const result = await agentManager.getInsightsForSchedule(scheduleId);

        expect(initializeSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith("AgentManager or its services not initialized for getInsightsForSchedule.");
        expect(result.insights).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'error', message: 'Services not initialized.' })
        ]));
        initializeSpy.mockRestore();
    });
  });

  describe('getSuggestions (Refactored Method)', () => {
    const mockClientId = 'client-sugg-123';
    const mockCaregiverId = 'cg-sugg-456';
    const mockClientData = { id: mockClientId, name: 'Client Beta', preferences: [] };
    const mockCaregiverData = { id: mockCaregiverId, name: 'Caregiver Zeta', skills: [], regularSchedule: [] };

    beforeEach(() => {
      mockFirebaseService.getClient.mockResolvedValue(null);
      mockFirebaseService.getCaregiver.mockResolvedValue(null);
      mockFirebaseService.getSchedulesByClientId.mockResolvedValue([]);
      mockFirebaseService.getSchedulesByCaregiverId.mockResolvedValue([]);
      mockFirebaseService.getCaregiverAvailability.mockResolvedValue({ regularSchedule: [] });
    });

    it('should get suggestions for a client (unassigned schedules, missing preferences)', async () => {
      mockFirebaseService.getClient.mockResolvedValueOnce(mockClientData);
      const unassignedSchedule = { id: 's1', caregiverId: null, date: new Date().toISOString() };
      const upcomingSchedule = { id: 's2', caregiverId: 'cg1', date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() }; // 3 days from now
      mockFirebaseService.getSchedulesByClientId.mockResolvedValueOnce([unassignedSchedule, upcomingSchedule]);

      const suggestions = await agentManager.getSuggestions(mockClientId, 'client');

      expect(mockFirebaseService.getClient).toHaveBeenCalledWith(mockClientId);
      expect(mockFirebaseService.getSchedulesByClientId).toHaveBeenCalledWith(mockClientId);
      expect(suggestions.suggestions).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'unassigned_schedules' }),
        expect.objectContaining({ type: 'upcoming_schedules' }),
        expect.objectContaining({ type: 'missing_preferences' })
      ]));
      expect(consoleLogSpy).toHaveBeenCalledWith(`Getting suggestions for client ${mockClientId}`);
    });

    it('should get suggestions for a caregiver (upcoming schedules, busy days, missing skills/availability)', async () => {
      mockFirebaseService.getCaregiver.mockResolvedValueOnce(mockCaregiverData);
      const schedulesOnSameDay = [
        { id: 's1', date: '2024-10-01' }, { id: 's2', date: '2024-10-01' }, { id: 's3', date: '2024-10-01' }
      ];
      const upcomingSchedule = { id: 's4', date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() }; // 2 days from now
      mockFirebaseService.getSchedulesByCaregiverId.mockResolvedValueOnce([...schedulesOnSameDay, upcomingSchedule]);
      // Ensure getCaregiverAvailability returns an object that implies missing availability
      mockFirebaseService.getCaregiverAvailability.mockResolvedValueOnce({ regularSchedule: [] });


      const suggestions = await agentManager.getSuggestions(mockCaregiverId, 'caregiver');

      expect(mockFirebaseService.getCaregiver).toHaveBeenCalledWith(mockCaregiverId);
      expect(mockFirebaseService.getSchedulesByCaregiverId).toHaveBeenCalledWith(mockCaregiverId);
      expect(mockFirebaseService.getCaregiverAvailability).toHaveBeenCalledWith(mockCaregiverId);
      expect(suggestions.suggestions).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'upcoming_schedules' }),
        expect.objectContaining({ type: 'busy_days' }),
        expect.objectContaining({ type: 'missing_skills' }),
        expect.objectContaining({ type: 'missing_availability' })
      ]));
    });

    it('should handle client not found', async () => {
        mockFirebaseService.getClient.mockResolvedValueOnce(null);
        await expect(agentManager.getSuggestions(mockClientId, 'client'))
            .rejects.toThrow(`Client ${mockClientId} not found`);
    });

    it('should handle caregiver not found', async () => {
        mockFirebaseService.getCaregiver.mockResolvedValueOnce(null);
        await expect(agentManager.getSuggestions(mockCaregiverId, 'caregiver'))
            .rejects.toThrow(`Caregiver ${mockCaregiverId} not found`);
    });

    it('should throw error for invalid entity type', async () => {
        await expect(agentManager.getSuggestions('id1', 'invalid_type'))
            .rejects.toThrow('Invalid entity type: invalid_type');
    });

    it('should call initialize if services are not ready', async () => {
      agentManager.isInitialized = false;
      agentManager.firebaseService = null;
      const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
        this.firebaseService = mockFirebaseService; // Ensure it's set for subsequent calls
        this.isInitialized = true;
      });

      mockFirebaseService.getClient.mockResolvedValueOnce(mockClientData); // For the client path

      await agentManager.getSuggestions(mockClientId, 'client');
      expect(initializeSpy).toHaveBeenCalled();
      expect(mockFirebaseService.getClient).toHaveBeenCalledWith(mockClientId);
      initializeSpy.mockRestore();
    });

     it('should return error suggestion if services are not initialized after attempt', async () => {
        agentManager.isInitialized = false;
        agentManager.firebaseService = null;
        const initializeSpy = jest.spyOn(agentManager, 'initialize').mockImplementation(async function() {
            this.isInitialized = true;
            this.firebaseService = null; // Simulate services not being set
        });

        const result = await agentManager.getSuggestions(mockClientId, 'client');
        expect(initializeSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith("AgentManager or FirebaseService not initialized for getSuggestions.");
        expect(result.suggestions).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'error', message: 'FirebaseService not initialized.' })
        ]));
        initializeSpy.mockRestore();
    });

    it('should correctly identify no missing preferences if preferences exist for client', async () => {
        mockFirebaseService.getClient.mockResolvedValueOnce({...mockClientData, preferences: ['has_pref']});
        mockFirebaseService.getSchedulesByClientId.mockResolvedValueOnce([]);
        const suggestions = await agentManager.getSuggestions(mockClientId, 'client');
        expect(suggestions.suggestions.find(s => s.type === 'missing_preferences')).toBeUndefined();
    });

    it('should correctly identify no missing skills if skills exist for caregiver', async () => {
        mockFirebaseService.getCaregiver.mockResolvedValueOnce({...mockCaregiverData, skills: ['has_skill']});
        mockFirebaseService.getSchedulesByCaregiverId.mockResolvedValueOnce([]);
        mockFirebaseService.getCaregiverAvailability.mockResolvedValueOnce({ regularSchedule: [] });
        const suggestions = await agentManager.getSuggestions(mockCaregiverId, 'caregiver');
        expect(suggestions.suggestions.find(s => s.type === 'missing_skills')).toBeUndefined();
    });

    it('should correctly identify no missing availability if availability exists for caregiver', async () => {
        mockFirebaseService.getCaregiver.mockResolvedValueOnce(mockCaregiverData);
        mockFirebaseService.getSchedulesByCaregiverId.mockResolvedValueOnce([]);
        mockFirebaseService.getCaregiverAvailability.mockResolvedValueOnce({ regularSchedule: [{day: "Monday"}] }); // Has availability
        const suggestions = await agentManager.getSuggestions(mockCaregiverId, 'caregiver');
        expect(suggestions.suggestions.find(s => s.type === 'missing_availability')).toBeUndefined();
    });
  });

  describe('handleOpportunityAction (within handleResponseActions)', () => {
    const userId = 'user-opp-action-test';
    const opportunityId = 'opp-action-target-123';
    let applyOpportunitySpy, rejectOpportunitySpy;

    beforeEach(() => {
      // Spy on the direct methods that handleOpportunityAction should call
      applyOpportunitySpy = jest.spyOn(agentManager, 'applyOpportunity');
      rejectOpportunitySpy = jest.spyOn(agentManager, 'rejectOpportunity');
    });

    // Spies are cleared in the main beforeEach

    it('should route to applyOpportunity when action is "apply"', async () => {
      const action = {
        type: 'opportunity_action',
        parameters: { opportunityId, action: 'apply', reason: 'test apply reason' }
      };
      // Mock applyOpportunity to prevent its full execution, just check if it's called
      applyOpportunitySpy.mockResolvedValueOnce({ success: true });

      await agentManager.handleResponseActions(userId, { actions: [action] }, {});

      expect(applyOpportunitySpy).toHaveBeenCalledWith(opportunityId, {
        appliedBy: userId,
        reason: 'test apply reason',
        timestamp: expect.any(String)
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(`Opportunity action for user ${userId}:`, action.parameters);
    });

    it('should route to rejectOpportunity when action is "reject"', async () => {
      const action = {
        type: 'opportunity_action',
        parameters: { opportunityId, action: 'reject', reason: 'test reject reason' }
      };
      rejectOpportunitySpy.mockResolvedValueOnce({ success: true });

      await agentManager.handleResponseActions(userId, { actions: [action] }, {});

      expect(rejectOpportunitySpy).toHaveBeenCalledWith(opportunityId, {
        rejectedBy: userId,
        reason: 'test reject reason',
        timestamp: expect.any(String)
      });
    });

    it('should log if opportunity_action has an unknown sub-action within parameters', async () => {
      const action = {
        type: 'opportunity_action',
        parameters: { opportunityId, action: 'unknown_sub_action' }
      };
      await agentManager.handleResponseActions(userId, { actions: [action] }, {});
      // Check that neither apply nor reject was called
      expect(applyOpportunitySpy).not.toHaveBeenCalled();
      expect(rejectOpportunitySpy).not.toHaveBeenCalled();
      // Optionally, check for a log message if handleOpportunityAction logs unknown sub-actions
      // For now, just ensuring it doesn't crash and doesn't call apply/reject.
      // The method handleOpportunityAction itself doesn't have specific logging for unknown sub-actions,
      // so this test primarily ensures it doesn't call other opportunity methods.
    });
  });
});

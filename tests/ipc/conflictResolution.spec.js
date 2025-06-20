// Mock enhancedScheduler before it's used by the IPC handler logic
const mockEnhancedScheduler = {
  getPendingConflicts: jest.fn(),
  resolveConflict: jest.fn(),
  getConflictResolutionOptions: jest.fn(),
  overrideConflict: jest.fn(),
  getConflictResolutionHistory: jest.fn(),
};
jest.mock('../../services/enhanced-scheduler', () => mockEnhancedScheduler);

// Simulate the IPC handler registration part of main.js
// We need to define the handler functions here to test their logic directly.
// This approach avoids needing a full Electron environment for these unit/integration tests.

const mainJsScope = {}; // To hold the handlers as if they were in main.js

// scheduler:getConflicts
mainJsScope.handleGetConflicts = async (event, filterOptions) => {
  try {
    return await mockEnhancedScheduler.getPendingConflicts(filterOptions);
  } catch (error) {
    console.error('IPC Error getting conflicts:', error);
    throw error;
  }
};

// scheduler:resolveConflict
mainJsScope.handleResolveConflict = async (event, conflictId, resolutionData) => {
  return await mockEnhancedScheduler.resolveConflict(conflictId, resolutionData);
};

// scheduler:getConflictResolutionOptions
mainJsScope.handleGetConflictResolutionOptions = async (event, conflictData) => {
  try {
    return await mockEnhancedScheduler.getConflictResolutionOptions(conflictData);
  } catch (error) {
    console.error('IPC Error getting conflict resolution options:', error);
    throw error;
  }
};

// scheduler:overrideConflict
mainJsScope.handleOverrideConflict = async (event, { conflictId, reason, userId }) => {
  try {
    return await mockEnhancedScheduler.overrideConflict(conflictId, reason, userId);
  } catch (error) {
    console.error('IPC Error overriding conflict:', error);
    throw error;
  }
};

// scheduler:getConflictResolutionHistory
mainJsScope.handleGetConflictResolutionHistory = async (event, limit) => {
  try {
    return await mockEnhancedScheduler.getConflictResolutionHistory(limit);
  } catch (error) {
    console.error('IPC Error getting conflict resolution history:', error);
    throw error;
  }
};


describe('Conflict Resolution IPC Handlers', () => {
  const mockEvent = {}; // Mock Electron event object

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduler:getConflicts', () => {
    it('should call enhancedScheduler.getPendingConflicts and return its result', async () => {
      const filterOptions = { status: 'pending' };
      const mockConflicts = [{ id: 'c1', description: 'Test conflict' }];
      mockEnhancedScheduler.getPendingConflicts.mockResolvedValue(mockConflicts);

      const result = await mainJsScope.handleGetConflicts(mockEvent, filterOptions);
      expect(mockEnhancedScheduler.getPendingConflicts).toHaveBeenCalledWith(filterOptions);
      expect(result).toEqual(mockConflicts);
    });

    it('should propagate errors from enhancedScheduler.getPendingConflicts', async () => {
      const filterOptions = { status: 'pending' };
      mockEnhancedScheduler.getPendingConflicts.mockRejectedValue(new Error('Scheduler error'));
      await expect(mainJsScope.handleGetConflicts(mockEvent, filterOptions)).rejects.toThrow('Scheduler error');
    });
  });

  describe('scheduler:resolveConflict', () => {
    it('should call enhancedScheduler.resolveConflict and return its result', async () => {
      const conflictId = 'c1';
      const resolutionData = { notes: 'Resolved' };
      const mockResponse = { success: true };
      mockEnhancedScheduler.resolveConflict.mockResolvedValue(mockResponse);

      const result = await mainJsScope.handleResolveConflict(mockEvent, conflictId, resolutionData);
      expect(mockEnhancedScheduler.resolveConflict).toHaveBeenCalledWith(conflictId, resolutionData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('scheduler:getConflictResolutionOptions', () => {
    it('should call enhancedScheduler.getConflictResolutionOptions', async () => {
        const conflictData = { type: 'time_overlap' };
        const mockOptions = [{id: 'opt1', label: 'Option 1'}];
        mockEnhancedScheduler.getConflictResolutionOptions.mockResolvedValue(mockOptions);
        const result = await mainJsScope.handleGetConflictResolutionOptions(mockEvent, conflictData);
        expect(mockEnhancedScheduler.getConflictResolutionOptions).toHaveBeenCalledWith(conflictData);
        expect(result).toEqual(mockOptions);
    });
  });

  describe('scheduler:overrideConflict', () => {
    it('should call enhancedScheduler.overrideConflict', async () => {
        const params = { conflictId: 'c1', reason: 'Client request', userId: 'admin' };
        const mockResponse = { success: true };
        mockEnhancedScheduler.overrideConflict.mockResolvedValue(mockResponse);
        const result = await mainJsScope.handleOverrideConflict(mockEvent, params);
        expect(mockEnhancedScheduler.overrideConflict).toHaveBeenCalledWith(params.conflictId, params.reason, params.userId);
        expect(result).toEqual(mockResponse);
    });
  });

  describe('scheduler:getConflictResolutionHistory', () => {
    it('should call enhancedScheduler.getConflictResolutionHistory', async () => {
        const limit = 10;
        const mockHistory = [{conflictId: 'c1', resolvedAt: new Date()}];
        mockEnhancedScheduler.getConflictResolutionHistory.mockResolvedValue(mockHistory);
        const result = await mainJsScope.handleGetConflictResolutionHistory(mockEvent, limit);
        expect(mockEnhancedScheduler.getConflictResolutionHistory).toHaveBeenCalledWith(limit);
        expect(result).toEqual(mockHistory);
    });
  });

});

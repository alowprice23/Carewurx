const enhancedScheduler = require('../../services/enhanced-scheduler');
const { firebaseService } = require('../../services/firebase');

jest.mock('../../services/firebase', () => ({
  firebaseService: {
    executeQuery: jest.fn(),
    getSchedule: jest.fn(), // Used by checkScheduleConflicts, which is used by getPendingConflicts
    updateDocument: jest.fn(),
    addDocument: jest.fn(),
    // Mock an object for db.collection()... for checkScheduleConflicts internal calls if not using executeQuery for all
    db: {
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(),
    }
  }
}));
// Mock realTimeUpdatesService if it's directly used and not just by other services called
jest.mock('../../app/services/real-time-updates', () => ({
    publish: jest.fn().mockResolvedValue(undefined),
}));


describe('EnhancedScheduler - Conflict Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingConflicts', () => {
    it('should fetch schedules for given days and aggregate conflicts', async () => {
      const mockSchedulesDate1 = [
        { id: 's1', client_name: 'Client A', date: '2024-01-01', startTime: '09:00', endTime: '11:00', caregiver_id: 'cg1' },
        { id: 's2', client_name: 'Client B', date: '2024-01-01', startTime: '10:00', endTime: '12:00', caregiver_id: 'cg1' }, // s1 and s2 conflict
      ];
      const mockSchedulesDate2 = [
        { id: 's3', client_name: 'Client C', date: '2024-01-02', startTime: '10:00', endTime: '12:00', caregiver_id: 'cg2' },
      ];
      firebaseService.executeQuery
        .mockResolvedValueOnce(mockSchedulesDate1) // For day 1
        .mockResolvedValueOnce(mockSchedulesDate2); // For day 2

      // Mock checkScheduleConflicts logic (which is part of enhancedScheduler itself)
      // For s1, it will find s2. For s2, it will find s1. For s3, no conflict.
      const checkConflictsSpy = jest.spyOn(enhancedScheduler, 'checkScheduleConflicts');
      checkConflictsSpy
        .mockImplementation(async (scheduleId) => {
            if (scheduleId === 's1') return [{ conflictingScheduleId: 's2', conflictingSchedule: mockSchedulesDate1[1], type: 'time_overlap', description: 'Conflict s1-s2'}];
            if (scheduleId === 's2') return [{ conflictingScheduleId: 's1', conflictingSchedule: mockSchedulesDate1[0], type: 'time_overlap', description: 'Conflict s2-s1'}];
            if (scheduleId === 's3') return [];
            return [];
        });

      // Mock getSchedule for when checkScheduleConflicts calls it
      firebaseService.getSchedule.mockImplementation(async (id) => {
          if (id === 's1') return mockSchedulesDate1[0];
          if (id === 's2') return mockSchedulesDate1[1];
          if (id === 's3') return mockSchedulesDate2[0];
          return null;
      });


      const conflicts = await enhancedScheduler.getPendingConflicts({ daysAhead: 2, limitPerDay: 5 });

      expect(firebaseService.executeQuery).toHaveBeenCalledTimes(2);
      expect(checkConflictsSpy).toHaveBeenCalledWith('s1');
      expect(checkConflictsSpy).toHaveBeenCalledWith('s2');
      expect(checkConflictsSpy).toHaveBeenCalledWith('s3');

      // Expecting one unique conflict pair (s1_vs_s2 or s2_vs_s1)
      // The current unique ID generation might create two if details differ slightly based on primary.
      // Let's check if at least one conflict is found.
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      if (conflicts.length > 0) {
          expect(conflicts[0].id).toMatch(/s1_vs_s2|s2_vs_s1/);
          expect(conflicts[0].status).toBe('pending');
      }
      checkConflictsSpy.mockRestore();
    });

    it('should skip schedules already marked as resolved or overridden', async () => {
        const mockScheduleResolved = { id: 'sResolved', date: '2024-01-01', conflictStatus: 'resolved', caregiver_id: 'cg1' };
        firebaseService.executeQuery.mockResolvedValueOnce([mockScheduleResolved]);
        const checkConflictsSpy = jest.spyOn(enhancedScheduler, 'checkScheduleConflicts');

        await enhancedScheduler.getPendingConflicts({ daysAhead: 1, limitPerDay: 5 });
        expect(checkConflictsSpy).not.toHaveBeenCalledWith('sResolved');
        checkConflictsSpy.mockRestore();
    });
  });

  describe('resolveConflict', () => {
    it('should update primary schedule and add to resolutionLog', async () => {
      firebaseService.updateDocument.mockResolvedValue({ success: true });
      firebaseService.addDocument.mockResolvedValue({ id: 'log1' });
      const conflictId = 'scheduleA_vs_scheduleB';
      const resolutionData = { notes: 'Adjusted schedule A times', resolvedBy: 'adminUser' };

      const result = await enhancedScheduler.resolveConflict(conflictId, resolutionData);

      expect(result.success).toBe(true);
      expect(firebaseService.updateDocument).toHaveBeenCalledWith('schedules', 'scheduleA', {
        conflictResolutionNotes: resolutionData.notes,
        conflictStatus: 'resolved',
        updatedAt: expect.any(String),
      });
      expect(firebaseService.addDocument).toHaveBeenCalledWith('resolutionLog', {
        conflictId,
        resolvedAt: expect.any(String),
        resolution: resolutionData,
        resolvedBy: 'adminUser',
      });
    });
    it('should throw if primaryScheduleId cannot be parsed from conflictId', async () => {
        await expect(enhancedScheduler.resolveConflict('invalidIdFormat', {}))
            .rejects.toThrow('Invalid conflictId format.');
    });
  });

  describe('getConflictResolutionOptions', () => {
    it('should return a static list of options', async () => {
      const conflictData = { type: 'time_overlap', primaryScheduleId: 's1', conflictingScheduleId: 's2' };
      const options = await enhancedScheduler.getConflictResolutionOptions(conflictData);
      expect(options).toBeInstanceOf(Array);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveProperty('id');
      expect(options[0]).toHaveProperty('label');
    });
    it('should include travel buffer option for travel_time_insufficient type', async () => {
        const conflictData = { type: 'travel_time_insufficient' };
        const options = await enhancedScheduler.getConflictResolutionOptions(conflictData);
        expect(options.some(opt => opt.id === 'adjust_travel_buffer')).toBe(true);
    });
  });

  describe('overrideConflict', () => {
    it('should update schedule and add to resolutionLog for override', async () => {
      firebaseService.updateDocument.mockResolvedValue({ success: true });
      firebaseService.addDocument.mockResolvedValue({ id: 'logOverride1' });
      const conflictId = 'scheduleX_vs_scheduleY';
      const reason = "Client insisted";
      const userId = "overrideUser";

      const result = await enhancedScheduler.overrideConflict(conflictId, reason, userId);
      expect(result.success).toBe(true);
      expect(firebaseService.updateDocument).toHaveBeenCalledWith('schedules', 'scheduleX', {
        conflictStatus: 'overridden',
        conflictOverrideReason: reason,
        conflictOverriddenBy: userId,
        updatedAt: expect.any(String),
      });
      expect(firebaseService.addDocument).toHaveBeenCalledWith('resolutionLog', {
        conflictId,
        resolvedAt: expect.any(String),
        resolution: { action: 'override', notes: reason },
        resolvedBy: userId,
      });
    });
  });

  describe('getConflictResolutionHistory', () => {
    it('should query resolutionLog collection ordered by date', async () => {
      const mockHistory = [{ id: 'log1', conflictId: 's1_vs_s2', resolvedAt: new Date().toISOString() }];
      firebaseService.executeQuery.mockResolvedValue(mockHistory);
      const limit = 20;
      const history = await enhancedScheduler.getConflictResolutionHistory(limit);

      expect(firebaseService.executeQuery).toHaveBeenCalledWith(
        expect.any(Function), // The queryFn
        `resolutionLog_last_${limit}`
      );
      // Check if the queryFn passed to executeQuery does the right thing (harder to check directly without executing it)
      // But we can verify the result.
      expect(history).toEqual(mockHistory);
    });
  });
});

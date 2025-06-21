// tests/enhanced-scheduler.service.test.js
const EnhancedScheduler = require('../services/enhanced-scheduler');
const { firebaseService } = require('../services/firebase'); // Will be mocked

jest.mock('../services/firebase', () => ({
  firebaseService: {
    // Mock any methods used by EnhancedScheduler if needed for other tests,
    // getCaregiverAvailability is used by functions that call isCaregiverAvailable,
    // but isCaregiverAvailable itself receives availabilityData directly.
    getCaregiverAvailability: jest.fn(),
    getClient: jest.fn(),
    getAllCaregivers: jest.fn(),
    getSchedule: jest.fn(),
    getSchedulesByCaregiverAndDate: jest.fn(),
    // Add other mocks as necessary for comprehensive testing of the class
  }
}));

// Mock realTimeUpdatesService if its methods are called and have side effects
jest.mock('../app/services/real-time-updates', () => ({
  publish: jest.fn().mockResolvedValue(true),
}));


describe('EnhancedScheduler Service', () => {
  let scheduler;

  beforeEach(() => {
    // Create a new instance of EnhancedScheduler before each test
    // This ensures that we are using the actual class instance for tests.
    // Since EnhancedScheduler is exported as `new EnhancedScheduler()`, we need to work around it
    // or change the export to export the class itself for easier testing.
    // For now, let's assume we can test its prototype methods or re-require.

    // Option 1: Test prototype methods directly (less ideal for methods relying on `this`)
    // scheduler = EnhancedScheduler.prototype; // Not quite right as `this` context would be off

    // Option 2: Re-require and get the instance (if module caching allows a fresh one, or reset modules)
    // jest.resetModules();
    // scheduler = require('../services/enhanced-scheduler');

    // Option 3: If EnhancedScheduler was exported as a class: `new EnhancedScheduler()`
    // For now, we will test the methods of the singleton instance.
    scheduler = require('../services/enhanced-scheduler');
    jest.clearAllMocks(); // Clear mocks before each test
  });

  describe('timeToMinutes', () => {
    it('should convert HH:MM time string to minutes from midnight', () => {
      expect(scheduler.timeToMinutes('00:00')).toBe(0);
      expect(scheduler.timeToMinutes('01:00')).toBe(60);
      expect(scheduler.timeToMinutes('10:30')).toBe(630);
      expect(scheduler.timeToMinutes('23:59')).toBe(1439);
    });

    it('should return null for invalid time strings', () => {
      expect(scheduler.timeToMinutes('24:00')).toBeNull();
      expect(scheduler.timeToMinutes('10:60')).toBeNull();
      expect(scheduler.timeToMinutes('abc')).toBeNull();
      expect(scheduler.timeToMinutes('10')).toBeNull();
      expect(scheduler.timeToMinutes(null)).toBeNull();
      expect(scheduler.timeToMinutes('')).toBeNull();
    });
  });

  describe('isCaregiverAvailable', () => {
    const requestedDateStr = '2024-07-16'; // A Tuesday
    const requestedStartTimeStr = '10:00';
    const requestedEndTimeStr = '12:00';

    it('should return false if availabilityData is null or undefined', () => {
      expect(scheduler.isCaregiverAvailable(null, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
      expect(scheduler.isCaregiverAvailable(undefined, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
    });

    it('should return false for missing required parameters', () => {
      const availabilityData = { specific_slots: [], general_rules: [], time_off: [] };
      expect(scheduler.isCaregiverAvailable(availabilityData, null, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, null, requestedEndTimeStr)).toBe(false);
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, null)).toBe(false);
    });

    it('should return false if caregiver is on PTO for the requested date', () => {
      const availabilityData = {
        time_off: [
          { id: 'pto1', start_datetime: '2024-07-15T00:00:00Z', end_datetime: '2024-07-17T23:59:59Z', reason: 'Vacation' }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
    });

    it('should return true if a specific slot matches', () => {
      const availabilityData = {
        specific_slots: [
          { day: 'Tuesday', start: '09:00', end: '13:00' }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(true);
    });

    it('should return false if specific slot does not match day', () => {
      const availabilityData = {
        specific_slots: [
          { day: 'Monday', start: '09:00', end: '13:00' }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
    });

    it('should return false if specific slot does not match time', () => {
      const availabilityData = {
        specific_slots: [
          { day: 'Tuesday', start: '13:00', end: '15:00' }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
    });

    it('should return true if a general rule matches and no exceptions apply', () => {
      const availabilityData = {
        general_rules: [
          {
            id: 'rule1', type: 'weekly_recurring',
            days_of_week: ['Monday', 'Tuesday', 'Wednesday'],
            start_time: '09:00', end_time: '17:00'
          }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(true);
    });

    it('should return false if general rule matches but an exception applies (full day)', () => {
      const availabilityData = {
        general_rules: [
          {
            id: 'rule1', type: 'weekly_recurring',
            days_of_week: ['Tuesday'], start_time: '09:00', end_time: '17:00',
            exceptions: [{ date: '2024-07-16', reason: 'Full day exception' }]
          }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
    });

    it('should return false if general rule matches but an exception applies (specific time)', () => {
      const availabilityData = {
        general_rules: [
          {
            id: 'rule1', type: 'weekly_recurring',
            days_of_week: ['Tuesday'], start_time: '09:00', end_time: '17:00',
            exceptions: [{ date: '2024-07-16', start_time: '10:00', end_time: '12:00', reason: 'Partial exception' }]
          }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
    });

    it('should return true if general rule matches and exception is for a different time', () => {
      const availabilityData = {
        general_rules: [
          {
            id: 'rule1', type: 'weekly_recurring',
            days_of_week: ['Tuesday'], start_time: '09:00', end_time: '17:00',
            exceptions: [{ date: '2024-07-16', start_time: '13:00', end_time: '15:00', reason: 'Later exception' }]
          }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(true);
    });

    it('should return true if general rule matches and exception is for a different day', () => {
      const availabilityData = {
        general_rules: [
          {
            id: 'rule1', type: 'weekly_recurring',
            days_of_week: ['Tuesday'], start_time: '09:00', end_time: '17:00',
            exceptions: [{ date: '2024-07-17', reason: 'Different day exception' }]
          }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(true);
    });

    it('should prioritize time_off over general rules and specific slots', () => {
      const availabilityData = {
        time_off: [
          { id: 'pto1', start_datetime: '2024-07-16T08:00:00Z', end_datetime: '2024-07-16T18:00:00Z', reason: 'Vacation' }
        ],
        specific_slots: [
          { day: 'Tuesday', start: '09:00', end: '13:00' }
        ],
        general_rules: [
          {
            id: 'rule1', type: 'weekly_recurring',
            days_of_week: ['Tuesday'], start_time: '09:00', end_time: '17:00'
          }
        ]
      };
      expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, requestedStartTimeStr, requestedEndTimeStr)).toBe(false);
    });

    it('should prioritize specific_slots over general_rules if both could apply and slot makes available', () => {
        // This scenario: specific slot makes available, general rule might make unavailable (e.g. due to exception)
        // The current logic checks specific slots first, then general rules. If a specific slot matches, it returns true.
        const availabilityData = {
            specific_slots: [
                { day: 'Tuesday', start: '10:00', end: '12:00' } // This matches
            ],
            general_rules: [
              { // This general rule also matches the day/time, but has an exception
                id: 'rule1', type: 'weekly_recurring',
                days_of_week: ['Tuesday'], start_time: '09:00', end_time: '17:00',
                exceptions: [{ date: '2024-07-16', start_time: '10:00', end_time: '12:00', reason: 'Blocked'}]
              }
            ]
          };
        expect(scheduler.isCaregiverAvailable(availabilityData, requestedDateStr, '10:30', '11:30')).toBe(true);
    });

    it('should handle general rule effective dates correctly', () => {
        const availabilityData = {
            general_rules: [
              {
                id: 'ruleFuture', type: 'weekly_recurring', days_of_week: ['Tuesday'],
                start_time: '09:00', end_time: '17:00', effective_start_date: '2024-08-01'
              },
              {
                id: 'rulePast', type: 'weekly_recurring', days_of_week: ['Tuesday'],
                start_time: '09:00', end_time: '17:00', effective_end_date: '2024-07-01'
              },
               {
                id: 'ruleCurrent', type: 'weekly_recurring', days_of_week: ['Tuesday'],
                start_time: '09:00', end_time: '17:00', effective_start_date: '2024-07-01', effective_end_date: '2024-07-30'
              }
            ]
          };
        expect(scheduler.isCaregiverAvailable(availabilityData, '2024-07-16', '10:00', '12:00')).toBe(true); // ruleCurrent applies
        expect(scheduler.isCaregiverAvailable(availabilityData, '2024-08-06', '10:00', '12:00')).toBe(true); // ruleFuture applies
        expect(scheduler.isCaregiverAvailable(availabilityData, '2024-06-25', '10:00', '12:00')).toBe(true); // rulePast IS active
    });

  });

  describe('optimizeSchedules', () => {
    let mockClientShifts;
    let mockCaregivers;

    beforeEach(() => {
      // Reset mocks for firebaseService if they are stateful between describe blocks
      // For getClient, getCaregiverAvailability, etc.
      firebaseService.getClient.mockReset();
      firebaseService.getCaregiverAvailability.mockReset();
      firebaseService.getSchedulesByCaregiverAndDate.mockReset(); // Used by checkScheduleConflictsWithCaregiver

      mockClientShifts = [
        {
          id: 'shift1', clientId: 'clientA', clientName: 'Client Alpha',
          date: '2024-07-17', startTime: '09:00', endTime: '13:00', durationHours: 4,
          requiredSkills: ['skillA'], location: { latitude: 1, longitude: 1 }, clientBusLineAccess: false
        },
      ];
      mockCaregivers = [
        {
          id: 'cg1', name: 'Caregiver One', skills: ['skillA', 'skillB'], drives_car: true,
          max_days_per_week: 5, max_hours_per_week: 40, target_weekly_hours: 30,
          availabilityData: { // Tuesday, Wednesday, Thursday 9-5
            general_rules: [{ id: 'cg1rule', type: 'weekly_recurring', days_of_week: ['Tuesday', 'Wednesday', 'Thursday'], start_time: '09:00', end_time: '17:00' }]
          }
        },
      ];
    });

    it('should assign a simple shift to a perfectly matching caregiver', async () => {
      // clientShiftsToFill for Wednesday 09:00-13:00
      mockClientShifts[0].date = '2024-07-17'; // Wednesday

      const result = await scheduler.optimizeSchedules(mockClientShifts, mockCaregivers);

      expect(result.assignments.length).toBe(1);
      expect(result.unmetShifts.length).toBe(0);
      expect(result.assignments[0].caregiverId).toBe('cg1');
      expect(result.assignments[0].shiftId).toBe('shift1');
      expect(result.optimization_summary.shiftsAssigned).toBe(1);
      expect(result.optimization_summary.caregiversUtilized).toBe(1);
    });

    it('should not assign if caregiver exceeds max_hours_per_week', async () => {
      mockCaregivers[0].max_hours_per_week = 3; // Shift is 4 hours
      mockClientShifts[0].date = '2024-07-17'; // Wednesday

      const result = await scheduler.optimizeSchedules(mockClientShifts, mockCaregivers);

      expect(result.assignments.length).toBe(0);
      expect(result.unmetShifts.length).toBe(1);
      expect(result.unmetShifts[0].id).toBe('shift1');
    });

    it('should not assign if caregiver has no more days in max_days_per_week', async () => {
      mockCaregivers[0].max_days_per_week = 1;
      // Pre-assign one shift to use up the day
      mockCaregivers[0].workedDaysThisPeriod = new Set(['2024-07-16']); // Assign a shift on Tuesday

      mockClientShifts = [
        { id: 'shift2', clientId: 'clientB', clientName: 'Client Beta', date: '2024-07-17', startTime: '10:00', endTime: '14:00', durationHours: 4, requiredSkills: ['skillA']},
      ];

      const result = await scheduler.optimizeSchedules(mockClientShifts, mockCaregivers);

      expect(result.assignments.length).toBe(0);
      expect(result.unmetShifts.length).toBe(1);
      expect(result.unmetShifts[0].id).toBe('shift2');
    });

    it('should not assign multiple shifts on the same day to the same caregiver', async () => {
      mockClientShifts = [
        { id: 'shift1', clientId: 'clientA', clientName: 'Client Alpha', date: '2024-07-17', startTime: '09:00', endTime: '11:00', durationHours: 2, requiredSkills: ['skillA'] },
        { id: 'shift2', clientId: 'clientB', clientName: 'Client Beta', date: '2024-07-17', startTime: '13:00', endTime: '15:00', durationHours: 2, requiredSkills: ['skillA'] },
      ];

      const result = await scheduler.optimizeSchedules(mockClientShifts, mockCaregivers);

      expect(result.assignments.length).toBe(1); // Only one shift should be assigned
      expect(result.unmetShifts.length).toBe(1);
      // The first shift should be assigned
      expect(result.assignments[0].shiftId).toBe('shift1');
      expect(result.unmetShifts[0].id).toBe('shift2');
    });

    it('should not assign if skills do not match', async () => {
      mockClientShifts[0].date = '2024-07-17'; // Wednesday
      mockClientShifts[0].requiredSkills = ['skillX']; // Skill caregiver doesn't have

      const result = await scheduler.optimizeSchedules(mockClientShifts, mockCaregivers);

      expect(result.assignments.length).toBe(0);
      expect(result.unmetShifts.length).toBe(1);
    });

    it('should not assign if caregiver not available via isCaregiverAvailable (e.g. wrong day)', async () => {
      mockClientShifts[0].date = '2024-07-15'; // Monday, caregiver cg1 not available

      const result = await scheduler.optimizeSchedules(mockClientShifts, mockCaregivers);

      expect(result.assignments.length).toBe(0);
      expect(result.unmetShifts.length).toBe(1);
    });

    it('should assign to different caregivers if one is maxed out', async () => {
      mockClientShifts = [
        { id: 's1', clientId: 'cA', clientName: 'CA', date: '2024-07-17', startTime: '09:00', endTime: '17:00', durationHours: 8, requiredSkills: ['skillA'] }, // Wed
        { id: 's2', clientId: 'cB', clientName: 'CB', date: '2024-07-18', startTime: '09:00', endTime: '17:00', durationHours: 8, requiredSkills: ['skillA'] }, // Thu
      ];
      mockCaregivers = [
        {
          id: 'cg1', name: 'CG One', skills: ['skillA'], drives_car: true,
          max_days_per_week: 1, max_hours_per_week: 8,
          availabilityData: { general_rules: [{ id: 'r1', type: 'weekly_recurring', days_of_week: ['Wednesday', 'Thursday'], start_time: '08:00', end_time: '18:00' }] }
        },
        {
          id: 'cg2', name: 'CG Two', skills: ['skillA'], drives_car: true,
          max_days_per_week: 5, max_hours_per_week: 40,
          availabilityData: { general_rules: [{ id: 'r2', type: 'weekly_recurring', days_of_week: ['Wednesday', 'Thursday'], start_time: '08:00', end_time: '18:00' }] }
        },
      ];

      const result = await scheduler.optimizeSchedules(mockClientShifts, mockCaregivers);
      expect(result.assignments.length).toBe(2);
      expect(result.unmetShifts.length).toBe(0);
      const assignedCaregivers = new Set(result.assignments.map(a => a.caregiverId));
      expect(assignedCaregivers.size).toBe(2); // Should use both caregivers
      expect(result.assignments.find(a=>a.shiftId === 's1').caregiverId).toBe('cg1'); // cg1 takes first shift
      expect(result.assignments.find(a=>a.shiftId === 's2').caregiverId).toBe('cg2'); // cg2 takes second
    });

    // TODO: Add tests for transportation mismatch (drives_car vs clientBusLineAccess)
    // TODO: Add tests for more complex scoring/selection when multiple caregivers are valid candidates
    // TODO: Add tests for 'Last Resort' simultaneous client coverage (once implemented)
  });
});

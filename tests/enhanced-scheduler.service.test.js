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
});

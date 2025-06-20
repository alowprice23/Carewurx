// frontend/src/services/__tests__/universalScheduleService.spec.js
import { isElectronAvailable } from '../firebaseService';
// Note: universalScheduleService and firebase are imported dynamically in beforeEach/describe blocks

// Define these at the top level
const mockScheduleIdTopLevel = 'sched123';
const mockDateTopLevel = '2024-08-15';


// Mock firebaseService to control isElectronAvailable
jest.mock('../firebaseService', () => ({
  isElectronAvailable: jest.fn(),
}));

// Mock firebase for auth - This needs to be at the top level
const mockGetIdToken = jest.fn();
let mockCurrentUser = null;

jest.mock('../firebase', () => ({
  auth: () => ({
    get currentUser() { return mockCurrentUser; }, // Use getter
  }),
}));

// Mock window.electronAPI including nested scheduler namespace
const mockElectronAPISchedulerNamespace = {
  getConflicts: jest.fn(),
  getConflictResolutionOptions: jest.fn(),
  resolveConflict: jest.fn(),
  overrideConflict: jest.fn(),
  getConflictResolutionHistory: jest.fn(),
};

const mockElectronAPIFlat = {
  getCircularEntities: jest.fn(),
  getSchedule: jest.fn(),
  getSchedulesByClientId: jest.fn(),
  getSchedulesByCaregiverId: jest.fn(),
  updateSchedule: jest.fn(),
  checkScheduleConflicts: jest.fn(),
  getCaregiverAvailability: jest.fn(),
  updateCaregiverAvailability: jest.fn(),
  createSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
  getScheduleWithDetails: jest.fn(),
  findBestCaregiver: jest.fn(),
  optimizeSchedules: jest.fn(),
};

global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: {
    ...mockElectronAPIFlat,
    scheduler: mockElectronAPISchedulerNamespace,
  },
  writable: true,
});

describe('UniversalScheduleService', () => {
  const mockToken = 'test-id-token';
  let universalScheduleService;

  const mockClientId = 'clientABC';
  const mockCaregiverId = 'cgXYZ';
  // Use mockDateTopLevel for mockScheduleData
  const mockScheduleData = { description: 'Test Schedule', date: mockDateTopLevel };


  beforeEach(() => {
    jest.resetModules();

    mockCurrentUser = null;
    mockGetIdToken.mockClear().mockResolvedValue('test-id-token');

    universalScheduleService = require('../universalScheduleService').default;

    for (const key in mockElectronAPIFlat) {
        mockElectronAPIFlat[key].mockClear();
    }
    for (const key in mockElectronAPISchedulerNamespace) {
        mockElectronAPISchedulerNamespace[key].mockClear();
    }
    // Also clear the mock for isElectronAvailable (the actual mock function from jest.mock)
    require('../firebaseService').isElectronAvailable.mockClear();
  });

  const testMethod = (methodName, ipcMethodName, serviceArgs, expectedIpcArgsPayload, isSchedulerNamespace = false) => {
    describe(methodName, () => {
      const apiMockObject = isSchedulerNamespace ? mockElectronAPISchedulerNamespace : mockElectronAPIFlat;

      it(`should call electronAPI${isSchedulerNamespace ? '.scheduler' : ''}.${ipcMethodName} with idToken if in Electron and authenticated`, async () => {
        require('../firebaseService').isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, data: 'mockData' };
        apiMockObject[ipcMethodName].mockResolvedValue(mockResponse);

        const result = await universalScheduleService[methodName](...serviceArgs);

        expect(mockGetIdToken).toHaveBeenCalled();
        if (methodName === 'getSchedules') { // Special case for getSchedules
          expect(apiMockObject[ipcMethodName]).toHaveBeenCalledWith(
            'schedules', // First argument
            { idToken: mockToken, ...expectedIpcArgsPayload } // Second argument
          );
        } else {
          expect(apiMockObject[ipcMethodName]).toHaveBeenCalledWith({
            idToken: mockToken,
            ...expectedIpcArgsPayload,
          });
        }
        expect(result).toEqual(mockResponse);
      });

      it(`should throw error in Electron mode if not authenticated for ${methodName}`, async () => {
        require('../firebaseService').isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;

        await expect(universalScheduleService[methodName](...serviceArgs))
          .rejects.toThrow('Authentication required');
        expect(apiMockObject[ipcMethodName]).not.toHaveBeenCalled();
      });

      it(`should use mock logic or throw in browser mode for ${methodName}`, async () => {
        require('../firebaseService').isElectronAvailable.mockReturnValue(false);
        mockCurrentUser = null; // Should not matter for browser mode

        // Reset MOCK_SCHEDULES_DB within service for predictable browser tests if service modifies it.
        // This is complex for singletons. Assuming service's internal mock DB is reset or behavior is understood.
        // For create/delete, ensure items exist/don't exist in the service's internal MOCK_SCHEDULES_DB.

        if (methodName === 'getSchedules' || methodName === 'getClientSchedules' || methodName === 'getCaregiverSchedules') {
          const result = await universalScheduleService[methodName](...serviceArgs);
          expect(result).toEqual(expect.any(Array));
        } else if (methodName === 'getSchedule' || methodName === 'getScheduleWithDetails' || methodName === 'findBestCaregiver') {
          const result = await universalScheduleService[methodName](...serviceArgs);
          // Service's internal MOCK_SCHEDULES_DB determines result here.
          // e.g. if serviceArgs[0] is 'schedule1' (which is in service's MOCK_SCHEDULES_DB)
          if (serviceArgs[0] === 'schedule1' || (serviceArgs[0] === mockScheduleIdTopLevel && universalScheduleService.MOCK_SCHEDULES_DB_INTERNAL_TEST_ONLY && universalScheduleService.MOCK_SCHEDULES_DB_INTERNAL_TEST_ONLY[serviceArgs[0]])) {
             expect(result).toBeDefined();
          } else if (methodName !== 'createSchedule'){
             expect(result).toBeNull();
          }
        } else if (methodName === 'createSchedule') {
            const result = await universalScheduleService[methodName](...serviceArgs);
            expect(result).toHaveProperty('id');
        } else if (methodName === 'deleteSchedule') {
            // For browser mode, ensure the item exists in the service's internal MOCK_SCHEDULES_DB
            // Then delete and check. This requires the service to expose its mock DB or have reliable add/delete for tests.
            // Let's assume the service's internal MOCK_SCHEDULES_DB has 'schedule1'.
            await universalScheduleService.createSchedule({id: 'schedule1', description: 'Pre-existing for delete test'}); // Ensure it exists
            const result = await universalScheduleService[methodName]('schedule1');
            expect(result.success).toBe(true);
        } else {
          const result = await universalScheduleService[methodName](...serviceArgs);
          expect(result).toBeDefined();
        }
        expect(apiMockObject[ipcMethodName]).not.toHaveBeenCalled(); // Corrected from ipcName to ipcMethodName
      });
    });
  };

  // Call testMethod for each service method
  // Using mockScheduleIdTopLevel and mockDateTopLevel for consistency
  testMethod('getSchedules', 'getCircularEntities', [{ startDate: '2024-01-01' }], { options: { startDate: '2024-01-01' } });
  testMethod('getSchedule', 'getSchedule', [mockScheduleIdTopLevel], { scheduleId: mockScheduleIdTopLevel });
  testMethod('getClientSchedules', 'getSchedulesByClientId', [mockClientId, mockDateTopLevel, mockDateTopLevel], { clientId: mockClientId, startDate: mockDateTopLevel, endDate: mockDateTopLevel });
  testMethod('getCaregiverSchedules', 'getSchedulesByCaregiverId', [mockCaregiverId, mockDateTopLevel, mockDateTopLevel], { caregiverId: mockCaregiverId, startDate: mockDateTopLevel, endDate: mockDateTopLevel });
  testMethod('updateSchedule', 'updateSchedule', [mockScheduleIdTopLevel, { status: 'Confirmed' }], { scheduleId: mockScheduleIdTopLevel, changes: { status: 'Confirmed' } });
  testMethod('findConflicts', 'checkScheduleConflicts', [mockScheduleIdTopLevel], { scheduleId: mockScheduleIdTopLevel });
  testMethod('getCaregiverAvailability', 'getCaregiverAvailability', [mockCaregiverId], { caregiverId: mockCaregiverId });
  testMethod('updateCaregiverAvailability', 'updateCaregiverAvailability', [mockCaregiverId, { timeOff: [] }], { caregiverId: mockCaregiverId, availabilityData: { timeOff: [] } });
  testMethod('createSchedule', 'createSchedule', [mockScheduleData], { scheduleData: mockScheduleData });
  testMethod('deleteSchedule', 'deleteSchedule', [mockScheduleIdTopLevel], { scheduleId: mockScheduleIdTopLevel });
  testMethod('getScheduleWithDetails', 'getScheduleWithDetails', [mockScheduleIdTopLevel], { scheduleId: mockScheduleIdTopLevel });
  testMethod('findBestCaregiver', 'findBestCaregiver', [mockScheduleIdTopLevel], { scheduleId: mockScheduleIdTopLevel });
  testMethod('optimizeSchedules', 'optimizeSchedules', [mockDateTopLevel], { date: mockDateTopLevel });

  // Conflict Resolution Methods (use scheduler namespace)
  testMethod('getConflicts', 'getConflicts', [{ status: 'pending' }], { filterOptions: { status: 'pending' } }, true);
  testMethod('getConflictResolutionOptions', 'getConflictResolutionOptions', [{ id: 'c1' }], { conflictData: { id: 'c1' } }, true);
  const resData = { conflictId: 'c1', resolutionOptionId: 'opt1', note: 'Resolved' };
  testMethod('resolveConflict', 'resolveConflict', [resData], { conflictId: resData.conflictId, resolutionData: resData }, true);
  const overrideData = { conflictId: 'c1', overrideReason: 'Test', userId: 'user1' };
  testMethod('overrideConflict', 'overrideConflict', [overrideData], { overrideData: overrideData }, true);
  testMethod('getConflictResolutionHistory', 'getConflictResolutionHistory', [10], { limit: 10 }, true);

});

// This was a helper for test logic, but browser tests should rely on the service's internal mocks.
// The service's internal MOCK_SCHEDULES_DB is what its browser-mode logic uses.
// const MOCK_SCHEDULES_DB_TEST_HELPER = {
//   schedule1: { id: 'schedule1', description: 'Morning Visit', clientId: 'client1', caregiverId: 'cg1', date: '2024-08-01', startTime: '09:00', endTime: '11:00', status: 'Confirmed' },
//   [mockScheduleIdTopLevel]: { id: mockScheduleIdTopLevel, description: 'Test Schedule', date: mockDateTopLevel }
// };

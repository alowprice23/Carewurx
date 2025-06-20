// frontend/src/services/__tests__/schedulerService.spec.js
import schedulerService from '../schedulerService';
import { isElectronAvailable } from '../firebaseService';
import firebase from '../firebase';

// Mock firebaseService to control isElectronAvailable
jest.mock('../firebaseService', () => ({
  isElectronAvailable: jest.fn(),
}));

// Mock firebase for auth
const mockGetIdToken = jest.fn().mockResolvedValue('test-id-token');
let mockCurrentUser = null;

jest.mock('../firebase', () => ({
  auth: () => ({
    currentUser: mockCurrentUser,
  }),
}));

// Mock window.electronAPI for all scheduler methods
const mockElectronAPIScheduler = {
  createSchedule: jest.fn(),
  updateSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
  findBestCaregiver: jest.fn(),
  createClientSchedule: jest.fn(),
  assignCaregiverToSchedule: jest.fn(),
  findAvailableCaregivers: jest.fn(),
  checkScheduleConflicts: jest.fn(),
  resolveScheduleConflict: jest.fn(),
  getScheduleWithDetails: jest.fn(),
  optimizeSchedules: jest.fn(),
};

global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPIScheduler,
  writable: true,
});

describe('SchedulerService', () => {
  const mockToken = 'test-id-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
    mockGetIdToken.mockClear().mockResolvedValue('test-id-token');

    // Reset all electronAPI scheduler mocks
    for (const key in mockElectronAPIScheduler) {
      mockElectronAPIScheduler[key].mockReset();
    }
  });

  const testCases = [
    {
      methodName: 'createSchedule',
      ipcMethodName: 'createSchedule',
      serviceArgs: [{ MOCK_DATA: 'scheduleData' }],
      expectedIpcArgs: { scheduleData: { MOCK_DATA: 'scheduleData' } },
    },
    {
      methodName: 'updateSchedule',
      ipcMethodName: 'updateSchedule',
      serviceArgs: ['sch123', { MOCK_DATA: 'updatedData' }],
      expectedIpcArgs: { scheduleId: 'sch123', updatedData: { MOCK_DATA: 'updatedData' } },
    },
    {
      methodName: 'deleteSchedule',
      ipcMethodName: 'deleteSchedule',
      serviceArgs: ['sch123'],
      expectedIpcArgs: { scheduleId: 'sch123' },
    },
    {
      methodName: 'findBestCaregiver',
      ipcMethodName: 'findBestCaregiver',
      serviceArgs: ['sch123'],
      expectedIpcArgs: { scheduleId: 'sch123' },
    },
    {
      methodName: 'createClientSchedule',
      ipcMethodName: 'createClientSchedule',
      serviceArgs: ['client123', { MOCK_DATA: 'scheduleData' }],
      expectedIpcArgs: { clientId: 'client123', scheduleData: { MOCK_DATA: 'scheduleData' } },
    },
    {
      methodName: 'assignCaregiverToSchedule',
      ipcMethodName: 'assignCaregiverToSchedule',
      serviceArgs: ['sch123', 'cg123'],
      expectedIpcArgs: { scheduleId: 'sch123', caregiverId: 'cg123' },
    },
    {
      methodName: 'findAvailableCaregivers',
      ipcMethodName: 'findAvailableCaregivers',
      serviceArgs: ['sch123'],
      expectedIpcArgs: { scheduleId: 'sch123' },
    },
    {
      methodName: 'checkConflicts', // Service method name
      ipcMethodName: 'checkScheduleConflicts', // IPC method name
      serviceArgs: ['sch123'],
      expectedIpcArgs: { scheduleId: 'sch123' },
    },
    {
      methodName: 'resolveConflict',
      ipcMethodName: 'resolveScheduleConflict',
      serviceArgs: ['conflict123', { MOCK_DATA: 'resolutionData' }],
      expectedIpcArgs: { conflictId: 'conflict123', resolution: { MOCK_DATA: 'resolutionData' } },
    },
    {
      methodName: 'getScheduleWithDetails',
      ipcMethodName: 'getScheduleWithDetails',
      serviceArgs: ['sch123'],
      expectedIpcArgs: { scheduleId: 'sch123' },
    },
    {
      methodName: 'optimizeSchedules',
      ipcMethodName: 'optimizeSchedules',
      serviceArgs: ['2024-01-01'],
      expectedIpcArgs: { date: '2024-01-01' },
    },
  ];

  testCases.forEach(({ methodName, ipcMethodName, serviceArgs, expectedIpcArgs }) => {
    describe(methodName, () => {
      it(`should call electronAPI.${ipcMethodName} with idToken in Electron mode if authenticated`, async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, data: 'mockData' };
        mockElectronAPIScheduler[ipcMethodName].mockResolvedValue(mockResponse);

        const result = await schedulerService[methodName](...serviceArgs);

        expect(mockGetIdToken).toHaveBeenCalled();
        expect(mockElectronAPIScheduler[ipcMethodName]).toHaveBeenCalledWith({
          idToken: mockToken,
          ...expectedIpcArgs,
        });
        expect(result).toEqual(mockResponse);
      });

      it(`should throw error in Electron mode if not authenticated for ${methodName}`, async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;

        await expect(schedulerService[methodName](...serviceArgs))
          .rejects.toThrow('Authentication required');
        expect(mockElectronAPIScheduler[ipcMethodName]).not.toHaveBeenCalled();
      });

      it(`should throw error in browser mode for ${methodName}`, async () => {
        isElectronAvailable.mockReturnValue(false);

        await expect(schedulerService[methodName](...serviceArgs))
          .rejects.toThrow('Electron API not available');
        expect(mockElectronAPIScheduler[ipcMethodName]).not.toHaveBeenCalled();
      });

      it(`should propagate error from electronAPI.${ipcMethodName} if authenticated`, async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const ipcError = new Error('IPC Error');
        mockElectronAPIScheduler[ipcMethodName].mockRejectedValue(ipcError);

        await expect(schedulerService[methodName](...serviceArgs))
          .rejects.toThrow(`Failed to ${methodName.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}: ${ipcError.message}`); // Adjust based on actual error message construction in service
        expect(mockGetIdToken).toHaveBeenCalled();
      });
    });
  });
});

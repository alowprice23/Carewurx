import availabilityService from '../availabilityService';
import { isElectronAvailable } from '../firebaseService';
import firebase from '../firebase'; // To be mocked for auth

// Mock firebaseService to control isElectronAvailable
jest.mock('../firebaseService', () => ({
  isElectronAvailable: jest.fn(),
}));

// Mock firebase for auth
const mockGetIdToken = jest.fn().mockResolvedValue('test-id-token');
let mockCurrentUser = null;

jest.mock('../firebase', () => ({
  auth: () => ({
    currentUser: mockCurrentUser, // This will be dynamically set in test cases
  }),
}));

// Mock window.electronAPI
global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: {
    getCaregiverAvailability: jest.fn(),
    updateCaregiverAvailability: jest.fn(),
    getAllCaregivers: jest.fn(),
    getSchedulesByCaregiverId: jest.fn(),
  },
  writable: true,
});

describe('AvailabilityService', () => {
  const mockToken = 'test-id-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
    mockGetIdToken.mockClear().mockResolvedValue('test-id-token');

    // Reset IPC method mocks
    for (const key in window.electronAPI) {
      if (typeof window.electronAPI[key].mockReset === 'function') {
        window.electronAPI[key].mockReset();
      }
    }
  });

  const caregiverId = 'cgTest1';

  describe('getCaregiverAvailability', () => {
    const mockApiAvailability = {
      regularSchedule: [{ dayOfWeek: 1, startTime: '08:00', endTime: '16:00' }],
      timeOff: [{ startDate: '2024-07-04', endDate: '2024-07-04' }],
    };

    it('should call electronAPI.getCaregiverAvailability with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      window.electronAPI.getCaregiverAvailability.mockResolvedValue(mockApiAvailability);

      const result = await availabilityService.getCaregiverAvailability(caregiverId);
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(window.electronAPI.getCaregiverAvailability).toHaveBeenCalledWith({ idToken: mockToken, caregiverId });
      expect(result).toEqual(mockApiAvailability);
    });

    it('should throw error in Electron mode if not authenticated for getCaregiverAvailability', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(availabilityService.getCaregiverAvailability(caregiverId))
        .rejects.toThrow('Authentication required');
      expect(window.electronAPI.getCaregiverAvailability).not.toHaveBeenCalled();
    });

    it('should return mock availability in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await availabilityService.getCaregiverAvailability(caregiverId);
      expect(result).toHaveProperty('regularSchedule');
      expect(result).toHaveProperty('timeOff');
      expect(window.electronAPI.getCaregiverAvailability).not.toHaveBeenCalled();
    });

    it('should return empty defaults if Electron API returns null (authenticated)', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken }; // Added auth simulation
      window.electronAPI.getCaregiverAvailability.mockResolvedValue(null);
      const result = await availabilityService.getCaregiverAvailability(caregiverId);
      expect(mockGetIdToken).toHaveBeenCalled(); // Ensure auth check was made
      expect(result).toEqual({ regularSchedule: [], timeOff: [] });
    });
  });

  describe('updateCaregiverAvailability', () => {
    const availabilityData = {
      regularSchedule: [{ dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }],
      timeOff: [],
    };
    const mockSuccessResponse = { success: true };

    it('should call electronAPI.updateCaregiverAvailability with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      window.electronAPI.updateCaregiverAvailability.mockResolvedValue(mockSuccessResponse);

      const result = await availabilityService.updateCaregiverAvailability(caregiverId, availabilityData);
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(window.electronAPI.updateCaregiverAvailability).toHaveBeenCalledWith({ idToken: mockToken, caregiverId, availabilityData });
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should throw error in Electron mode if not authenticated for updateCaregiverAvailability', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(availabilityService.updateCaregiverAvailability(caregiverId, availabilityData))
        .rejects.toThrow('Authentication required');
      expect(window.electronAPI.updateCaregiverAvailability).not.toHaveBeenCalled();
    });

    it('should throw error if electronAPI.updateCaregiverAvailability indicates failure (authenticated)', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      window.electronAPI.updateCaregiverAvailability.mockResolvedValue({ success: false, error: 'Backend error' });
      await expect(availabilityService.updateCaregiverAvailability(caregiverId, availabilityData))
        .rejects.toThrow('Backend error');
      expect(mockGetIdToken).toHaveBeenCalled(); // Auth check still happens
    });

    it('should simulate update and return success in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await availabilityService.updateCaregiverAvailability(caregiverId, availabilityData);
      expect(result).toEqual({ success: true });
      expect(window.electronAPI.updateCaregiverAvailability).not.toHaveBeenCalled();
    });
  });

  describe('_getSchedulesByCaregiverAndDate', () => {
    const date = '2024-07-15';
    const mockSchedules = [{ id: 's1', date: date, startTime: '10:00', endTime: '12:00' }];

    it('should call electronAPI.getSchedulesByCaregiverId with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      window.electronAPI.getSchedulesByCaregiverId.mockResolvedValue(mockSchedules);

      const result = await availabilityService._getSchedulesByCaregiverAndDate(caregiverId, date);
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(window.electronAPI.getSchedulesByCaregiverId).toHaveBeenCalledWith({idToken: mockToken, caregiverId, startDate: date, endDate: date});
      expect(result).toEqual(mockSchedules);
    });

    it('should throw error in Electron mode if not authenticated for _getSchedulesByCaregiverAndDate', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(availabilityService._getSchedulesByCaregiverAndDate(caregiverId, date))
        .rejects.toThrow('Authentication required');
      expect(window.electronAPI.getSchedulesByCaregiverId).not.toHaveBeenCalled();
    });

    it('should return mock schedules in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await availabilityService._getSchedulesByCaregiverAndDate('cg1', date);
      expect(result).toEqual(expect.any(Array));
      expect(window.electronAPI.getSchedulesByCaregiverId).not.toHaveBeenCalled();
    });
  });

  describe('checkScheduleConflict', () => {
    const date = '2024-07-15'; // Monday
    const startTime = '10:00';
    const endTime = '12:00';

    beforeEach(() => {
        jest.spyOn(availabilityService, 'getCaregiverAvailability');
        jest.spyOn(availabilityService, '_getSchedulesByCaregiverAndDate');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return false (no conflict) if slot is available in Electron mode and authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      availabilityService.getCaregiverAvailability.mockResolvedValue({
        regularSchedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
        timeOff: [],
      });
      availabilityService._getSchedulesByCaregiverAndDate.mockResolvedValue([]);

      const conflict = await availabilityService.checkScheduleConflict(caregiverId, date, startTime, endTime);
      expect(conflict).toBe(false);
      expect(availabilityService.getCaregiverAvailability).toHaveBeenCalledWith(caregiverId); // Auth handled by actual method if not spied
    });

    it('should throw auth error if underlying getCaregiverAvailability fails due to auth in Electron mode (not spied)', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        // jest.restoreAllMocks(); // Use actual service methods for this test
        // Note: Spies are active from beforeEach. To test actual method, need to not use spy or clear it.
        // For this test, we'll assume the spy is NOT active for getCaregiverAvailability to test real propagation.
        // This requires careful management of spies if other tests in describe rely on them.
        // A cleaner way would be a separate describe block or more granular spy management.
        // Given the current structure, we test the scenario where the actual method is called.
        // If getCaregiverAvailability is spied and mockResolvedValue is used, it won't throw auth error.
        // So, we remove the spy for this specific test for getCaregiverAvailability.
        availabilityService.getCaregiverAvailability.mockRestore(); // Use actual method

        await expect(availabilityService.checkScheduleConflict(caregiverId, date, startTime, endTime))
            .rejects.toThrow('Authentication required to get caregiver availability.');
    });


    it('should correctly check conflict in browser mode using mock data (spied methods)', async () => {
      isElectronAvailable.mockReturnValue(false);
      const noConflictDate = '2024-07-15';
      const noConflictStartTime = '14:00';
      const noConflictEndTime = '16:00';

      availabilityService.getCaregiverAvailability.mockResolvedValue({
        regularSchedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
        timeOff: []
      });
      availabilityService._getSchedulesByCaregiverAndDate.mockResolvedValue([]);

      const conflict = await availabilityService.checkScheduleConflict('cg1', noConflictDate, noConflictStartTime, noConflictEndTime);
      expect(conflict).toBe(false);
    });
  });

  describe('getAvailableCaregivers', () => {
    const date = '2024-07-15';
    const startTime = '10:00';
    const endTime = '12:00';
    const mockCaregiversList = [
        { id: 'cg1', name: 'Available CG', skills: ['cpr'] },
        { id: 'cg2', name: 'Unavailable CG', skills: ['first-aid'] }
    ];

    beforeEach(() => {
        jest.spyOn(availabilityService, 'checkScheduleConflict');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should call electronAPI.getAllCaregivers with idToken and filter in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      window.electronAPI.getAllCaregivers.mockResolvedValue(mockCaregiversList);

      availabilityService.checkScheduleConflict.mockImplementation(async (cgId, d, st, et) => {
          return cgId === 'cg2';
      });

      const result = await availabilityService.getAvailableCaregivers(date, startTime, endTime);
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(window.electronAPI.getAllCaregivers).toHaveBeenCalledWith({idToken: mockToken});
      expect(availabilityService.checkScheduleConflict).toHaveBeenCalledTimes(mockCaregiversList.length);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('cg1');
    });

    it('should throw error if not authenticated before calling getAllCaregivers in Electron mode', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(availabilityService.getAvailableCaregivers(date, startTime, endTime))
            .rejects.toThrow('Authentication required');
        expect(window.electronAPI.getAllCaregivers).not.toHaveBeenCalled();
    });

    it('should use mock caregivers and filter in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      availabilityService.checkScheduleConflict.mockImplementation(async (cgId, d, st, et) => {
        return cgId === 'cg2';
      });

      const result = await availabilityService.getAvailableCaregivers(date, startTime, endTime);
      expect(window.electronAPI.getAllCaregivers).not.toHaveBeenCalled();
      expect(availabilityService.checkScheduleConflict).toHaveBeenCalled();
      expect(result.some(cg => cg.id === 'cg1')).toBe(true);
      expect(result.some(cg => cg.id === 'cg2')).toBe(false);
    });
  });

  describe('getNextAvailableSlots', () => {
    beforeEach(() => {
        jest.spyOn(availabilityService, 'getCaregiverAvailability');
        jest.spyOn(availabilityService, '_getSchedulesByCaregiverAndDate');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should use Electron API for data fetching in Electron mode (authenticated)', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };

        availabilityService.getCaregiverAvailability.mockResolvedValue({
            regularSchedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }], timeOff: []
        });
        availabilityService._getSchedulesByCaregiverAndDate.mockResolvedValue([]);

        await availabilityService.getNextAvailableSlots(caregiverId);
        expect(availabilityService.getCaregiverAvailability).toHaveBeenCalledWith(caregiverId);
        expect(availabilityService._getSchedulesByCaregiverAndDate).toHaveBeenCalled();
    });

    it('should throw auth error if initial getCaregiverAvailability fails in Electron mode (not spied)', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        jest.restoreAllMocks(); // Use actual service method

        await expect(availabilityService.getNextAvailableSlots(caregiverId))
            .rejects.toThrow('Authentication required to get caregiver availability.');
    });

    it('should use mock data providers in browser mode', async () => {
        isElectronAvailable.mockReturnValue(false);
         availabilityService.getCaregiverAvailability.mockResolvedValue({
            regularSchedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }], timeOff: []
        });
        availabilityService._getSchedulesByCaregiverAndDate.mockResolvedValue([]);

        await availabilityService.getNextAvailableSlots(caregiverId);
        expect(availabilityService.getCaregiverAvailability).toHaveBeenCalledWith(caregiverId);
        expect(availabilityService._getSchedulesByCaregiverAndDate).toHaveBeenCalled();
        expect(window.electronAPI.getCaregiverAvailability).not.toHaveBeenCalled();
        expect(window.electronAPI.getSchedulesByCaregiverId).not.toHaveBeenCalled();
    });
  });
});

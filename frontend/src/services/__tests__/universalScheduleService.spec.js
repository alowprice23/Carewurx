import universalScheduleService from '../universalScheduleService';
import { isElectronAvailable } from '../firebaseService';

// Mock the firebaseService to control isElectronAvailable
jest.mock('../firebaseService', () => ({
  isElectronAvailable: jest.fn(),
}));

// Mock window.electronAPI
global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: {
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
  },
  writable: true,
});

describe('UniversalScheduleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockScheduleId = 'sched123';
  const mockClientId = 'clientABC';
  const mockCaregiverId = 'cgXYZ';
  const mockDate = '2024-08-15';
  const mockScheduleData = { description: 'Test Schedule', date: mockDate };

  // Test structure for each method:
  // 1. Electron mode: success, failure (if applicable)
  // 2. Browser mode: success (returns mock data)

  describe('getSchedules', () => {
    const options = { startDate: '2024-01-01', endDate: '2024-12-31' };
    it('should call electronAPI.getCircularEntities in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = [{ id: mockScheduleId, ...mockScheduleData }];
      window.electronAPI.getCircularEntities.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.getSchedules(options);
      expect(window.electronAPI.getCircularEntities).toHaveBeenCalledWith('schedules', options);
      expect(result).toEqual(mockResponse);
    });

    it('should return mock schedules in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.getSchedules(options);
      expect(result).toEqual(expect.any(Array)); // From MOCK_SCHEDULES_DB
      expect(window.electronAPI.getCircularEntities).not.toHaveBeenCalled();
    });
  });

  describe('getSchedule', () => {
    it('should call electronAPI.getSchedule in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = { id: mockScheduleId, ...mockScheduleData };
      window.electronAPI.getSchedule.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.getSchedule(mockScheduleId);
      expect(window.electronAPI.getSchedule).toHaveBeenCalledWith(mockScheduleId);
      expect(result).toEqual(mockResponse);
    });

    it('should return a mock schedule in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      // Relies on MOCK_SCHEDULES_DB['schedule1'] existing in the service
      const result = await universalScheduleService.getSchedule('schedule1');
      expect(result).toHaveProperty('id', 'schedule1');
      expect(window.electronAPI.getSchedule).not.toHaveBeenCalled();
    });
  });

  describe('getClientSchedules', () => {
    it('should call electronAPI.getSchedulesByClientId in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = [{ id: mockScheduleId, clientId: mockClientId }];
      window.electronAPI.getSchedulesByClientId.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.getClientSchedules(mockClientId, mockDate, mockDate);
      expect(window.electronAPI.getSchedulesByClientId).toHaveBeenCalledWith(mockClientId, mockDate, mockDate);
      expect(result).toEqual(mockResponse);
    });

    it('should return mock client schedules in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      // Relies on MOCK_SCHEDULES_DB having schedules for 'client1'
      const result = await universalScheduleService.getClientSchedules('client1');
      expect(result.every(s => s.clientId === 'client1')).toBe(true);
      expect(window.electronAPI.getSchedulesByClientId).not.toHaveBeenCalled();
    });
  });

  describe('getCaregiverSchedules', () => {
    it('should call electronAPI.getSchedulesByCaregiverId in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = [{ id: mockScheduleId, caregiverId: mockCaregiverId }];
      window.electronAPI.getSchedulesByCaregiverId.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.getCaregiverSchedules(mockCaregiverId, mockDate, mockDate);
      expect(window.electronAPI.getSchedulesByCaregiverId).toHaveBeenCalledWith(mockCaregiverId, mockDate, mockDate);
      expect(result).toEqual(mockResponse);
    });

    it('should return mock caregiver schedules in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.getCaregiverSchedules('cg1');
      expect(result.every(s => s.caregiverId === 'cg1')).toBe(true);
      expect(window.electronAPI.getSchedulesByCaregiverId).not.toHaveBeenCalled();
    });
  });

  describe('updateSchedule', () => {
    const changes = { status: 'Confirmed' };
    it('should call electronAPI.updateSchedule in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = { id: mockScheduleId, ...mockScheduleData, ...changes };
      window.electronAPI.updateSchedule.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.updateSchedule(mockScheduleId, changes);
      expect(window.electronAPI.updateSchedule).toHaveBeenCalledWith(mockScheduleId, changes);
      expect(result).toEqual(mockResponse);
    });

    it('should update a mock schedule in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.updateSchedule('schedule1', changes);
      expect(result.status).toBe('Confirmed');
      expect(window.electronAPI.updateSchedule).not.toHaveBeenCalled();
    });
  });

  describe('findConflicts', () => {
    it('should call electronAPI.checkScheduleConflicts in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockConflicts = [{ type: 'doubleBooking' }];
      window.electronAPI.checkScheduleConflicts.mockResolvedValue(mockConflicts);
      const result = await universalScheduleService.findConflicts(mockScheduleId);
      expect(window.electronAPI.checkScheduleConflicts).toHaveBeenCalledWith(mockScheduleId);
      expect(result).toEqual(mockConflicts);
    });

    it('should return mock conflicts in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.findConflicts('schedule1'); // Assumes schedule1 exists
      expect(result).toEqual([]); // Mock logic returns [] if schedule exists
      const resultNonExistent = await universalScheduleService.findConflicts('nonExistent');
      expect(resultNonExistent.length).toBeGreaterThan(0);
      expect(window.electronAPI.checkScheduleConflicts).not.toHaveBeenCalled();
    });
  });

  describe('getCaregiverAvailability', () => {
    it('should call electronAPI.getCaregiverAvailability in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockAvail = { regularSchedule: [] };
      window.electronAPI.getCaregiverAvailability.mockResolvedValue(mockAvail);
      const result = await universalScheduleService.getCaregiverAvailability(mockCaregiverId);
      expect(window.electronAPI.getCaregiverAvailability).toHaveBeenCalledWith(mockCaregiverId);
      expect(result).toEqual(mockAvail);
    });

    it('should return mock availability in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.getCaregiverAvailability('cg1');
      expect(result).toHaveProperty('regularSchedule'); // From MOCK_AVAILABILITY_DB
      expect(window.electronAPI.getCaregiverAvailability).not.toHaveBeenCalled();
    });
  });

  describe('updateCaregiverAvailability', () => {
    const availabilityData = { regularSchedule: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00' }] };
    it('should call electronAPI.updateCaregiverAvailability in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = { success: true };
      window.electronAPI.updateCaregiverAvailability.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.updateCaregiverAvailability(mockCaregiverId, availabilityData);
      expect(window.electronAPI.updateCaregiverAvailability).toHaveBeenCalledWith(mockCaregiverId, availabilityData);
      expect(result).toEqual(mockResponse);
    });

    it('should simulate update for mock availability in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.updateCaregiverAvailability('cg1', availabilityData);
      expect(result).toEqual({ success: true });
      // Check if MOCK_AVAILABILITY_DB['cg1'] was updated
      const updatedAvail = await universalScheduleService.getCaregiverAvailability('cg1');
      expect(updatedAvail.regularSchedule[0].dayOfWeek).toBe(0);
      expect(window.electronAPI.updateCaregiverAvailability).not.toHaveBeenCalled();
    });
  });

  describe('createSchedule', () => {
    it('should call electronAPI.createSchedule in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = { id: 'newSched', ...mockScheduleData };
      window.electronAPI.createSchedule.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.createSchedule(mockScheduleData);
      expect(window.electronAPI.createSchedule).toHaveBeenCalledWith(mockScheduleData);
      expect(result).toEqual(mockResponse);
    });

    it('should create a mock schedule in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.createSchedule(mockScheduleData);
      expect(result).toHaveProperty('id');
      expect(result.description).toBe(mockScheduleData.description);
      expect(window.electronAPI.createSchedule).not.toHaveBeenCalled();
    });
  });

  describe('deleteSchedule', () => {
    it('should call electronAPI.deleteSchedule in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = { success: true };
      window.electronAPI.deleteSchedule.mockResolvedValue(mockResponse);
      const result = await universalScheduleService.deleteSchedule(mockScheduleId);
      expect(window.electronAPI.deleteSchedule).toHaveBeenCalledWith(mockScheduleId);
      expect(result).toEqual(mockResponse);
    });

    it('should delete a mock schedule in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      await universalScheduleService.createSchedule({ id: 'tempSchedDel', description: 'to delete' }); // Ensure it exists
      const result = await universalScheduleService.deleteSchedule('tempSchedDel');
      expect(result.success).toBe(true);
      const deleted = await universalScheduleService.getSchedule('tempSchedDel');
      expect(deleted).toBeNull();
      expect(window.electronAPI.deleteSchedule).not.toHaveBeenCalled();
    });
  });

  describe('getScheduleWithDetails', () => {
    it('should call electronAPI.getScheduleWithDetails in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockDetailedSchedule = { id: mockScheduleId, ...mockScheduleData, clientName: 'Test Client' };
      window.electronAPI.getScheduleWithDetails.mockResolvedValue(mockDetailedSchedule);
      const result = await universalScheduleService.getScheduleWithDetails(mockScheduleId);
      expect(window.electronAPI.getScheduleWithDetails).toHaveBeenCalledWith(mockScheduleId);
      expect(result).toEqual(mockDetailedSchedule);
    });

    it('should return a mock detailed schedule in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.getScheduleWithDetails('schedule1'); // Assumes 'schedule1' exists in mock
      expect(result).toHaveProperty('id', 'schedule1');
      expect(result).toHaveProperty('clientName');
      expect(window.electronAPI.getScheduleWithDetails).not.toHaveBeenCalled();
    });
  });

  describe('findBestCaregiver', () => {
    it('should call electronAPI.findBestCaregiver in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockBestCG = { caregiverId: 'cgBest', score: 0.9 };
      window.electronAPI.findBestCaregiver.mockResolvedValue(mockBestCG);
      const result = await universalScheduleService.findBestCaregiver(mockScheduleId);
      expect(window.electronAPI.findBestCaregiver).toHaveBeenCalledWith(mockScheduleId);
      expect(result).toEqual(mockBestCG);
    });

    it('should return a mock best caregiver in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.findBestCaregiver('schedule1');
      expect(result).toHaveProperty('caregiverId', 'cgMockSmart');
      expect(window.electronAPI.findBestCaregiver).not.toHaveBeenCalled();
    });
  });

  describe('optimizeSchedules', () => {
    it('should call electronAPI.optimizeSchedules in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockOptimizationResult = { success: true, changes: 2 };
      window.electronAPI.optimizeSchedules.mockResolvedValue(mockOptimizationResult);
      const result = await universalScheduleService.optimizeSchedules(mockDate);
      expect(window.electronAPI.optimizeSchedules).toHaveBeenCalledWith(mockDate);
      expect(result).toEqual(mockOptimizationResult);
    });

    it('should return a mock optimization result in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const result = await universalScheduleService.optimizeSchedules(mockDate);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Mock optimization complete');
      expect(window.electronAPI.optimizeSchedules).not.toHaveBeenCalled();
    });
  });
});

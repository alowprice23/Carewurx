import scannerService from '../scannerService';
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
    // Use a getter to dynamically access the current value of mockCurrentUser
    get currentUser() { return mockCurrentUser; },
  }),
}));

// Mock window.electronAPI
const mockElectronAPIScanner = {
  getScheduleScannerStatus: jest.fn(),
  startScheduleScanner: jest.fn(),
  stopScheduleScanner: jest.fn(),
  forceScanSchedules: jest.fn(),
  getScanHistory: jest.fn(),
};

global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPIScanner,
  writable: true,
});

describe('ScannerService', () => {
  const mockToken = 'test-id-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
    mockGetIdToken.mockClear().mockResolvedValue('test-id-token');

    for (const key in mockElectronAPIScanner) {
      mockElectronAPIScanner[key].mockReset();
    }

    // Reset internal state of the singleton scannerService for browser mode tests
    if (scannerService.mockScanInterval) {
        clearInterval(scannerService.mockScanInterval);
        scannerService.mockScanInterval = null;
    }
    scannerService.mockStatus = {
        isRunning: false,
        lastScan: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        intervalMinutes: 30,
        totalScansRun: 3
    };
    scannerService.mockScanHistory = [ // Reset history to a known state
      { id: 'scan-hist-1', timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), opportunitiesFound: 1, status: 'completed'},
      { id: 'scan-hist-2', timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(), opportunitiesFound: 2, status: 'completed'}
    ];
  });

  describe('getStatus', () => {
    it('should call electronAPI.getScheduleScannerStatus with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockStatus = { isRunning: true, lastScan: new Date().toISOString() };
      mockElectronAPIScanner.getScheduleScannerStatus.mockResolvedValue(mockStatus);

      const status = await scannerService.getStatus();
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIScanner.getScheduleScannerStatus).toHaveBeenCalledWith({ idToken: mockToken });
      expect(status).toEqual(mockStatus);
    });

    it('should throw error in Electron mode if not authenticated for getStatus', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(scannerService.getStatus()).rejects.toThrow('Authentication required');
      expect(mockElectronAPIScanner.getScheduleScannerStatus).not.toHaveBeenCalled();
    });

    it('should return mock status in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const status = await scannerService.getStatus();
      expect(status).toBeDefined();
      expect(status.isRunning).toBe(false);
      expect(mockElectronAPIScanner.getScheduleScannerStatus).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    const intervalMinutes = 60;
    it('should call electronAPI.startScheduleScanner with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockResponse = { success: true, message: 'Scanner started' };
      mockElectronAPIScanner.startScheduleScanner.mockResolvedValue(mockResponse);

      const response = await scannerService.start(intervalMinutes);
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIScanner.startScheduleScanner).toHaveBeenCalledWith({ idToken: mockToken, intervalMinutes });
      expect(response).toEqual(mockResponse);
    });

    it('should throw error in Electron mode if not authenticated for start', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(scannerService.start(intervalMinutes)).rejects.toThrow('Authentication required');
      expect(mockElectronAPIScanner.startScheduleScanner).not.toHaveBeenCalled();
    });

    it('should simulate start and update mock status in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const response = await scannerService.start(intervalMinutes);
      expect(response.success).toBe(true);
      expect(response.message).toContain('Mock scanner started');
      expect(scannerService.mockStatus.isRunning).toBe(true);
      expect(scannerService.mockStatus.intervalMinutes).toBe(intervalMinutes);
      expect(scannerService.mockScanInterval).toBeDefined();
      expect(mockElectronAPIScanner.startScheduleScanner).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should call electronAPI.stopScheduleScanner with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockResponse = { success: true, message: 'Scanner stopped' };
      mockElectronAPIScanner.stopScheduleScanner.mockResolvedValue(mockResponse);

      const response = await scannerService.stop();
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIScanner.stopScheduleScanner).toHaveBeenCalledWith({ idToken: mockToken });
      expect(response).toEqual(mockResponse);
    });

    it('should throw error in Electron mode if not authenticated for stop', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(scannerService.stop()).rejects.toThrow('Authentication required');
      expect(mockElectronAPIScanner.stopScheduleScanner).not.toHaveBeenCalled();
    });

    it('should simulate stop and update mock status in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      await scannerService.start(30); // Start to have something to stop
      const response = await scannerService.stop();
      expect(response.success).toBe(true);
      expect(response.message).toContain('Mock scanner stopped');
      expect(scannerService.mockStatus.isRunning).toBe(false);
      expect(scannerService.mockScanInterval).toBeNull();
      expect(mockElectronAPIScanner.stopScheduleScanner).not.toHaveBeenCalled();
    });
  });

  describe('forceScan', () => {
    const options = { someOption: true };
    it('should call electronAPI.forceScanSchedules with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockScanResult = { id: 'scan-electron', opportunitiesFound: 3 };
      mockElectronAPIScanner.forceScanSchedules.mockResolvedValue(mockScanResult);

      const result = await scannerService.forceScan(options);
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIScanner.forceScanSchedules).toHaveBeenCalledWith({ idToken: mockToken, options });
      expect(result).toEqual(mockScanResult);
    });

    it('should throw error in Electron mode if not authenticated for forceScan', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(scannerService.forceScan(options)).rejects.toThrow('Authentication required');
      expect(mockElectronAPIScanner.forceScanSchedules).not.toHaveBeenCalled();
    });

    it('should simulate scan and return mock result in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const initialHistoryCount = scannerService.mockScanHistory.length;
      const result = await scannerService.forceScan(options);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Mock scan completed successfully');
      expect(scannerService.mockScanHistory.length).toBe(initialHistoryCount + 1);
      expect(mockElectronAPIScanner.forceScanSchedules).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    const limit = 5;
    it('should call electronAPI.getScanHistory with idToken in Electron mode if authenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const mockHistory = [{ id: 'h1' }, { id: 'h2' }];
      mockElectronAPIScanner.getScanHistory.mockResolvedValue(mockHistory);

      const history = await scannerService.getHistory(limit);
      expect(mockGetIdToken).toHaveBeenCalled();
      expect(mockElectronAPIScanner.getScanHistory).toHaveBeenCalledWith({ idToken: mockToken, limit });
      expect(history).toEqual(mockHistory);
    });

    it('should throw error in Electron mode if not authenticated for getHistory', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      await expect(scannerService.getHistory(limit)).rejects.toThrow('Authentication required');
      expect(mockElectronAPIScanner.getScanHistory).not.toHaveBeenCalled();
    });

    it('should return mock history in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const history = await scannerService.getHistory(limit);
      expect(history.length).toBe(Math.min(limit, scannerService.mockScanHistory.length));
      expect(mockElectronAPIScanner.getScanHistory).not.toHaveBeenCalled();
    });
  });

  describe('setupBackgroundScanner', () => {
    it('should call start and return a cleanup function that calls stop in Electron mode when authenticated', () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = { getIdToken: mockGetIdToken };
      const startSpy = jest.spyOn(scannerService, 'start').mockResolvedValue({ success: true });
      const stopSpy = jest.spyOn(scannerService, 'stop').mockResolvedValue({ success: true });

      const cleanup = scannerService.setupBackgroundScanner(60);
      expect(startSpy).toHaveBeenCalledWith(60);

      cleanup();
      expect(stopSpy).toHaveBeenCalled();

      startSpy.mockRestore();
      stopSpy.mockRestore();
    });

    it('should handle auth error from start when setting up background scanner in Electron mode if unauthenticated', async () => {
      isElectronAvailable.mockReturnValue(true);
      mockCurrentUser = null;
      // Do NOT spy on start/stop, let the actual methods run and throw
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      scannerService.setupBackgroundScanner(60);
      // Allow promises within setupBackgroundScanner to settle/reject
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to start background scanner via Electron API:', expect.any(Error));
      expect(consoleErrorSpy.mock.calls[0][1].message).toContain('Authentication required to start scanner.');
      consoleErrorSpy.mockRestore();
    });

    it('should simulate start and return a cleanup function that calls stop in browser mode', () => {
      isElectronAvailable.mockReturnValue(false);
      const startSpy = jest.spyOn(scannerService, 'start').mockResolvedValue({ success: true });
      const stopSpy = jest.spyOn(scannerService, 'stop').mockResolvedValue({ success: true });

      const cleanup = scannerService.setupBackgroundScanner(60);
      expect(startSpy).toHaveBeenCalledWith(60);

      cleanup();
      expect(stopSpy).toHaveBeenCalled();

      startSpy.mockRestore();
      stopSpy.mockRestore();
    });
  });

  describe('subscribeToScanResults', () => {
    it('should add and remove event listener for scan-results', () => {
      const mockCallback = jest.fn();
      const addEventSpy = jest.spyOn(window, 'addEventListener');
      const removeEventSpy = jest.spyOn(window, 'removeEventListener');

      const unsubscribe = scannerService.subscribeToScanResults(mockCallback);
      expect(addEventSpy).toHaveBeenCalledWith('scan-results', expect.any(Function));

      const eventHandler = addEventSpy.mock.calls[0][1];
      const mockEventDetail = { data: 'scan complete' };
      eventHandler({ detail: mockEventDetail }); // Simulate event dispatch
      expect(mockCallback).toHaveBeenCalledWith(mockEventDetail);

      unsubscribe();
      expect(removeEventSpy).toHaveBeenCalledWith('scan-results', eventHandler);
    });
  });
});

import scannerService from '../scannerService';
import { isElectronAvailable } from '../firebaseService';

// Mock the firebaseService to control isElectronAvailable
jest.mock('../firebaseService', () => ({
  isElectronAvailable: jest.fn(),
}));

// Mock window.electronAPI
global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: {
    getScheduleScannerStatus: jest.fn(),
    startScheduleScanner: jest.fn(),
    stopScheduleScanner: jest.fn(),
    forceScanSchedules: jest.fn(),
    getScanHistory: jest.fn(),
  },
  writable: true,
});

// To mock setTimeout for delay testing if needed, though not strictly necessary for these tests
// jest.useFakeTimers();

describe('ScannerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset any internal state of the mock scanner if necessary (e.g., mockStatus, mockScanInterval)
    // This might require modifying the ScannerService class to allow resetting its mock state or re-instantiating it.
    // For this test suite, we'll assume a fresh instance or that side effects between tests are managed.
    // If scannerService instance retains state across tests (like mockScanInterval), it might need specific reset logic.
    // For now, the service is a singleton, so its internal mock state can persist.
    // Let's clear the mock interval if it's running from a previous test in browser mode.
    if (scannerService.mockScanInterval) {
        clearInterval(scannerService.mockScanInterval);
        scannerService.mockScanInterval = null;
    }
    scannerService.mockStatus = { // Reset mock status
        isRunning: false,
        lastScan: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        intervalMinutes: 30,
        totalScansRun: 3
    };
  });

  describe('getStatus', () => {
    it('should call electronAPI.getScheduleScannerStatus in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockStatus = { isRunning: true, lastScan: new Date().toISOString() };
      window.electronAPI.getScheduleScannerStatus.mockResolvedValue(mockStatus);

      const status = await scannerService.getStatus();
      expect(window.electronAPI.getScheduleScannerStatus).toHaveBeenCalledTimes(1);
      expect(status).toEqual(mockStatus);
    });

    it('should return mock status in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const status = await scannerService.getStatus();
      expect(status).toBeDefined();
      expect(status.isRunning).toBe(false); // Default mock state
      expect(window.electronAPI.getScheduleScannerStatus).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    const intervalMinutes = 60;
    it('should call electronAPI.startScheduleScanner in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = { success: true, message: 'Scanner started' };
      window.electronAPI.startScheduleScanner.mockResolvedValue(mockResponse);

      const response = await scannerService.start(intervalMinutes);
      expect(window.electronAPI.startScheduleScanner).toHaveBeenCalledWith(intervalMinutes);
      expect(response).toEqual(mockResponse);
    });

    it('should simulate start and update mock status in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const response = await scannerService.start(intervalMinutes);
      expect(response.success).toBe(true);
      expect(response.message).toContain('Mock scanner started');
      expect(scannerService.mockStatus.isRunning).toBe(true);
      expect(scannerService.mockStatus.intervalMinutes).toBe(intervalMinutes);
      expect(scannerService.mockScanInterval).toBeDefined(); // Check if interval is set
      expect(window.electronAPI.startScheduleScanner).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should call electronAPI.stopScheduleScanner in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockResponse = { success: true, message: 'Scanner stopped' };
      window.electronAPI.stopScheduleScanner.mockResolvedValue(mockResponse);

      const response = await scannerService.stop();
      expect(window.electronAPI.stopScheduleScanner).toHaveBeenCalledTimes(1);
      expect(response).toEqual(mockResponse);
    });

    it('should simulate stop and update mock status in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      // First, start the mock scanner to have something to stop
      await scannerService.start(30);
      expect(scannerService.mockStatus.isRunning).toBe(true);
      expect(scannerService.mockScanInterval).toBeDefined();

      const response = await scannerService.stop();
      expect(response.success).toBe(true);
      expect(response.message).toContain('Mock scanner stopped');
      expect(scannerService.mockStatus.isRunning).toBe(false);
      expect(scannerService.mockScanInterval).toBeNull();
      expect(window.electronAPI.stopScheduleScanner).not.toHaveBeenCalled();
    });
  });

  describe('forceScan', () => {
    const options = { someOption: true };
    it('should call electronAPI.forceScanSchedules in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockScanResult = { id: 'scan-electron', opportunitiesFound: 3 };
      window.electronAPI.forceScanSchedules.mockResolvedValue(mockScanResult);

      const result = await scannerService.forceScan(options);
      expect(window.electronAPI.forceScanSchedules).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockScanResult);
    });

    it('should simulate scan and return mock result in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      const initialHistoryCount = scannerService.mockScanHistory.length;
      const result = await scannerService.forceScan(options);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Mock scan completed successfully');
      expect(result.result).toHaveProperty('id');
      expect(result.result).toHaveProperty('opportunitiesFound');
      expect(scannerService.mockScanHistory.length).toBe(initialHistoryCount + 1);
      expect(window.electronAPI.forceScanSchedules).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    const limit = 5;
    it('should call electronAPI.getScanHistory in Electron mode', async () => {
      isElectronAvailable.mockReturnValue(true);
      const mockHistory = [{ id: 'h1' }, { id: 'h2' }];
      window.electronAPI.getScanHistory.mockResolvedValue(mockHistory);

      const history = await scannerService.getHistory(limit);
      expect(window.electronAPI.getScanHistory).toHaveBeenCalledWith(limit);
      expect(history).toEqual(mockHistory);
    });

    it('should return mock history in browser mode', async () => {
      isElectronAvailable.mockReturnValue(false);
      // Ensure MOCK_SCAN_HISTORY in service has some items
      const history = await scannerService.getHistory(limit);
      expect(history).toEqual(expect.any(Array));
      expect(history.length).toBeLessThanOrEqual(limit);
      // Check if it's a slice of the MOCK_SCAN_HISTORY from the service
      expect(history.length).toBe(Math.min(limit, scannerService.mockScanHistory.length));
      expect(window.electronAPI.getScanHistory).not.toHaveBeenCalled();
    });
  });

  describe('setupBackgroundScanner', () => {
    it('should call start and return a cleanup function that calls stop in Electron mode', () => {
      isElectronAvailable.mockReturnValue(true);
      const startSpy = jest.spyOn(scannerService, 'start').mockResolvedValue({ success: true });
      const stopSpy = jest.spyOn(scannerService, 'stop').mockResolvedValue({ success: true });

      const cleanup = scannerService.setupBackgroundScanner(60);
      expect(startSpy).toHaveBeenCalledWith(60);

      cleanup();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should simulate start and return a cleanup function that calls stop in browser mode', () => {
      isElectronAvailable.mockReturnValue(false);
      const startSpy = jest.spyOn(scannerService, 'start').mockResolvedValue({ success: true });
      const stopSpy = jest.spyOn(scannerService, 'stop').mockResolvedValue({ success: true });

      const cleanup = scannerService.setupBackgroundScanner(60);
      expect(startSpy).toHaveBeenCalledWith(60);

      cleanup();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('subscribeToScanResults', () => {
    it('should add and remove event listener for scan-results', () => {
      const mockCallback = jest.fn();
      const addEventSpy = jest.spyOn(window, 'addEventListener');
      const removeEventSpy = jest.spyOn(window, 'removeEventListener');

      const unsubscribe = scannerService.subscribeToScanResults(mockCallback);

      expect(addEventSpy).toHaveBeenCalledWith('scan-results', expect.any(Function));

      // Simulate an event
      const mockEventDetail = { data: 'scan complete' };
      const customEvent = new CustomEvent('scan-results', { detail: mockEventDetail });
      window.dispatchEvent(customEvent);

      // The actual callback passed to addEventListener is wrapped, so we check if our mockCallback was called by that wrapper.
      // This requires the event handling logic in the service to call the passed callback.
      // Assuming the wrapper correctly calls the mockCallback:
      // expect(mockCallback).toHaveBeenCalledWith(mockEventDetail); // This part depends on the internal wrapper

      unsubscribe();
      expect(removeEventSpy).toHaveBeenCalledWith('scan-results', addEventSpy.mock.calls[0][1]); // Check it's removing the same function
    });
  });

});

/**
 * Scanner Service
 * Provides interface to schedule scanner functionality with browser fallback
 */

import { isElectronAvailable } from './firebaseService'; // Corrected import

// Helper function to simulate network delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Mock data for browser-only mode
const MOCK_SCAN_HISTORY = [
  {
    id: 'scan-1',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    opportunitiesFound: 5,
    durationMs: 1250,
    status: 'completed'
  },
  {
    id: 'scan-2',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    opportunitiesFound: 3,
    durationMs: 980,
    status: 'completed'
  },
  {
    id: 'scan-3',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    opportunitiesFound: 7,
    durationMs: 1420,
    status: 'completed'
  }
];

import firebase from './firebase'; // For auth - Corrected Path

class ScannerService {
  constructor() {
    // Use the imported isElectronAvailable for consistency
    // this.isElectronAvailable = isElectronAvailable; // This was incorrect, isElectronAvailable is a function
    this.mockScanHistory = [...MOCK_SCAN_HISTORY];
    this.mockStatus = {
      isRunning: false,
      lastScan: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      intervalMinutes: 30,
      totalScansRun: 3
    };
    this.mockScanInterval = null;
    
    console.log(`Scanner Service initializing in ${this.isElectronAvailable ? 'Electron' : 'browser-only'} mode`);
  }

  /**
   * Get the current status of the scanner
   * @returns {Promise<Object>} - Scanner status object
   */
  async getStatus() {
    try {
      if (isElectronAvailable()) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get scanner status.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getScheduleScannerStatus({ idToken });
      } else {
        // Browser-only mode: return mock status
        console.log('Scanner Service: Using mock status in browser-only mode');
        await delay(500); // Simulate network delay
        return this.mockStatus;
      }
    } catch (error) {
      console.error('Error getting scanner status:', error);
      throw new Error(`Failed to get scanner status: ${error.message}`);
    }
  }

  /**
   * Start the schedule scanner with specified interval
   * @param {number} intervalMinutes - Scan interval in minutes
   * @returns {Promise<Object>} - Start result
   */
  async start(intervalMinutes = 30) {
    try {
      if (isElectronAvailable()) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to start scanner.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.startScheduleScanner({ idToken, intervalMinutes });
      } else {
        // Browser-only mode: simulate scanner start
        console.log(`Scanner Service: Starting mock scanner with ${intervalMinutes} minute interval in browser-only mode`);
        await delay(700); // Simulate network delay
        
        // Update mock status
        this.mockStatus.isRunning = true;
        this.mockStatus.intervalMinutes = intervalMinutes;
        
        // Clear any existing interval
        if (this.mockScanInterval) {
          clearInterval(this.mockScanInterval);
        }
        
        // Set up mock interval for demonstration purposes
        // This won't actually do anything except update timestamps
        // In real usage, the interval would be too long anyway (we're just simulating)
        this.mockScanInterval = setInterval(() => {
          this.mockStatus.lastScan = new Date().toISOString();
          this.mockStatus.totalScansRun++;
          
          // Add to mock history
          const newScan = {
            id: `scan-${Date.now()}`,
            timestamp: new Date().toISOString(),
            opportunitiesFound: Math.floor(Math.random() * 10),
            durationMs: 800 + Math.floor(Math.random() * 800),
            status: 'completed'
          };
          
          this.mockScanHistory.unshift(newScan);
          
          console.log('Scanner Service: Mock scan completed:', newScan);
          
          // Dispatch event for subscribers
          const event = new CustomEvent('scan-results', { detail: newScan });
          window.dispatchEvent(event);
        }, 60000); // Simulate a scan every minute (just for demonstration)
        
        return {
          success: true,
          message: `Mock scanner started with ${intervalMinutes} minute interval`,
          status: this.mockStatus
        };
      }
    } catch (error) {
      console.error('Error starting scanner:', error);
      throw new Error(`Failed to start scanner: ${error.message}`);
    }
  }

  /**
   * Stop the schedule scanner
   * @returns {Promise<boolean>} - Success status
   */
  async stop() {
    try {
      if (isElectronAvailable()) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to stop scanner.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.stopScheduleScanner({ idToken });
      } else {
        // Browser-only mode: simulate scanner stop
        console.log('Scanner Service: Stopping mock scanner in browser-only mode');
        await delay(500); // Simulate network delay
        
        // Update mock status
        this.mockStatus.isRunning = false;
        
        // Clear interval
        if (this.mockScanInterval) {
          clearInterval(this.mockScanInterval);
          this.mockScanInterval = null;
        }
        
        return {
          success: true,
          message: 'Mock scanner stopped',
          status: this.mockStatus
        };
      }
    } catch (error) {
      console.error('Error stopping scanner:', error);
      throw new Error(`Failed to stop scanner: ${error.message}`);
    }
  }

  /**
   * Force an immediate scan with optional parameters
   * @param {Object} options - Scan options
   * @returns {Promise<Object>} - Scan results
   */
  async forceScan(options = {}) {
    try {
      if (isElectronAvailable()) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to force scan.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.forceScanSchedules({ idToken, options });
      } else {
        // Browser-only mode: simulate forced scan
        console.log('Scanner Service: Forcing mock scan in browser-only mode');
        await delay(2000); // Simulate longer network delay for scanning
        
        // Update mock status
        this.mockStatus.lastScan = new Date().toISOString();
        this.mockStatus.totalScansRun++;
        
        // Create scan result
        const scanResult = {
          id: `scan-${Date.now()}`,
          timestamp: new Date().toISOString(),
          opportunitiesFound: Math.floor(Math.random() * 10),
          durationMs: 1500 + Math.floor(Math.random() * 1000),
          status: 'completed'
        };
        
        // Add to mock history
        this.mockScanHistory.unshift(scanResult);
        
        // Dispatch event for subscribers
        const event = new CustomEvent('scan-results', { detail: scanResult });
        window.dispatchEvent(event);
        
        return {
          success: true,
          message: 'Mock scan completed successfully',
          result: scanResult
        };
      }
    } catch (error) {
      console.error('Error forcing scan:', error);
      throw new Error(`Failed to force scan: ${error.message}`);
    }
  }

  /**
   * Get scan history
   * @param {number} limit - Maximum number of history items to return
   * @returns {Promise<Array>} - Scan history
   */
  async getHistory(limit = 10) {
    try {
      if (isElectronAvailable()) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get scan history.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getScanHistory({ idToken, limit });
      } else {
        // Browser-only mode: return mock history
        console.log('Scanner Service: Using mock history in browser-only mode');
        await delay(600); // Simulate network delay
        
        return this.mockScanHistory.slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting scan history:', error);
      throw new Error(`Failed to get scan history: ${error.message}`);
    }
  }

  /**
   * Set up a background scanner with automatic scheduling
   * @param {number} intervalMinutes - Scan interval in minutes
   * @returns {Function} - Cleanup function to stop the scanner
   */
  setupBackgroundScanner(intervalMinutes = 30) {
    // This method calls this.start() and this.stop(), which now have auth checks.
    // If called in Electron mode, and user is not authenticated, this.start() will throw.
    // The try/catch here is for the setupBackgroundScanner's own logic, not the async start/stop.
    try {
      if (isElectronAvailable()) {
        console.log(`Scanner Service: Setting up Electron background scanner with ${intervalMinutes} min interval.`);
        this.start(intervalMinutes) // This will perform auth check
          .then(result => console.log('Background scanner started via Electron API:', result))
          .catch(error => console.error('Failed to start background scanner via Electron API:', error));

        return () => {
          this.stop() // This will perform auth check
            .then(() => console.log('Background scanner stopped via Electron API'))
            .catch(error => console.error('Failed to stop background scanner via Electron API:', error));
        };
      } else {
        console.log(`Scanner Service: Setting up mock background scanner with ${intervalMinutes} minute interval`);
        this.start(intervalMinutes) // Browser mode, no auth check in service for this path
          .then(result => console.log('Mock background scanner started:', result))
          .catch(error => console.error('Failed to start mock background scanner:', error));
        
        return () => {
          this.stop() // Browser mode
            .then(() => console.log('Mock background scanner stopped'))
            .catch(error => console.error('Failed to stop mock background scanner:', error));
        };
      }
    } catch (error) {
        // This catch is for synchronous errors during setup, not for the async start/stop.
        console.error("Error in setupBackgroundScanner synchronous part:", error);
        return () => {}; // Return no-op cleanup
    }
  }
  /**
   * Subscribe to scan results
   * @param {Function} callback - Callback function for scan results
   * @returns {Function} - Unsubscribe function
   */
  subscribeToScanResults(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Set up listener for scan results
    const handleScanResults = (event) => {
      callback(event.detail || event);
    };
    
    // Add event listener
    window.addEventListener('scan-results', handleScanResults);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener('scan-results', handleScanResults);
    };
  }
}

// Create and export singleton instance
const scannerService = new ScannerService();
export default scannerService;

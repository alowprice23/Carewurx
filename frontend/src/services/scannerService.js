/**
 * Scanner Service
 * Provides interface to schedule scanner functionality with browser fallback
 */

// Import the firebaseService to check if we're in Electron mode
import { firebaseService } from './index';

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

class ScannerService {
  constructor() {
    // this.isElectronAvailable = typeof window !== 'undefined' && window.electronAPI; // To be removed
    this.mockScanHistory = [...MOCK_SCAN_HISTORY];
    this.mockStatus = {
      isRunning: false,
      lastScan: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      intervalMinutes: 30,
      totalScansRun: 3
    };
    this.mockScanInterval = null;
    
    console.log('Scanner Service initializing for web API communication.');
  }

  async _fetchAPI(endpoint, options = {}) {
    const { body, method = 'GET', params } = options;
    let url = `/api${endpoint}`;

    if (params) {
      url += `?${new URLSearchParams(params)}`;
    }

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`API Error (${response.status}): ${errorData.message || 'Unknown error'}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get the current status of the scanner
   * @returns {Promise<Object>} - Scanner status object
   */
  async getStatus() {
    try {
      return await this._fetchAPI('/scanner/status');
    } catch (error) {
      console.warn('API call failed for getStatus, falling back to mock.', error);
      // Fallback to mock
      console.log('Scanner Service: Using mock status due to API error or browser-only mode');
      await delay(500);
      return { ...this.mockStatus }; // Return a copy
    }
  }

  /**
   * Start the schedule scanner with specified interval
   * @param {number} intervalMinutes - Scan interval in minutes
   * @returns {Promise<Object>} - Start result
   */
  async start(intervalMinutes = 30) {
    try {
      return await this._fetchAPI('/scanner/start', {
        method: 'POST',
        body: { intervalMinutes },
      });
    } catch (error) {
      console.warn('API call failed for start, falling back to mock.', error);
      // Fallback to mock
      console.log(`Scanner Service: Starting mock scanner with ${intervalMinutes} minute interval due to API error or browser-only mode`);
      await delay(700);
      this.mockStatus.isRunning = true;
      this.mockStatus.intervalMinutes = intervalMinutes;
      if (this.mockScanInterval) clearInterval(this.mockScanInterval);
      this.mockScanInterval = setInterval(() => {
        this.mockStatus.lastScan = new Date().toISOString();
        this.mockStatus.totalScansRun++;
        const newScan = {
          id: `scan-${Date.now()}`,
          timestamp: new Date().toISOString(),
          opportunitiesFound: Math.floor(Math.random() * 10),
          durationMs: 800 + Math.floor(Math.random() * 800),
          status: 'completed'
        };
        this.mockScanHistory.unshift(newScan);
        console.log('Scanner Service: Mock scan completed:', newScan);
        const event = new CustomEvent('scan-results', { detail: newScan });
        window.dispatchEvent(event);
      }, 60000); // Mock interval
      return {
        success: true,
        message: `Mock scanner started with ${intervalMinutes} minute interval`,
        status: { ...this.mockStatus }
      };
    }
  }

  /**
   * Stop the schedule scanner
   * @returns {Promise<boolean>} - Success status
   */
  async stop() {
    try {
      return await this._fetchAPI('/scanner/stop', { method: 'POST' });
    } catch (error) {
      console.warn('API call failed for stop, falling back to mock.', error);
      // Fallback to mock
      console.log('Scanner Service: Stopping mock scanner due to API error or browser-only mode');
      await delay(500);
      this.mockStatus.isRunning = false;
      if (this.mockScanInterval) {
        clearInterval(this.mockScanInterval);
        this.mockScanInterval = null;
      }
      return {
        success: true,
        message: 'Mock scanner stopped',
        status: { ...this.mockStatus }
      };
    }
  }

  /**
   * Force an immediate scan with optional parameters
   * @param {Object} options - Scan options
   * @returns {Promise<Object>} - Scan results
   */
  async forceScan(options = {}) {
    try {
      return await this._fetchAPI('/scanner/forceScan', {
        method: 'POST',
        body: { options },
      });
    } catch (error) {
      console.warn('API call failed for forceScan, falling back to mock.', error);
      // Fallback to mock
      console.log('Scanner Service: Forcing mock scan due to API error or browser-only mode');
      await delay(2000);
      this.mockStatus.lastScan = new Date().toISOString();
      this.mockStatus.totalScansRun++;
      const scanResult = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        opportunitiesFound: Math.floor(Math.random() * 10),
        durationMs: 1500 + Math.floor(Math.random() * 1000),
        status: 'completed'
      };
      this.mockScanHistory.unshift(scanResult);
      const event = new CustomEvent('scan-results', { detail: scanResult });
      window.dispatchEvent(event);
      return {
        success: true,
        message: 'Mock scan completed successfully',
        result: scanResult
      };
    }
  }

  /**
   * Get scan history
   * @param {number} limit - Maximum number of history items to return
   * @returns {Promise<Array>} - Scan history
   */
  async getHistory(limit = 10) {
    try {
      return await this._fetchAPI('/scanner/history', { params: { limit } });
    } catch (error) {
      console.warn('API call failed for getHistory, falling back to mock.', error);
      // Fallback to mock
      console.log('Scanner Service: Using mock history due to API error or browser-only mode');
      await delay(600);
      return this.mockScanHistory.slice(0, limit);
    }
  }

  /**
   * Set up a background scanner with automatic scheduling
   * @param {number} intervalMinutes - Scan interval in minutes
   * @returns {Function} - Cleanup function to stop the scanner
   */
  setupBackgroundScanner(intervalMinutes = 30) {
    // This method now uses the refactored start/stop which have API calls & fallbacks
    console.log(`Scanner Service: Setting up background scanner with ${intervalMinutes} minute interval.`);

    this.start(intervalMinutes)
      .then(result => {
        console.log('Background scanner started/mocked:', result);
      })
      .catch(error => {
        console.error('Failed to start background scanner/mock:', error);
      });
      
    return () => {
      this.stop()
        .then(() => {
          console.log('Background scanner stopped/mocked');
        })
        .catch(error => {
          console.error('Failed to stop background scanner/mock:', error);
        });
    };
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

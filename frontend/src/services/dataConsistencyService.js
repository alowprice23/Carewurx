/**
 * Data Consistency Service (Frontend)
 * Interface for interacting with backend data consistency checking and repair tools.
 */
class DataConsistencyService {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  }

  async getHealthStatus() {
    if (this.isElectron && window.electronAPI.getDbHealthStatus) {
      return window.electronAPI.getDbHealthStatus();
    }
    console.warn('DataConsistencyService.getHealthStatus: IPC method not available. Returning mock data.');
    return Promise.resolve({ status: 'unknown', lastCheck: null, checkInProgress: false }); // Mock
  }

  async runHealthCheck(config) {
    if (this.isElectron && window.electronAPI.runDbHealthCheck) {
      return window.electronAPI.runDbHealthCheck(config);
    }
    console.warn('DataConsistencyService.runHealthCheck: IPC method not available. Returning mock data.');
    const issueCount = Math.random() > 0.5 ? Math.floor(Math.random() * 10) : 0;
    return Promise.resolve({
      status: issueCount > 5 ? 'critical' : issueCount > 0 ? 'issues' : 'healthy',
      lastCheck: new Date().toISOString(),
      issuesFound: issueCount
    }); // Mock
  }

  async getInconsistencies(filter = {}) {
    if (this.isElectron && window.electronAPI.getDbInconsistencies) {
      return window.electronAPI.getDbInconsistencies(filter);
    }
    console.warn('DataConsistencyService.getInconsistencies: IPC method not available. Returning mock data.');
    return Promise.resolve([]); // Mock
  }

  async runRepairOperations(selectedIds, repairConfig) {
    if (this.isElectron && window.electronAPI.runDbRepairOperations) {
      return window.electronAPI.runDbRepairOperations(selectedIds, repairConfig);
    }
    console.warn('DataConsistencyService.runRepairOperations: IPC method not available. Mocking results.');
    const successfulRepairs = Math.floor(selectedIds.length * (Math.random() * 0.5 + 0.5)); // Repair 50-100%
    return Promise.resolve({
      attemptedRepairs: selectedIds.length,
      successfulRepairs: successfulRepairs,
      failedRepairs: selectedIds.length - successfulRepairs,
      remainingIssues: 0, // Simplified mock
      timestamp: new Date().toISOString()
    }); // Mock
  }

  async getDbStatistics() {
    if (this.isElectron && window.electronAPI.getDbStatistics) {
      return window.electronAPI.getDbStatistics();
    }
    console.warn('DataConsistencyService.getDbStatistics: IPC method not available. Returning mock data.');
    return Promise.resolve({
        entityCounts: { clients: 0, caregivers: 0, schedules: 0, users: 0 },
        storageUsed: '0 MB',
        lastBackup: null,
        performance: { averageQueryTime: 0, cachingEfficiency: 0 }
      }); // Mock
  }
}

const dataConsistencyService = new DataConsistencyService();
export default dataConsistencyService;

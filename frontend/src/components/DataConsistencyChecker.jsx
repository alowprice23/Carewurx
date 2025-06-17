import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '../services';

/**
 * Data Consistency Checker Component
 * Provides a UI for monitoring database health, alerting inconsistencies, and offering repair tools
 */
const DataConsistencyChecker = () => {
  // State for database health status
  const [healthStatus, setHealthStatus] = useState({
    status: 'unknown', // 'healthy', 'issues', 'critical', 'unknown'
    lastCheck: null,
    checkInProgress: false
  });
  
  // State for inconsistency data
  const [inconsistencies, setInconsistencies] = useState([]);
  
  // State for repair operations
  const [repairStatus, setRepairStatus] = useState({
    inProgress: false,
    results: null,
    selectedInconsistencies: []
  });
  
  // State for database statistics
  const [dbStats, setDbStats] = useState(null);
  
  // State for check configuration
  const [checkConfig, setCheckConfig] = useState({
    thoroughCheck: false,
    entityTypes: ['clients', 'caregivers', 'schedules', 'users'],
    relations: true,
    orphanedRecords: true,
    dataIntegrity: true
  });
  
  // State for repair configuration
  const [repairConfig, setRepairConfig] = useState({
    autoRepairSafe: true,
    deleteOrphaned: false,
    createMissingRelations: true,
    backupBeforeRepair: true
  });
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('status'); // 'status', 'issues', 'repair', 'settings'
  
  // Reference for charts
  const healthChartRef = useRef(null);
  const entityDistributionRef = useRef(null);
  
  // Helper to generate mock inconsistencies
  const generateMockInconsistencies = (count = 5) => {
    const types = [
      'orphaned_record',
      'missing_relation',
      'invalid_data',
      'duplicate_entry',
      'missing_required_field'
    ];
    
    const entities = ['client', 'caregiver', 'schedule', 'user'];
    const severity = ['low', 'medium', 'high', 'critical'];
    
    const result = [];
    
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const entity = entities[Math.floor(Math.random() * entities.length)];
      const entityId = `${entity}-${Math.floor(Math.random() * 1000)}`;
      const issueSeverity = severity[Math.floor(Math.random() * severity.length)];
      
      let description = `Issue with ${entity}: ${type.replace('_', ' ')}`;
      let repairAction = 'Automatic repair';
      
      result.push({
        id: `issue-${i}-${Date.now()}`,
        type,
        entity,
        entityId,
        description,
        repairAction,
        severity: issueSeverity,
        details: {
          detectedAt: new Date().toISOString(),
          affectedRecords: Math.floor(Math.random() * 5) + 1,
          canAutoRepair: Math.random() > 0.3
        }
      });
    }
    
    return result;
  };
  
  // Load initial data on component mount
  useEffect(() => {
    loadDatabaseStats();
    
    // Simulated initial health check
    const initialHealthCheck = setTimeout(() => {
      const mockHealth = {
        status: Math.random() > 0.7 ? 'issues' : 'healthy',
        lastCheck: new Date().toISOString(),
        checkInProgress: false
      };
      
      setHealthStatus(mockHealth);
      
      // If we have issues, also set some mock inconsistencies
      if (mockHealth.status === 'issues') {
        setInconsistencies(generateMockInconsistencies());
      }
    }, 1000);
    
    return () => clearTimeout(initialHealthCheck);
  }, []);
  
  // Helper to update health status chart
  const updateHealthStatusChart = useCallback(() => {
    if (healthChartRef.current) {
      const canvas = healthChartRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Determine color based on status
      let statusColor;
      switch (healthStatus.status) {
        case 'healthy':
          statusColor = '#28a745';
          break;
        case 'issues':
          statusColor = '#ffc107';
          break;
        case 'critical':
          statusColor = '#dc3545';
          break;
        default:
          statusColor = '#6c757d';
      }
      
      // Draw circle
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 3, 0, 2 * Math.PI);
      ctx.fillStyle = statusColor;
      ctx.fill();
      
      // Draw status text
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        healthStatus.status.toUpperCase(),
        canvas.width / 2,
        canvas.height / 2
      );
    }
  }, [healthStatus]);

  // Helper to update entity distribution chart
  const updateEntityDistributionChart = useCallback(() => {
    if (entityDistributionRef.current && dbStats) {
      const canvas = entityDistributionRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Get entity counts and calculate max for scaling
      const entities = Object.entries(dbStats.entityCounts);
      const maxCount = Math.max(...entities.map(([_, count]) => count));
      
      // Calculate bar width and spacing
      const barWidth = (canvas.width - 40) / entities.length - 10;
      const barSpacing = 10;
      
      // Colors for different entity types
      const colors = [
        '#007bff', '#28a745', '#dc3545', '#ffc107'
      ];
      
      // Draw bars
      entities.forEach(([entity, count], index) => {
        const x = 20 + index * (barWidth + barSpacing);
        const barHeight = (count / maxCount) * (canvas.height - 60);
        const y = canvas.height - 30 - barHeight;
        
        // Draw bar
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw entity label
        ctx.font = '10px Arial';
        ctx.fillStyle = '#343a40';
        ctx.textAlign = 'center';
        ctx.fillText(
          entity.slice(0, 8),
          x + barWidth / 2,
          canvas.height - 15
        );
      });
    }
  }, [dbStats]);

  // Effect for updating charts
  useEffect(() => {
    if (dbStats) {
      updateEntityDistributionChart();
    }
  }, [dbStats, updateEntityDistributionChart]);
  
  useEffect(() => {
    updateHealthStatusChart();
  }, [healthStatus, updateHealthStatusChart]);
  
  // Load database statistics
  const loadDatabaseStats = () => {
    // Simulated API call to get database statistics
    setTimeout(() => {
      const mockStats = {
        entityCounts: {
          clients: 87,
          caregivers: 32,
          schedules: 1126,
          users: 12
        },
        storageUsed: '42.5 MB',
        lastBackup: '2025-06-13T18:30:00Z',
        performance: {
          averageQueryTime: 45, // ms
          cachingEfficiency: 87 // percent
        }
      };
      
      setDbStats(mockStats);
    }, 800);
  };
  
  // Run database health check
  const runHealthCheck = () => {
    setHealthStatus(prev => ({
      ...prev,
      checkInProgress: true
    }));
    
    // Simulate API call for database health check
    setTimeout(() => {
      const mockHealth = {
        status: checkConfig.thoroughCheck ? 
          (Math.random() > 0.5 ? 'issues' : (Math.random() > 0.7 ? 'critical' : 'healthy')) : 
          (Math.random() > 0.7 ? 'issues' : 'healthy'),
        lastCheck: new Date().toISOString(),
        checkInProgress: false
      };
      
      setHealthStatus(mockHealth);
      
      // Generate mock inconsistencies based on status
      if (mockHealth.status === 'issues' || mockHealth.status === 'critical') {
        const mockIssues = generateMockInconsistencies(mockHealth.status === 'critical' ? 12 : 5);
        setInconsistencies(mockIssues);
        
        // Show notification
        notificationService.showNotification({
          type: mockHealth.status === 'critical' ? 'error' : 'warning',
          title: mockHealth.status === 'critical' ? 'Critical Database Issues' : 'Database Inconsistencies Found',
          message: `Found ${mockIssues.length} issues during database health check.`
        });
        
        // Switch to issues tab if there are inconsistencies
        setActiveTab('issues');
      } else {
        setInconsistencies([]);
        
        // Show success notification
        notificationService.showNotification({
          type: 'success',
          title: 'Database Health Check Completed',
          message: 'No inconsistencies found. Database is healthy.'
        });
      }
    }, checkConfig.thoroughCheck ? 3000 : 1500);
  };
  
  // Run repair operations
  const runRepairOperations = () => {
    // Validate that we have inconsistencies selected
    if (repairStatus.selectedInconsistencies.length === 0) {
      notificationService.showNotification({
        type: 'warning',
        title: 'No Issues Selected',
        message: 'Please select at least one issue to repair.'
      });
      return;
    }
    
    setRepairStatus(prev => ({
      ...prev,
      inProgress: true,
      results: null
    }));
    
    // Simulate API call for repair operations
    setTimeout(() => {
      // Determine which inconsistencies were successfully repaired
      const repairedIds = [];
      const failedIds = [];
      
      repairStatus.selectedInconsistencies.forEach(id => {
        // Simulate some repairs failing
        if (Math.random() > 0.2) {
          repairedIds.push(id);
        } else {
          failedIds.push(id);
        }
      });
      
      // Update the inconsistencies list
      const updatedInconsistencies = inconsistencies.filter(item => !repairedIds.includes(item.id));
      
      // Create repair results
      const results = {
        attemptedRepairs: repairStatus.selectedInconsistencies.length,
        successfulRepairs: repairedIds.length,
        failedRepairs: failedIds.length,
        remainingIssues: updatedInconsistencies.length,
        timestamp: new Date().toISOString()
      };
      
      setInconsistencies(updatedInconsistencies);
      setRepairStatus({
        inProgress: false,
        results,
        selectedInconsistencies: []
      });
      
      // Show notification
      if (failedIds.length === 0) {
        notificationService.showNotification({
          type: 'success',
          title: 'Repair Operations Completed',
          message: `Successfully repaired all ${repairedIds.length} selected issues.`
        });
      } else {
        notificationService.showNotification({
          type: 'warning',
          title: 'Repair Operations Partially Completed',
          message: `Repaired ${repairedIds.length} issues, but ${failedIds.length} repairs failed.`
        });
      }
      
      // If database is now healthy (no remaining issues), update health status
      if (updatedInconsistencies.length === 0) {
        setHealthStatus(prev => ({
          ...prev,
          status: 'healthy'
        }));
      }
      
      // Update database stats to reflect repairs
      loadDatabaseStats();
    }, 2000);
  };
  
  // Toggle selection of an inconsistency for repair
  const toggleInconsistencySelection = (id) => {
    setRepairStatus(prev => {
      const selectedInconsistencies = [...prev.selectedInconsistencies];
      const index = selectedInconsistencies.indexOf(id);
      
      if (index === -1) {
        selectedInconsistencies.push(id);
      } else {
        selectedInconsistencies.splice(index, 1);
      }
      
      return {
        ...prev,
        selectedInconsistencies
      };
    });
  };
  
  // Select all inconsistencies for repair
  const selectAllInconsistencies = () => {
    setRepairStatus(prev => ({
      ...prev,
      selectedInconsistencies: inconsistencies.map(item => item.id)
    }));
  };
  
  // Clear selection of inconsistencies for repair
  const clearInconsistencySelection = () => {
    setRepairStatus(prev => ({
      ...prev,
      selectedInconsistencies: []
    }));
  };
  
  // Handle check configuration changes
  const handleCheckConfigChange = (key, value) => {
    setCheckConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Handle repair configuration changes
  const handleRepairConfigChange = (key, value) => {
    setRepairConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Helper to get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'healthy':
        return 'status-badge-success';
      case 'issues':
        return 'status-badge-warning';
      case 'critical':
        return 'status-badge-danger';
      default:
        return 'status-badge-secondary';
    }
  };
  
  // Helper to get severity badge class
  const getSeverityBadgeClass = (severity) => {
    switch (severity) {
      case 'low':
        return 'severity-badge-info';
      case 'medium':
        return 'severity-badge-warning';
      case 'high':
        return 'severity-badge-danger';
      case 'critical':
        return 'severity-badge-dark';
      default:
        return 'severity-badge-secondary';
    }
  };
  
  return (
    <div className="data-consistency-checker">
      <h3>Data Consistency Checker</h3>
      
      <div className="checker-tabs">
        <button 
          className={activeTab === 'status' ? 'active' : ''}
          onClick={() => setActiveTab('status')}
        >
          Database Status
        </button>
        <button 
          className={activeTab === 'issues' ? 'active' : ''}
          onClick={() => setActiveTab('issues')}
          disabled={inconsistencies.length === 0}
        >
          Issues {inconsistencies.length > 0 && `(${inconsistencies.length})`}
        </button>
        <button 
          className={activeTab === 'repair' ? 'active' : ''}
          onClick={() => setActiveTab('repair')}
          disabled={inconsistencies.length === 0}
        >
          Repair
        </button>
        <button 
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>
      
      {activeTab === 'status' && (
        <div className="status-tab">
          <div className="health-status">
            <h4>Database Health</h4>
            <div className="status-indicator">
              <div className={`status-badge ${getStatusBadgeClass(healthStatus.status)}`}>
                {healthStatus.status.toUpperCase()}
              </div>
              {healthStatus.lastCheck && (
                <div className="last-check-time">
                  Last checked: {new Date(healthStatus.lastCheck).toLocaleString()}
                </div>
              )}
            </div>
            
            <canvas 
              ref={healthChartRef}
              width={200}
              height={200}
              className="health-chart"
            />
            
            <button 
              className="run-check-button"
              onClick={runHealthCheck}
              disabled={healthStatus.checkInProgress}
            >
              {healthStatus.checkInProgress ? 'Running Check...' : 'Run Health Check'}
            </button>
            
            <label>
              <input
                type="checkbox"
                checked={checkConfig.thoroughCheck}
                onChange={(e) => handleCheckConfigChange('thoroughCheck', e.target.checked)}
                disabled={healthStatus.checkInProgress}
              />
              Thorough Check
            </label>
          </div>
          
          <div className="database-stats">
            <h4>Database Statistics</h4>
            {dbStats ? (
              <div className="stats-container">
                <div className="storage-info">
                  <div>Storage Used: {dbStats.storageUsed}</div>
                  <div>Last Backup: {new Date(dbStats.lastBackup).toLocaleString()}</div>
                </div>
                
                <div className="entity-distribution">
                  <h5>Entity Distribution</h5>
                  <canvas 
                    ref={entityDistributionRef}
                    width={400}
                    height={200}
                    className="entity-chart"
                  />
                </div>
              </div>
            ) : (
              <div className="loading-stats">Loading database statistics...</div>
            )}
          </div>
        </div>
      )}
      
      {activeTab === 'issues' && (
        <div className="issues-tab">
          <h4>Database Inconsistencies</h4>
          
          {inconsistencies.length === 0 ? (
            <div className="no-issues">
              <p>No inconsistencies found. Database is healthy.</p>
            </div>
          ) : (
            <div className="issues-list">
              <div className="issue-controls">
                <span>Found {inconsistencies.length} issues</span>
                <button onClick={() => setActiveTab('repair')}>
                  Repair Issues
                </button>
                <button onClick={runHealthCheck} disabled={healthStatus.checkInProgress}>
                  Rerun Check
                </button>
              </div>
              
              <table className="issues-table">
                <thead>
                  <tr>
                    <th>
                      <input 
                        type="checkbox" 
                        checked={repairStatus.selectedInconsistencies.length === inconsistencies.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllInconsistencies();
                          } else {
                            clearInconsistencySelection();
                          }
                        }}
                      />
                    </th>
                    <th>Type</th>
                    <th>Entity</th>
                    <th>Description</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {inconsistencies.map(issue => (
                    <tr key={issue.id}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={repairStatus.selectedInconsistencies.includes(issue.id)}
                          onChange={() => toggleInconsistencySelection(issue.id)}
                        />
                      </td>
                      <td>{issue.type.replace('_', ' ')}</td>
                      <td>{issue.entity} ({issue.entityId})</td>
                      <td>{issue.description}</td>
                      <td>
                        <span className={`severity-badge ${getSeverityBadgeClass(issue.severity)}`}>
                          {issue.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <button 
                className="repair-button"
                onClick={runRepairOperations}
                disabled={repairStatus.inProgress}
              >
                {repairStatus.inProgress ? 'Repairing...' : 'Run Repair Operations'}
              </button>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'repair' && (
        <div className="repair-tab">
          <h4>Repair Database Inconsistencies</h4>
          
          <div className="repair-options">
            <h5>Selected Issues: {repairStatus.selectedInconsistencies.length} of {inconsistencies.length}</h5>
            
            <div className="repair-actions">
              <button onClick={selectAllInconsistencies} disabled={repairStatus.inProgress}>
                Select All
              </button>
              <button onClick={clearInconsistencySelection} disabled={repairStatus.inProgress}>
                Clear Selection
              </button>
            </div>
            
            <div className="repair-settings">
              <label>
                <input
                  type="checkbox"
                  checked={repairConfig.autoRepairSafe}
                  onChange={(e) => handleRepairConfigChange('autoRepairSafe', e.target.checked)}
                  disabled={repairStatus.inProgress}
                />
                Auto-repair safe issues
              </label>
              
              <label>
                <input
                  type="checkbox"
                  checked={repairConfig.backupBeforeRepair}
                  onChange={(e) => handleRepairConfigChange('backupBeforeRepair', e.target.checked)}
                  disabled={repairStatus.inProgress}
                />
                Backup before repair
              </label>
            </div>
            
            <button 
              className="repair-button"
              onClick={runRepairOperations}
              disabled={repairStatus.inProgress || repairStatus.selectedInconsistencies.length === 0}
            >
              {repairStatus.inProgress ? 'Repairing...' : 'Run Repair Operations'}
            </button>
          </div>
          
          {repairStatus.results && (
            <div className="repair-results">
              <h5>Repair Results</h5>
              <div>Attempted: {repairStatus.results.attemptedRepairs}</div>
              <div>Successful: {repairStatus.results.successfulRepairs}</div>
              <div>Failed: {repairStatus.results.failedRepairs}</div>
              <div>Remaining: {repairStatus.results.remainingIssues}</div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'settings' && (
        <div className="settings-tab">
          <h4>Consistency Checker Settings</h4>
          
          <div className="settings-section">
            <h5>Check Configuration</h5>
            
            <label>
              <input
                type="checkbox"
                checked={checkConfig.thoroughCheck}
                onChange={(e) => handleCheckConfigChange('thoroughCheck', e.target.checked)}
              />
              Perform thorough check
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={checkConfig.orphanedRecords}
                onChange={(e) => handleCheckConfigChange('orphanedRecords', e.target.checked)}
              />
              Check for orphaned records
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={checkConfig.relations}
                onChange={(e) => handleCheckConfigChange('relations', e.target.checked)}
              />
              Check relations
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={checkConfig.dataIntegrity}
                onChange={(e) => handleCheckConfigChange('dataIntegrity', e.target.checked)}
              />
              Check data integrity
            </label>
          </div>
          
          <div className="settings-section">
            <h5>Repair Configuration</h5>
            
            <label>
              <input
                type="checkbox"
                checked={repairConfig.autoRepairSafe}
                onChange={(e) => handleRepairConfigChange('autoRepairSafe', e.target.checked)}
              />
              Auto-repair safe issues
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={repairConfig.deleteOrphaned}
                onChange={(e) => handleRepairConfigChange('deleteOrphaned', e.target.checked)}
              />
              Delete orphaned records
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={repairConfig.createMissingRelations}
                onChange={(e) => handleRepairConfigChange('createMissingRelations', e.target.checked)}
              />
              Create missing relations
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={repairConfig.backupBeforeRepair}
                onChange={(e) => handleRepairConfigChange('backupBeforeRepair', e.target.checked)}
              />
              Backup before repair
            </label>
          </div>
          
          <div className="settings-actions">
            <button>Save Settings</button>
            <button>Reset to Defaults</button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .data-consistency-checker {
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px;
          height: 100%;
        }
        
        .checker-tabs {
          display: flex;
          margin-bottom: 20px;
        }
        
        .checker-tabs button {
          flex: 1;
          padding: 10px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          cursor: pointer;
        }
        
        .checker-tabs button.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }
        
        .health-chart, .entity-chart {
          margin: 15px 0;
          border: 1px solid #dee2e6;
          border-radius: 4px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 4px;
          font-weight: bold;
          margin: 5px 0;
        }
        
        .status-badge-success { background: #28a745; color: white; }
        .status-badge-warning { background: #ffc107; color: #212529; }
        .status-badge-danger { background: #dc3545; color: white; }
        .status-badge-secondary { background: #6c757d; color: white; }
        
        .severity-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 12px;
        }
        
        .severity-badge-info { background: #17a2b8; color: white; }
        .severity-badge-warning { background: #ffc107; color: #212529; }
        .severity-badge-danger { background: #dc3545; color: white; }
        .severity-badge-dark { background: #343a40; color: white; }
        
        .issues-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        
        .issues-table th, .issues-table td {
          padding: 8px 12px;
          border: 1px solid #dee2e6;
          text-align: left;
        }
        
        .issues-table th {
          background: #f8f9fa;
        }
        
        button {
          padding: 8px 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        
        button:hover:not(:disabled) {
          background: #0069d9;
        }
        
        button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }
        
        .settings-section {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .settings-section label {
          display: block;
          margin-bottom: 10px;
        }
      `}</style>
    </div>
  );
};

export default DataConsistencyChecker;

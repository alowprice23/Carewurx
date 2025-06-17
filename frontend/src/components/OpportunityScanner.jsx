import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { agentService, scannerService } from '../services';

// Memoized opportunity card component for better performance
const OpportunityCard = memo(({ opportunity, onApply, onReject }) => {
  const { id, title, score, clientName, scheduledDate, startTime, endTime, 
          caregiverName, description, status } = opportunity;
  
  // Format date for display
  const formattedDate = useMemo(() => {
    if (!scheduledDate) return 'TBD';
    const date = new Date(scheduledDate);
    return date.toLocaleDateString();
  }, [scheduledDate]);
  
  return (
    <div className={`opportunity-card ${status || ''}`}>
      <div className="opportunity-header">
        <h4>{title}</h4>
        <span className="score">{score.toFixed(1)}</span>
      </div>
      <div className="opportunity-details">
        <p><strong>Client:</strong> {clientName}</p>
        <p><strong>Date:</strong> {formattedDate}</p>
        <p><strong>Time:</strong> {startTime} - {endTime}</p>
        {caregiverName && (
          <p><strong>Caregiver:</strong> {caregiverName}</p>
        )}
      </div>
      <div className="opportunity-description">
        {description}
      </div>
      {!status && (
        <div className="opportunity-actions">
          <button 
            onClick={() => onApply(id)}
            className="apply-button"
          >
            Apply
          </button>
          <button 
            onClick={() => onReject(id)}
            className="reject-button"
          >
            Reject
          </button>
        </div>
      )}
      {status && (
        <div className="opportunity-status">
          Status: <span className="status-text">{status}</span>
        </div>
      )}
    </div>
  );
});

/**
 * Opportunity Scanner Component
 * Provides interface for scanning and viewing opportunities
 */
const OpportunityScanner = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannerStatus, setScannerStatus] = useState({ isRunning: false, lastScan: null });
  const [scanHistory, setScanHistory] = useState([]);
  const [intervalMinutes, setIntervalMinutes] = useState(30); // Default to 30 minutes
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Validate interval input
  const validateInterval = useCallback((minutes) => {
    if (isNaN(minutes) || minutes < 5 || minutes > 120) {
      setError('Scan interval must be between 5 and 120 minutes');
      return false;
    }
    setError('');
    return true;
  }, []);

  // Fetch opportunities with proper error handling
  const fetchOpportunities = useCallback(async () => {
    try {
      setError('');
      // Verify service availability
      if (!agentService) {
        throw new Error('Agent service is not available - backend connection missing');
      }
      
      const options = { limit: 20, sortBy: 'score', order: 'desc' };
      const result = await agentService.scanForOpportunities(options);
      
      if (!result || !Array.isArray(result)) {
        throw new Error('Invalid response format from opportunity scan');
      }
      
      setOpportunities(result);
      setSuccessMessage('Opportunities fetched successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      setError(`Failed to fetch opportunities: ${error.message}`);
    }
  }, []);

  // Get scanner status with proper error handling
  const getScannerStatus = useCallback(async () => {
    try {
      setError('');
      // Verify service availability
      if (!scannerService) {
        throw new Error('Scanner service is not available - backend connection missing');
      }
      
      const status = await scannerService.getStatus();
      
      if (!status) {
        throw new Error('Invalid response from scanner status');
      }
      
      setScannerStatus(status);
    } catch (error) {
      console.error('Error getting scanner status:', error);
      setError(`Failed to get scanner status: ${error.message}`);
    }
  }, []);

  // Get scan history
  const getScanHistory = useCallback(async () => {
    try {
      const history = await scannerService.getHistory(5); // Get last 5 scans
      setScanHistory(history);
    } catch (error) {
      console.error('Error getting scan history:', error);
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchOpportunities();
    getScannerStatus();
    getScanHistory();

    // Set up auto-refresh of status every minute
    const statusInterval = setInterval(getScannerStatus, 60000);
    return () => clearInterval(statusInterval);
  }, [fetchOpportunities, getScannerStatus, getScanHistory]);

  // Set up auto-scanning effect
  useEffect(() => {
    let scanInterval;
    
    if (autoScanEnabled) {
      // Start the scanner if auto scan is enabled
      scannerService.start(intervalMinutes)
        .then(() => {
          console.log(`Scanner started with ${intervalMinutes} minute interval`);
          getScannerStatus();
        })
        .catch(error => {
          console.error('Error starting scanner:', error);
        });
      
      // Also set up a refresh interval to update opportunities
      scanInterval = setInterval(fetchOpportunities, intervalMinutes * 60000);
    } else if (scannerStatus.isRunning) {
      // Stop the scanner if it's running and auto scan is disabled
      scannerService.stop()
        .then(() => {
          console.log('Scanner stopped');
          getScannerStatus();
        })
        .catch(error => {
          console.error('Error stopping scanner:', error);
        });
      
      if (scanInterval) {
        clearInterval(scanInterval);
      }
    }
    
    return () => {
      if (scanInterval) {
        clearInterval(scanInterval);
      }
    };
  }, [autoScanEnabled, intervalMinutes, fetchOpportunities, getScannerStatus, scannerStatus.isRunning]);


  // Manual scan with progress tracking and better error handling
  const handleManualScan = async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setError('');
    setSuccessMessage('');
    
    try {
      // Verify service availability
      if (!scannerService) {
        throw new Error('Scanner service is not available - backend connection missing');
      }
      
      // Start progress simulation
      const progressInterval = setInterval(() => {
        setScanProgress(current => {
          // Max out at 90% until we get actual results
          return current < 90 ? current + 10 : current;
        });
      }, 300);
      
      // Perform scan
      await scannerService.forceScan();
      setScanProgress(95);
      
      // Update UI with results
      await fetchOpportunities();
      setScanProgress(98);
      
      await getScannerStatus();
      await getScanHistory();
      setScanProgress(100);
      
      setSuccessMessage('Scan completed successfully');
      
      // Clear progress and success message after 3 seconds
      setTimeout(() => {
        setScanProgress(0);
        setSuccessMessage('');
      }, 3000);
      
      clearInterval(progressInterval);
    } catch (error) {
      console.error('Error performing manual scan:', error);
      setError(`Scan failed: ${error.message}`);
      setScanProgress(0);
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle auto scanning with validation
  const toggleAutoScan = () => {
    if (!autoScanEnabled) {
      // Validate before enabling
      if (!validateInterval(intervalMinutes)) {
        return;
      }
    }
    setAutoScanEnabled(!autoScanEnabled);
  };
  
  // Handle interval change with validation
  const handleIntervalChange = (e) => {
    const value = parseInt(e.target.value);
    setIntervalMinutes(value);
    validateInterval(value);
  };

  // Handle applying for an opportunity
  const handleApplyOpportunity = async (opportunityId) => {
    try {
      await agentService.applyOpportunity(opportunityId);
      // Update the opportunities list
      setOpportunities(opportunities.map(opp => 
        opp.id === opportunityId 
          ? { ...opp, status: 'applied' } 
          : opp
      ));
    } catch (error) {
      console.error('Error applying for opportunity:', error);
    }
  };

  // Handle rejecting an opportunity
  const handleRejectOpportunity = async (opportunityId, reason = 'Not suitable') => {
    try {
      await agentService.rejectOpportunity(opportunityId, reason);
      // Update the opportunities list
      setOpportunities(opportunities.map(opp => 
        opp.id === opportunityId 
          ? { ...opp, status: 'rejected' } 
          : opp
      ));
    } catch (error) {
      console.error('Error rejecting opportunity:', error);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="opportunity-scanner">
      <div className="scanner-controls">
        <div className="scanner-status">
          <h3>Scanner Status</h3>
          <div className="status-indicator">
            <span className={`status-dot ${scannerStatus.isRunning ? 'active' : 'inactive'}`}></span>
            <span className="status-text">
              {scannerStatus.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="last-scan">
            Last scan: {formatDate(scannerStatus.lastScan)}
          </div>
        </div>
        
        <div className="scanner-config">
          <h3>Scanner Configuration</h3>
          <div className="interval-setting">
            <label htmlFor="intervalMinutes">Scan interval (minutes):</label>
            <input
              type="number"
              id="intervalMinutes"
              min="5"
              max="120"
              value={intervalMinutes}
              onChange={handleIntervalChange}
              disabled={autoScanEnabled}
              className={error && error.includes('interval') ? 'input-error' : ''}
            />
          </div>
          <div className="auto-scan-toggle">
            <label htmlFor="autoScan">Auto-scan:</label>
            <input
              type="checkbox"
              id="autoScan"
              checked={autoScanEnabled}
              onChange={toggleAutoScan}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}
          
          <button 
            onClick={handleManualScan} 
            disabled={isScanning || autoScanEnabled || Boolean(error)}
            className="scan-button"
          >
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </button>
          
          {isScanning && (
            <div className="progress-container">
              <div 
                className="progress-bar" 
                style={{ width: `${scanProgress}%` }}
              ></div>
              <div className="progress-text">{scanProgress}%</div>
            </div>
          )}
        </div>
      </div>
      
      <div className="scan-history">
        <h3>Scan History</h3>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Results</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {scanHistory.map((scan, index) => (
              <tr key={index}>
                <td>{formatDate(scan.timestamp)}</td>
                <td>{scan.opportunitiesFound} opportunities</td>
                <td>{scan.durationMs}ms</td>
              </tr>
            ))}
            {scanHistory.length === 0 && (
              <tr>
                <td colSpan="3">No scan history available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="opportunities-list">
        <h3>Available Opportunities</h3>
        {opportunities.length === 0 ? (
          <div className="no-opportunities">
            No opportunities found. Try scanning again.
          </div>
        ) : (
          <div className="opportunities-container">
            {/* Use memoized card components for better performance */}
            {opportunities.map((opp) => (
              <OpportunityCard 
                key={opp.id}
                opportunity={opp}
                onApply={handleApplyOpportunity}
                onReject={handleRejectOpportunity}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .opportunity-scanner {
          padding: 20px;
          background: #f9f9f9;
          border-radius: 8px;
        }
        
        .scanner-controls {
          display: flex;
          margin-bottom: 20px;
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .scanner-status, .scanner-config {
          flex: 1;
          padding: 0 15px;
        }
        
        .scanner-status {
          border-right: 1px solid #eee;
        }
        
        h3 {
          margin-top: 0;
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        
        .status-indicator {
          display: flex;
          align-items: center;
          margin: 15px 0;
        }
        
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
        }
        
        .status-dot.active {
          background: #2ecc71;
        }
        
        .status-dot.inactive {
          background: #e74c3c;
        }
        
        .interval-setting, .auto-scan-toggle {
          margin-bottom: 15px;
        }
        
        .interval-setting input {
          margin-left: 10px;
          width: 60px;
          padding: 5px;
        }
        
        .scan-button {
          padding: 8px 15px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .scan-button:hover {
          background: #2980b9;
        }
        
        .scan-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .progress-container {
          margin-top: 10px;
          background: #ecf0f1;
          border-radius: 10px;
          height: 10px;
          position: relative;
          overflow: hidden;
        }
        
        .progress-bar {
          background: #3498db;
          height: 100%;
          border-radius: 10px;
          transition: width 0.3s;
        }
        
        .progress-text {
          position: absolute;
          top: -5px;
          right: 10px;
          font-size: 0.8rem;
          color: #2c3e50;
        }
        
        .error-message {
          color: #e74c3c;
          font-size: 0.85rem;
          margin: 5px 0 10px;
          padding: 5px 10px;
          background: #fdeded;
          border-radius: 4px;
          border-left: 3px solid #e74c3c;
        }
        
        .success-message {
          color: #27ae60;
          font-size: 0.85rem;
          margin: 5px 0 10px;
          padding: 5px 10px;
          background: #eafaf1;
          border-radius: 4px;
          border-left: 3px solid #27ae60;
        }
        
        .input-error {
          border: 1px solid #e74c3c;
          background: #fdeded;
        }
        
        .scan-history {
          background: white;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        
        th {
          background: #f5f5f5;
        }
        
        .opportunities-list {
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .no-opportunities {
          padding: 20px;
          text-align: center;
          color: #7f8c8d;
        }
        
        .opportunities-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .opportunity-card {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
          transition: transform 0.2s;
        }
        
        .opportunity-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .opportunity-card.applied {
          border-left: 4px solid #2ecc71;
        }
        
        .opportunity-card.rejected {
          border-left: 4px solid #e74c3c;
          opacity: 0.8;
        }
        
        .opportunity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .opportunity-header h4 {
          margin: 0;
          color: #2c3e50;
        }
        
        .score {
          background: #f39c12;
          color: white;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: bold;
        }
        
        .opportunity-details {
          font-size: 0.9rem;
          margin-bottom: 10px;
        }
        
        .opportunity-details p {
          margin: 5px 0;
        }
        
        .opportunity-description {
          font-size: 0.9rem;
          color: #555;
          margin-bottom: 15px;
          border-top: 1px solid #eee;
          padding-top: 10px;
        }
        
        .opportunity-actions {
          display: flex;
          justify-content: space-between;
        }
        
        .apply-button, .reject-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
          font-size: 0.9rem;
        }
        
        .apply-button {
          background: #2ecc71;
          color: white;
        }
        
        .apply-button:hover {
          background: #27ae60;
        }
        
        .reject-button {
          background: #e74c3c;
          color: white;
        }
        
        .reject-button:hover {
          background: #c0392b;
        }
        
        .opportunity-status {
          font-size: 0.9rem;
          color: #7f8c8d;
        }
        
        .status-text {
          font-weight: bold;
          text-transform: capitalize;
        }
      `}</style>
    </div>
  );
};

export default OpportunityScanner;

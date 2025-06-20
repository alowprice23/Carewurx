import React, { useState, useEffect, useCallback } from 'react';
import { universalScheduleService, notificationService } from '../services';

/**
 * Conflict Resolution UI Component
 * Handles identification and resolution of scheduling conflicts
 */
const ConflictResolutionUI = ({ onResolutionComplete }) => {
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [resolutionOptions, setResolutionOptions] = useState([]);
  const [resolutionHistory, setResolutionHistory] = useState([]);
  const [loading, setLoading] = useState({
    conflicts: true,
    options: false,
    history: true,
    resolution: false
  });
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending'); // 'pending', 'resolved', 'all'
  const [sortBy, setSortBy] = useState('date'); // 'date', 'severity', 'client'
  const [sortDirection, setSortDirection] = useState('desc');
  const [showDetails, setShowDetails] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  // Fetch active conflicts
  const fetchConflicts = useCallback(async () => {
    setLoading(prev => ({ ...prev, conflicts: true }));
    setError(null);
    
    try {
      // Use the new consolidated getConflicts method
      const conflictsData = await universalScheduleService.getConflicts({ status: filterStatus === 'all' ? undefined : filterStatus });
      
      // Sort conflicts
      const sortedConflicts = sortConflicts(conflictsData, sortBy, sortDirection);
      setConflicts(sortedConflicts);
    } catch (err) {
      console.error('Error fetching conflicts:', err);
      setError('Failed to load scheduling conflicts. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, conflicts: false }));
    }
  }, [filterStatus, sortBy, sortDirection]);

  // Fetch resolution history
  const fetchResolutionHistory = useCallback(async () => {
    setLoading(prev => ({ ...prev, history: true }));
    
    try {
      const historyData = await universalScheduleService.getConflictResolutionHistory();
      setResolutionHistory(historyData);
    } catch (err) {
      console.error('Error fetching resolution history:', err);
      // No need to set error state for history, it's not critical
    } finally {
      setLoading(prev => ({ ...prev, history: false }));
    }
  }, []);

  // Sort conflicts based on criteria
  const sortConflicts = (conflictsToSort, sortCriteria, direction) => {
    return [...conflictsToSort].sort((a, b) => {
      let comparison = 0;
      
      if (sortCriteria === 'date') {
        comparison = new Date(a.detectedAt) - new Date(b.detectedAt);
      } else if (sortCriteria === 'severity') {
        comparison = b.severity - a.severity;
      } else if (sortCriteria === 'client') {
        comparison = a.client.name.localeCompare(b.client.name);
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  };

  // Initial data load
  useEffect(() => {
    fetchConflicts();
    fetchResolutionHistory();
  }, [fetchConflicts, fetchResolutionHistory]);

  // Fetch resolution options when a conflict is selected
  useEffect(() => {
    if (!selectedConflict) {
      setResolutionOptions([]);
      return;
    }
    
    const getResolutionOptions = async () => {
      setLoading(prev => ({ ...prev, options: true }));
      
      try {
        // Pass the whole selectedConflict object as it might be needed for context by the service/backend
        const options = await universalScheduleService.getConflictResolutionOptions(selectedConflict);
        setResolutionOptions(options);
      } catch (err) {
        console.error('Error fetching resolution options:', err);
        setError('Failed to load resolution options. Please try again.');
      } finally {
        setLoading(prev => ({ ...prev, options: false }));
      }
    };
    
    getResolutionOptions();
  }, [selectedConflict]);

  // Handle conflict selection
  const handleConflictSelect = (conflict) => {
    setSelectedConflict(conflict);
    setShowDetails(true);
    setResolutionNote('');
  };

  // Handle resolution option selection and application
  const handleResolveConflict = async (optionId) => {
    if (!selectedConflict || !optionId) return;
    
    setLoading(prev => ({ ...prev, resolution: true }));
    setError(null);
    
    try {
      // Assuming current user ID can be fetched or is available via props/context
      const currentUserId = 'temp-user-id'; // Placeholder: Replace with actual user ID source

      const resolutionPayload = {
        conflictId: selectedConflict.id,
        resolutionOptionId: optionId, // The backend might map this to a specific action
        notes: resolutionNote,
        resolvedBy: currentUserId
      };
      
      await universalScheduleService.resolveConflict(resolutionPayload);
      
      // Notify the system about the resolution
      await notificationService.createNotification({
        type: 'info',
        title: 'Schedule Conflict Resolved',
        message: `The conflict involving ${selectedConflict.client.name} has been resolved.`,
        link: `/schedules/${selectedConflict.scheduleId}`
      });
      
      // Refresh conflicts and history
      await fetchConflicts();
      await fetchResolutionHistory();
      
      // Reset state
      setSelectedConflict(null);
      setShowDetails(false);
      setResolutionNote('');
      
      // Call completion callback if provided
      if (onResolutionComplete) {
        onResolutionComplete();
      }
    } catch (err) {
      console.error('Error resolving conflict:', err);
      setError('Failed to resolve conflict. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, resolution: false }));
    }
  };

  // Handle manual override of a conflict
  const handleManualOverride = async () => {
    if (!selectedConflict) return;
    
    setLoading(prev => ({ ...prev, resolution: true }));
    setError(null);
    
    try {
      // Assuming current user ID can be fetched or is available via props/context
      const currentUserId = 'temp-user-id'; // Placeholder: Replace with actual user ID source

      const overridePayload = {
        conflictId: selectedConflict.id,
        overrideReason: resolutionNote || 'Manual override by user.',
        userId: currentUserId // Pass userId as expected by backend
      };
      
      await universalScheduleService.overrideConflict(overridePayload);
      
      // Notify the system about the override
      await notificationService.createNotification({
        type: 'warning',
        title: 'Schedule Conflict Overridden',
        message: `The conflict involving ${selectedConflict.client.name} has been manually overridden.`,
        link: `/schedules/${selectedConflict.scheduleId}`
      });
      
      // Refresh conflicts and history
      await fetchConflicts();
      await fetchResolutionHistory();
      
      // Reset state
      setSelectedConflict(null);
      setShowDetails(false);
      setResolutionNote('');
      
      // Call completion callback if provided
      if (onResolutionComplete) {
        onResolutionComplete();
      }
    } catch (err) {
      console.error('Error overriding conflict:', err);
      setError('Failed to override conflict. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, resolution: false }));
    }
  };

  // Toggle sort direction when clicking the same sort criteria
  const handleSortChange = (criteria) => {
    if (sortBy === criteria) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(criteria);
      setSortDirection('desc'); // Default to descending for new criteria
    }
  };

  // Handle filter status change
  const handleFilterChange = (status) => {
    setFilterStatus(status);
  };

  // Format severity for display
  const formatSeverity = (severity) => {
    if (severity >= 8) return 'High';
    if (severity >= 4) return 'Medium';
    return 'Low';
  };

  // Get severity class
  const getSeverityClass = (severity) => {
    if (severity >= 8) return 'high';
    if (severity >= 4) return 'medium';
    return 'low';
  };

  // Format datetime for display
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Render conflict list
  const renderConflictList = () => {
    if (loading.conflicts) {
      return <div className="loading">Loading conflicts...</div>;
    }
    
    if (conflicts.length === 0) {
      return (
        <div className="no-conflicts">
          <p>No {filterStatus !== 'all' ? filterStatus : ''} conflicts found.</p>
        </div>
      );
    }
    
    return (
      <div className="conflict-list">
        <div className="conflict-list-header">
          <div 
            className={`header-cell date ${sortBy === 'date' ? 'active' : ''}`}
            onClick={() => handleSortChange('date')}
          >
            Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
          </div>
          <div 
            className={`header-cell client ${sortBy === 'client' ? 'active' : ''}`}
            onClick={() => handleSortChange('client')}
          >
            Client {sortBy === 'client' && (sortDirection === 'asc' ? '↑' : '↓')}
          </div>
          <div 
            className={`header-cell severity ${sortBy === 'severity' ? 'active' : ''}`}
            onClick={() => handleSortChange('severity')}
          >
            Severity {sortBy === 'severity' && (sortDirection === 'asc' ? '↑' : '↓')}
          </div>
          <div className="header-cell type">Type</div>
        </div>
        
        {conflicts.map(conflict => (
          <div 
            key={conflict.id}
            className={`conflict-item ${selectedConflict?.id === conflict.id ? 'selected' : ''}`}
            onClick={() => handleConflictSelect(conflict)}
          >
            <div className="conflict-cell date">{formatDateTime(conflict.detectedAt)}</div>
            <div className="conflict-cell client">{conflict.client.name}</div>
            <div className={`conflict-cell severity ${getSeverityClass(conflict.severity)}`}>
              {formatSeverity(conflict.severity)}
            </div>
            <div className="conflict-cell type">{conflict.type}</div>
          </div>
        ))}
      </div>
    );
  };

  // Render conflict details
  const renderConflictDetails = () => {
    if (!selectedConflict) {
      return (
        <div className="no-selection">
          <p>Select a conflict from the list to view details and resolution options.</p>
        </div>
      );
    }
    
    return (
      <div className="conflict-details">
        <h3>Conflict Details</h3>
        
        <div className="detail-section">
          <div className="detail-row">
            <span className="detail-label">Client:</span>
            <span className="detail-value">{selectedConflict.client.name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Caregivers:</span>
            <span className="detail-value">
              {selectedConflict.caregivers.map(cg => cg.name).join(', ')}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Schedule Date:</span>
            <span className="detail-value">
              {new Date(selectedConflict.scheduleDate).toLocaleDateString()}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Time:</span>
            <span className="detail-value">
              {selectedConflict.startTime} - {selectedConflict.endTime}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Type:</span>
            <span className="detail-value">{selectedConflict.type}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Severity:</span>
            <span className={`detail-value severity ${getSeverityClass(selectedConflict.severity)}`}>
              {formatSeverity(selectedConflict.severity)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Detected:</span>
            <span className="detail-value">{formatDateTime(selectedConflict.detectedAt)}</span>
          </div>
        </div>
        
        <div className="detail-section">
          <h4>Conflict Description</h4>
          <p className="conflict-description">{selectedConflict.description}</p>
        </div>
        
        <div className="resolution-section">
          <h4>Resolution Options</h4>
          
          {loading.options ? (
            <div className="loading">Loading resolution options...</div>
          ) : resolutionOptions.length === 0 ? (
            <p>No automatic resolution options available. Please use manual override.</p>
          ) : (
            <div className="resolution-options">
              {resolutionOptions.map(option => (
                <div key={option.id} className="resolution-option">
                  <div className="option-description">{option.description}</div>
                  <div className="option-impact">
                    <span className="impact-label">Impact:</span>
                    <span className={`impact-value ${option.impactLevel.toLowerCase()}`}>
                      {option.impactLevel}
                    </span>
                  </div>
                  <button 
                    className="apply-button"
                    disabled={loading.resolution}
                    onClick={() => handleResolveConflict(option.id)}
                  >
                    Apply This Resolution
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="resolution-note">
            <h4>Resolution Note</h4>
            <textarea
              placeholder="Enter any notes about this resolution..."
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="resolution-actions">
            <button 
              className="manual-override-button"
              disabled={loading.resolution}
              onClick={handleManualOverride}
            >
              Manual Override
            </button>
            <button 
              className="cancel-button"
              onClick={() => {
                setSelectedConflict(null);
                setShowDetails(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render resolution history
  const renderResolutionHistory = () => {
    if (loading.history) {
      return <div className="loading">Loading resolution history...</div>;
    }
    
    if (resolutionHistory.length === 0) {
      return (
        <div className="no-history">
          <p>No resolution history available.</p>
        </div>
      );
    }
    
    return (
      <div className="resolution-history">
        <h3>Resolution History</h3>
        
        <div className="history-list">
          {resolutionHistory.map(item => (
            <div key={item.id} className="history-item">
              <div className="history-header">
                <span className="history-date">{formatDateTime(item.resolvedAt)}</span>
                <span className={`history-method ${item.method === 'override' ? 'override' : 'resolution'}`}>
                  {item.method === 'override' ? 'Manual Override' : 'Automatic Resolution'}
                </span>
              </div>
              <div className="history-details">
                <div className="history-client">
                  <span className="detail-label">Client:</span>
                  <span className="detail-value">{item.client.name}</span>
                </div>
                <div className="history-conflict-type">
                  <span className="detail-label">Conflict Type:</span>
                  <span className="detail-value">{item.conflictType}</span>
                </div>
                {item.method !== 'override' && (
                  <div className="history-resolution">
                    <span className="detail-label">Resolution:</span>
                    <span className="detail-value">{item.resolutionDescription}</span>
                  </div>
                )}
                {item.note && (
                  <div className="history-note">
                    <span className="detail-label">Note:</span>
                    <span className="detail-value">{item.note}</span>
                  </div>
                )}
                <div className="history-resolver">
                  <span className="detail-label">Resolved By:</span>
                  <span className="detail-value">{item.resolvedBy}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="conflict-resolution-ui">
      {error && <div className="error-message">{error}</div>}
      
      <div className="conflict-filters">
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          <div className="filter-buttons">
            <button 
              className={`filter-button ${filterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => handleFilterChange('pending')}
            >
              Pending
            </button>
            <button 
              className={`filter-button ${filterStatus === 'resolved' ? 'active' : ''}`}
              onClick={() => handleFilterChange('resolved')}
            >
              Resolved
            </button>
            <button 
              className={`filter-button ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              All
            </button>
          </div>
        </div>
        
        <button 
          className="refresh-button"
          onClick={fetchConflicts}
          disabled={loading.conflicts}
        >
          Refresh
        </button>
      </div>
      
      <div className="conflict-container">
        <div className={`conflict-section ${showDetails ? 'minimized' : ''}`}>
          <h3>Schedule Conflicts</h3>
          {renderConflictList()}
        </div>
        
        {showDetails && (
          <div className="detail-section">
            {renderConflictDetails()}
          </div>
        )}
      </div>
      
      <div className="history-container">
        {renderResolutionHistory()}
      </div>

      <style jsx>{`
        .conflict-resolution-ui {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .conflict-filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
        }
        
        .filter-label {
          margin-right: 10px;
          font-weight: 500;
        }
        
        .filter-buttons {
          display: flex;
        }
        
        .filter-button {
          padding: 8px 12px;
          background: none;
          border: 1px solid #e9ecef;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .filter-button:first-child {
          border-radius: 4px 0 0 4px;
        }
        
        .filter-button:last-child {
          border-radius: 0 4px 4px 0;
        }
        
        .filter-button.active {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }
        
        .refresh-button {
          padding: 8px 12px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .refresh-button:hover {
          background: #e9ecef;
        }
        
        .conflict-container {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .conflict-section {
          flex: 1;
          min-width: 0;
        }
        
        .conflict-section.minimized {
          flex: 0 0 300px;
        }
        
        .detail-section {
          flex: 2;
          min-width: 0;
        }
        
        .conflict-section h3, .detail-section h3 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
        }
        
        .conflict-list {
          border: 1px solid #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .conflict-list-header {
          display: flex;
          background: #f8f9fa;
          font-weight: 500;
        }
        
        .header-cell {
          padding: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .header-cell:hover {
          background: #e9ecef;
        }
        
        .header-cell.active {
          background: #e9ecef;
        }
        
        .header-cell.date, .conflict-cell.date {
          flex: 1.5;
        }
        
        .header-cell.client, .conflict-cell.client {
          flex: 2;
        }
        
        .header-cell.severity, .conflict-cell.severity {
          flex: 1;
        }
        
        .header-cell.type, .conflict-cell.type {
          flex: 1.5;
        }
        
        .conflict-item {
          display: flex;
          border-top: 1px solid #e9ecef;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .conflict-item:hover {
          background: #f8f9fa;
        }
        
        .conflict-item.selected {
          background: #e3f2fd;
        }
        
        .conflict-cell {
          padding: 10px;
        }
        
        .conflict-cell.severity {
          font-weight: 500;
        }
        
        .conflict-cell.severity.high, .detail-value.severity.high, .impact-value.high {
          color: #e74c3c;
        }
        
        .conflict-cell.severity.medium, .detail-value.severity.medium, .impact-value.medium {
          color: #f39c12;
        }
        
        .conflict-cell.severity.low, .detail-value.severity.low, .impact-value.low {
          color: #2ecc71;
        }
        
        .no-conflicts, .no-selection, .no-history, .loading {
          padding: 20px;
          text-align: center;
          color: #6c757d;
          border: 1px solid #e9ecef;
          border-radius: 4px;
        }
        
        .conflict-details {
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 15px;
        }
        
        .detail-section {
          margin-bottom: 20px;
        }
        
        .detail-row {
          margin-bottom: 8px;
          display: flex;
        }
        
        .detail-label {
          font-weight: 500;
          min-width: 100px;
          margin-right: 10px;
        }
        
        .conflict-description {
          line-height: 1.5;
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
        }
        
        .resolution-options {
          margin-top: 15px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .resolution-option {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          border-left: 4px solid #3498db;
        }
        
        .option-description {
          margin-bottom: 5px;
        }
        
        .option-impact {
          margin-bottom: 10px;
          font-size: 0.9rem;
        }
        
        .impact-label {
          font-weight: 500;
          margin-right: 5px;
        }
        
        .apply-button {
          padding: 6px 12px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .apply-button:hover {
          background: #2980b9;
        }
        
        .resolution-note {
          margin-top: 20px;
        }
        
        .resolution-note h4 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        
        .resolution-note textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          resize: vertical;
        }
        
        .resolution-actions {
          margin-top: 15px;
          display: flex;
          gap: 10px;
        }
        
        .manual-override-button, .cancel-button {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .manual-override-button {
          background: #e74c3c;
          color: white;
        }
        
        .manual-override-button:hover {
          background: #c0392b;
        }
        
        .cancel-button {
          background: #95a5a6;
          color: white;
        }
        
        .cancel-button:hover {
          background: #7f8c8d;
        }
        
        .history-container {
          margin-top: 20px;
        }
        
        .resolution-history h3 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
        }
        
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .history-item {
          background: #f8f9fa;
          border-radius: 4px;
          padding: 10px;
        }
        
        .history-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .history-date {
          font-weight: 500;
        }
        
        .history-method {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        
        .history-method.resolution {
          background: #d4edda;
          color: #155724;
        }
        
        .history-method.override {
          background: #f8d7da;
          color: #721c24;
        }
        
        .history-details {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }
        
        .history-note {
          grid-column: 1 / -1;
        }
      `}</style>
    </div>
  );
};

export default ConflictResolutionUI;

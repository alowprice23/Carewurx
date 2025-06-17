import React, { useState, useEffect, useRef } from 'react';
import { notificationService, universalScheduleService } from '../services';

/**
 * Circular Data Flow Monitor Component
 * Visualizes the data flow in the system based on the C=2πr model,
 * displays update history, and provides conflict detection alerts.
 */
const CircularDataFlowMonitor = () => {
  // Flow visualization state
  const [flowData, setFlowData] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [activeView, setActiveView] = useState('flow'); // 'flow', 'history', 'conflicts'
  
  // Visualization settings
  const [timeRange, setTimeRange] = useState('24h'); // '1h', '24h', '7d', '30d'
  const [refreshInterval, setRefreshInterval] = useState(0); // 0 = manual, 30 = 30 seconds, etc.
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  
  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Canvas reference for drawing
  const canvasRef = useRef(null);
  
  // Interval reference for auto-refresh
  const intervalRef = useRef(null);
  
  // Constants for visualization
  const ENTITY_TYPES = {
    CLIENT: { color: '#3498db', radius: 60, label: 'Client' },
    CAREGIVER: { color: '#2ecc71', radius: 60, label: 'Caregiver' },
    SCHEDULE: { color: '#e74c3c', radius: 60, label: 'Schedule' },
    NOTIFICATION: { color: '#f39c12', radius: 40, label: 'Notification' },
    AGENT: { color: '#9b59b6', radius: 40, label: 'Agent' }
  };

  // Fetch initial data
  useEffect(() => {
    fetchFlowData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);
  
  // Setup auto-refresh
  useEffect(() => {
    if (isAutoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchFlowData();
      }, refreshInterval * 1000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoRefresh, refreshInterval]);
  
  // Draw canvas when flow data changes
  useEffect(() => {
    if (canvasRef.current && flowData.length > 0 && activeView === 'flow') {
      drawCircularFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowData, activeView, selectedEntity]);
  
  // Fetch data flow information
  const fetchFlowData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch data flow information
      const data = await universalScheduleService.getDataFlowMetrics({
        timeRange: timeRange
      });
      
      setFlowData(data.entities || []);
      
      // Fetch update history
      const history = await universalScheduleService.getUpdateHistory({
        timeRange: timeRange
      });
      
      setUpdateHistory(history.updates || []);
      
      // Fetch conflicts
      const conflictData = await universalScheduleService.getDataConflicts({
        timeRange: timeRange
      });
      
      setConflicts(conflictData.conflicts || []);
      
      // Check for serious conflicts and show notification
      const seriousConflicts = conflictData.conflicts?.filter(c => c.severity === 'high') || [];
      if (seriousConflicts.length > 0) {
        notificationService.showNotification({
          type: 'error',
          title: 'Critical Data Conflicts Detected',
          message: `${seriousConflicts.length} critical conflicts found. Review immediately.`
        });
      }
    } catch (err) {
      console.error('Error fetching data flow information:', err);
      setError('Failed to load data flow information. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Data Flow Error',
        message: 'Failed to load data flow information. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Manual refresh handler
  const handleRefresh = () => {
    fetchFlowData();
  };
  
  // Handle time range change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };
  
  // Handle interval change
  const handleIntervalChange = (interval) => {
    setRefreshInterval(interval);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isAutoRefresh && interval > 0) {
      intervalRef.current = setInterval(() => {
        fetchFlowData();
      }, interval * 1000);
    }
  };
  
  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setIsAutoRefresh(!isAutoRefresh);
    
    if (!isAutoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchFlowData();
      }, refreshInterval * 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
  
  // Handle entity selection
  const handleEntityClick = (entity) => {
    setSelectedEntity(entity);
  };
  
  // Draw the circular flow visualization
  const drawCircularFlow = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw circular model (C=2πr)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, 2 * Math.PI);
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw formula text
    ctx.font = '14px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.textAlign = 'center';
    ctx.fillText('C=2πr Circular Data Model', centerX, centerY - 180);
    
    // Draw entities around the circle
    if (flowData.length > 0) {
      const entities = flowData.filter(entity => entity.type !== 'RELATION');
      const relations = flowData.filter(entity => entity.type === 'RELATION');
      
      const angleStep = (2 * Math.PI) / entities.length;
      
      // Draw entities
      entities.forEach((entity, index) => {
        const angle = index * angleStep;
        const entityX = centerX + Math.cos(angle) * 150;
        const entityY = centerY + Math.sin(angle) * 150;
        const entityType = ENTITY_TYPES[entity.type] || ENTITY_TYPES.CLIENT;
        
        // Draw entity circle
        ctx.beginPath();
        ctx.arc(entityX, entityY, entityType.radius / 2, 0, 2 * Math.PI);
        
        // Highlight selected entity
        if (selectedEntity && selectedEntity.id === entity.id) {
          ctx.fillStyle = '#34495e';
          ctx.strokeStyle = '#f1c40f';
          ctx.lineWidth = 3;
        } else {
          ctx.fillStyle = entityType.color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
        }
        
        ctx.fill();
        ctx.stroke();
        
        // Draw entity label
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(entity.name || entityType.label, entityX, entityY);
        
        // Draw update count if available
        if (entity.updateCount) {
          ctx.font = '10px Arial';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${entity.updateCount} updates`, entityX, entityY + 15);
        }
        
        // Store entity position for click detection
        entity.position = { x: entityX, y: entityY, radius: entityType.radius / 2 };
      });
      
      // Draw relations between entities
      relations.forEach(relation => {
        const sourceEntity = entities.find(e => e.id === relation.sourceId);
        const targetEntity = entities.find(e => e.id === relation.targetId);
        
        if (sourceEntity && targetEntity && sourceEntity.position && targetEntity.position) {
          ctx.beginPath();
          ctx.moveTo(sourceEntity.position.x, sourceEntity.position.y);
          ctx.lineTo(targetEntity.position.x, targetEntity.position.y);
          
          // Use gradient for flow direction
          const gradient = ctx.createLinearGradient(
            sourceEntity.position.x, sourceEntity.position.y,
            targetEntity.position.x, targetEntity.position.y
          );
          
          gradient.addColorStop(0, ENTITY_TYPES[sourceEntity.type]?.color || '#3498db');
          gradient.addColorStop(1, ENTITY_TYPES[targetEntity.type]?.color || '#2ecc71');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = relation.strength || 2;
          ctx.stroke();
          
          // Draw flow rate if available
          if (relation.flowRate) {
            const midX = (sourceEntity.position.x + targetEntity.position.x) / 2;
            const midY = (sourceEntity.position.y + targetEntity.position.y) / 2;
            
            ctx.font = '10px Arial';
            ctx.fillStyle = '#2c3e50';
            ctx.textAlign = 'center';
            ctx.fillText(`${relation.flowRate}/min`, midX, midY - 5);
          }
          
          // Draw conflict indicators
          if (relation.hasConflict) {
            const midX = (sourceEntity.position.x + targetEntity.position.x) / 2;
            const midY = (sourceEntity.position.y + targetEntity.position.y) / 2;
            
            ctx.beginPath();
            ctx.arc(midX, midY, 8, 0, 2 * Math.PI);
            ctx.fillStyle = '#e74c3c';
            ctx.fill();
            
            ctx.font = 'bold 10px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText('!', midX, midY + 3);
          }
        }
      });
    }
  };
  
  // Handle canvas click for entity selection
  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if click is on an entity
    for (const entity of flowData) {
      if (entity.position) {
        const dx = x - entity.position.x;
        const dy = y - entity.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= entity.position.radius) {
          handleEntityClick(entity);
          return;
        }
      }
    }
    
    // If click is not on an entity, clear selection
    setSelectedEntity(null);
  };
  
  // Resolve conflict handler
  const handleResolveConflict = async (conflict) => {
    try {
      setIsLoading(true);
      
      await universalScheduleService.resolveConflict(conflict.id);
      
      // Refresh data
      fetchFlowData();
      
      notificationService.showNotification({
        type: 'success',
        title: 'Conflict Resolved',
        message: 'Data conflict has been successfully resolved.'
      });
    } catch (err) {
      console.error('Error resolving conflict:', err);
      
      notificationService.showNotification({
        type: 'error',
        title: 'Resolution Failed',
        message: 'Failed to resolve data conflict. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Format conflict severity
  const formatSeverity = (severity) => {
    switch (severity) {
      case 'low':
        return <span className="severity low">Low</span>;
      case 'medium':
        return <span className="severity medium">Medium</span>;
      case 'high':
        return <span className="severity high">High</span>;
      default:
        return <span className="severity">Unknown</span>;
    }
  };

  return (
    <div className="circular-data-flow-monitor">
      <div className="monitor-header">
        <h3>Circular Data Flow Monitor</h3>
        
        <div className="monitor-controls">
          <div className="time-range-selector">
            <span>Time Range:</span>
            <select 
              value={timeRange} 
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              disabled={isLoading}
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <div className="refresh-controls">
            <span>Auto-refresh:</span>
            <select 
              value={refreshInterval} 
              onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
              disabled={isLoading || !isAutoRefresh}
            >
              <option value="0">Manual</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
            </select>
            
            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={isAutoRefresh}
                onChange={toggleAutoRefresh}
                disabled={isLoading}
              />
              Enable
            </label>
            
            <button 
              className="refresh-button"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh Now'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="view-tabs">
        <button 
          className={`tab-button ${activeView === 'flow' ? 'active' : ''}`}
          onClick={() => setActiveView('flow')}
        >
          Flow Visualization
        </button>
        <button 
          className={`tab-button ${activeView === 'history' ? 'active' : ''}`}
          onClick={() => setActiveView('history')}
        >
          Update History
          {updateHistory.length > 0 && (
            <span className="badge">{updateHistory.length}</span>
          )}
        </button>
        <button 
          className={`tab-button ${activeView === 'conflicts' ? 'active' : ''}`}
          onClick={() => setActiveView('conflicts')}
        >
          Conflicts
          {conflicts.length > 0 && (
            <span className="badge conflict">{conflicts.length}</span>
          )}
        </button>
      </div>
      
      <div className="monitor-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {activeView === 'flow' && (
          <div className="flow-visualization">
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={600}
              onClick={handleCanvasClick}
            ></canvas>
            
            {isLoading && (
              <div className="loading-overlay">
                <div className="loading-spinner"></div>
                <p>Loading data flow information...</p>
              </div>
            )}
            
            {selectedEntity && (
              <div className="entity-details">
                <h4>{selectedEntity.name || 'Entity Details'}</h4>
                
                <table>
                  <tbody>
                    <tr>
                      <td>Type:</td>
                      <td>{ENTITY_TYPES[selectedEntity.type]?.label || selectedEntity.type}</td>
                    </tr>
                    <tr>
                      <td>ID:</td>
                      <td>{selectedEntity.id}</td>
                    </tr>
                    <tr>
                      <td>Updates:</td>
                      <td>{selectedEntity.updateCount || 0}</td>
                    </tr>
                    <tr>
                      <td>Last Update:</td>
                      <td>{formatTimestamp(selectedEntity.lastUpdate)}</td>
                    </tr>
                    <tr>
                      <td>Status:</td>
                      <td className={selectedEntity.hasConflict ? 'conflict-status' : 'normal-status'}>
                        {selectedEntity.hasConflict ? 'Conflict Detected' : 'Normal'}
                      </td>
                    </tr>
                  </tbody>
                </table>
                
                <div className="entity-actions">
                  <button onClick={() => setSelectedEntity(null)}>Close</button>
                  <button 
                    onClick={() => {
                      // Find conflicts for this entity
                      const entityConflicts = conflicts.filter(
                        c => c.sourceEntityId === selectedEntity.id || c.targetEntityId === selectedEntity.id
                      );
                      
                      if (entityConflicts.length > 0) {
                        setActiveView('conflicts');
                      } else {
                        notificationService.showNotification({
                          type: 'info',
                          title: 'No Conflicts Found',
                          message: 'No conflicts detected for this entity.'
                        });
                      }
                    }}
                    disabled={!selectedEntity.hasConflict}
                  >
                    View Conflicts
                  </button>
                  <button 
                    onClick={() => {
                      // Find updates for this entity
                      const entityUpdates = updateHistory.filter(
                        u => u.entityId === selectedEntity.id
                      );
                      
                      if (entityUpdates.length > 0) {
                        setActiveView('history');
                      } else {
                        notificationService.showNotification({
                          type: 'info',
                          title: 'No Updates Found',
                          message: 'No update history found for this entity.'
                        });
                      }
                    }}
                  >
                    View Updates
                  </button>
                </div>
              </div>
            )}
            
            <div className="flow-legend">
              <h4>Legend</h4>
              <ul>
                {Object.entries(ENTITY_TYPES).map(([type, config]) => (
                  <li key={type}>
                    <span className="legend-color" style={{ backgroundColor: config.color }}></span>
                    <span>{config.label}</span>
                  </li>
                ))}
              </ul>
              <div className="flow-metrics">
                <h4>Flow Metrics</h4>
                <p>Total Entities: {flowData.filter(entity => entity.type !== 'RELATION').length}</p>
                <p>Total Relations: {flowData.filter(entity => entity.type === 'RELATION').length}</p>
                <p>Conflicts: {conflicts.length}</p>
                <p>Updates: {updateHistory.length}</p>
              </div>
            </div>
          </div>
        )}
        
        {activeView === 'history' && (
          <div className="update-history">
            <h4>Update History Timeline</h4>
            
            {isLoading ? (
              <div className="loading-indicator">Loading update history...</div>
            ) : updateHistory.length === 0 ? (
              <div className="empty-state">
                No updates found in the selected time range.
              </div>
            ) : (
              <div className="timeline">
                {updateHistory.map((update, index) => (
                  <div key={update.id || index} className="timeline-item">
                    <div className="timeline-time">
                      {formatTimestamp(update.timestamp)}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="entity-type">
                          {ENTITY_TYPES[update.entityType]?.label || update.entityType}
                        </span>
                        <span className="update-type">{update.updateType}</span>
                      </div>
                      <div className="timeline-body">
                        <p><strong>Entity:</strong> {update.entityName || update.entityId}</p>
                        <p><strong>User:</strong> {update.userId || 'System'}</p>
                        {update.description && (
                          <p><strong>Details:</strong> {update.description}</p>
                        )}
                      </div>
                      {update.changes && (
                        <div className="timeline-changes">
                          <table>
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Previous</th>
                                <th>New</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(update.changes).map(([field, values]) => (
                                <tr key={field}>
                                  <td>{field}</td>
                                  <td className="previous-value">{values.previous || '(empty)'}</td>
                                  <td className="new-value">{values.new || '(empty)'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeView === 'conflicts' && (
          <div className="conflict-detection">
            <h4>Data Conflicts</h4>
            
            {isLoading ? (
              <div className="loading-indicator">Loading conflicts...</div>
            ) : conflicts.length === 0 ? (
              <div className="empty-state success">
                No conflicts detected in the selected time range.
              </div>
            ) : (
              <div className="conflicts-list">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className={`conflict-card severity-${conflict.severity}`}>
                    <div className="conflict-header">
                      <h5>{conflict.title || 'Data Conflict'}</h5>
                      <div className="conflict-meta">
                        {formatSeverity(conflict.severity)}
                        <span className="conflict-time">
                          Detected: {formatTimestamp(conflict.detectedAt)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="conflict-entities">
                      <div className="entity source-entity">
                        <h6>Source Entity</h6>
                        <p><strong>Type:</strong> {ENTITY_TYPES[conflict.sourceEntityType]?.label || conflict.sourceEntityType}</p>
                        <p><strong>Name:</strong> {conflict.sourceEntityName || conflict.sourceEntityId}</p>
                      </div>
                      
                      <div className="entity-relation">
                        <div className="relation-line"></div>
                        <div className="conflict-icon">!</div>
                      </div>
                      
                      <div className="entity target-entity">
                        <h6>Target Entity</h6>
                        <p><strong>Type:</strong> {ENTITY_TYPES[conflict.targetEntityType]?.label || conflict.targetEntityType}</p>
                        <p><strong>Name:</strong> {conflict.targetEntityName || conflict.targetEntityId}</p>
                      </div>
                    </div>
                    
                    <div className="conflict-details">
                      <p><strong>Conflict Type:</strong> {conflict.type}</p>
                      <p><strong>Description:</strong> {conflict.description}</p>
                      
                      {conflict.resolutionOptions && (
                        <div className="resolution-options">
                          <h6>Resolution Options:</h6>
                          <div className="options-buttons">
                            {conflict.resolutionOptions.map((option, index) => (
                              <button 
                                key={index}
                                onClick={() => handleResolveConflict({
                                  ...conflict,
                                  resolutionOption: option.id
                                })}
                                disabled={isLoading}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {!conflict.resolutionOptions && (
                        <div className="conflict-actions">
                          <button 
                            onClick={() => handleResolveConflict(conflict)}
                            disabled={isLoading}
                          >
                            Resolve Conflict
                          </button>
                          <button 
                            onClick={() => {
                              // Find both entities in the flow data
                              const sourceEntity = flowData.find(e => e.id === conflict.sourceEntityId);
                              const targetEntity = flowData.find(e => e.id === conflict.targetEntityId);
                              
                              if (sourceEntity) {
                                setSelectedEntity(sourceEntity);
                                setActiveView('flow');
                              } else if (targetEntity) {
                                setSelectedEntity(targetEntity);
                                setActiveView('flow');
                              }
                            }}
                          >
                            View in Flow
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .circular-data-flow-monitor {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
          height: 700px;
          display: flex;
          flex-direction: column;
        }
        
        .monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .monitor-header h3 {
          margin: 0;
          color: #2c3e50;
        }
        
        .monitor-controls {
          display: flex;
          gap: 20px;
        }
        
        .time-range-selector,
        .refresh-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        select {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background-color: white;
        }
        
        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }
        
        .refresh-button {
          padding: 6px 12px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .refresh-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .refresh-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .view-tabs {
          display: flex;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 20px;
        }
        
        .tab-button {
          padding: 10px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 1rem;
          color: #6c757d;
          position: relative;
        }
        
        .tab-button.active {
          border-bottom-color: #3498db;
          color: #3498db;
          font-weight: 500;
        }
        
        .tab-button:hover:not(.active) {
          border-bottom-color: #e9ecef;
          background-color: #f8f9fa;
        }
        
        .badge {
          position: absolute;
          top: 5px;
          right: 5px;
          background: #3498db;
          color: white;
          border-radius: 10px;
          padding: 2px 6px;
          font-size: 0.7rem;
          font-weight: bold;
        }
        
        .badge.conflict {
          background: #e74c3c;
        }
        
        .monitor-content {
          flex: 1;
          position: relative;
          overflow: hidden;
        }
        
        .error-message {
          padding: 10px;
          background: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .flow-visualization {
          position: relative;
          display: flex;
        }
        
        canvas {
          border: 1px solid #e9ecef;
          border-radius: 4px;
          background: #f8f9fa;
        }
        
        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.8);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 10;
        }
        
        .loading-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .entity-details {
          position: absolute;
          top: 20px;
          right: 20px;
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 15px;
          width: 300px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          z-index: 5;
        }
        
        .entity-details h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .entity-details table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        
        .entity-details td {
          padding: 5px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .entity-details td:first-child {
          font-weight: 500;
          width: 40%;
        }
        
        .conflict-status {
          color: #e74c3c;
          font-weight: 500;
        }
        
        .normal-status {
          color: #2ecc71;
        }
        
        .entity-actions {
          display: flex;
          gap: 10px;
        }
        
        .entity-actions button {
          flex: 1;
          padding: 6px 12px;
          background: #f8f9fa;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .entity-actions button:hover {
          background: #e9ecef;
        }
        
        .flow-legend {
          padding: 15px;
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          margin-left: 20px;
          max-width: 220px;
        }
        
        .flow-legend h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .flow-legend ul {
          list-style: none;
          padding: 0;
          margin: 0 0 20px 0;
        }
        
        .flow-legend li {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .legend-color {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          margin-right: 10px;
        }
        
        .flow-metrics {
          border-top: 1px solid #e9ecef;
          padding-top: 15px;
        }
        
        .flow-metrics h4 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        
        .flow-metrics p {
          margin: 5px 0;
          font-size: 0.9rem;
        }
        
        .update-history {
          padding: 15px;
          height: 100%;
          overflow-y: auto;
        }
        
        .update-history h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
        }
        
        .timeline {
          position: relative;
          padding-left: 30px;
          border-left: 2px solid #e9ecef;
        }
        
        .timeline-item {
          position: relative;
          margin-bottom: 30px;
        }
        
        .timeline-item::before {
          content: '';
          position: absolute;
          left: -36px;
          top: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #3498db;
          border: 2px solid white;
        }
        
        .timeline-time {
          position: absolute;
          left: -150px;
          top: 0;
          width: 120px;
          text-align: right;
          color: #7f8c8d;
          font-size: 0.85rem;
        }
        
        .timeline-content {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 15px;
        }
        
        .timeline-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .entity-type {
          background: #3498db;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85rem;
        }
        
        .update-type {
          background: #f8f9fa;
          padding: 2px 8px;
          border-radius: 4px;
          color: #7f8c8d;
          font-size: 0.85rem;
        }
        
        .timeline-body p {
          margin: 5px 0;
        }
        
        .timeline-changes {
          margin-top: 15px;
          border-top: 1px solid #e9ecef;
          padding-top: 15px;
        }
        
        .timeline-changes table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        
        .timeline-changes th {
          background: #f8f9fa;
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #e9ecef;
        }
        
        .timeline-changes td {
          padding: 8px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .previous-value {
          color: #e74c3c;
          text-decoration: line-through;
        }
        
        .new-value {
          color: #2ecc71;
        }
        
        .conflict-detection {
          padding: 15px;
          height: 100%;
          overflow-y: auto;
        }
        
        .conflict-detection h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
        }
        
        .empty-state {
          padding: 30px;
          text-align: center;
          background: #f8f9fa;
          border-radius: 4px;
          color: #7f8c8d;
          font-style: italic;
        }
        
        .empty-state.success {
          background: #d4edda;
          color: #155724;
        }
        
        .loading-indicator {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100px;
          color: #7f8c8d;
        }
        
        .conflicts-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .conflict-card {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 15px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }
        
        .conflict-card.severity-high {
          border-left: 5px solid #e74c3c;
        }
        
        .conflict-card.severity-medium {
          border-left: 5px solid #f39c12;
        }
        
        .conflict-card.severity-low {
          border-left: 5px solid #3498db;
        }
        
        .conflict-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .conflict-header h5 {
          margin: 0;
          color: #2c3e50;
        }
        
        .conflict-meta {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .severity {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .severity.high {
          background: #e74c3c;
          color: white;
        }
        
        .severity.medium {
          background: #f39c12;
          color: white;
        }
        
        .severity.low {
          background: #3498db;
          color: white;
        }
        
        .conflict-time {
          color: #7f8c8d;
          font-size: 0.85rem;
        }
        
        .conflict-entities {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .entity {
          flex: 1;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 10px;
        }
        
        .entity h6 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .entity p {
          margin: 5px 0;
          font-size: 0.9rem;
        }
        
        .entity-relation {
          width: 100px;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .relation-line {
          height: 2px;
          width: 100%;
          background: #e74c3c;
        }
        
        .conflict-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 20px;
          height: 20px;
          background: #e74c3c;
          color: white;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: bold;
          font-size: 0.85rem;
        }
        
        .conflict-details {
          background: #f8f9fa;
          border-radius: 4px;
          padding: 15px;
        }
        
        .conflict-details p {
          margin: 5px 0;
        }
        
        .resolution-options {
          margin-top: 15px;
        }
        
        .resolution-options h6 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .options-buttons,
        .conflict-actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        
        .options-buttons button,
        .conflict-actions button {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .options-buttons button {
          background: #f8f9fa;
          border: 1px solid #ced4da;
          color: #2c3e50;
        }
        
        .options-buttons button:hover {
          background: #e9ecef;
        }
        
        .conflict-actions button:first-child {
          background: #2ecc71;
          color: white;
        }
        
        .conflict-actions button:first-child:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .conflict-actions button:last-child {
          background: #f8f9fa;
          border: 1px solid #ced4da;
          color: #2c3e50;
        }
        
        .conflict-actions button:last-child:hover {
          background: #e9ecef;
        }
        
        .conflict-actions button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default CircularDataFlowMonitor;

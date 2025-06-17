import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '../services';

/**
 * Live Update Stream Component
 * Provides real-time updates and notifications about system changes
 */
const LiveUpdateStream = ({ onUpdate }) => {
  // State for stream data
  const [updates, setUpdates] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [streamPaused, setStreamPaused] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'schedule', 'client', 'caregiver', 'system'
  const [filterPriority, setFilterPriority] = useState('all'); // 'all', 'high', 'medium', 'low'
  const [filterRead, setFilterRead] = useState('all'); // 'all', 'read', 'unread'
  const [visibleCount, setVisibleCount] = useState(10);
  
  // Refs for event source and autoscroll
  const eventSourceRef = useRef(null);
  const updatesEndRef = useRef(null);
  
  // Connection config
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
  
  // Set up event source connection
  const connectEventSource = useCallback(() => {
    try {
      // Clean up existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Connect to SSE endpoint
      eventSourceRef.current = new EventSource('/api/updates/stream');
      
      // Handle connection open
      eventSourceRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionAttempts(0);
        console.log('Live update stream connected');
      };
      
      // Handle updates
      eventSourceRef.current.addEventListener('update', (event) => {
        const updateData = JSON.parse(event.data);
        setUpdates(prevUpdates => {
          const newUpdates = [...prevUpdates, {
            ...updateData,
            id: updateData.id || `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: updateData.timestamp || new Date().toISOString(),
            read: false
          }];
          
          // Keep only the latest 100 updates to prevent memory issues
          return newUpdates.slice(-100);
        });
        
        // Notify parent component
        if (onUpdate) {
          onUpdate(updateData);
        }
        
        // Show notification for high priority updates
        if (updateData.priority === 'high' && !streamPaused) {
          notificationService.showNotification({
            type: 'info',
            title: updateData.title || 'New Update',
            message: updateData.message || 'A new high priority update is available'
          });
        }
      });
      
      // Handle connection error
      eventSourceRef.current.onerror = (error) => {
        console.error('Live update stream error:', error);
        
        // Close the event source
        eventSourceRef.current.close();
        setIsConnected(false);
        
        // Attempt to reconnect with backoff
        if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
          setTimeout(() => {
            setConnectionAttempts(prev => prev + 1);
          }, RECONNECT_DELAY * (connectionAttempts + 1));
        } else {
          notificationService.showNotification({
            type: 'error',
            title: 'Connection Failed',
            message: 'Failed to connect to update stream after multiple attempts.'
          });
        }
      };
    } catch (error) {
      console.error('Error setting up event source:', error);
      setIsConnected(false);
    }
  }, [onUpdate, streamPaused, connectionAttempts]);

  // Connect to SSE stream on component mount
  useEffect(() => {
    if (!streamPaused) {
      connectEventSource();
    }
    
    return () => {
      // Clean up event source on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [streamPaused, connectionAttempts, connectEventSource]);
  
  // Auto-scroll to latest update
  useEffect(() => {
    if (updatesEndRef.current && !streamPaused) {
      updatesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [updates, streamPaused]);
  
  // Toggle stream pause state
  const toggleStreamPause = () => {
    if (streamPaused) {
      setStreamPaused(false);
      // Will reconnect due to useEffect dependency
    } else {
      setStreamPaused(true);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
    }
  };
  
  // Manual reconnect function
  const handleReconnect = () => {
    setConnectionAttempts(0);
    setStreamPaused(false);
  };
  
  // Mark all updates as read
  const markAllAsRead = () => {
    setUpdates(prevUpdates => 
      prevUpdates.map(update => ({ ...update, read: true }))
    );
  };
  
  // Mark a single update as read
  const markAsRead = (updateId) => {
    setUpdates(prevUpdates => 
      prevUpdates.map(update => 
        update.id === updateId ? { ...update, read: true } : update
      )
    );
  };
  
  // Clear all updates
  const clearAllUpdates = () => {
    setUpdates([]);
  };
  
  // Handle filter changes
  const handleFilterTypeChange = (e) => {
    setFilterType(e.target.value);
  };
  
  const handleFilterPriorityChange = (e) => {
    setFilterPriority(e.target.value);
  };
  
  const handleFilterReadChange = (e) => {
    setFilterRead(e.target.value);
  };
  
  // Load more updates
  const loadMoreUpdates = () => {
    setVisibleCount(prev => prev + 10);
  };
  
  // Apply filters to updates
  const filteredUpdates = updates.filter(update => {
    // Filter by type
    if (filterType !== 'all' && update.type !== filterType) {
      return false;
    }
    
    // Filter by priority
    if (filterPriority !== 'all' && update.priority !== filterPriority) {
      return false;
    }
    
    // Filter by read status
    if (filterRead === 'read' && !update.read) {
      return false;
    }
    if (filterRead === 'unread' && update.read) {
      return false;
    }
    
    return true;
  });
  
  // Get visible updates based on count limit
  const visibleUpdates = filteredUpdates.slice(-visibleCount);
  
  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Get update priority class
  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return 'high-priority';
      case 'medium': return 'medium-priority';
      case 'low': return 'low-priority';
      default: return '';
    }
  };
  
  // Get update type icon
  const getTypeIcon = (type) => {
    switch (type) {
      case 'schedule': return '📅';
      case 'client': return '👤';
      case 'caregiver': return '🧑‍⚕️';
      case 'system': return '⚙️';
      default: return '📋';
    }
  };
  
  return (
    <div className="live-update-stream">
      <div className="stream-header">
        <h3>Live Updates</h3>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {!isConnected && !streamPaused && connectionAttempts > 0 && (
            <span className="reconnecting">
              Reconnecting... ({connectionAttempts}/{MAX_RECONNECT_ATTEMPTS})
            </span>
          )}
          {!isConnected && (connectionAttempts >= MAX_RECONNECT_ATTEMPTS || streamPaused) && (
            <button 
              className="reconnect-button"
              onClick={handleReconnect}
            >
              Reconnect
            </button>
          )}
          <button 
            className={`pause-button ${streamPaused ? 'resume' : 'pause'}`}
            onClick={toggleStreamPause}
          >
            {streamPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
      
      <div className="stream-filters">
        <div className="filter-group">
          <label htmlFor="filter-type">Type:</label>
          <select 
            id="filter-type" 
            value={filterType} 
            onChange={handleFilterTypeChange}
          >
            <option value="all">All</option>
            <option value="schedule">Schedule</option>
            <option value="client">Client</option>
            <option value="caregiver">Caregiver</option>
            <option value="system">System</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="filter-priority">Priority:</label>
          <select 
            id="filter-priority" 
            value={filterPriority} 
            onChange={handleFilterPriorityChange}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="filter-read">Status:</label>
          <select 
            id="filter-read" 
            value={filterRead} 
            onChange={handleFilterReadChange}
          >
            <option value="all">All</option>
            <option value="read">Read</option>
            <option value="unread">Unread</option>
          </select>
        </div>
        
        <div className="filter-actions">
          <button 
            className="mark-read-button"
            onClick={markAllAsRead}
            disabled={!updates.some(update => !update.read)}
          >
            Mark All Read
          </button>
          <button 
            className="clear-button"
            onClick={clearAllUpdates}
            disabled={updates.length === 0}
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div className="updates-container">
        {visibleUpdates.length === 0 ? (
          <div className="no-updates">
            <p>No updates available</p>
            {filterType !== 'all' || filterPriority !== 'all' || filterRead !== 'all' ? (
              <p className="filter-hint">Try changing your filters</p>
            ) : (
              <p className="waiting-hint">Waiting for updates...</p>
            )}
          </div>
        ) : (
          <>
            {visibleUpdates.map((update, index) => (
              <div 
                key={update.id} 
                className={`update-item ${update.read ? 'read' : 'unread'} ${getPriorityClass(update.priority)}`}
                onClick={() => markAsRead(update.id)}
              >
                <div className="update-header">
                  <span className="update-type">
                    {getTypeIcon(update.type)} {update.type}
                  </span>
                  <span className="update-timestamp">
                    {formatTimestamp(update.timestamp)}
                  </span>
                  {!update.read && <span className="unread-indicator">New</span>}
                </div>
                <div className="update-content">
                  <h4>{update.title}</h4>
                  <p>{update.message}</p>
                  {update.details && (
                    <div className="update-details">
                      <pre>{JSON.stringify(update.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
                {update.actions && update.actions.length > 0 && (
                  <div className="update-actions">
                    {update.actions.map((action, actionIndex) => (
                      <button 
                        key={actionIndex}
                        className="action-button"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent marking as read
                          if (action.handler) {
                            action.handler(update);
                          } else {
                            console.warn('No handler defined for action:', action.label);
                          }
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {/* Reference for auto-scroll */}
            <div ref={updatesEndRef} />
            
            {/* Load more button */}
            {filteredUpdates.length > visibleCount && (
              <div className="load-more">
                <button 
                  className="load-more-button"
                  onClick={loadMoreUpdates}
                >
                  Load More
                </button>
                <span className="count-indicator">
                  Showing {visibleCount} of {filteredUpdates.length}
                </span>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="update-timeline">
        <h4>Update History Timeline</h4>
        <div className="timeline-container">
          {updates.length === 0 ? (
            <p className="no-data">No update history available</p>
          ) : (
            <div className="timeline">
              {updates.map((update, index) => (
                <div 
                  key={update.id}
                  className={`timeline-point ${getPriorityClass(update.priority)}`}
                  style={{ left: `${(index / (updates.length - 1)) * 100}%` }}
                  title={`${update.title} - ${formatTimestamp(update.timestamp)}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="update-indicators">
        <div className="indicator-stats">
          <div className="stat-item">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{updates.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Unread:</span>
            <span className="stat-value">{updates.filter(u => !u.read).length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">High Priority:</span>
            <span className="stat-value">{updates.filter(u => u.priority === 'high').length}</span>
          </div>
        </div>
        
        <div className="real-time-indicator">
          <div className={`pulse ${isConnected ? 'active' : 'inactive'}`}></div>
          <span>Real-time {isConnected ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      
      <style jsx>{`
        .live-update-stream {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .stream-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .stream-header h3 {
          margin: 0;
          color: #343a40;
        }
        
        .connection-status {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .status-indicator {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .status-indicator.connected {
          background-color: #d4edda;
          color: #155724;
        }
        
        .status-indicator.disconnected {
          background-color: #f8d7da;
          color: #721c24;
        }
        
        .reconnecting {
          font-size: 14px;
          color: #856404;
        }
        
        .reconnect-button, .pause-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .reconnect-button {
          background-color: #3498db;
          color: white;
        }
        
        .reconnect-button:hover {
          background-color: #2980b9;
        }
        
        .pause-button {
          background-color: #6c757d;
          color: white;
        }
        
        .pause-button:hover {
          background-color: #5a6268;
        }
        
        .pause-button.resume {
          background-color: #28a745;
        }
        
        .pause-button.resume:hover {
          background-color: #218838;
        }
        
        .stream-filters {
          display: flex;
          flex-wrap: wrap;
          padding: 10px 15px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          gap: 15px;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .filter-group label {
          font-weight: 500;
          color: #495057;
        }
        
        .filter-group select {
          padding: 6px 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          background-color: white;
        }
        
        .filter-actions {
          margin-left: auto;
          display: flex;
          gap: 10px;
        }
        
        .mark-read-button, .clear-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }
        
        .mark-read-button {
          background-color: #6c757d;
          color: white;
        }
        
        .mark-read-button:hover:not(:disabled) {
          background-color: #5a6268;
        }
        
        .clear-button {
          background-color: #dc3545;
          color: white;
        }
        
        .clear-button:hover:not(:disabled) {
          background-color: #c82333;
        }
        
        .mark-read-button:disabled, .clear-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .updates-container {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
        }
        
        .no-updates {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #6c757d;
        }
        
        .no-updates p {
          margin: 5px 0;
        }
        
        .filter-hint {
          font-style: italic;
          font-size: 14px;
        }
        
        .waiting-hint {
          font-style: italic;
          font-size: 14px;
        }
        
        .update-item {
          margin-bottom: 15px;
          padding: 15px;
          background-color: white;
          border-radius: 6px;
          border-left: 4px solid #6c757d;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .update-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .update-item.unread {
          background-color: #f8f9fa;
        }
        
        .update-item.high-priority {
          border-left-color: #dc3545;
        }
        
        .update-item.medium-priority {
          border-left-color: #ffc107;
        }
        
        .update-item.low-priority {
          border-left-color: #28a745;
        }
        
        .update-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          font-size: 14px;
        }
        
        .update-type {
          font-weight: 500;
          color: #495057;
        }
        
        .update-timestamp {
          color: #6c757d;
        }
        
        .unread-indicator {
          background-color: #dc3545;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .update-content h4 {
          margin: 0 0 10px 0;
          color: #343a40;
        }
        
        .update-content p {
          margin: 0 0 10px 0;
          color: #495057;
        }
        
        .update-details {
          background-color: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
          overflow-x: auto;
        }
        
        .update-details pre {
          margin: 0;
          font-size: 12px;
          white-space: pre-wrap;
        }
        
        .update-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
          gap: 10px;
        }
        
        .action-button {
          padding: 6px 12px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }
        
        .action-button:hover {
          background-color: #2980b9;
        }
        
        .load-more {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 15px;
          margin-bottom: 15px;
        }
        
        .load-more-button {
          padding: 8px 16px;
          background-color: #f8f9fa;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .load-more-button:hover {
          background-color: #e9ecef;
        }
        
        .count-indicator {
          margin-top: 5px;
          font-size: 14px;
          color: #6c757d;
        }
        
        .update-timeline {
          padding: 15px;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
        }
        
        .update-timeline h4 {
          margin: 0 0 10px 0;
          color: #343a40;
        }
        
        .timeline-container {
          height: 30px;
          position: relative;
        }
        
        .no-data {
          text-align: center;
          color: #6c757d;
          font-style: italic;
        }
        
        .timeline {
          height: 4px;
          background-color: #e9ecef;
          position: relative;
          margin-top: 13px;
        }
        
        .timeline-point {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #6c757d;
          top: -3px;
          transform: translateX(-50%);
          cursor: pointer;
        }
        
        .timeline-point.high-priority {
          background-color: #dc3545;
        }
        
        .timeline-point.medium-priority {
          background-color: #ffc107;
        }
        
        .timeline-point.low-priority {
          background-color: #28a745;
        }
        
        .update-indicators {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
        }
        
        .indicator-stats {
          display: flex;
          gap: 15px;
        }
        
        .stat-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .stat-label {
          font-size: 14px;
          color: #495057;
        }
        
        .stat-value {
          font-size: 14px;
          font-weight: 500;
          color: #343a40;
        }
        
        .real-time-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #495057;
        }
        
        .pulse {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          position: relative;
        }
        
        .pulse.active {
          background-color: #28a745;
        }
        
        .pulse.active:before {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: rgba(40, 167, 69, 0.4);
          animation: pulse 2s infinite;
        }
        
        .pulse.inactive {
          background-color: #dc3545;
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          70% {
            transform: scale(2);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LiveUpdateStream;

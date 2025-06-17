import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '../services';

/**
 * Collaboration Tools Component
 * Provides multi-user editing indicators, change conflict resolution, and edit history tracking
 */
const CollaborationTools = ({ entityType, entityId, onConflictResolved }) => {
  // State for active users and edits
  const [activeUsers, setActiveUsers] = useState([]);
  const [editHistory, setEditHistory] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'history', 'conflicts'
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // WebSocket reference for real-time collaboration
  const wsRef = useRef(null);
  
  // Mock user data (would come from auth service in a real implementation)
  const currentUser = {
    id: 'current-user-123',
    name: 'Current User',
    color: '#3498db',
    avatar: 'https://via.placeholder.com/32'
  };
  
  // Set up WebSocket connection to collaboration server
  const connectCollaborationServer = useCallback(() => {
    try {
      // Clean up existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Connect to WebSocket server (mock for now)
      wsRef.current = new WebSocket(`ws://localhost:8080/collaboration/${entityType}/${entityId}`);
      
      // Handle connection open
      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('Collaboration connection established');
        
        // Send join message
        sendMessage({
          type: 'join',
          user: currentUser,
          timestamp: new Date().toISOString()
        });
      };
      
      // Handle incoming messages
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        processMessage(message);
      };
      
      // Handle connection close
      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('Collaboration connection closed');
      };
      
      // Handle connection error
      wsRef.current.onerror = (error) => {
        setIsConnected(false);
        setErrorMessage('Connection error. Please try again.');
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setIsConnected(false);
      setErrorMessage('Failed to connect to collaboration server.');
    }
  }, [entityType, entityId, currentUser]);

  // Connect to collaboration server on component mount
  useEffect(() => {
    connectCollaborationServer();
    
    return () => {
      // Clean up websocket on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectCollaborationServer]);
  
  // Process incoming messages
  const processMessage = (message) => {
    switch (message.type) {
      case 'users_update':
        setActiveUsers(message.users);
        break;
      case 'edit':
        addToEditHistory(message);
        break;
      case 'conflict':
        addConflict(message);
        break;
      case 'conflict_resolved':
        removeConflict(message.conflictId);
        break;
      case 'history_sync':
        setEditHistory(message.history);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };
  
  // Send message to collaboration server
  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, unable to send message');
      setErrorMessage('Connection lost. Attempting to reconnect...');
      setTimeout(connectCollaborationServer, 1000);
    }
  };
  
  // Add edit to history
  const addToEditHistory = (edit) => {
    setEditHistory(prevHistory => {
      const newHistory = [...prevHistory, edit];
      // Sort by timestamp, newest first
      return newHistory.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    });
  };
  
  // Add conflict
  const addConflict = (conflict) => {
    setConflicts(prevConflicts => {
      // Check if conflict already exists
      if (prevConflicts.some(c => c.id === conflict.id)) {
        return prevConflicts;
      }
      
      // Add conflict and notify
      notificationService.showNotification({
        type: 'warning',
        title: 'Edit Conflict Detected',
        message: `A conflict was detected with ${conflict.otherUser.name}'s edit.`
      });
      
      return [...prevConflicts, conflict];
    });
  };
  
  // Remove conflict
  const removeConflict = (conflictId) => {
    setConflicts(prevConflicts => 
      prevConflicts.filter(conflict => conflict.id !== conflictId)
    );
    
    // Reset selected conflict if it was removed
    if (selectedConflict && selectedConflict.id === conflictId) {
      setSelectedConflict(null);
    }
  };
  
  // Resolve conflict
  const resolveConflict = (conflictId, resolution) => {
    sendMessage({
      type: 'resolve_conflict',
      conflictId,
      resolution,
      user: currentUser,
      timestamp: new Date().toISOString()
    });
    
    // Notify parent component
    if (onConflictResolved) {
      onConflictResolved(conflictId, resolution);
    }
    
    // Show notification
    notificationService.showNotification({
      type: 'success',
      title: 'Conflict Resolved',
      message: 'The edit conflict has been successfully resolved.'
    });
    
    // Remove conflict from list
    removeConflict(conflictId);
  };
  
  // Handle revert edit
  const revertEdit = (editId) => {
    if (window.confirm('Are you sure you want to revert this change?')) {
      sendMessage({
        type: 'revert',
        editId,
        user: currentUser,
        timestamp: new Date().toISOString()
      });
      
      // Show notification
      notificationService.showNotification({
        type: 'info',
        title: 'Edit Reverted',
        message: 'The change has been reverted successfully.'
      });
    }
  };
  
  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Get short time ago string
  const getTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return `${interval} years ago`;
    if (interval === 1) return '1 year ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return `${interval} months ago`;
    if (interval === 1) return '1 month ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return `${interval} days ago`;
    if (interval === 1) return '1 day ago';
    
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return `${interval} hours ago`;
    if (interval === 1) return '1 hour ago';
    
    interval = Math.floor(seconds / 60);
    if (interval > 1) return `${interval} minutes ago`;
    if (interval === 1) return '1 minute ago';
    
    if (seconds < 10) return 'just now';
    
    return `${Math.floor(seconds)} seconds ago`;
  };
  
  // Get edit type label
  const getEditTypeLabel = (editType) => {
    switch (editType) {
      case 'add': return 'Added';
      case 'update': return 'Updated';
      case 'delete': return 'Deleted';
      case 'revert': return 'Reverted';
      default: return 'Modified';
    }
  };
  
  // Get field label
  const getFieldLabel = (field) => {
    // Convert camelCase to Title Case with spaces
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };
  
  // Mock functions for testing (would be replaced with real API calls)
  // Initialize with mock data for demo purposes
  useEffect(() => {
    const mockUsers = [
      { id: 'user-1', name: 'Jane Smith', color: '#e74c3c', avatar: 'https://via.placeholder.com/32/e74c3c', active: true, lastActivity: new Date().toISOString() },
      { id: 'user-2', name: 'John Doe', color: '#2ecc71', avatar: 'https://via.placeholder.com/32/2ecc71', active: true, lastActivity: new Date().toISOString() },
      { id: 'user-3', name: 'Bob Johnson', color: '#f39c12', avatar: 'https://via.placeholder.com/32/f39c12', active: false, lastActivity: new Date(Date.now() - 300000).toISOString() }
    ];
    
    const mockHistory = [
      { id: 'edit-1', user: { id: 'user-1', name: 'Jane Smith', color: '#e74c3c', avatar: 'https://via.placeholder.com/32/e74c3c' }, timestamp: new Date(Date.now() - 60000).toISOString(), type: 'update', field: 'clientName', oldValue: 'John Client', newValue: 'John A. Client', entityType: 'client', entityId: 'client-123' },
      { id: 'edit-2', user: { id: 'user-2', name: 'John Doe', color: '#2ecc71', avatar: 'https://via.placeholder.com/32/2ecc71' }, timestamp: new Date(Date.now() - 120000).toISOString(), type: 'update', field: 'phoneNumber', oldValue: '555-1234', newValue: '555-5678', entityType: 'client', entityId: 'client-123' },
      { id: 'edit-3', user: currentUser, timestamp: new Date(Date.now() - 180000).toISOString(), type: 'add', field: 'emailAddress', oldValue: '', newValue: 'john@example.com', entityType: 'client', entityId: 'client-123' }
    ];
    
    const mockConflicts = [
      { 
        id: 'conflict-1', 
        timestamp: new Date(Date.now() - 30000).toISOString(),
        field: 'appointmentTime',
        entityType: 'schedule',
        entityId: 'schedule-456',
        yourEdit: { value: '2:00 PM', timestamp: new Date(Date.now() - 31000).toISOString() },
        otherEdit: { value: '3:00 PM', timestamp: new Date(Date.now() - 32000).toISOString() },
        otherUser: { id: 'user-1', name: 'Jane Smith', color: '#e74c3c', avatar: 'https://via.placeholder.com/32/e74c3c' }
      }
    ];
    setActiveUsers(mockUsers);
    setEditHistory(mockHistory);
    setConflicts(mockConflicts);
  }, []);
  
  return (
    <div className="collaboration-tools">
      <div className="collaboration-header">
        <h3>Collaboration Tools</h3>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {!isConnected && (
            <button 
              className="reconnect-button"
              onClick={connectCollaborationServer}
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
      
      <div className="collaboration-tabs">
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Active Users ({activeUsers.filter(u => u.active).length})
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Edit History ({editHistory.length})
        </button>
        <button
          className={activeTab === 'conflicts' ? 'active' : ''}
          onClick={() => setActiveTab('conflicts')}
          data-count={conflicts.length}
        >
          Conflicts {conflicts.length > 0 && `(${conflicts.length})`}
        </button>
      </div>
      
      {/* Active Users Tab */}
      {activeTab === 'users' && (
        <div className="users-tab">
          <div className="users-list">
            {activeUsers.length === 0 ? (
              <div className="empty-state">
                <p>No active users</p>
              </div>
            ) : (
              activeUsers.map(user => (
                <div 
                  key={user.id} 
                  className={`user-item ${user.active ? 'active' : 'inactive'}`}
                >
                  <div 
                    className="user-avatar" 
                    style={{ backgroundColor: user.color }}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} />
                    ) : (
                      user.name.charAt(0)
                    )}
                  </div>
                  <div className="user-info">
                    <div className="user-name">
                      {user.name}
                      {user.id === currentUser.id && ' (You)'}
                    </div>
                    <div className="user-status">
                      {user.active ? (
                        <span className="status-active">Currently editing</span>
                      ) : (
                        <span className="status-inactive">Last active {getTimeAgo(user.lastActivity)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Edit History Tab */}
      {activeTab === 'history' && (
        <div className="history-tab">
          <div className="history-controls">
            <button 
              className="refresh-button"
              onClick={() => {
                setIsLoading(true);
                // In a real implementation, this would fetch the latest history
                setTimeout(() => {
                  setIsLoading(false);
                }, 500);
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing...' : 'Refresh History'}
            </button>
          </div>
          <div className="history-list">
            {editHistory.length === 0 ? (
              <div className="empty-state">
                <p>No edit history available</p>
              </div>
            ) : (
              editHistory.map(edit => (
                <div 
                  key={edit.id} 
                  className="history-item"
                >
                  <div className="edit-header">
                    <div 
                      className="user-avatar small" 
                      style={{ backgroundColor: edit.user.color }}
                    >
                      {edit.user.avatar ? (
                        <img src={edit.user.avatar} alt={edit.user.name} />
                      ) : (
                        edit.user.name.charAt(0)
                      )}
                    </div>
                    <div className="edit-info">
                      <span className="edit-user">
                        {edit.user.name}
                        {edit.user.id === currentUser.id && ' (You)'}
                      </span>
                      <span className="edit-type">{getEditTypeLabel(edit.type)}</span>
                      <span className="edit-field">{getFieldLabel(edit.field)}</span>
                    </div>
                    <div className="edit-time" title={formatTimestamp(edit.timestamp)}>
                      {getTimeAgo(edit.timestamp)}
                    </div>
                  </div>
                  <div className="edit-content">
                    {edit.type === 'delete' ? (
                      <div className="edit-deleted">
                        Deleted "{edit.oldValue}"
                      </div>
                    ) : edit.type === 'add' ? (
                      <div className="edit-added">
                        Added "{edit.newValue}"
                      </div>
                    ) : (
                      <div className="edit-changed">
                        <div className="edit-old">
                          <span className="label">From:</span> {edit.oldValue}
                        </div>
                        <div className="edit-new">
                          <span className="label">To:</span> {edit.newValue}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="edit-actions">
                    {edit.user.id !== currentUser.id && (
                      <button 
                        className="revert-button"
                        onClick={() => revertEdit(edit.id)}
                      >
                        Revert
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Conflicts Tab */}
      {activeTab === 'conflicts' && (
        <div className="conflicts-tab">
          {conflicts.length === 0 ? (
            <div className="empty-state">
              <p>No conflicts detected</p>
            </div>
          ) : (
            <div className="conflicts-container">
              <div className="conflicts-list">
                {conflicts.map(conflict => (
                  <div 
                    key={conflict.id} 
                    className={`conflict-item ${selectedConflict && selectedConflict.id === conflict.id ? 'selected' : ''}`}
                    onClick={() => setSelectedConflict(conflict)}
                  >
                    <div className="conflict-header">
                      <div className="conflict-field">{getFieldLabel(conflict.field)}</div>
                      <div className="conflict-time" title={formatTimestamp(conflict.timestamp)}>
                        {getTimeAgo(conflict.timestamp)}
                      </div>
                    </div>
                    <div className="conflict-users">
                      <div className="your-edit">
                        <span className="label">Your edit:</span> {conflict.yourEdit.value}
                      </div>
                      <div className="other-edit">
                        <div 
                          className="user-avatar small" 
                          style={{ backgroundColor: conflict.otherUser.color }}
                        >
                          {conflict.otherUser.avatar ? (
                            <img src={conflict.otherUser.avatar} alt={conflict.otherUser.name} />
                          ) : (
                            conflict.otherUser.name.charAt(0)
                          )}
                        </div>
                        <span className="other-user">{conflict.otherUser.name}:</span> {conflict.otherEdit.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedConflict && (
                <div className="conflict-resolver">
                  <h4>Resolve Conflict</h4>
                  <div className="conflict-details">
                    <div className="conflict-field-details">
                      <span className="label">Field:</span> {getFieldLabel(selectedConflict.field)}
                    </div>
                    <div className="conflict-time-details">
                      <span className="label">Detected:</span> {formatTimestamp(selectedConflict.timestamp)}
                    </div>
                  </div>
                  
                  <div className="resolution-options">
                    <div className="resolution-option your-option">
                      <h5>Your Change</h5>
                      <div className="option-value">{selectedConflict.yourEdit.value}</div>
                      <div className="option-time">
                        Edited {getTimeAgo(selectedConflict.yourEdit.timestamp)}
                      </div>
                      <button 
                        className="option-button"
                        onClick={() => resolveConflict(selectedConflict.id, 'yours')}
                      >
                        Use Your Version
                      </button>
                    </div>
                    
                    <div className="resolution-option other-option">
                      <h5>{selectedConflict.otherUser.name}'s Change</h5>
                      <div className="option-value">{selectedConflict.otherEdit.value}</div>
                      <div className="option-time">
                        Edited {getTimeAgo(selectedConflict.otherEdit.timestamp)}
                      </div>
                      <button 
                        className="option-button"
                        onClick={() => resolveConflict(selectedConflict.id, 'theirs')}
                      >
                        Use Their Version
                      </button>
                    </div>
                  </div>
                  
                  <div className="manual-resolution">
                    <h5>Custom Resolution</h5>
                    <textarea 
                      className="custom-value"
                      defaultValue={selectedConflict.yourEdit.value}
                      placeholder="Enter a custom value to resolve the conflict"
                    ></textarea>
                    <button 
                      className="option-button"
                      onClick={() => {
                        const customValue = document.querySelector('.custom-value').value;
                        resolveConflict(selectedConflict.id, 'custom', customValue);
                      }}
                    >
                      Use Custom Version
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <style jsx>{`
        .collaboration-tools {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .collaboration-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .collaboration-header h3 {
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
        
        .reconnect-button {
          padding: 4px 8px;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .reconnect-button:hover {
          background-color: #2980b9;
        }
        
        .error-message {
          padding: 10px 15px;
          background-color: #f8d7da;
          color: #721c24;
          margin: 0;
        }
        
        .collaboration-tabs {
          display: flex;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .collaboration-tabs button {
          padding: 12px 20px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 15px;
          color: #495057;
          position: relative;
        }
        
        .collaboration-tabs button.active {
          color: #3498db;
          font-weight: 500;
          box-shadow: inset 0 -3px 0 #3498db;
        }
        
        .collaboration-tabs button[data-count]:not([data-count="0"]):after {
          content: attr(data-count);
          position: absolute;
          top: 5px;
          right: 5px;
          background: #e74c3c;
          color: white;
          border-radius: 50%;
          padding: 0.2em 0.55em;
          font-size: 11px;
          font-weight: bold;
        }
        
        /* Active Users Tab */
        .users-tab {
          padding: 20px;
          flex: 1;
          overflow: auto;
        }
        
        .users-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .user-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 6px;
          background: #f8f9fa;
        }
        
        .user-item.active {
          background: #e8f4fd;
        }
        
        .user-item.inactive {
          opacity: 0.7;
        }
        
        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 16px;
          flex-shrink: 0;
          overflow: hidden;
        }
        
        .user-avatar.small {
          width: 24px;
          height: 24px;
          font-size: 12px;
        }
        
        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .user-info {
          display: flex;
          flex-direction: column;
        }
        
        .user-name {
          font-weight: 500;
          color: #343a40;
        }
        
        .user-status {
          font-size: 12px;
          color: #6c757d;
        }
        
        .status-active {
          color: #28a745;
        }
        
        .status-inactive {
          color: #6c757d;
        }
        
        /* Edit History Tab */
        .history-tab {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        
        .history-controls {
          padding: 15px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .refresh-button {
          padding: 6px 12px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .refresh-button:hover:not(:disabled) {
          background-color: #5a6268;
        }
        
        .refresh-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .history-list {
          flex: 1;
          overflow: auto;
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .history-item {
          padding: 12px;
          border-radius: 6px;
          background: #f8f9fa;
          border-left: 3px solid #6c757d;
        }
        
        .edit-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        
        .edit-info {
          flex: 1;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        
        .edit-user {
          font-weight: 500;
          color: #343a40;
        }
        
        .edit-type {
          color: #6c757d;
        }
        
        .edit-field {
          color: #3498db;
          font-weight: 500;
        }
        
        .edit-time {
          color: #6c757d;
          font-size: 13px;
          white-space: nowrap;
        }
        
        .edit-content {
          margin-bottom: 10px;
          padding-left: 34px;
        }
        
        .edit-deleted {
          color: #dc3545;
        }
        
        .edit-added {
          color: #28a745;
        }
        
        .edit-changed {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .edit-old {
          color: #dc3545;
          text-decoration: line-through;
          opacity: 0.8;
        }
        
        .edit-new {
          color: #28a745;
        }
        
        .edit-old .label,
        .edit-new .label {
          font-weight: 500;
          color: inherit;
          margin-right: 4px;
        }
        
        .edit-actions {
          padding-left: 34px;
          display: flex;
          justify-content: flex-start;
        }
        
        .revert-button {
          padding: 4px 8px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        }
        
        .revert-button:hover {
          background-color: #c82333;
        }
        
        /* Conflicts Tab */
        .conflicts-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 20px;
        }
        
        .conflicts-container {
          display: flex;
          gap: 20px;
          flex: 1;
          overflow: hidden;
        }
        
        .conflicts-list {
          flex: 1;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .conflict-item {
          padding: 12px;
          border-radius: 6px;
          background: #f8f9fa;
          border-left: 3px solid #f39c12;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .conflict-item:hover {
          background: #e9ecef;
          transform: translateY(-2px);
        }
        
        .conflict-item.selected {
          background: #e8f4fd;
          border-left-color: #3498db;
        }
        
        .conflict-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .conflict-field {
          font-weight: 500;
          color: #343a40;
        }
        
        .conflict-time {
          color: #6c757d;
          font-size: 13px;
        }
        
        .conflict-users {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .your-edit, .other-edit {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .your-edit {
          color: #3498db;
        }
        
        .other-edit {
          color: #e74c3c;
        }
        
        .label {
          font-weight: 500;
          color: inherit;
        }
        
        .other-user {
          font-weight: 500;
        }
        
        .conflict-resolver {
          flex: 1;
          min-width: 300px;
          max-width: 400px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
          overflow: auto;
        }
        
        .conflict-resolver h4 {
          margin-top: 0;
          color: #343a40;
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        
        .conflict-details {
          margin-bottom: 20px;
        }
        
        .conflict-field-details, .conflict-time-details {
          margin-bottom: 8px;
        }
        
        .resolution-options {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .resolution-option {
          flex: 1;
          padding: 12px;
          border-radius: 6px;
          background: white;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .resolution-option h5 {
          margin: 0;
          text-align: center;
        }
        
        .your-option {
          border: 1px solid #3498db;
        }
        
        .your-option h5 {
          color: #3498db;
        }
        
        .other-option {
          border: 1px solid #e74c3c;
        }
        
        .other-option h5 {
          color: #e74c3c;
        }
        
        .option-value {
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          word-break: break-word;
        }
        
        .option-time {
          font-size: 12px;
          color: #6c757d;
          text-align: center;
        }
        
        .option-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .your-option .option-button {
          background-color: #3498db;
          color: white;
        }
        
        .your-option .option-button:hover {
          background-color: #2980b9;
        }
        
        .other-option .option-button {
          background-color: #e74c3c;
          color: white;
        }
        
        .other-option .option-button:hover {
          background-color: #c0392b;
        }
        
        .manual-resolution {
          padding: 12px;
          border-radius: 6px;
          background: white;
          border: 1px solid #6c757d;
        }
        
        .manual-resolution h5 {
          margin: 0 0 10px 0;
          color: #343a40;
          text-align: center;
        }
        
        .custom-value {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ced4da;
          margin-bottom: 10px;
          resize: vertical;
        }
        
        .manual-resolution .option-button {
          width: 100%;
          background-color: #6c757d;
          color: white;
        }
        
        .manual-resolution .option-button:hover {
          background-color: #5a6268;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          color: #6c757d;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default CollaborationTools;

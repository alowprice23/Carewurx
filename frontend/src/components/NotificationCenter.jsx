import React, { useState, useEffect, useCallback } from 'react';
import { notificationService, agentService } from '../services'; // Import agentService

/**
 * Enhanced Notification Center Component
 * Provides a comprehensive interface for viewing and managing notifications
 */
const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categories] = useState([
    { id: 'all', label: 'All' },
    { id: 'urgent', label: 'Urgent' },
    { id: 'info', label: 'Info' },
    { id: 'reminder', label: 'Reminders' }
  ]);

  // Fetch notifications with filtering
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const options = {
        read: showUnreadOnly ? false : undefined,
        type: activeCategory !== 'all' ? activeCategory : undefined,
        limit: 50,
        sortBy: 'timestamp',
        order: 'desc'
      };
      
      const result = await notificationService.getNotifications(options);
      setNotifications(result);
      
      // Get unread count for the badge
      const unreadResult = await notificationService.getNotificationCount();
      setUnreadCount(unreadResult);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, showUnreadOnly]);

  // Initial fetch and set up subscription
  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to real-time notifications
    const unsubscribe = notificationService.subscribeToNotifications(notification => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    
    return () => {
      unsubscribe();
    };
  }, [fetchNotifications]);

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
  };

  // Toggle unread only filter
  const toggleUnreadOnly = () => {
    setShowUnreadOnly(!showUnreadOnly);
  };

  // Mark a notification as read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete a notification
  const handleDelete = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };
  
  // Handle notification action
  const handleAction = async (notification, action) => {
    if (!notification || !notification.entityId) {
      console.error("Cannot handle action: notification or entityId is missing.", notification);
      // Optionally, display an error to the user here
      return;
    }

    const wasNotificationUnread = !notification.read; // Capture read status before any action

    try {
      let actionSuccess = false;
      let actionError = null;

      if (notification.entityType === 'opportunity') {
        if (action === 'accept') {
          console.log('Accepting opportunity:', notification.entityId);
          const result = await agentService.applyOpportunity(notification.entityId);
          actionSuccess = result.success;
          if (!actionSuccess) actionError = result.message || 'Failed to accept opportunity.';
        } else if (action === 'reject') {
          console.log('Rejecting opportunity:', notification.entityId);
          const result = await agentService.rejectOpportunity(notification.entityId, "Rejected via notification");
          actionSuccess = result.success;
          if (!actionSuccess) actionError = result.message || 'Failed to reject opportunity.';
        } else {
          console.log(`Unsupported action "${action}" for opportunity ${notification.entityId}`);
          actionSuccess = true; // Or false if we want to indicate error for unsupported actions
        }
      } else if (notification.entityType === 'schedule') {
        // Placeholder for schedule actions
        console.log(`Action "${action}" for schedule:`, notification.entityId);
        actionSuccess = true; // Assume success for placeholder
      } else {
        // Generic action handling or navigation
        console.log(`Action "${action}" for entityType "${notification.entityType}" with ID "${notification.entityId}"`);
        // Example: Programmatic navigation or calling a prop function
        // window.location.hash = `/${notification.entityType}/${notification.entityId}`; // Simple example
        actionSuccess = true; // Assume success for placeholder
      }

      if (actionSuccess) {
        // Mark as read after successful action
        if (wasNotificationUnread) { // Only call markAsRead if it was originally unread
          await notificationService.markAsRead(notification.id);
        }

        // Update UI to reflect action taken and mark as read
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, read: true, actionTaken: action }
              : n
          )
        );

        if (wasNotificationUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } else {
        console.error(`Action "${action}" for entity ${notification.entityId} reported as not successful. Error: ${actionError}`);
        // Optionally, display an error to the user that the action failed.
        // For example, by adding a temporary error message to the notification item in the UI.
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, actionError: actionError || `Action '${action}' failed.` }
              : n
          )
        );
      }
      
    } catch (error) {
      console.error(`Error handling ${action} action for notification ${notification.id}:`, error);
      // Update UI to show error for this specific notification
       setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, actionError: error.message || `Action '${action}' failed.` }
              : n
          )
        );
    }
  };
  
  // Format timestamp for display
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  // Get icon based on notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'urgent':
        return '🔴';
      case 'info':
        return 'ℹ️';
      case 'reminder':
        return '⏰';
      default:
        return '📣';
    }
  };

  return (
    <div className={`notification-center ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="notification-header" onClick={() => setExpanded(!expanded)}>
        <h3>Notifications</h3>
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
        <button className="toggle-button">
          {expanded ? '▼' : '▲'}
        </button>
      </div>
      
      {expanded && (
        <>
          <div className="notification-filters">
            <div className="category-tabs">
              {categories.map(category => (
                <button
                  key={category.id}
                  className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
                  onClick={() => handleCategoryChange(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            
            <div className="filter-actions">
              <label className="unread-toggle">
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={toggleUnreadOnly}
                />
                Unread only
              </label>
              
              <button
                className="mark-all-read"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                Mark all as read
              </button>
            </div>
          </div>
          
          <div className="notifications-list">
            {loading ? (
              <div className="loading">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">
                No notifications to display
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.type || 'default'}`}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="notification-content" onClick={() => handleMarkAsRead(notification.id)}>
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-timestamp">{formatTime(notification.timestamp)}</div>
                  </div>
                  
                  <div className="notification-actions">
                    {notification.actionable && !notification.actionTaken && (
                      <>
                        <button
                          className="action-button accept"
                          onClick={() => handleAction(notification, 'accept')}
                        >
                          ✓
                        </button>
                        <button
                          className="action-button reject"
                          onClick={() => handleAction(notification, 'reject')}
                        >
                          ✗
                        </button>
                      </>
                    )}
                    <button
                      className="action-button delete"
                      onClick={() => handleDelete(notification.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
      
      <style jsx>{`
        .notification-center {
          background: white;
          border-radius: 8px;
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12);
          max-width: 500px;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid #e9ecef;
        }
        
        .notification-header {
          display: flex;
          align-items: center;
          padding: 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          cursor: pointer;
          height: 60px;
        }
        
        .notification-header h3 {
          margin: 0;
          flex: 1;
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .badge {
          background: #e74c3c;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          margin: 0 12px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(231, 76, 60, 0.3);
        }
        
        .toggle-button {
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          color: #6c757d;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .toggle-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .notification-filters {
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
          background-color: white;
        }
        
        .category-tabs {
          display: flex;
          margin-bottom: 16px;
          overflow-x: auto;
          scrollbar-width: thin;
          border-bottom: 1px solid #e9ecef;
          padding-bottom: 1px;
        }
        
        .category-tabs::-webkit-scrollbar {
          height: 4px;
        }
        
        .category-tabs::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        
        .category-tab {
          background: none;
          border: none;
          padding: 8px 16px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
          white-space: nowrap;
          color: #6c757d;
          font-size: 14px;
          margin-right: 8px;
          height: 40px;
          display: flex;
          align-items: center;
        }
        
        .category-tab.active {
          border-color: #3498db;
          color: #3498db;
          font-weight: 600;
        }
        
        .category-tab:hover:not(.active) {
          background-color: rgba(0, 0, 0, 0.03);
          color: #2c3e50;
        }
        
        .filter-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 40px;
        }
        
        .unread-toggle {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 14px;
          color: #2c3e50;
          height: 100%;
        }
        
        .unread-toggle input {
          margin-right: 8px;
          width: 16px;
          height: 16px;
        }
        
        .mark-all-read {
          padding: 8px 12px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          color: #3498db;
          font-weight: 500;
          height: 100%;
        }
        
        .mark-all-read:hover:not(:disabled) {
          background: #e2e8f0;
        }
        
        .mark-all-read:disabled {
          cursor: not-allowed;
          opacity: 0.5;
          color: #95a5a6;
        }
        
        .notifications-list {
          max-height: 400px;
          overflow-y: auto;
          scrollbar-width: thin;
          background-color: white;
        }
        
        .notifications-list::-webkit-scrollbar {
          width: 6px;
        }
        
        .notifications-list::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        
        .notification-item {
          display: flex;
          padding: 16px;
          border-bottom: 1px solid #e9ecef;
          transition: background 0.2s;
          align-items: flex-start;
        }
        
        .notification-item:last-child {
          border-bottom: none;
        }
        
        .notification-item:hover {
          background: #f8f9fa;
        }
        
        .notification-item.unread {
          background: #f0f7ff;
        }
        
        .notification-item.urgent {
          border-left: 4px solid #e74c3c;
        }
        
        .notification-item.info {
          border-left: 4px solid #3498db;
        }
        
        .notification-item.reminder {
          border-left: 4px solid #f39c12;
        }
        
        .notification-item:not(.urgent):not(.info):not(.reminder) {
          border-left: 4px solid transparent;
        }
        
        .notification-icon {
          font-size: 18px;
          margin-right: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
        }
        
        .notification-content {
          flex: 1;
          cursor: pointer;
          padding-right: 16px;
          min-width: 0; /* Enable text truncation */
        }
        
        .notification-title {
          font-weight: 600;
          margin-bottom: 6px;
          color: #2c3e50;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .notification-message {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 8px;
          line-height: 1.5;
        }
        
        .notification-timestamp {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }
        
        .notification-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .action-button {
          width: 32px;
          height: 32px;
          background: none;
          border: 1px solid #e2e8f0;
          font-size: 14px;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .action-button:hover {
          background: #f1f5f9;
          transform: translateY(-1px);
        }
        
        .action-button.accept {
          color: #2ecc71;
          border-color: #2ecc71;
        }
        
        .action-button.accept:hover {
          background: rgba(46, 204, 113, 0.1);
        }
        
        .action-button.reject {
          color: #e74c3c;
          border-color: #e74c3c;
        }
        
        .action-button.reject:hover {
          background: rgba(231, 76, 60, 0.1);
        }
        
        .action-button.delete {
          color: #64748b;
        }
        
        .loading, .empty-state {
          padding: 32px 16px;
          text-align: center;
          color: #64748b;
          font-size: 14px;
          border-top: none;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
        }
        
        .collapsed {
          border-radius: 8px;
        }
        
        .expanded {
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
        }
      `}</style>
    </div>
  );
};

export default NotificationCenter;

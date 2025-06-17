/**
 * Notification Service
 * Provides interface to notification system functionality with browser fallback
 */

// Import the firebaseService to check if we're in Electron mode
import { firebaseService } from './index';

// Helper function to simulate network delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Mock data for browser-only mode
const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Schedule Update',
    message: 'Client John Smith\'s schedule has been updated for tomorrow.',
    type: 'info',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    read: false,
    entityId: 'client-123',
    entityType: 'client'
  },
  {
    id: 'notif-2',
    title: 'Caregiver Unavailable',
    message: 'Sarah Johnson has marked herself as unavailable for the next week.',
    type: 'warning',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    read: true,
    entityId: 'caregiver-456',
    entityType: 'caregiver'
  },
  {
    id: 'notif-3',
    title: 'System Update',
    message: 'The system will undergo maintenance tonight at 2 AM.',
    type: 'info',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    read: false,
    entityId: null,
    entityType: null
  }
];

class NotificationService {
  constructor() {
    this.isElectronAvailable = typeof window !== 'undefined' && window.electronAPI;
    this.mockNotifications = [...MOCK_NOTIFICATIONS];
    
    console.log(`Notification Service initializing in ${this.isElectronAvailable ? 'Electron' : 'browser-only'} mode`);
  }

  /**
   * Show a notification toast/popup to the user
   * @param {string} message - The message to display
   * @param {string} type - Type of notification (info, success, warning, error)
   * @param {number} duration - How long to show the notification (ms)
   */
  showNotification(message, type = 'info', duration = 5000) {
    // This function is used across the application for UI toast notifications
    console.log(`NOTIFICATION [${type}]: ${message}`);
    
    // Create DOM element for notification (for browser-only mode)
    const notificationElement = document.createElement('div');
    notificationElement.className = `toast-notification ${type}`;
    notificationElement.innerHTML = `
      <div class="toast-message">${message}</div>
    `;
    
    // Style the notification
    Object.assign(notificationElement.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: type === 'error' ? '#f44336' : 
                     type === 'warning' ? '#ff9800' : 
                     type === 'success' ? '#4caf50' : 
                     '#2196f3',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '4px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      zIndex: '9999',
      opacity: '0',
      transition: 'opacity 0.3s ease-in-out'
    });
    
    // Add to document
    document.body.appendChild(notificationElement);
    
    // Animate in
    setTimeout(() => {
      notificationElement.style.opacity = '1';
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
      notificationElement.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notificationElement);
      }, 300);
    }, duration);
  }

  /**
   * Get notifications with optional filtering
   * @param {Object} options - Filter options (e.g. read status, date range, type)
   * @returns {Promise<Array>} - List of notifications
   */
  async getNotifications(options = {}) {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        return await window.electronAPI.getNotifications(options);
      } else {
        // Browser-only mode: filter mock notifications
        console.log('Notification Service: Using mock notifications in browser-only mode');
        await delay(600); // Simulate network delay
        
        // Apply filters from options
        let result = [...this.mockNotifications];
        
        if (options.read !== undefined) {
          result = result.filter(n => n.read === options.read);
        }
        
        if (options.type) {
          result = result.filter(n => n.type === options.type);
        }
        
        if (options.entityType) {
          result = result.filter(n => n.entityType === options.entityType);
        }
        
        if (options.entityId) {
          result = result.filter(n => n.entityId === options.entityId);
        }
        
        // Sort by timestamp (newest first)
        result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return result;
      }
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - The notification ID
   * @returns {Promise<Object>} - Updated notification
   */
  async markAsRead(notificationId) {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        return await window.electronAPI.markAsRead(notificationId);
      } else {
        // Browser-only mode: update mock notification
        console.log('Notification Service: Marking mock notification as read in browser-only mode');
        await delay(400); // Simulate network delay
        
        const notification = this.mockNotifications.find(n => n.id === notificationId);
        if (!notification) {
          throw new Error('Notification not found');
        }
        
        notification.read = true;
        
        return { ...notification };
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   * @returns {Promise<boolean>} - Success status
   */
  async markAllAsRead() {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        return await window.electronAPI.markAllNotificationsAsRead();
      } else {
        // Browser-only mode: update all mock notifications
        console.log('Notification Service: Marking all mock notifications as read in browser-only mode');
        await delay(500); // Simulate network delay
        
        this.mockNotifications.forEach(notification => {
          notification.read = true;
        });
        
        return { success: true, count: this.mockNotifications.length };
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Create a new notification
   * @param {Object} notificationData - The notification data
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.message - Notification message
   * @param {string} notificationData.type - Notification type (info, warning, error)
   * @param {string} notificationData.entityId - Related entity ID (optional)
   * @param {string} notificationData.entityType - Related entity type (optional)
   * @returns {Promise<Object>} - Created notification
   */
  async createNotification(notificationData) {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        return await window.electronAPI.createNotification(notificationData);
      } else {
        // Browser-only mode: create mock notification
        console.log('Notification Service: Creating mock notification in browser-only mode');
        await delay(600); // Simulate network delay
        
        const newNotification = {
          id: `notif-${Date.now()}`,
          timestamp: new Date().toISOString(),
          read: false,
          ...notificationData
        };
        
        this.mockNotifications.unshift(newNotification);
        
        // Show UI notification
        this.showNotification(notificationData.message, notificationData.type || 'info');
        
        // Dispatch event for subscribers
        const event = new CustomEvent('new-notification', { detail: newNotification });
        window.dispatchEvent(event);
        
        return { ...newNotification };
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - The notification ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteNotification(notificationId) {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        return await window.electronAPI.deleteNotification(notificationId);
      } else {
        // Browser-only mode: delete mock notification
        console.log('Notification Service: Deleting mock notification in browser-only mode');
        await delay(400); // Simulate network delay
        
        const index = this.mockNotifications.findIndex(n => n.id === notificationId);
        if (index === -1) {
          throw new Error('Notification not found');
        }
        
        this.mockNotifications.splice(index, 1);
        
        return { success: true };
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time notifications
   * @param {Function} callback - Callback function for new notifications
   * @returns {Function} - Unsubscribe function
   */
  subscribeToNotifications(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Set up listener for new notifications
    const handleNewNotification = (event) => {
      callback(event.detail || event);
    };
    
    // Add event listener
    window.addEventListener('new-notification', handleNewNotification);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener('new-notification', handleNewNotification);
    };
  }
  
  /**
   * Get notification count by type
   * @param {string} type - Notification type (optional)
   * @returns {Promise<number>} - Count of notifications
   */
  async getNotificationCount(type = null) {
    try {
      const notifications = await this.getNotifications({ 
        read: false, 
        type: type 
      });
      return notifications.length;
    } catch (error) {
      console.error('Error getting notification count:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const notificationService = new NotificationService();
export default notificationService;

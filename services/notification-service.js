/**
 * Notification Service
 * Manages system notifications and integrates with the agentic capabilities
 * A key part of the circular integration model (C=2πr)
 */

const { firebaseService } = require('./firebase');
const realTimeUpdatesService = require('./real-time-updates');

class NotificationService {
  constructor() {
    this.init();
  }

  /**
   * Initialize the service
   */
  init() {
    console.log('Initializing Notification Service');
  }

  /**
   * Create a new notification
   * @param {Object} notificationData - The notification data
   * @returns {Promise<Object>} The created notification
   */
  async createNotification(notificationData) {
    try {
      // Add default properties if not provided
      const notification = {
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        read: false,
        ...notificationData
      };
      
      // Save to Firebase
      const savedNotification = await firebaseService.addDocument('notifications', notification);
      
      // Publish the new notification through the circular integration system
      await realTimeUpdatesService.publish('notification', savedNotification, 'notification-service');
      
      return savedNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {Object} options - The options for filtering notifications
   * @returns {Promise<Array>} The notifications
   */
  async getNotifications(options = {}) {
    try {
      const defaultOptions = {
        limit: 50,
        read: null, // null means both read and unread
        type: null, // null means all types
        sortBy: 'timestamp',
        sortDirection: 'desc'
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      
      let notifications = await firebaseService.getNotifications(finalOptions);
      
      // Apply additional filtering in memory if needed
      if (finalOptions.type) {
        notifications = notifications.filter(n => n.type === finalOptions.type);
      }
      
      // Apply additional sorting in memory
      notifications.sort((a, b) => {
        const aValue = a[finalOptions.sortBy];
        const bValue = b[finalOptions.sortBy];
        
        if (finalOptions.sortDirection === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
      
      // Apply limit in memory
      if (finalOptions.limit) {
        notifications = notifications.slice(0, finalOptions.limit);
      }
      
      return notifications;
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - The ID of the notification to mark as read
   * @returns {Promise<Object>} The updated notification
   */
  async markAsRead(notificationId) {
    try {
      await firebaseService.updateDocument('notifications', notificationId, { read: true });
      
      // Get the updated notification
      const updatedNotification = await firebaseService.getDocument('notifications', notificationId);
      
      // Publish the update through the circular integration system
      await realTimeUpdatesService.publish('notification', updatedNotification, 'notification-service');
      
      return updatedNotification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   * @returns {Promise<number>} The number of notifications marked as read
   */
  async markAllAsRead() {
    try {
      // Get all unread notifications
      const unreadNotifications = await this.getNotifications({ read: false });
      
      // Mark each as read
      const updatePromises = unreadNotifications.map(notification => 
        firebaseService.updateDocument('notifications', notification.id, { read: true })
      );
      
      await Promise.all(updatePromises);
      
      // Publish a bulk update through the circular integration system
      await realTimeUpdatesService.publish('notification_bulk_update', { 
        action: 'mark_all_read',
        count: unreadNotifications.length
      }, 'notification-service');
      
      return unreadNotifications.length;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - The ID of the notification to delete
   * @returns {Promise<void>}
   */
  async deleteNotification(notificationId) {
    try {
      await firebaseService.deleteDocument('notifications', notificationId);
      
      // Publish the deletion through the circular integration system
      await realTimeUpdatesService.publish('notification', { 
        id: notificationId, 
        deleted: true 
      }, 'notification-service');
      
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Create a system notification
   * @param {string} title - The notification title
   * @param {string} message - The notification message
   * @param {string} [priority='medium'] - The notification priority
   * @returns {Promise<Object>} The created notification
   */
  async createSystemNotification(title, message, priority = 'medium') {
    return await this.createNotification({
      type: 'system',
      title,
      message,
      priority,
      data: {
        source: 'system',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Create an agent notification
   * @param {string} agentName - The name of the agent
   * @param {string} message - The notification message
   * @param {string} [priority='medium'] - The notification priority
   * @returns {Promise<Object>} The created notification
   */
  async createAgentNotification(agentName, message, priority = 'medium') {
    return await this.createNotification({
      type: 'agent',
      title: `Message from ${agentName}`,
      message,
      priority,
      data: {
        agentName,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Create a schedule notification
   * @param {string} title - The notification title
   * @param {string} message - The notification message
   * @param {Object} scheduleData - The schedule data
   * @param {string} [priority='medium'] - The notification priority
   * @returns {Promise<Object>} The created notification
   */
  async createScheduleNotification(title, message, scheduleData, priority = 'medium') {
    return await this.createNotification({
      type: 'schedule',
      title,
      message,
      priority,
      data: {
        scheduleId: scheduleData.id,
        clientId: scheduleData.client_id,
        clientName: scheduleData.client_name,
        caregiverId: scheduleData.caregiver_id,
        caregiverName: scheduleData.caregiver_name,
        date: scheduleData.date,
        timeRange: `${scheduleData.start_time} - ${scheduleData.end_time}`,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Create an opportunity notification
   * @param {Object} opportunity - The opportunity data
   * @returns {Promise<Object>} The created notification
   */
  async createOpportunityNotification(opportunity) {
    let title, message;
    
    switch (opportunity.type) {
      case 'caregiver_assignment':
        title = `Caregiver Match Found for ${opportunity.client_name}`;
        message = `Found ${opportunity.candidates.length} potential caregivers for ${opportunity.client_name}'s schedule on ${opportunity.date}.`;
        break;
        
      case 'schedule_optimization':
        title = 'Schedule Optimization Opportunity';
        message = `Potential optimization found for schedules on ${opportunity.date}.`;
        break;
        
      case 'conflict_resolution':
        title = 'Schedule Conflict Detected';
        message = `Scheduling conflict detected for ${opportunity.caregiver_name || 'a caregiver'} on ${opportunity.date}.`;
        break;
        
      default:
        title = 'New Scheduling Opportunity';
        message = `New opportunity discovered at ${new Date().toLocaleString()}`;
    }
    
    return await this.createNotification({
      type: 'opportunity',
      title,
      message,
      priority: opportunity.priority || 'medium',
      data: {
        opportunityId: opportunity.id,
        opportunityType: opportunity.type,
        scheduleId: opportunity.schedule_id,
        clientId: opportunity.client_id,
        clientName: opportunity.client_name,
        date: opportunity.date,
        timestamp: new Date().toISOString()
      }
    });
  }
}

module.exports = new NotificationService();

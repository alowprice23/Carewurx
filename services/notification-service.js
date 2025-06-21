/**
 * Notification Service
 * Manages system notifications and integrates with the agentic capabilities
 * A key part of the circular integration model (C=2πr)
 */

const { firebaseService } = require('./firebase');
const realTimeUpdatesService = require('../app/services/real-time-updates');

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
    let notificationDataPayload = {
        opportunityId: opportunity.id,
        opportunityType: opportunity.type,
        timestamp: new Date().toISOString(),
        priority: opportunity.priority || 'medium',
    };
    
    switch (opportunity.type) {
      case 'caregiver_assignment_to_schedule': // Updated from 'caregiver_assignment'
        title = `Caregiver Match for ${opportunity.client_name}`;
        message = `Found ${opportunity.candidates.length} potential caregiver(s) for ${opportunity.client_name}'s shift on ${opportunity.date} (${opportunity.time_range}). Top match: ${opportunity.candidates[0]?.caregiver_name || 'N/A'}.`;
        notificationDataPayload.schedule_id = opportunity.schedule_id;
        notificationDataPayload.client_id = opportunity.client_id;
        notificationDataPayload.client_name = opportunity.client_name;
        notificationDataPayload.date = opportunity.date;
        notificationDataPayload.candidates = opportunity.candidates;
        break;

      case 'client_assignment_suggestion':
        title = `Client Suggestion for ${opportunity.caregiver_name}`;
        const clientNames = opportunity.potential_clients.map(c => c.client_name).join(', ');
        message = `${opportunity.caregiver_name} is generally available and could take on new clients like ${clientNames}.`;
        notificationDataPayload.caregiver_id = opportunity.caregiver_id;
        notificationDataPayload.caregiver_name = opportunity.caregiver_name;
        notificationDataPayload.potential_clients = opportunity.potential_clients;
        notificationDataPayload.availability_summary = opportunity.availability_summary;
        break;

      case 'increase_caregiver_hours':
        title = `Capacity Alert: ${opportunity.caregiver_name}`;
        message = `${opportunity.caregiver_name} has capacity for ~${opportunity.hour_deficit} more hours next week. ${opportunity.potential_matches?.length || 0} potential shifts identified.`;
        notificationDataPayload.caregiver_id = opportunity.caregiver_id;
        notificationDataPayload.caregiver_name = opportunity.caregiver_name;
        notificationDataPayload.current_hours_next_week = opportunity.current_hours_next_week;
        notificationDataPayload.target_hours = opportunity.target_hours;
        notificationDataPayload.hour_deficit = opportunity.hour_deficit;
        notificationDataPayload.potential_matches = opportunity.potential_matches;
        break;

      case 'fill_gap_efficiency':
        title = `Efficiency: Fill Gap for ${opportunity.caregiver_name}`;
        message = `Suggest filling a ${opportunity.gap_duration_minutes} min gap for ${opportunity.caregiver_name} on ${opportunity.date || opportunity.summary.match(/on (\d{4}-\d{2}-\d{2})/)?.[1]} with a nearby shift.`;
        notificationDataPayload.caregiver_id = opportunity.caregiver_id;
        notificationDataPayload.caregiver_name = opportunity.caregiver_name;
        notificationDataPayload.existing_schedule_id = opportunity.existing_schedule_id;
        notificationDataPayload.potential_schedule_to_fill_id = opportunity.potential_schedule_to_fill_id;
        notificationDataPayload.gap_duration_minutes = opportunity.gap_duration_minutes;
        break;

      case 'caregiver_shortage_alert':
        title = `Caregiver Shortage Alert: ${opportunity.date}`;
        message = opportunity.summary || `Potential caregiver shortage identified for date ${opportunity.date} requiring skills: ${(opportunity.required_skills || []).join(', ') || 'general care'}.`;
        notificationDataPayload.date = opportunity.date;
        notificationDataPayload.required_skills = opportunity.required_skills;
        notificationDataPayload.number_of_shifts_affected = opportunity.number_of_shifts_affected;
        notificationDataPayload.affected_clients_sample = opportunity.affected_clients_sample;
        notificationDataPayload.details = opportunity.details;
        break;

      case 'schedule_optimization':
        title = 'Schedule Optimization Opportunity';
        message = `Potential optimization found for schedules on ${opportunity.date}.`;
        break;
        
      case 'conflict_resolution':
        title = 'Schedule Conflict Detected';
        message = `Scheduling conflict detected for ${opportunity.caregiver_name || 'a caregiver'} on ${opportunity.date || 'upcoming date'}.`;
        notificationDataPayload.conflict_details = opportunity.conflict_details; // Assuming this field exists
        break;
        
      default:
        title = 'New Scheduling Opportunity';
        message = opportunity.summary || `New opportunity of type '${opportunity.type}' discovered.`;
    }
    
    return await this.createNotification({
      type: 'opportunity',
      title,
      message,
      priority: opportunity.priority || 'medium',
      data: notificationDataPayload
    });
  }
}

module.exports = new NotificationService();

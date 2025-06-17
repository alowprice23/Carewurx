/**
 * Notification Center Component
 * Displays real-time notifications to the user
 * A key part of the circular integration model (C=2πr) on the frontend
 */

const realTimeUpdatesService = require('../services/real-time-updates');

class NotificationCenter {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.notifications = [];
    this.subscriptionId = null;
    
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    console.log('Initializing Notification Center');
    
    // Subscribe to notification updates
    this.subscriptionId = realTimeUpdatesService.subscribe('notification', (notifications) => {
      this.handleNotificationUpdate(notifications);
    });
    
    // Initial render
    this.render();
    
    // Fetch initial notifications
    this.fetchInitialNotifications();
  }

  /**
   * Handle a notification update from the real-time service
   * @param {Array|Object} notifications - The updated notifications
   */
  handleNotificationUpdate(notifications) {
    if (!Array.isArray(notifications)) {
      notifications = [notifications];
    }
    
    console.log('Received notification update:', notifications);
    
    // Update the local list of notifications
    notifications.forEach(notification => {
      const existingIndex = this.notifications.findIndex(n => n.id === notification.id);
      
      if (existingIndex >= 0) {
        // Update existing notification
        this.notifications[existingIndex] = notification;
      } else {
        // Add new notification
        this.notifications.unshift(notification); // Add to the top
      }
    });
    
    // Re-render the component
    this.render();
  }

  /**
   * Fetch initial notifications from the backend
   */
  async fetchInitialNotifications() {
    try {
      const notifications = await window.electronAPI.getNotifications({ read: false, limit: 20 });
      if (notifications && notifications.length > 0) {
        this.notifications = notifications;
        this.render();
      }
    } catch (error) {
      console.error('Error fetching initial notifications:', error);
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the main title
    const title = document.createElement('h2');
    title.textContent = 'Notifications';
    this.container.appendChild(title);
    
    // If no notifications, show a message
    if (this.notifications.length === 0) {
      const noNotificationsMessage = document.createElement('p');
      noNotificationsMessage.textContent = 'No new notifications.';
      noNotificationsMessage.className = 'no-notifications';
      this.container.appendChild(noNotificationsMessage);
      return;
    }
    
    // Create a list of notifications
    const notificationList = document.createElement('ul');
    notificationList.className = 'notification-list';
    
    this.notifications.forEach(notification => {
      const listItem = this.createNotificationListItem(notification);
      notificationList.appendChild(listItem);
    });
    
    this.container.appendChild(notificationList);
  }

  /**
   * Create a list item for a notification
   * @param {Object} notification - The notification data
   * @returns {HTMLLIElement} The list item element
   */
  createNotificationListItem(notification) {
    const listItem = document.createElement('li');
    listItem.className = `notification-item priority-${notification.priority || 'medium'} ${notification.read ? 'read' : 'unread'} type-${notification.type || 'system'}`;
    
    // Create the header
    const header = document.createElement('div');
    header.className = 'notification-header';
    
    const title = document.createElement('h3');
    title.textContent = notification.title;
    header.appendChild(title);
    
    const timestamp = document.createElement('span');
    timestamp.className = 'notification-timestamp';
    timestamp.textContent = new Date(notification.timestamp).toLocaleString();
    header.appendChild(timestamp);
    
    listItem.appendChild(header);
    
    // Create the message
    const message = document.createElement('p');
    message.className = 'notification-message';
    message.textContent = notification.message;
    listItem.appendChild(message);
    
    // Add action buttons based on notification type
    const actions = document.createElement('div');
    actions.className = 'notification-actions';
    
    // Mark as read button for all notifications
    if (!notification.read) {
      const markAsReadButton = document.createElement('button');
      markAsReadButton.textContent = 'Mark as Read';
      markAsReadButton.className = 'mark-as-read-button';
      markAsReadButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleMarkAsRead(notification.id);
      });
      actions.appendChild(markAsReadButton);
    }
    
    // Add type-specific actions
    if (notification.type === 'opportunity' && notification.data && notification.data.opportunityId) {
      // View details button
      const viewDetailsButton = document.createElement('button');
      viewDetailsButton.textContent = 'View Details';
      viewDetailsButton.className = 'view-details-button';
      viewDetailsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleViewOpportunityDetails(notification.data.opportunityId);
      });
      actions.appendChild(viewDetailsButton);
      
      // Apply button
      const applyButton = document.createElement('button');
      applyButton.textContent = 'Apply';
      applyButton.className = 'apply-button';
      applyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleApplyOpportunity(notification.data.opportunityId);
      });
      actions.appendChild(applyButton);
    } else if (notification.type === 'schedule' && notification.data && notification.data.scheduleId) {
      // View schedule button
      const viewScheduleButton = document.createElement('button');
      viewScheduleButton.textContent = 'View Schedule';
      viewScheduleButton.className = 'view-schedule-button';
      viewScheduleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleViewSchedule(notification.data.scheduleId);
      });
      actions.appendChild(viewScheduleButton);
    } else if (notification.type === 'agent' && notification.data && notification.data.agentName) {
      // Open chat button
      const openChatButton = document.createElement('button');
      openChatButton.textContent = 'Open Chat';
      openChatButton.className = 'open-chat-button';
      openChatButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleOpenChat(notification.data.agentName);
      });
      actions.appendChild(openChatButton);
    }
    
    // Add custom actions if provided
    if (notification.actions) {
      notification.actions.forEach(action => {
        const actionButton = document.createElement('button');
        actionButton.textContent = action.label;
        actionButton.className = 'action-button';
        actionButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleAction(action, notification.id);
        });
        actions.appendChild(actionButton);
      });
    }
    
    listItem.appendChild(actions);
    
    // Make the entire notification clickable
    listItem.addEventListener('click', () => {
      this.handleNotificationClick(notification);
    });
    
    return listItem;
  }

  /**
   * Handle marking a notification as read
   * @param {string} notificationId - The ID of the notification to mark as read
   */
  async handleMarkAsRead(notificationId) {
    console.log(`Marking notification ${notificationId} as read`);
    
    try {
      // Find the notification
      const notification = this.notifications.find(n => n.id === notificationId);
      if (!notification) {
        console.error('Notification not found');
        return;
      }
      
      // Update the notification status
      const updatedNotification = { ...notification, read: true };
      
      // Publish the update through the circular integration system
      await realTimeUpdatesService.publish('notification', updatedNotification, 'notification-center');
      
      // Update the local list and re-render
      notification.read = true;
      this.render();
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Handle a custom action from a notification
   * @param {Object} action - The action to handle
   * @param {string} notificationId - The ID of the notification containing the action
   */
  async handleAction(action, notificationId) {
    console.log('Handling action:', action, 'for notification:', notificationId);
    
    try {
      // Publish the action to the system so other components can handle it
      await realTimeUpdatesService.publish('system', {
        type: 'notification_action',
        action,
        notificationId
      }, 'notification-center');
      
      // Mark the notification as read
      if (notificationId) {
        await this.handleMarkAsRead(notificationId);
      } else {
        // Find by action if notificationId not provided (backward compatibility)
        const notification = this.notifications.find(n => n.actions && n.actions.some(a => a.label === action.label));
        if (notification) {
          await this.handleMarkAsRead(notification.id);
        }
      }
      
    } catch (error) {
      console.error('Error handling notification action:', error);
    }
  }
  
  /**
   * Handle viewing opportunity details
   * @param {string} opportunityId - The ID of the opportunity to view
   */
  async handleViewOpportunityDetails(opportunityId) {
    console.log(`Viewing opportunity details for ${opportunityId}`);
    
    try {
      // Get opportunity details
      const opportunityDetails = await window.electronAPI.getOpportunityDetails(opportunityId);
      
      // Publish an event to show opportunity details in the opportunity viewer
      await realTimeUpdatesService.publish('system', {
        type: 'view_opportunity',
        opportunityId,
        opportunityDetails
      }, 'notification-center');
      
      // Switch to the opportunity view
      this.switchToView('opportunity');
      
    } catch (error) {
      console.error('Error viewing opportunity details:', error);
      alert('Failed to view opportunity details. Please try again.');
    }
  }
  
  /**
   * Handle applying an opportunity
   * @param {string} opportunityId - The ID of the opportunity to apply
   */
  async handleApplyOpportunity(opportunityId) {
    console.log(`Applying opportunity ${opportunityId}`);
    
    try {
      // Apply the opportunity
      const result = await window.electronAPI.applyOpportunity(opportunityId);
      
      if (result.success) {
        // Show success message
        alert(`Opportunity applied successfully!`);
        
        // Mark related notifications as read
        const relatedNotifications = this.notifications.filter(
          n => n.type === 'opportunity' && n.data && n.data.opportunityId === opportunityId
        );
        
        for (const notification of relatedNotifications) {
          await this.handleMarkAsRead(notification.id);
        }
      } else {
        alert(`Failed to apply opportunity: ${result.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error applying opportunity:', error);
      alert('Failed to apply opportunity. Please try again.');
    }
  }
  
  /**
   * Handle viewing a schedule
   * @param {string} scheduleId - The ID of the schedule to view
   */
  async handleViewSchedule(scheduleId) {
    console.log(`Viewing schedule ${scheduleId}`);
    
    try {
      // Get schedule details
      const schedule = await window.electronAPI.getSchedule(scheduleId);
      
      if (schedule.client_id) {
        // Switch to client profile view if client exists
        await realTimeUpdatesService.publish('system', {
          type: 'view_client',
          clientId: schedule.client_id,
          highlightScheduleId: scheduleId
        }, 'notification-center');
      } else {
        // Just show the schedule in a dialog for now
        alert(`Schedule Details:\nDate: ${schedule.date}\nTime: ${schedule.start_time} - ${schedule.end_time}\nClient: ${schedule.client_name || 'Unknown'}\nCaregiver: ${schedule.caregiver_name || 'Unassigned'}`);
      }
      
    } catch (error) {
      console.error('Error viewing schedule:', error);
      alert('Failed to view schedule. Please try again.');
    }
  }
  
  /**
   * Handle opening a chat with an agent
   * @param {string} agentName - The name of the agent to chat with
   */
  async handleOpenChat(agentName) {
    console.log(`Opening chat with agent ${agentName}`);
    
    try {
      // Switch to chat view and focus on the agent
      await realTimeUpdatesService.publish('system', {
        type: 'open_chat',
        agentName
      }, 'notification-center');
      
      // Switch to the chat view
      this.switchToView('chat');
      
    } catch (error) {
      console.error('Error opening chat:', error);
      alert('Failed to open chat. Please try again.');
    }
  }
  
  /**
   * Handle clicking on a notification
   * @param {Object} notification - The notification that was clicked
   */
  async handleNotificationClick(notification) {
    console.log('Notification clicked:', notification);
    
    try {
      // Mark as read
      if (!notification.read) {
        await this.handleMarkAsRead(notification.id);
      }
      
      // Handle based on notification type
      switch (notification.type) {
        case 'opportunity':
          if (notification.data && notification.data.opportunityId) {
            await this.handleViewOpportunityDetails(notification.data.opportunityId);
          }
          break;
          
        case 'schedule':
          if (notification.data && notification.data.scheduleId) {
            await this.handleViewSchedule(notification.data.scheduleId);
          }
          break;
          
        case 'agent':
          if (notification.data && notification.data.agentName) {
            await this.handleOpenChat(notification.data.agentName);
          }
          break;
          
        default:
          console.log('No specific action for this notification type');
      }
      
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  }
  
  /**
   * Switch to a specific view in the application
   * @param {string} viewName - The name of the view to switch to
   */
  switchToView(viewName) {
    // Publish a system event to switch views
    realTimeUpdatesService.publish('system', {
      type: 'switch_view',
      viewName
    }, 'notification-center');
  }

  /**
   * Clean up the component
   */
  destroy() {
    console.log('Destroying Notification Center');
    
    // Unsubscribe from updates
    if (this.subscriptionId) {
      realTimeUpdatesService.unsubscribe('notification', this.subscriptionId);
      this.subscriptionId = null;
    }
    
    // Clear the container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

module.exports = NotificationCenter;

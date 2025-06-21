/**
 * Real-time Updates Service
 * Enables circular data flow throughout the application (C=2πr)
 * Acts as the primary channel for propagating changes between components
 */

class RealTimeUpdatesService {
  constructor() {
    // Subscribers organized by entity type
    this.subscribers = {
      schedule: new Map(),
      client: new Map(),
      caregiver: new Map(),
      opportunity: new Map(),
      notification: new Map(),
      agent: new Map(),
      system: new Map()
    };
    
    // Update queue for batching updates
    this.updateQueue = [];
    this.isProcessingQueue = false;
    this.processingInterval = null;
    this.debounceTime = 50; // ms
    
    // Circular path tracking to prevent infinite loops
    this.circularPaths = new Map();
    this.maxCircularPathLength = 5;
    
    // Initialize the processing interval
    this.initializeProcessingInterval();
  }

  /**
   * Initialize the update processing interval
   */
  initializeProcessingInterval() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      this.processUpdateQueue();
    }, 100); // Process updates every 100ms
  }

  /**
   * Process the update queue
   */
  async processUpdateQueue() {
    if (this.isProcessingQueue || this.updateQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Get the next batch of updates (up to 10)
      const batch = this.updateQueue.splice(0, 10);
      
      // Group updates by type to avoid redundant notifications
      const groupedUpdates = this.groupUpdates(batch);
      
      // Process each update group
      for (const [type, updates] of Object.entries(groupedUpdates)) {
        // Get subscribers for this type
        const typeSubscribers = this.subscribers[type];
        if (!typeSubscribers || typeSubscribers.size === 0) {
          continue;
        }
        
        // Notify subscribers
        typeSubscribers.forEach((callback, id) => {
          try {
            // For multiple updates of the same entity, only send the latest
            if (updates.length === 1) {
              callback(updates[0].data, updates[0].path);
            } else {
              callback(updates.map(u => u.data), updates.map(u => u.path));
            }
          } catch (error) {
            console.error(`Error notifying subscriber ${id} for type ${type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error processing update queue:', error);
    } finally {
      this.isProcessingQueue = false;
      
      // If there are more updates, process them after a short delay
      if (this.updateQueue.length > 0) {
        setTimeout(() => {
          this.processUpdateQueue();
        }, this.debounceTime);
      }
    }
  }

  /**
   * Group updates by type
   * @param {Array} updates - The updates to group
   * @returns {Object} The grouped updates
   */
  groupUpdates(updates) {
    const grouped = {};
    
    updates.forEach(update => {
      const { type } = update;
      
      if (!grouped[type]) {
        grouped[type] = [];
      }
      
      // Check if we already have an update for this entity
      const existingIndex = grouped[type].findIndex(u => 
        u.data.id === update.data.id && u.data.uid === update.data.uid
      );
      
      if (existingIndex >= 0) {
        // Replace with the newer update
        grouped[type][existingIndex] = update;
      } else {
        // Add the new update
        grouped[type].push(update);
      }
    });
    
    return grouped;
  }

  /**
   * Subscribe to updates for a specific entity type
   * @param {string} type - The entity type to subscribe to
   * @param {Function} callback - The callback to call when an update occurs
   * @returns {string} The subscription ID
   */
  subscribe(type, callback) {
    if (!this.subscribers[type]) {
      this.subscribers[type] = new Map();
    }
    
    const subscriptionId = `sub-${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.subscribers[type].set(subscriptionId, callback);
    
    console.log(`Subscribed to ${type} updates with ID ${subscriptionId}`);
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from updates
   * @param {string} type - The entity type
   * @param {string} subscriptionId - The subscription ID
   * @returns {boolean} Whether the unsubscription was successful
   */
  unsubscribe(type, subscriptionId) {
    if (!this.subscribers[type]) {
      return false;
    }
    
    const result = this.subscribers[type].delete(subscriptionId);
    
    if (result) {
      console.log(`Unsubscribed from ${type} updates with ID ${subscriptionId}`);
    }
    
    return result;
  }

  /**
   * Publish an update to subscribers
   * This is the key method that enables circular data flow (C=2πr)
   * @param {string} type - The entity type
   * @param {Object} data - The update data
   * @param {string} [source] - The source of the update
   * @param {Array} [path] - The path the update has taken
   * @returns {Promise<void>}
   */
  async publish(type, data, source = 'system', path = []) {
    // Create a new path including this publish event
    const newPath = [...path, { type, source, timestamp: Date.now() }];
    
    // Check for circular updates to prevent infinite loops
    if (this.isCircularUpdate(newPath)) {
      console.warn('Circular update detected, breaking the loop:', newPath);
      return;
    }
    
    // Add the update to the queue
    this.updateQueue.push({
      type,
      data,
      source,
      path: newPath,
      timestamp: Date.now()
    });
    
    // Perform any cascading updates
    await this.performCascadingUpdates(type, data, source, newPath);
  }

  /**
   * Perform cascading updates based on the entity type
   * This is where the circular integration model (C=2πr) is implemented
   * @param {string} type - The entity type
   * @param {Object} data - The update data
   * @param {string} source - The source of the update
   * @param {Array} path - The path the update has taken
   * @returns {Promise<void>}
   */
  async performCascadingUpdates(type, data, source, path) {
    try {
      switch (type) {
        case 'schedule':
          await this.handleScheduleUpdate(data, source, path);
          break;
          
        case 'client':
          await this.handleClientUpdate(data, source, path);
          break;
          
        case 'caregiver':
          await this.handleCaregiverUpdate(data, source, path);
          break;
          
        case 'opportunity':
          await this.handleOpportunityUpdate(data, source, path);
          break;
          
        case 'notification':
          // Notifications don't cascade by default
          break;
          
        case 'agent':
          await this.handleAgentUpdate(data, source, path);
          break;
      }
    } catch (error) {
      console.error(`Error performing cascading updates for ${type}:`, error);
    }
  }

  /**
   * Handle a schedule update
   * @param {Object} data - The schedule data
   * @param {string} source - The source of the update
   * @param {Array} path - The path the update has taken
   * @returns {Promise<void>}
   */
  async handleScheduleUpdate(data, source, path) {
    // Create a unique ID for this cascading update
    const updateId = `schedule-${data.id}-${Date.now()}`;
    
    try {
      // Get related client and caregiver
      if (data.client_id) {
        const client = await window.electronAPI.getClient(data.client_id);
        if (client) {
          // Publish an update for the client with related schedule changes
          const clientUpdate = {
            ...client,
            recentScheduleChange: {
              scheduleId: data.id,
              changeType: data.isNew ? 'created' : 'updated',
              timestamp: Date.now()
            }
          };
          
          await this.publish('client', clientUpdate, updateId, path);
        }
      }
      
      if (data.caregiver_id) {
        const caregiver = await window.electronAPI.getCaregiver(data.caregiver_id);
        if (caregiver) {
          // Publish an update for the caregiver with related schedule changes
          const caregiverUpdate = {
            ...caregiver,
            recentScheduleChange: {
              scheduleId: data.id,
              changeType: data.isNew ? 'created' : 'updated',
              timestamp: Date.now()
            }
          };
          
          await this.publish('caregiver', caregiverUpdate, updateId, path);
        }
      }
      
      // Check for scheduling conflicts and opportunities
      const conflicts = await window.electronAPI.checkScheduleConflicts(data.id);
      if (conflicts && conflicts.length > 0) {
        // Create a notification for each conflict
        for (const conflict of conflicts) {
          const notification = {
            id: `conflict-${conflict.id}-${Date.now()}`,
            type: 'conflict',
            title: 'Schedule Conflict Detected',
            message: conflict.description,
            severity: conflict.severity,
            relatedEntities: [
              { type: 'schedule', id: data.id },
              ...(conflict.conflictingSchedules || []).map(id => ({ type: 'schedule', id }))
            ],
            timestamp: Date.now(),
            read: false
          };
          
          await this.publish('notification', notification, updateId, path);
          
          // Also create an opportunity
          const opportunity = {
            id: `opportunity-${conflict.id}-${Date.now()}`,
            type: 'conflict_resolution',
            title: 'Resolve Schedule Conflict',
            description: conflict.description,
            priority: conflict.severity === 'high' ? 'high' : 'medium',
            schedules: [data.id, ...(conflict.conflictingSchedules || [])],
            timestamp: Date.now(),
            status: 'pending'
          };
          
          await this.publish('opportunity', opportunity, updateId, path);
        }
      }
    } catch (error) {
      console.error(`Error handling schedule update cascading:`, error);
    }
  }

  /**
   * Handle a client update
   * @param {Object} data - The client data
   * @param {string} source - The source of the update
   * @param {Array} path - The path the update has taken
   * @returns {Promise<void>}
   */
  async handleClientUpdate(data, source, path) {
    // Create a unique ID for this cascading update
    const updateId = `client-${data.id}-${Date.now()}`;
    
    try {
      // Get client's schedules
      const schedules = await window.electronAPI.getSchedulesByClient(data.id);
      
      if (schedules && schedules.length > 0) {
        // Update each schedule with the latest client information
        for (const schedule of schedules) {
          const scheduleUpdate = {
            ...schedule,
            client_name: data.name,
            client_updated: true,
            lastUpdated: Date.now()
          };
          
          await this.publish('schedule', scheduleUpdate, updateId, path);
        }
      }
      
      // If client preferences changed, check for optimization opportunities
      if (data.preferencesUpdated) {
        const opportunity = {
          id: `opportunity-prefs-${data.id}-${Date.now()}`,
          type: 'preference_match',
          title: 'Client Preferences Updated',
          description: `${data.name}'s preferences have changed. Review caregiver assignments for better matches.`,
          priority: 'medium',
          client: data.id,
          timestamp: Date.now(),
          status: 'pending'
        };
        
        await this.publish('opportunity', opportunity, updateId, path);
      }
    } catch (error) {
      console.error(`Error handling client update cascading:`, error);
    }
  }

  /**
   * Handle a caregiver update
   * @param {Object} data - The caregiver data
   * @param {string} source - The source of the update
   * @param {Array} path - The path the update has taken
   * @returns {Promise<void>}
   */
  async handleCaregiverUpdate(data, source, path) {
    // Create a unique ID for this cascading update
    const updateId = `caregiver-${data.id}-${Date.now()}`;
    
    try {
      // Get caregiver's schedules
      const schedules = await window.electronAPI.getSchedulesByCaregiver(data.id);
      
      if (schedules && schedules.length > 0) {
        // Update each schedule with the latest caregiver information
        for (const schedule of schedules) {
          const scheduleUpdate = {
            ...schedule,
            caregiver_name: data.name,
            caregiver_updated: true,
            lastUpdated: Date.now()
          };
          
          await this.publish('schedule', scheduleUpdate, updateId, path);
        }
      }
      
      // If availability changed, check for optimization opportunities
      if (data.availabilityUpdated) {
        const opportunity = {
          id: `opportunity-avail-${data.id}-${Date.now()}`,
          type: 'availability_change',
          title: 'Caregiver Availability Updated',
          description: `${data.name}'s availability has changed. Review schedule assignments.`,
          priority: 'high',
          caregiver: data.id,
          timestamp: Date.now(),
          status: 'pending'
        };
        
        await this.publish('opportunity', opportunity, updateId, path);
      }
      
      // If skills changed, check for better assignment opportunities
      if (data.skillsUpdated) {
        const opportunity = {
          id: `opportunity-skills-${data.id}-${Date.now()}`,
          type: 'skill_match',
          title: 'Caregiver Skills Updated',
          description: `${data.name}'s skills have been updated. Review client assignments for better matches.`,
          priority: 'medium',
          caregiver: data.id,
          timestamp: Date.now(),
          status: 'pending'
        };
        
        await this.publish('opportunity', opportunity, updateId, path);
      }
    } catch (error) {
      console.error(`Error handling caregiver update cascading:`, error);
    }
  }

  /**
   * Handle an opportunity update
   * @param {Object} data - The opportunity data
   * @param {string} source - The source of the update
   * @param {Array} path - The path the update has taken
   * @returns {Promise<void>}
   */
  async handleOpportunityUpdate(data, source, path) {
    // Create a unique ID for this cascading update
    const updateId = `opportunity-${data.id}-${Date.now()}`;
    
    try {
      // Create a notification for the opportunity
      const notification = {
        id: `notif-opp-${data.id}-${Date.now()}`,
        type: 'opportunity',
        title: data.title,
        message: data.description,
        severity: data.priority,
        relatedEntities: [
          { type: 'opportunity', id: data.id },
          ...(data.schedules || []).map(id => ({ type: 'schedule', id })),
          ...(data.client ? [{ type: 'client', id: data.client }] : []),
          ...(data.caregiver ? [{ type: 'caregiver', id: data.caregiver }] : [])
        ],
        timestamp: Date.now(),
        read: false,
        actions: [
          { type: 'accept_opportunity', label: 'Accept', opportunityId: data.id },
          { type: 'reject_opportunity', label: 'Reject', opportunityId: data.id }
        ]
      };
      
      await this.publish('notification', notification, updateId, path);
      
      // If the opportunity status changed, update related entities
      if (data.status === 'accepted' || data.status === 'rejected') {
        // Update the notification to mark it as resolved
        const notificationUpdate = {
          id: notification.id,
          resolved: true,
          resolution: data.status,
          resolutionTimestamp: Date.now()
        };
        
        await this.publish('notification', notificationUpdate, updateId, path);
        
        // If accepted, update any related schedules
        if (data.status === 'accepted' && data.schedules && data.schedules.length > 0) {
          for (const scheduleId of data.schedules) {
            const schedule = await window.electronAPI.getSchedule(scheduleId);
            if (schedule) {
              const scheduleUpdate = {
                ...schedule,
                optimized: true,
                optimizationApplied: data.type,
                lastUpdated: Date.now()
              };
              
              await this.publish('schedule', scheduleUpdate, updateId, path);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error handling opportunity update cascading:`, error);
    }
  }

  /**
   * Handle an agent update
   * @param {Object} data - The agent data
   * @param {string} source - The source of the update
   * @param {Array} path - The path the update has taken
   * @returns {Promise<void>}
   */
  async handleAgentUpdate(data, source, path) {
    // Create a unique ID for this cascading update
    const updateId = `agent-${data.id || data.name}-${Date.now()}`;
    
    try {
      // If the agent performed an action, update related entities
      if (data.action) {
        switch (data.action.type) {
          case 'schedule_create':
          case 'schedule_update':
            if (data.action.schedule) {
              await this.publish('schedule', data.action.schedule, updateId, path);
            }
            break;
            
          case 'opportunity_create':
            if (data.action.opportunity) {
              await this.publish('opportunity', data.action.opportunity, updateId, path);
            }
            break;
            
          case 'notification_create':
            if (data.action.notification) {
              await this.publish('notification', data.action.notification, updateId, path);
            }
            break;
            
          case 'opportunity_scan':
            // Handle opportunity scan results
            if (data.action.opportunities && Array.isArray(data.action.opportunities)) {
              for (const opportunity of data.action.opportunities) {
                await this.publish('opportunity', opportunity, updateId, path);
              }
              
              // Also publish a notification about the scan results
              const scanNotification = {
                id: `notif-scan-${Date.now()}`,
                type: 'system',
                title: 'Opportunity Scan Complete',
                message: `Found ${data.action.opportunities.length} opportunities.`,
                priority: 'medium',
                timestamp: Date.now(),
                read: false,
                data: {
                  scanId: data.action.scanId,
                  opportunityCount: data.action.opportunities.length,
                  scanTimestamp: data.action.timestamp || Date.now()
                }
              };
              
              await this.publish('notification', scanNotification, updateId, path);
            }
            break;
            
          case 'agent_insight':
            // Handle AI insights from agent
            if (data.action.insight) {
              const insightNotification = {
                id: `notif-insight-${Date.now()}`,
                type: 'agent',
                title: `Insight from ${data.name || 'Agent'}`,
                message: data.action.insight.message,
                priority: data.action.insight.priority || 'medium',
                timestamp: Date.now(),
                read: false,
                data: {
                  agentName: data.name,
                  insightType: data.action.insight.type,
                  insightData: data.action.insight.data
                }
              };
              
              await this.publish('notification', insightNotification, updateId, path);
            }
            break;
        }
      }
      
      // Handle agent message responses (from Groq/LLM)
      if (data.response && data.userId) {
        // Create a notification for important agent responses
        if (data.response.important) {
          const responseNotification = {
            id: `notif-response-${Date.now()}`,
            type: 'agent',
            title: `Message from ${data.name || 'Agent'}`,
            message: data.response.summary || data.response.text.substring(0, 100) + '...',
            priority: data.response.priority || 'medium',
            timestamp: Date.now(),
            read: false,
            data: {
              agentName: data.name,
              userId: data.userId,
              fullResponse: data.response.text
            },
            actions: [
              { type: 'open_chat', label: 'View in Chat', agentName: data.name }
            ]
          };
          
          await this.publish('notification', responseNotification, updateId, path);
        }
      }
    } catch (error) {
      console.error(`Error handling agent update cascading:`, error);
    }
  }

  /**
   * Check if an update is circular
   * @param {Array} path - The path the update has taken
   * @returns {boolean} Whether the update is circular
   */
  isCircularUpdate(path) {
    if (path.length < 2) {
      return false;
    }
    
    // Check if this update has gone through too many steps
    if (path.length > this.maxCircularPathLength) {
      return true;
    }
    
    // Check for repeating patterns (same entity updated multiple times)
    const entities = path.map(p => `${p.type}-${p.source}`);
    const uniqueEntities = new Set(entities);
    
    // If the number of unique entities is significantly less than the path length,
    // it might be a circular update
    if (uniqueEntities.size < path.length / 2) {
      return true;
    }
    
    // Check for specific repeating patterns
    for (let i = 0; i < entities.length - 1; i++) {
      const pattern = [entities[i], entities[i + 1]];
      let patternCount = 0;
      
      for (let j = 0; j < entities.length - 1; j++) {
        if (entities[j] === pattern[0] && entities[j + 1] === pattern[1]) {
          patternCount++;
        }
      }
      
      // If a pattern repeats more than twice, it's likely circular
      if (patternCount > 2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Simulate an update for testing
   * @param {string} type - The entity type
   * @param {Object} data - The update data
   * @returns {Promise<void>}
   */
  async simulateUpdate(type, data) {
    console.log(`Simulating ${type} update:`, data);
    await this.publish(type, data, 'simulation');
  }

  /**
   * Clean up the service
   */
  cleanup() {
    // Clear the processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Clear all subscribers
    Object.keys(this.subscribers).forEach(type => {
      this.subscribers[type].clear();
    });
    
    // Clear the update queue
    this.updateQueue = [];
    
    // Clear circular path tracking
    this.circularPaths.clear();
    
    console.log('Real-time updates service cleaned up');
  }
}

// Create and export a singleton instance
const realTimeUpdatesService = new RealTimeUpdatesService();
module.exports = realTimeUpdatesService;

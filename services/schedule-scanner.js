/**
 * Schedule Scanner Service
 * Periodically scans for scheduling opportunities and triggers agent actions
 * Implements the awareness capabilities described in the agentic capability requirements
 */

const agentManager = require('../agents/core/agent-manager');
const notificationService = require('./notification-service');
const { firebaseService } = require('./firebase');

class ScheduleScanner {
  constructor() {
    this.scanInterval = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.scanTimer = null;
    this.isScanning = false;
    this.lastScanTime = null;
    this.scanHistory = [];
  }

  /**
   * Start the schedule scanner with periodic scanning
   * @param {number} intervalMinutes - Optional custom interval in minutes
   */
  start(intervalMinutes) {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }

    if (intervalMinutes) {
      this.scanInterval = intervalMinutes * 60 * 1000;
    }

    console.log(`Starting schedule scanner with interval: ${this.scanInterval / 60 / 1000} minutes`);

    // Perform an initial scan
    this.scan();

    // Set up the periodic scanning
    this.scanTimer = setInterval(() => {
      this.scan();
    }, this.scanInterval);

    return true;
  }

  /**
   * Stop the schedule scanner
   */
  stop() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
      console.log('Schedule scanner stopped');
      return true;
    }
    return false;
  }

  /**
   * Scan for scheduling opportunities
   * @param {Object} options - Optional scan options
   * @returns {Promise<Array>} The discovered opportunities
   */
  async scan(options = {}) {
    // Prevent concurrent scans
    if (this.isScanning) {
      console.log('Scan already in progress, skipping');
      return [];
    }

    this.isScanning = true;
    console.log('Starting schedule scan...');

    try {
      // Define the date range to scan (default: 2 weeks from now)
      const startDate = options.startDate || new Date().toISOString().split('T')[0];
      const endDate = options.endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`Scanning schedules from ${startDate} to ${endDate}`);

      // Get all schedules in the date range
      const schedules = await firebaseService.getSchedulesInDateRange(startDate, endDate);
      
      if (!schedules || schedules.length === 0) {
        console.log('No schedules found in the date range');
        this.isScanning = false;
        this.lastScanTime = new Date();
        return [];
      }

      console.log(`Found ${schedules.length} schedules in the date range`);

      // Collect all clients and caregivers involved
      const clientIds = [...new Set(schedules.map(s => s.client_id))];
      const caregiverIds = [...new Set(schedules.map(s => s.caregiver_id).filter(Boolean))];

      // Get client and caregiver details
      const clients = await Promise.all(clientIds.map(id => firebaseService.getClient(id)));
      const caregivers = await Promise.all(caregiverIds.map(id => firebaseService.getCaregiver(id)));

      // Check for unassigned schedules
      const unassignedSchedules = schedules.filter(s => !s.caregiver_id || s.status === 'unassigned');
      
      console.log(`Found ${unassignedSchedules.length} unassigned schedules`);

      // Use the agent manager to scan for opportunities
      const opportunities = await agentManager.scanForOpportunities();

      // Create notifications for the discovered opportunities
      for (const opportunity of opportunities) {
        await this.createOpportunityNotification(opportunity);
      }

      // Store scan history
      this.scanHistory.push({
        timestamp: new Date().toISOString(),
        schedulesScanned: schedules.length,
        opportunitiesFound: opportunities.length,
        dateRange: { startDate, endDate }
      });

      // Limit history length
      if (this.scanHistory.length > 100) {
        this.scanHistory = this.scanHistory.slice(-100);
      }

      this.lastScanTime = new Date();
      this.isScanning = false;
      
      return opportunities;
    } catch (error) {
      console.error('Error during schedule scan:', error);
      this.isScanning = false;
      throw error;
    }
  }

  /**
   * Force an immediate scan
   * @param {Object} options - Optional scan options
   * @returns {Promise<Array>} The discovered opportunities
   */
  async forceScan(options = {}) {
    // Reset the scan timer to ensure the next automatic scan happens at the correct interval
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = setInterval(() => {
        this.scan();
      }, this.scanInterval);
    }

    return await this.scan(options);
  }

  /**
   * Create a notification for an opportunity
   * @param {Object} opportunity - The opportunity data
   * @returns {Promise<Object>} The created notification
   */
  async createOpportunityNotification(opportunity) {
    const notification = {
      type: 'opportunity',
      title: this.getOpportunityTitle(opportunity),
      message: this.getOpportunityMessage(opportunity),
      priority: opportunity.priority || 'medium',
      data: {
        opportunityId: opportunity.id,
        opportunityType: opportunity.type,
        scheduleId: opportunity.schedule_id,
        clientId: opportunity.client_id,
        dateTime: new Date().toISOString()
      },
      read: false,
      timestamp: new Date().toISOString()
    };

    return await notificationService.createNotification(notification);
  }

  /**
   * Get a title for an opportunity notification
   * @param {Object} opportunity - The opportunity data
   * @returns {string} The notification title
   */
  getOpportunityTitle(opportunity) {
    switch (opportunity.type) {
      case 'caregiver_assignment':
        return `Caregiver Match Found for ${opportunity.client_name}`;
      case 'schedule_optimization':
        return 'Schedule Optimization Opportunity';
      case 'conflict_resolution':
        return 'Schedule Conflict Detected';
      default:
        return 'New Scheduling Opportunity';
    }
  }

  /**
   * Get a message for an opportunity notification
   * @param {Object} opportunity - The opportunity data
   * @returns {string} The notification message
   */
  getOpportunityMessage(opportunity) {
    switch (opportunity.type) {
      case 'caregiver_assignment':
        const topCandidate = opportunity.candidates[0];
        return `Found ${opportunity.candidates.length} potential caregivers for ${opportunity.client_name}'s schedule on ${opportunity.date}. Top match: ${topCandidate.caregiver_name} (${topCandidate.score}% match)`;
      
      case 'schedule_optimization':
        return `Potential optimization found for schedules on ${opportunity.date}. Could save approximately ${opportunity.potential_savings} minutes of travel time.`;
      
      case 'conflict_resolution':
        return `Scheduling conflict detected for ${opportunity.caregiver_name} on ${opportunity.date}. Action required.`;
      
      default:
        return `New opportunity discovered at ${new Date().toLocaleString()}`;
    }
  }

  /**
   * Get the scan history
   * @param {number} limit - Optional limit on the number of history items to return
   * @returns {Array} The scan history
   */
  getScanHistory(limit) {
    if (limit && limit > 0) {
      return this.scanHistory.slice(-limit);
    }
    return this.scanHistory;
  }

  /**
   * Get the scanner status
   * @returns {Object} The scanner status
   */
  getStatus() {
    return {
      active: !!this.scanTimer,
      interval: this.scanInterval / 60 / 1000, // In minutes
      isScanning: this.isScanning,
      lastScanTime: this.lastScanTime,
      totalScans: this.scanHistory.length,
      opportunitiesFound: this.scanHistory.reduce((total, scan) => total + scan.opportunitiesFound, 0)
    };
  }
}

module.exports = new ScheduleScanner();

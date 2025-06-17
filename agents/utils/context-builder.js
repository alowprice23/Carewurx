/**
 * Context Builder
 * Builds rich context for agent responses from various data sources
 * A key component in the circular integration model (C=2πr)
 */

const { firebaseService } = require('../../services/firebase');

class ContextBuilder {
  constructor() {
    this.contextCache = new Map();
    this.cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Build context for an agent response
   * This is a central part of the circular integration model, gathering data from many sources
   * @param {string} userId - The user's ID
   * @param {string} message - The user's message
   * @param {string} agentName - The agent name
   * @param {Object} conversation - The conversation object
   * @returns {Promise<Object>} The context object
   */
  async buildContext(userId, message, agentName, conversation) {
    console.log(`Building context for ${agentName} response to user ${userId}`);
    
    try {
      // Start with basic context
      const context = {
        userId,
        userRole: await this.getUserRole(userId),
        timestamp: new Date().toISOString(),
        messageIntent: this.detectIntent(message)
      };
      
      // Add agent-specific context
      if (agentName === 'lexxi') {
        // Lexxi focuses on scheduling, so add schedule-related context
        Object.assign(context, await this.buildSchedulingContext(userId, message));
      } else if (agentName === 'bruce') {
        // Bruce is general-purpose, so add broader context
        Object.assign(context, await this.buildGeneralContext(userId, message));
      }
      
      // Add conversation context
      context.recentTopics = this.extractRecentTopics(conversation.history);
      
      // Extract entities from message and add related data
      const entities = this.extractEntities(message);
      if (entities.length > 0) {
        context.entities = entities;
        
        // Fetch additional data for each entity
        await Promise.all(entities.map(async (entity) => {
          switch (entity.type) {
            case 'client':
              entity.data = await this.fetchClientData(entity.id || entity.name);
              break;
            case 'caregiver':
              entity.data = await this.fetchCaregiverData(entity.id || entity.name);
              break;
            case 'schedule':
              entity.data = await this.fetchScheduleData(entity.id || entity.date);
              break;
          }
        }));
      }
      
      return context;
    } catch (error) {
      console.error('Error building context:', error);
      // Return minimal context if there was an error
      return {
        userId,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Build scheduling-specific context
   * @param {string} userId - The user's ID
   * @param {string} message - The user's message
   * @returns {Promise<Object>} The scheduling context
   */
  async buildSchedulingContext(userId, message) {
    const cacheKey = `scheduling:${userId}:${new Date().toDateString()}`;
    
    // Check cache first
    if (this.contextCache.has(cacheKey)) {
      const cachedContext = this.contextCache.get(cacheKey);
      if (Date.now() - cachedContext.timestamp < this.cacheExpiryMs) {
        return cachedContext.data;
      }
    }
    
    try {
      // Extract date references from message
      const dateRefs = this.extractDateReferences(message);
      const dateRange = this.calculateDateRange(dateRefs);
      
      // Fetch schedules for date range
      let schedules = [];
      if (dateRange.startDate && dateRange.endDate) {
        schedules = await firebaseService.getSchedulesInDateRange(dateRange.startDate, dateRange.endDate);
      } else {
        // Default to current and next week if no dates mentioned
        const today = new Date();
        const twoWeeksLater = new Date(today);
        twoWeeksLater.setDate(today.getDate() + 14);
        
        schedules = await firebaseService.getSchedulesInDateRange(
          today.toISOString().split('T')[0],
          twoWeeksLater.toISOString().split('T')[0]
        );
      }
      
      // Get caregiver information
      const caregiverIds = [...new Set(schedules.map(s => s.caregiver_id).filter(Boolean))];
      const caregivers = await Promise.all(
        caregiverIds.map(id => firebaseService.getCaregiver(id))
      );
      
      // Get client information
      const clientIds = [...new Set(schedules.map(s => s.client_id).filter(Boolean))];
      const clients = await Promise.all(
        clientIds.map(id => firebaseService.getClient(id))
      );
      
      // Get optimization opportunities
      const opportunities = await firebaseService.getOpportunities({ status: 'pending' });
      
      // Build caregiver availability map
      const caregiverAvailability = {};
      for (const caregiver of caregivers) {
        if (caregiver && caregiver.id) {
          caregiverAvailability[caregiver.id] = await firebaseService.getCaregiverAvailability(caregiver.id);
        }
      }
      
      // Create the context
      const context = {
        schedules,
        caregivers: caregivers.filter(Boolean), // Remove any null values
        clients: clients.filter(Boolean),
        opportunities,
        dateRange,
        caregiverAvailability
      };
      
      // Cache the result
      this.contextCache.set(cacheKey, {
        timestamp: Date.now(),
        data: context
      });
      
      return context;
    } catch (error) {
      console.error('Error building scheduling context:', error);
      return {
        schedules: [],
        caregivers: [],
        clients: [],
        opportunities: [],
        error: error.message
      };
    }
  }

  /**
   * Build general context for Bruce
   * @param {string} userId - The user's ID
   * @param {string} message - The user's message
   * @returns {Promise<Object>} The general context
   */
  async buildGeneralContext(userId, message) {
    const cacheKey = `general:${userId}:${new Date().toDateString()}`;
    
    // Check cache first
    if (this.contextCache.has(cacheKey)) {
      const cachedContext = this.contextCache.get(cacheKey);
      if (Date.now() - cachedContext.timestamp < this.cacheExpiryMs) {
        return cachedContext.data;
      }
    }
    
    try {
      // Get recent schedules
      const today = new Date();
      const weekLater = new Date(today);
      weekLater.setDate(today.getDate() + 7);
      
      const schedules = await firebaseService.getSchedulesInDateRange(
        today.toISOString().split('T')[0],
        weekLater.toISOString().split('T')[0]
      );
      
      // Get unassigned schedules
      const unassignedSchedules = schedules.filter(s => !s.caregiver_id);
      
      // Get high-priority notifications
      const notifications = await firebaseService.getNotifications({ 
        priority: 'high',
        read: false,
        limit: 5
      });
      
      // Get user information
      const userInfo = await firebaseService.getUserInfo(userId);
      
      // Create the context
      const context = {
        recentSchedules: schedules.slice(0, 10),
        unassignedSchedules,
        notifications,
        userInfo
      };
      
      // Cache the result
      this.contextCache.set(cacheKey, {
        timestamp: Date.now(),
        data: context
      });
      
      return context;
    } catch (error) {
      console.error('Error building general context:', error);
      return {
        recentSchedules: [],
        unassignedSchedules: [],
        notifications: [],
        error: error.message
      };
    }
  }

  /**
   * Get the role of a user
   * @param {string} userId - The user's ID
   * @returns {Promise<string>} The user's role
   */
  async getUserRole(userId) {
    try {
      const userInfo = await firebaseService.getUserInfo(userId);
      return userInfo?.role || 'user';
    } catch (error) {
      console.error('Error getting user role:', error);
      return 'user';
    }
  }

  /**
   * Detect the intent of a message
   * @param {string} message - The message to analyze
   * @returns {string} The detected intent
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('schedule') && 
       (lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new'))) {
      return 'create_schedule';
    }
    
    if (lowerMessage.includes('schedule') && 
       (lowerMessage.includes('update') || lowerMessage.includes('change') || lowerMessage.includes('modify'))) {
      return 'update_schedule';
    }
    
    if (lowerMessage.includes('assign') || 
        (lowerMessage.includes('caregiver') && lowerMessage.includes('schedule'))) {
      return 'assign_caregiver';
    }
    
    if (lowerMessage.includes('optimize') || lowerMessage.includes('efficiency') || lowerMessage.includes('improve')) {
      return 'optimize_schedule';
    }
    
    if (lowerMessage.includes('conflict') || lowerMessage.includes('overlap') || lowerMessage.includes('clash')) {
      return 'resolve_conflict';
    }
    
    if (lowerMessage.includes('show') || lowerMessage.includes('view') || lowerMessage.includes('list') || lowerMessage.includes('get')) {
      if (lowerMessage.includes('schedule')) {
        return 'view_schedule';
      }
      if (lowerMessage.includes('client')) {
        return 'view_client';
      }
      if (lowerMessage.includes('caregiver')) {
        return 'view_caregiver';
      }
    }
    
    return 'general_query';
  }

  /**
   * Extract entities from a message
   * @param {string} message - The message to analyze
   * @returns {Array<Object>} The extracted entities
   */
  extractEntities(message) {
    const entities = [];
    const lowerMessage = message.toLowerCase();
    
    // Extract client references
    const clientRegex = /client(?:\s+named)?\s+([a-z\s]+)|\b([a-z\s]+)\s+client\b/gi;
    let clientMatch;
    while ((clientMatch = clientRegex.exec(message)) !== null) {
      const name = (clientMatch[1] || clientMatch[2]).trim();
      entities.push({
        type: 'client',
        name: name,
        index: clientMatch.index
      });
    }
    
    // Extract caregiver references
    const caregiverRegex = /caregiver(?:\s+named)?\s+([a-z\s]+)|\b([a-z\s]+)\s+caregiver\b/gi;
    let caregiverMatch;
    while ((caregiverMatch = caregiverRegex.exec(message)) !== null) {
      const name = (caregiverMatch[1] || caregiverMatch[2]).trim();
      entities.push({
        type: 'caregiver',
        name: name,
        index: caregiverMatch.index
      });
    }
    
    // Extract schedule IDs
    const scheduleIdRegex = /schedule\s+(?:id\s+)?([a-z0-9-]+)/gi;
    let scheduleIdMatch;
    while ((scheduleIdMatch = scheduleIdRegex.exec(message)) !== null) {
      entities.push({
        type: 'schedule',
        id: scheduleIdMatch[1].trim(),
        index: scheduleIdMatch.index
      });
    }
    
    // Extract dates (simple regex, could be enhanced)
    const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
    let dateMatch;
    while ((dateMatch = dateRegex.exec(message)) !== null) {
      const month = parseInt(dateMatch[1], 10);
      const day = parseInt(dateMatch[2], 10);
      let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear();
      
      // Adjust 2-digit years
      if (year < 100) {
        year += 2000;
      }
      
      entities.push({
        type: 'date',
        value: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        index: dateMatch.index
      });
    }
    
    // Also look for named dates
    const today = new Date();
    
    if (lowerMessage.includes('today')) {
      entities.push({
        type: 'date',
        value: today.toISOString().split('T')[0],
        index: lowerMessage.indexOf('today')
      });
    }
    
    if (lowerMessage.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      entities.push({
        type: 'date',
        value: tomorrow.toISOString().split('T')[0],
        index: lowerMessage.indexOf('tomorrow')
      });
    }
    
    if (lowerMessage.includes('next week')) {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      entities.push({
        type: 'date',
        value: nextWeek.toISOString().split('T')[0],
        index: lowerMessage.indexOf('next week')
      });
    }
    
    return entities;
  }

  /**
   * Extract date references from a message
   * @param {string} message - The message to analyze
   * @returns {Array<Object>} The extracted dates
   */
  extractDateReferences(message) {
    const dateRefs = [];
    const lowerMessage = message.toLowerCase();
    
    // Named date ranges
    if (lowerMessage.includes('this week')) {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // End of current week (Saturday)
      
      dateRefs.push({
        type: 'range',
        start: startOfWeek,
        end: endOfWeek,
        text: 'this week'
      });
    }
    
    if (lowerMessage.includes('next week')) {
      const today = new Date();
      const startOfNextWeek = new Date(today);
      startOfNextWeek.setDate(today.getDate() - today.getDay() + 7); // Start of next week (Sunday)
      const endOfNextWeek = new Date(startOfNextWeek);
      endOfNextWeek.setDate(startOfNextWeek.getDate() + 6); // End of next week (Saturday)
      
      dateRefs.push({
        type: 'range',
        start: startOfNextWeek,
        end: endOfNextWeek,
        text: 'next week'
      });
    }
    
    if (lowerMessage.includes('this month')) {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      dateRefs.push({
        type: 'range',
        start: startOfMonth,
        end: endOfMonth,
        text: 'this month'
      });
    }
    
    if (lowerMessage.includes('next month')) {
      const today = new Date();
      const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      
      dateRefs.push({
        type: 'range',
        start: startOfNextMonth,
        end: endOfNextMonth,
        text: 'next month'
      });
    }
    
    // Specific dates
    const today = new Date();
    
    if (lowerMessage.includes('today')) {
      dateRefs.push({
        type: 'specific',
        date: today,
        text: 'today'
      });
    }
    
    if (lowerMessage.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      dateRefs.push({
        type: 'specific',
        date: tomorrow,
        text: 'tomorrow'
      });
    }
    
    if (lowerMessage.includes('day after tomorrow')) {
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(today.getDate() + 2);
      dateRefs.push({
        type: 'specific',
        date: dayAfterTomorrow,
        text: 'day after tomorrow'
      });
    }
    
    return dateRefs;
  }

  /**
   * Calculate a date range from date references
   * @param {Array<Object>} dateRefs - The date references
   * @returns {Object} The date range with startDate and endDate strings (YYYY-MM-DD)
   */
  calculateDateRange(dateRefs) {
    if (dateRefs.length === 0) {
      return {}; // No dates mentioned
    }
    
    let earliestDate = null;
    let latestDate = null;
    
    dateRefs.forEach(ref => {
      if (ref.type === 'range') {
        if (!earliestDate || ref.start < earliestDate) {
          earliestDate = ref.start;
        }
        if (!latestDate || ref.end > latestDate) {
          latestDate = ref.end;
        }
      } else if (ref.type === 'specific') {
        if (!earliestDate || ref.date < earliestDate) {
          earliestDate = ref.date;
        }
        if (!latestDate || ref.date > latestDate) {
          latestDate = ref.date;
        }
      }
    });
    
    // If only one specific date was mentioned, set both to the same date
    if (earliestDate && latestDate && earliestDate === latestDate) {
      return {
        startDate: earliestDate.toISOString().split('T')[0],
        endDate: earliestDate.toISOString().split('T')[0]
      };
    }
    
    // Otherwise, return the range
    return {
      startDate: earliestDate ? earliestDate.toISOString().split('T')[0] : null,
      endDate: latestDate ? latestDate.toISOString().split('T')[0] : null
    };
  }

  /**
   * Extract recent topics from conversation history
   * @param {Array} history - The conversation history
   * @returns {Array<string>} The recent topics
   */
  extractRecentTopics(history) {
    if (!history || history.length === 0) {
      return [];
    }
    
    const recentMessages = history.slice(-10); // Get last 10 messages
    const topics = new Set();
    
    // Simple keyword-based topic extraction
    const topicKeywords = {
      'schedule': 'scheduling',
      'appointment': 'scheduling',
      'caregiver': 'caregivers',
      'assign': 'assignments',
      'client': 'clients',
      'optimize': 'optimization',
      'efficiency': 'optimization',
      'conflict': 'conflicts',
      'availability': 'availability'
    };
    
    recentMessages.forEach(msg => {
      if (!msg.text) return;
      
      const lowerText = msg.text.toLowerCase();
      
      Object.entries(topicKeywords).forEach(([keyword, topic]) => {
        if (lowerText.includes(keyword)) {
          topics.add(topic);
        }
      });
    });
    
    return Array.from(topics);
  }

  /**
   * Fetch client data by ID or name
   * @param {string} idOrName - The client ID or name
   * @returns {Promise<Object>} The client data
   */
  async fetchClientData(idOrName) {
    try {
      // Try to fetch by ID first
      let client = await firebaseService.getClient(idOrName);
      
      // If not found and it doesn't look like an ID, try to search by name
      if (!client && !idOrName.match(/^[A-Za-z0-9-]+$/)) {
        const clients = await firebaseService.searchClients(idOrName);
        if (clients && clients.length > 0) {
          client = clients[0];
        }
      }
      
      return client || { error: 'Client not found' };
    } catch (error) {
      console.error('Error fetching client data:', error);
      return { error: error.message };
    }
  }

  /**
   * Fetch caregiver data by ID or name
   * @param {string} idOrName - The caregiver ID or name
   * @returns {Promise<Object>} The caregiver data
   */
  async fetchCaregiverData(idOrName) {
    try {
      // Try to fetch by ID first
      let caregiver = await firebaseService.getCaregiver(idOrName);
      
      // If not found and it doesn't look like an ID, try to search by name
      if (!caregiver && !idOrName.match(/^[A-Za-z0-9-]+$/)) {
        const caregivers = await firebaseService.searchCaregivers(idOrName);
        if (caregivers && caregivers.length > 0) {
          caregiver = caregivers[0];
        }
      }
      
      // If found, also fetch availability
      if (caregiver && caregiver.id) {
        caregiver.availability = await firebaseService.getCaregiverAvailability(caregiver.id);
      }
      
      return caregiver || { error: 'Caregiver not found' };
    } catch (error) {
      console.error('Error fetching caregiver data:', error);
      return { error: error.message };
    }
  }

  /**
   * Fetch schedule data by ID or date
   * @param {string} idOrDate - The schedule ID or date
   * @returns {Promise<Object|Array>} The schedule data
   */
  async fetchScheduleData(idOrDate) {
    try {
      // Check if it's a date format (YYYY-MM-DD)
      if (idOrDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return await firebaseService.getSchedulesByDate(idOrDate);
      }
      
      // Otherwise, treat as ID
      const schedule = await firebaseService.getSchedule(idOrDate);
      
      return schedule || { error: 'Schedule not found' };
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      return { error: error.message };
    }
  }

  /**
   * Clear the context cache
   */
  clearCache() {
    this.contextCache.clear();
    console.log('Context cache cleared');
  }
}

module.exports = ContextBuilder;

/**
 * Agent Manager
 * Coordinates between different agent models and implements the circular integration model (C=2πr)
 */

const LLMService = require('./llm-service');
const Bruce = require('../models/bruce');
const Lexxi = require('../models/lexxi');
const ContextBuilder = require('../utils/context-builder');
const ResponseParser = require('../utils/response-parser');
const fs = require('fs');
const path = require('path');
const enhancedScheduler = require('../../services/enhanced-scheduler');
const { firebaseService } = require('../../services/firebase');

class AgentManager {
  constructor() {
    this.llmService = null;
    this.agents = {};
    this.defaultAgent = 'bruce';
    this.isInitialized = false;
    this.conversations = new Map();
    this.contextBuilder = null;
    this.responseParser = null;
    
    // Circular integration tracking (to prevent infinite loops)
    this.circularReferences = new Map();
    this.maxCircularDepth = 3;

    // For tracking agent-initiated long-running tasks like optimization
    this.activeOptimizationTasks = new Map();
  }

  /**
   * Analyzes unmet shifts and caregiver data to identify potential shortages.
   * This is a simplified initial version.
   *
   * @param {Array<Object>} unmetShifts - Array of shift objects that could not be filled.
   *   Each shift: { clientId, clientName, date, startTime, endTime, requiredSkills, location }
   * @param {Array<Object>} allCaregivers - Array of all caregiver profiles (with skills, availability etc.)
   * @returns {Promise<Array<Object>>} - An array of shortage alert opportunity objects.
   */
  async identifyAndReportShortages(unmetShifts, allCaregivers) {
    if (!unmetShifts || unmetShifts.length === 0) {
      return []; // No unmet shifts, no shortages to report from this batch.
    }

    console.log(`Identifying shortages from ${unmetShifts.length} unmet shifts.`);
    const shortageAlerts = [];

    // Example: Group unmet shifts by date and required skills to identify patterns
    const unmetByDateAndSkills = {};

    for (const shift of unmetShifts) {
      const key = `${shift.date}_${(shift.requiredSkills || []).sort().join('-') || 'any-skill'}`;
      if (!unmetByDateAndSkills[key]) {
        unmetByDateAndSkills[key] = {
          date: shift.date,
          requiredSkills: shift.requiredSkills || [],
          count: 0,
          shifts: []
        };
      }
      unmetByDateAndSkills[key].count++;
      unmetByDateAndSkills[key].shifts.push({
        clientId: shift.clientId,
        clientName: shift.clientName,
        startTime: shift.startTime,
        endTime: shift.endTime,
        location: shift.location // Assuming location might have region/zip
      });
    }

    for (const key in unmetByDateAndSkills) {
      const group = unmetByDateAndSkills[key];
      // Here, more sophisticated analysis could be done:
      // - Check if any *available* caregivers (not maxed out) had the skills but not the time.
      // - Check if caregivers with skills were maxed out.
      // - Aggregate by region if location data allows.

      const summaryMessage = `Potential shortage of ${group.count} shift(s) on ${group.date} requiring skills: ${group.requiredSkills.join(', ') || 'general care'}. Affected clients include ${group.shifts.slice(0,2).map(s=>s.clientName).join(', ')}.`;

      const shortageOpportunity = {
        id: `opp-shortage-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'caregiver_shortage_alert',
        date: group.date, // Date of the shortage
        required_skills: group.requiredSkills,
        number_of_shifts_affected: group.count,
        affected_clients_sample: group.shifts.slice(0, 3).map(s => ({clientName: s.clientName, time: `${s.startTime}-${s.endTime}` })),
        // TODO: Add region/location if available and aggregated
        summary: summaryMessage,
        details: `On ${group.date}, ${group.count} shifts requiring skills '${group.requiredSkills.join(', ') || 'general care'}' could not be filled. Further analysis needed to pinpoint exact cause (e.g., lack of available time slots from skilled caregivers, or absolute lack of skilled caregivers).`,
        created_at: new Date().toISOString(),
        status: 'pending_review', // Or 'active_alert'
        priority: group.count > 2 ? 'high' : 'medium', // Example priority
      };

      shortageAlerts.push(shortageOpportunity);
      await firebaseService.addDocument('opportunities', shortageOpportunity);
      console.log('Generated shortage alert:', shortageOpportunity.summary);
    }

    return shortageAlerts;
  }

  /**
   * Initialize the agent manager
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('Agent Manager already initialized');
      return;
    }
    
    console.log('Initializing Agent Manager...');
    
    try {
      // Initialize the LLM service with API key
      const apiKeyPath = path.join(process.cwd(), 'Groq API KEY.txt');
      let apiKey = '';
      
      if (fs.existsSync(apiKeyPath)) {
        apiKey = fs.readFileSync(apiKeyPath, 'utf8').trim();
      } else {
        console.error('Groq API key file not found. Looking for environment variable...');
        apiKey = process.env.GROQ_API_KEY || '';
      }
      
      if (!apiKey) {
        throw new Error('No Groq API key found. Please provide an API key in "Groq API KEY.txt" or set the GROQ_API_KEY environment variable.');
      }
      
      this.llmService = new LLMService(apiKey);
      
      // Initialize agents
      this.agents.bruce = new Bruce(this.llmService);
      this.agents.lexxi = new Lexxi(this.llmService);
      
      // Initialize context builder and response parser
      this.contextBuilder = new ContextBuilder();
      this.responseParser = new ResponseParser();
      
      this.isInitialized = true;
      console.log('Agent Manager initialized successfully with agents: Bruce, Lexxi');
    } catch (error) {
      console.error('Failed to initialize Agent Manager:', error);
      throw error;
    }
  }

  /**
   * Process a user message and generate a response
   * @param {string} userId - The user's ID
   * @param {string} message - The user's message
   * @param {string} [agentName] - Optional specific agent to use
   * @returns {Promise<Object>} The response object
   */
  async processMessage(userId, message, agentName = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Get or create conversation history
    const conversation = this.getOrCreateConversation(userId);
    
    // Determine which agent should handle the message
    const targetAgent = agentName || this.determineAgent(message, conversation);
    
    // Track the current request in circular reference tracking
    const requestId = `${userId}-${Date.now()}`;
    this.trackRequest(requestId, targetAgent, message);
    
    try {
      // Build context for the agent (part of circular integration)
      const context = await this.contextBuilder.buildContext(userId, message, targetAgent, conversation);
      
      // Get the agent instance
      const agent = this.agents[targetAgent];
      if (!agent) {
        throw new Error(`Agent "${targetAgent}" not found`);
      }
      
      // Generate response
      const agentResponse = await agent.generateResponse(message, conversation.history, context);
      
      // Parse the response to extract actions, entities, etc.
      const parsedResponse = this.responseParser.parse(agentResponse, targetAgent);
      
      // Update conversation history
      this.updateConversation(userId, message, parsedResponse, targetAgent);
      
      // Handle any actions in the response (part of circular integration)
      await this.handleResponseActions(userId, parsedResponse, context);
      
      return {
        text: parsedResponse.text,
        agent: targetAgent,
        actions: parsedResponse.actions,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error processing message with agent ${targetAgent}:`, error);
      
      // Clear circular reference tracking for this request
      this.clearRequest(requestId);
      
      return {
        text: `I encountered an issue while processing your request. ${error.message}`,
        agent: 'system',
        error: true,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Determine which agent should handle a message
   * @param {string} message - The user's message
   * @param {Object} conversation - The conversation data
   * @returns {string} The agent name
   */
  determineAgent(message, conversation) {
    // If conversation has a current agent and recent messages, prefer continuing
    if (conversation.currentAgent && conversation.history.length > 0) {
      const recentMessages = conversation.history.slice(-3);
      const recentAgentMessages = recentMessages.filter(msg => 
        msg.sender === conversation.currentAgent
      );
      
      // If there are recent messages from the current agent, likely continue the conversation
      if (recentAgentMessages.length > 0) {
        // But still check if the message clearly indicates a domain change
        const bruceScore = this.agents.bruce.getConfidenceScore ? 
          this.agents.bruce.getConfidenceScore(message) : 0.5;
        const lexxiScore = this.agents.lexxi.getConfidenceScore ? 
          this.agents.lexxi.getConfidenceScore(message) : 0.5;
        
        // Only switch if the score difference is significant (0.3+)
        if (bruceScore > lexxiScore + 0.3 && conversation.currentAgent === 'lexxi') {
          return 'bruce';
        } else if (lexxiScore > bruceScore + 0.3 && conversation.currentAgent === 'bruce') {
          return 'lexxi';
        }
        
        return conversation.currentAgent;
      }
    }
    
    // Otherwise, determine based on message content
    // Check for explicit agent mentions
    if (message.toLowerCase().includes('lexxi') || 
        message.toLowerCase().includes('schedule optimization') ||
        message.toLowerCase().includes('scheduling specialist')) {
      return 'lexxi';
    }
    
    if (message.toLowerCase().includes('bruce') ||
        message.toLowerCase().includes('general assistant')) {
      return 'bruce';
    }
    
    // Calculate confidence scores if the agents have the method
    const bruceScore = this.agents.bruce.getConfidenceScore ? 
      this.agents.bruce.getConfidenceScore(message) : 0.5;
    const lexxiScore = this.agents.lexxi.getConfidenceScore ? 
      this.agents.lexxi.getConfidenceScore(message) : 0.5;
    
    // Return the agent with the highest confidence
    return lexxiScore > bruceScore ? 'lexxi' : 'bruce';
  }

  /**
   * Get or create a conversation for a user
   * @param {string} userId - The user's ID
   * @returns {Object} The conversation object
   */
  getOrCreateConversation(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        userId,
        history: [],
        currentAgent: this.defaultAgent,
        lastUpdated: new Date().toISOString(),
        context: {}
      });
    }
    
    return this.conversations.get(userId);
  }

  /**
   * Update a conversation with a new message and response
   * @param {string} userId - The user's ID
   * @param {string} message - The user's message
   * @param {Object} response - The parsed response
   * @param {string} agentName - The agent that generated the response
   */
  updateConversation(userId, message, response, agentName) {
    const conversation = this.getOrCreateConversation(userId);
    
    // Add the user message to history
    conversation.history.push({
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString()
    });
    
    // Add the agent response to history
    conversation.history.push({
      sender: agentName,
      text: response.text,
      actions: response.actions,
      timestamp: new Date().toISOString()
    });
    
    // Update the current agent
    conversation.currentAgent = agentName;
    conversation.lastUpdated = new Date().toISOString();
    
    // Limit history length to prevent context growth
    if (conversation.history.length > 50) {
      conversation.history = conversation.history.slice(-50);
    }
    
    // Update the conversation in the map
    this.conversations.set(userId, conversation);
  }

  /**
   * Handle actions from an agent response
   * @param {string} userId - The user's ID
   * @param {Object} parsedResponse - The parsed response
   * @param {Object} context - The context used for the response
   * @returns {Promise<void>}
   */
  async handleResponseActions(userId, parsedResponse, context) {
    if (!parsedResponse.actions || parsedResponse.actions.length === 0) {
      return;
    }
    
    for (const action of parsedResponse.actions) {
      try {
        switch (action.type) {
          case 'schedule_create':
            await this.handleScheduleCreate(userId, action.parameters);
            break;
            
          case 'schedule_update':
            await this.handleScheduleUpdate(userId, action.parameters);
            break;
            
          case 'caregiver_assign':
            await this.handleCaregiverAssign(userId, action.parameters);
            break;
            
          case 'cross_agent_query':
            await this.handleCrossAgentQuery(userId, action.parameters);
            break;
            
          case 'opportunity_action':
            await this.handleOpportunityAction(userId, action.parameters);
            break;

          case 'initiate_schedule_optimization_task':
            await this.handleInitiateScheduleOptimizationTask(userId, action.parameters);
            break;
            
          default:
            console.log(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        console.error(`Error handling action ${action.type}:`, error);
      }
    }
  }

  /**
   * Handle initiation of a schedule optimization task.
   * This is a conceptual handler; actual optimization logic is external.
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters from the LLM
   * @returns {Promise<Object>} A confirmation or status object
   */
  async handleInitiateScheduleOptimizationTask(userId, parameters) {
    console.log(`Initiating schedule optimization task for user ${userId}:`, parameters);

    const { task_id, optimization_criteria, scope } = parameters;

    if (!task_id || !optimization_criteria || !scope || !scope.date_range_start || !scope.date_range_end) {
      throw new Error('Missing required parameters (task_id, optimization_criteria, scope with date_range_start/end) for initiating optimization task.');
    }

    if (this.activeOptimizationTasks.has(task_id) && this.activeOptimizationTasks.get(task_id).status === 'processing') {
        return {
            success: false,
            task_id,
            status: 'already_processing',
            message: `Optimization task ${task_id} is already in progress. Please wait for it to complete.`
        };
    }

    const taskDetails = {
      ...parameters,
      userId,
      status: 'processing', // Mark as processing
      startTime: new Date().toISOString(),
      conversationSnapshot: this.getConversationHistory(userId, true).slice(-5)
    };
    this.activeOptimizationTasks.set(task_id, taskDetails);

    console.log(`Optimization task ${task_id} started. Fetching data...`);

    try {
      // 1. Fetch caregivers and their full availability
      const allCaregiversRaw = await firebaseService.getAllCaregivers();
      const allCaregiversWithAvailability = await Promise.all(
        allCaregiversRaw.map(async (cg) => {
          const availabilityData = await firebaseService.getCaregiverAvailability(cg.id);
          return { ...cg, availabilityData: availabilityData || {} }; // Ensure availabilityData is at least an empty object
        })
      );

      // 2. Fetch unassigned schedules within the scope as the primary shifts to fill
      // This is a simplification. A more advanced approach might generate all potential shifts
      // from client.authorized_weekly_hours.
      const unassignedSchedulesInRange = await firebaseService.getSchedulesInDateRange(scope.date_range_start, scope.date_range_end);
      const clientShiftsToFill = unassignedSchedulesInRange
        .filter(s => s.status === 'unassigned')
        .map(s => {
            const clientDetails = firebaseService.getClient(s.client_id); // Assuming this is fast/cached or batch it
            return {
                id: s.id, // Using schedule ID as the unique shift ID
                clientId: s.client_id,
                clientName: s.client_name, // Already on schedule doc
                date: s.date,
                startTime: s.start_time,
                endTime: s.end_time,
                durationHours: enhancedScheduler.timeToMinutes(s.end_time) && enhancedScheduler.timeToMinutes(s.start_time) ? (enhancedScheduler.timeToMinutes(s.end_time) - enhancedScheduler.timeToMinutes(s.start_time)) / 60 : 0,
                requiredSkills: s.required_skills || (clientDetails?.required_skills || []),
                location: s.client_location || clientDetails?.location,
                clientBusLineAccess: clientDetails?.bus_line_access || false
                // Ensure clientBusLineAccess is fetched; might need to get all clients first if not on schedule doc
            };
        });

      if (clientShiftsToFill.length === 0) {
        this.activeOptimizationTasks.set(task_id, { ...taskDetails, status: 'completed_no_shifts', endTime: new Date().toISOString() });
        return {
          success: true,
          task_id,
          status: 'completed_no_shifts',
          message: 'No unassigned shifts found in the specified date range to optimize.',
          results: { assignments: [], unmetShifts: [], optimization_summary: { totalShiftsToFill: 0 } }
        };
      }

      // 3. Call the optimization algorithm
      const optimizationResult = await enhancedScheduler.optimizeSchedules(
        clientShiftsToFill,
        allCaregiversWithAvailability,
        { primaryGoal: optimization_criteria.includes('maximizeCoverageFewestCaregivers') ? 'maximizeCoverageFewestCaregivers' : 'maximizeCoverage' } // Example mapping
      );

      // 4. Identify and report shortages if any shifts are unmet
      let shortageAlerts = [];
      if (optimizationResult.unmetShifts && optimizationResult.unmetShifts.length > 0) {
        shortageAlerts = await this.identifyAndReportShortages(optimizationResult.unmetShifts, allCaregiversWithAvailability);
      }

      this.activeOptimizationTasks.set(task_id, { ...taskDetails, status: 'completed', endTime: new Date().toISOString(), results: optimizationResult, shortages: shortageAlerts });

      console.log(`Optimization task ${task_id} completed.`);
      return {
        success: true,
        task_id,
        status: 'completed',
        message: `Optimization analysis complete. ${optimizationResult.optimization_summary.shiftsAssigned} shifts assigned, ${optimizationResult.optimization_summary.shiftsUnmet} unmet. ${shortageAlerts.length} shortage alerts created.`,
        results: optimizationResult,
        shortage_alerts_summary: shortageAlerts.map(s => s.summary)
      };

    } catch (error) {
      console.error(`Error during optimization task ${task_id}:`, error);
      this.activeOptimizationTasks.set(task_id, { ...taskDetails, status: 'failed', endTime: new Date().toISOString(), error: error.message });
      throw error; // Re-throw for the agent to handle
    }
  }

  /**
   * Handle a schedule creation action
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleScheduleCreate(userId, parameters) {
    console.log(`Creating schedule for user ${userId}:`, parameters);
    
    try {
      // Basic validation
      if (!parameters.client_id || !parameters.date || !parameters.start_time || !parameters.end_time) {
        console.error('Missing required parameters for schedule creation:', parameters);
        throw new Error('Client ID, date, start time, and end time are required to create a schedule.');
      }

      let scheduleData = {
        client_id: parameters.client_id,
        date: parameters.date,
        start_time: parameters.start_time,
        end_time: parameters.end_time,
        notes: parameters.notes || '',
        status: 'unassigned', // Default status
        created_by_agent: true,
        user_id_initiator: userId
      };

      if (!parameters.client_name || !parameters.client_location || !parameters.required_skills) {
        const client = await firebaseService.getClient(parameters.client_id);
        if (client) {
          scheduleData.client_name = client.name || parameters.client_name;
          scheduleData.client_location = client.location || parameters.client_location;
          scheduleData.required_skills = client.required_skills || parameters.required_skills || [];
        } else {
          throw new Error(`Client with ID ${parameters.client_id} not found.`);
        }
      } else {
        scheduleData.client_name = parameters.client_name;
        scheduleData.client_location = parameters.client_location;
        scheduleData.required_skills = parameters.required_skills;
      }

      const createdSchedule = await enhancedScheduler.createSchedule(scheduleData);
      console.log(`Schedule created successfully by agent for user ${userId}:`, createdSchedule.id);
      return createdSchedule;

    } catch (error) {
      console.error(`Error in handleScheduleCreate for user ${userId}:`, error.message);
      throw error;
    }
    try {
      if (!parameters.schedule_id || !parameters.updates) {
        console.error('Missing schedule_id or updates for schedule update:', parameters);
        throw new Error('Schedule ID and updates object are required to update a schedule.');
      }

      const { schedule_id, updates } = parameters;

      if (updates.date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.date)) {
        throw new Error('Invalid date format for schedule update. Use YYYY-MM-DD.');
      }
      if (updates.start_time && !/^\d{2}:\d{2}$/.test(updates.start_time)) {
        throw new Error('Invalid start time format for schedule update. Use HH:MM.');
      }
      if (updates.end_time && !/^\d{2}:\d{2}$/.test(updates.end_time)) {
        throw new Error('Invalid end time format for schedule update. Use HH:MM.');
      }

      const updatedSchedule = await enhancedScheduler.updateSchedule(schedule_id, updates);
      console.log(`Schedule ${schedule_id} updated successfully by agent for user ${userId}:`, updatedSchedule);
      return updatedSchedule;

    } catch (error) {
      console.error(`Error in handleScheduleUpdate for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Handle a schedule update action
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleScheduleUpdate(userId, parameters) {
    console.log(`Updating schedule for user ${userId}:`, parameters);
    
    // This would connect to the schedule service
    // For now, just log the action
  }

  /**
   * Handle a caregiver assignment action
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleCaregiverAssign(userId, parameters) {
    console.log(`Assigning caregiver for user ${userId}:`, parameters);
    
    try {
      if (!parameters.schedule_id || !parameters.caregiver_id) {
        console.error('Missing schedule_id or caregiver_id for assignment:', parameters);
        throw new Error('Schedule ID and Caregiver ID are required to assign a caregiver.');
      }

      const { schedule_id, caregiver_id } = parameters;
      const assignmentResult = await enhancedScheduler.assignCaregiverToSchedule(schedule_id, caregiver_id);

      if (assignmentResult.success) {
        console.log(`Caregiver ${caregiver_id} assigned to schedule ${schedule_id} successfully by agent for user ${userId}.`);
      } else {
        console.error(`Failed to assign caregiver ${caregiver_id} to schedule ${schedule_id} by agent for user ${userId}.`);
        throw new Error(assignmentResult.message || `Failed to assign caregiver to schedule ${schedule_id}.`);
      }
      return assignmentResult.schedule;

    } catch (error) {
      console.error(`Error in handleCaregiverAssign for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Handle a cross-agent query action
   * This is a key part of the circular integration model (C=2πr)
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleCrossAgentQuery(userId, parameters) {
    const { targetAgent, query, requestId } = parameters;
    
    // Check circular reference depth to prevent infinite loops
    if (!this.canProcessCircularRequest(requestId, targetAgent)) {
      console.log(`Circular reference depth exceeded for request ${requestId}, agent ${targetAgent}`);
      return;
    }
    
    console.log(`Cross-agent query from user ${userId} to agent ${targetAgent}: ${query}`);
    
    try {
      // Process the query with the target agent
      const response = await this.processMessage(userId, query, targetAgent);
      
      // Update the conversation to reflect this was an internal query
      const conversation = this.getOrCreateConversation(userId);
      
      // Mark the last two messages (the query and response) as internal
      const historyLength = conversation.history.length;
      if (historyLength >= 2) {
        conversation.history[historyLength - 2].internal = true;
        conversation.history[historyLength - 1].internal = true;
        conversation.history[historyLength - 1].crossAgentQuery = true;
      }
      
      // Restore the previous current agent
      conversation.currentAgent = parameters.sourceAgent;
    } catch (error) {
      console.error(`Error in cross-agent query:`, error);
    }
  }

  /**
   * Handle an opportunity action
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleOpportunityAction(userId, parameters) {
    console.log(`Opportunity action for user ${userId}:`, parameters);
    
    // This implementation integrates with the opportunity system
    const { opportunityId, action, reason } = parameters;
    
    if (action === 'apply') {
      await this.applyOpportunity(opportunityId, { 
        appliedBy: userId,
        reason,
        timestamp: new Date().toISOString()
      });
    } else if (action === 'reject') {
      await this.rejectOpportunity(opportunityId, {
        rejectedBy: userId,
        reason,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Scan for scheduling opportunities
   * Part of the agentic capability implementation
   * @returns {Promise<Array>} The discovered opportunities
   */
  async scanForOpportunities(scanOptions = {}) {
    console.log('Scanning for scheduling opportunities...', scanOptions);
    const opportunities = []; // This will collect all types of opportunities
    const defaultWeeklyTargetHours = 30; // Default target hours for caregivers

    try {
      // 1. Find caregivers for unassigned schedules (existing logic)
      console.log('Phase 1: Scanning for caregivers for unassigned schedules...');
      const unassignedSchedules = await firebaseService.db.collection('schedules')
        .where('status', '==', 'unassigned')
        // Potentially add date range filter from scanOptions if provided
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      for (const schedule of unassignedSchedules) {
        const availableCaregivers = await enhancedScheduler.findAvailableCaregivers(schedule.id);
        if (availableCaregivers.length > 0) {
          const opportunity = {
            id: `opp-cgassign-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: 'caregiver_assignment_to_schedule', // More specific type
            schedule_id: schedule.id,
            client_id: schedule.client_id,
            client_name: schedule.client_name,
            date: schedule.date,
            time_range: `${schedule.start_time} - ${schedule.end_time}`,
            candidates: availableCaregivers.slice(0, 3).map(c => ({
              caregiver_id: c.caregiver.id,
              caregiver_name: c.caregiver.name,
              score: c.score,
              distance: c.distance || 'unknown',
            })),
            created_at: new Date().toISOString(),
            status: 'pending',
            priority: availableCaregivers[0].score > 85 ? 'high' : 'medium',
            summary: `Potential caregivers found for ${schedule.client_name}'s unassigned shift on ${schedule.date}.`
          };
          opportunities.push(opportunity);
          await firebaseService.addDocument('opportunities', opportunity);
        }
      }
      console.log(`Phase 1: Found ${opportunities.length} caregiver assignment opportunities.`);

      // 2. Find clients for generally available caregivers
      console.log('Phase 2: Scanning for clients for generally available caregivers...');
      const allCaregivers = await firebaseService.getAllCaregivers();
      const allClients = await firebaseService.getAllClients(); // Assuming clients have a way to mark active need

      for (const caregiver of allCaregivers) {
        const availability = await firebaseService.getCaregiverAvailability(caregiver.id);
        if (availability && availability.general_rules && availability.general_rules.length > 0) {
          // This caregiver has general availability. Let's find potential clients.
          // This logic would be more complex: check skills, location preferences, etc.
          // For now, a simplified version: suggest clients who have no upcoming assigned schedules.

          const clientsWithPotentialNeed = [];
          for (const client of allClients) {
            // Example: Client needs care if they have no assigned schedules in the next 7 days
            // This is a placeholder for a more robust "client needs care" indicator.
            const upcomingSchedules = await firebaseService.getSchedulesByClientIdInDateRange(client.id,
                new Date().toISOString().split('T')[0],
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            );
            const hasAssignedUpcoming = upcomingSchedules.some(s => s.status === 'assigned');

            if (!hasAssignedUpcoming) {
                 // Basic match: check if caregiver has any skill the client might need (very simplified)
                const clientSkills = client.required_skills || [];
                const caregiverSkills = caregiver.skills || [];
                const skillsMatch = clientSkills.length === 0 || clientSkills.some(skill => caregiverSkills.includes(skill));

                if (skillsMatch) {
                    // Further check: is caregiver generally available on days client might need?
                    // This requires a more defined client need profile (e.g. preferred days)
                    // For now, we'll assume a general match is an opportunity.
                    clientsWithPotentialNeed.push({
                        client_id: client.id,
                        client_name: client.name,
                        // Add more client details if useful for the opportunity
                    });
                }
            }
          }

          if (clientsWithPotentialNeed.length > 0) {
            const opportunity = {
              id: `opp-clientmatch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              type: 'client_assignment_suggestion',
              caregiver_id: caregiver.id,
              caregiver_name: caregiver.name,
              potential_clients: clientsWithPotentialNeed.slice(0,3), // Suggest a few
              availability_summary: `Generally available: ${availability.general_rules.map(r => r.days_of_week.join(', ') + ' ' + r.start_time + '-' + r.end_time).join('; ')}`,
              created_at: new Date().toISOString(),
              status: 'pending',
              priority: 'medium',
              summary: `${caregiver.name} is generally available and could potentially take on new clients like ${clientsWithPotentialNeed.map(c => c.client_name).join(', ')}.`
            };
            opportunities.push(opportunity);
            await firebaseService.addDocument('opportunities', opportunity);
          }
        }
      }
      console.log(`Phase 2: Found ${opportunities.filter(o=>o.type === 'client_assignment_suggestion').length} client assignment suggestion opportunities.`);


      // 3. Identify caregivers who can take more hours
      console.log('Phase 3: Scanning for caregivers who can take more hours...');
      const today = new Date();
      const nextWeekStart = new Date(today);
      nextWeekStart.setDate(today.getDate() + ( (1 + 7 - today.getDay()) % 7 ) ); // Next Monday
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6); // Next Sunday

      for (const caregiver of allCaregivers) {
        const caregiverSchedulesNextWeek = await firebaseService.getSchedulesByCaregiverIdInDateRange(
          caregiver.id,
          nextWeekStart.toISOString().split('T')[0],
          nextWeekEnd.toISOString().split('T')[0]
        );

        let scheduledHoursNextWeek = 0;
        caregiverSchedulesNextWeek.forEach(s => {
          const startMinutes = enhancedScheduler.timeToMinutes(s.start_time);
          const endMinutes = enhancedScheduler.timeToMinutes(s.end_time);
          if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
            scheduledHoursNextWeek += (endMinutes - startMinutes) / 60;
          }
        });

        const targetHours = caregiver.target_weekly_hours || defaultWeeklyTargetHours;
        const hourDeficit = targetHours - scheduledHoursNextWeek;

        if (hourDeficit > 4) { // Significant deficit, e.g., more than 4 hours
          const availability = await firebaseService.getCaregiverAvailability(caregiver.id);
          if (availability && ( (availability.general_rules && availability.general_rules.length > 0) || (availability.specific_slots && availability.specific_slots.length > 0) ) ) {
            // Find some unassigned schedules this caregiver might fit
            const potentialMatches = [];
            for (const unassignedSch of unassignedSchedules) {
                // Check if caregiver is available for this unassigned schedule
                 const isActuallyAvailable = enhancedScheduler.isCaregiverAvailable(availability, unassignedSch.date, unassignedSch.start_time, unassignedSch.end_time);
                 if(isActuallyAvailable) {
                    // Check basic skill match
                    const clientDetails = await firebaseService.getClient(unassignedSch.client_id);
                    const clientSkills = clientDetails ? (clientDetails.required_skills || []) : [];
                    const caregiverSkills = caregiver.skills || [];
                    const skillsMatch = clientSkills.length === 0 || clientSkills.some(skill => caregiverSkills.includes(skill));
                    if(skillsMatch) {
                        potentialMatches.push({
                            schedule_id: unassignedSch.id,
                            client_name: unassignedSch.client_name,
                            date: unassignedSch.date,
                            time_range: `${unassignedSch.start_time} - ${unassignedSch.end_time}`
                        });
                        if(potentialMatches.length >= 2) break; // Suggest a couple
                    }
                 }
            }

            const opportunity = {
              id: `opp-morehours-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              type: 'increase_caregiver_hours',
              caregiver_id: caregiver.id,
              caregiver_name: caregiver.name,
              current_hours_next_week: scheduledHoursNextWeek.toFixed(1),
              target_hours: targetHours,
              hour_deficit: hourDeficit.toFixed(1),
              potential_matches: potentialMatches, // Unassigned shifts they might cover
              created_at: new Date().toISOString(),
              status: 'pending',
              priority: 'medium',
              summary: `${caregiver.name} has capacity for ~${hourDeficit.toFixed(0)} more hours next week. Potential matches: ${potentialMatches.map(p=>p.client_name).join(', ')}.`
            };
            opportunities.push(opportunity);
            await firebaseService.addDocument('opportunities', opportunity);
          }
        }
      }
      console.log(`Phase 3: Found ${opportunities.filter(o=>o.type === 'increase_caregiver_hours').length} 'increase hours' opportunities.`);
      
      // 4. Placeholder for Efficiency Opportunities (can be expanded later)
      console.log('Phase 4: Identifying efficiency opportunities (basic)...');
      const efficiencyOps = await this.identifyEfficiencyOpportunities(unassignedSchedules, allCaregivers, allClients);
      opportunities.push(...efficiencyOps);
      console.log(`Phase 4: Found ${efficiencyOps.length} efficiency opportunities.`);

      // Phase 5: After attempting to fill/optimize, identify remaining shortages explicitly
      // This is a conceptual placement. In a real flow, optimizeSchedules would be called,
      // and its unmetShifts output would feed into identifyAndReportShortages.
      // For now, if scanForOpportunities is the primary way to find issues,
      // we can call it based on the currently unassigned shifts.
      console.log('Phase 5: Identifying shortages from remaining unassigned shifts...');
      // Re-fetch unassignedSchedules if they might have changed during prior opportunity creation
      const currentUnassignedSchedules = await firebaseService.db.collection('schedules')
        .where('status', '==', 'unassigned')
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      if (currentUnassignedSchedules.length > 0) {
        // Convert these unassigned schedules into the 'unmetShift' format expected by identifyAndReportShortages
        const unmetShiftObjects = currentUnassignedSchedules.map(s => ({
            id: s.id, // Use schedule id as shift id for this context
            clientId: s.client_id,
            clientName: s.client_name,
            date: s.date,
            startTime: s.start_time,
            endTime: s.end_time,
            durationHours: enhancedScheduler.timeToMinutes(s.end_time) && enhancedScheduler.timeToMinutes(s.start_time) ? (enhancedScheduler.timeToMinutes(s.end_time) - enhancedScheduler.timeToMinutes(s.start_time)) / 60 : 0,
            requiredSkills: s.required_skills || [], // Assuming schedules might have this
            location: s.client_location, // Assuming schedules have this
            clientBusLineAccess: allClients.find(c=>c.id === s.client_id)?.bus_line_access || false // Fetch if needed
        }));
        const shortageAlertOps = await this.identifyAndReportShortages(unmetShiftObjects, allCaregivers);
        opportunities.push(...shortageAlertOps);
        console.log(`Phase 5: Found ${shortageAlertOps.length} shortage alert opportunities.`);
      }


      console.log(`Total opportunities found: ${opportunities.length}`);
      return opportunities;

    } catch (error) {
      console.error('Error scanning for opportunities:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific opportunity
   * @param {string} opportunityId - The ID of the opportunity
   * @returns {Promise<Object>} The opportunity details
   */
  async getOpportunityDetails(opportunityId) {
    console.log(`Getting details for opportunity ${opportunityId}`);
    
    try {
      const firebaseService = require('../../services/firebase').firebaseService;
      
      // Get the opportunity from the database
      const opportunity = await firebaseService.getDocument('opportunities', opportunityId);
      
      if (!opportunity) {
        throw new Error(`Opportunity ${opportunityId} not found`);
      }
      
      // Enhance with additional information based on opportunity type
      if (opportunity.type === 'caregiver_assignment') {
        // Get more information about the schedule
        const schedule = await firebaseService.getSchedule(opportunity.schedule_id);
        
        // Get more information about the client
        const client = await firebaseService.getClient(opportunity.client_id);
        
        // Get full details for each candidate caregiver
        const enhancedCandidates = [];
        
        for (const candidate of opportunity.candidates) {
          const caregiver = await firebaseService.getCaregiver(candidate.caregiver_id);
          
          enhancedCandidates.push({
            ...candidate,
            caregiver_details: caregiver,
            availability: await firebaseService.getCaregiverAvailability(candidate.caregiver_id)
          });
        }
        
        return {
          ...opportunity,
          schedule_details: schedule,
          client_details: client,
          enhanced_candidates: enhancedCandidates,
          ai_recommendation: this.generateAIRecommendation(opportunity, enhancedCandidates)
        };
      }
      
      return opportunity;
    } catch (error) {
      console.error(`Error getting opportunity details for ${opportunityId}:`, error);
      throw error;
    }
  }

  /**
   * Apply a scheduling opportunity
   * @param {string} opportunityId - The ID of the opportunity
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} The result
   */
  async applyOpportunity(opportunityId, options = {}) {
    console.log(`Applying opportunity ${opportunityId}`);
    
    try {
      const firebaseService = require('../../services/firebase').firebaseService;
      const enhancedScheduler = require('../../services/enhanced-scheduler');
      
      // Get the opportunity
      const opportunity = await firebaseService.getDocument('opportunities', opportunityId);
      
      if (!opportunity) {
        throw new Error(`Opportunity ${opportunityId} not found`);
      }
      
      // Apply the opportunity based on its type
      if (opportunity.type === 'caregiver_assignment') {
        // Get the best candidate
        const bestCandidate = opportunity.candidates[0];
        
        // Assign the caregiver to the schedule
        const result = await enhancedScheduler.assignCaregiverToSchedule(
          opportunity.schedule_id, 
          bestCandidate.caregiver_id
        );
        
        // Update the opportunity status
        await firebaseService.updateDocument('opportunities', opportunityId, {
          status: result.success ? 'applied' : 'failed',
          applied_at: new Date().toISOString(),
          applied_by: options.appliedBy || 'system',
          application_result: result,
          ...options
        });
        
        return {
          success: result.success,
          opportunity,
          result
        };
      }
      
      throw new Error(`Unsupported opportunity type: ${opportunity.type}`);
    } catch (error) {
      console.error(`Error applying opportunity ${opportunityId}:`, error);
      throw error;
    }
  }

  /**
   * Reject a scheduling opportunity
   * @param {string} opportunityId - The ID of the opportunity
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} The result
   */
  async rejectOpportunity(opportunityId, options = {}) {
    console.log(`Rejecting opportunity ${opportunityId}`);
    
    try {
      const firebaseService = require('../../services/firebase').firebaseService;
      
      // Update the opportunity status
      await firebaseService.updateDocument('opportunities', opportunityId, {
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: options.rejectedBy || 'system',
        ...options
      });
      
      return {
        success: true,
        opportunityId
      };
    } catch (error) {
      console.error(`Error rejecting opportunity ${opportunityId}:`, error);
      throw error;
    }
  }

  /**
   * Identify scheduling efficiency opportunities
   * @param {Array} unassignedSchedules - List of unassigned schedules
   * @param {Array} allCaregivers - List of all caregivers
   * @param {Array} allClients - List of all clients
   * @returns {Promise<Array>} The efficiency opportunities
   */
  async identifyEfficiencyOpportunities(unassignedSchedules, allCaregivers, allClients) {
    const efficiencyOpportunities = [];
    console.log('Identifying basic efficiency opportunities...');

    // Example: Suggest filling small gaps for already scheduled caregivers if an unassigned shift is nearby
    // This is a very simplified example. Real efficiency logic would be much more complex.
    const assignedSchedulesToday = await firebaseService.db.collection('schedules')
        .where('status', '==', 'assigned')
        .where('date', '==', new Date().toISOString().split('T')[0])
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    for (const assignedSchedule of assignedSchedulesToday) {
        const caregiverId = assignedSchedule.caregiver_id;
        const caregiver = allCaregivers.find(c => c.id === caregiverId);
        if (!caregiver) continue;

        // Look for an unassigned schedule nearby (time and location)
        for (const unassigned of unassignedSchedules) {
            if (unassigned.date === assignedSchedule.date) { // Same day
                const assignedEndMinutes = enhancedScheduler.timeToMinutes(assignedSchedule.end_time);
                const unassignedStartMinutes = enhancedScheduler.timeToMinutes(unassigned.start_time);

                if (assignedEndMinutes !== null && unassignedStartMinutes !== null) {
                    const gapDuration = unassignedStartMinutes - assignedEndMinutes;
                    // If gap is small (e.g., 30-90 mins) and locations are close (placeholder for actual distance check)
                    if (gapDuration > 15 && gapDuration <= 90) {
                        const clientOfAssigned = allClients.find(c => c.id === assignedSchedule.client_id);
                        const clientOfUnassigned = allClients.find(c => c.id === unassigned.client_id);

                        // Placeholder for location proximity check
                        const areClose = clientOfAssigned && clientOfUnassigned &&
                                         (clientOfAssigned.location && clientOfUnassigned.location ?
                                          enhancedScheduler.areLocationsClose(clientOfAssigned.location, clientOfUnassigned.location) : true);

                        if (areClose) {
                             const availability = await firebaseService.getCaregiverAvailability(caregiverId);
                             const isActuallyAvailable = enhancedScheduler.isCaregiverAvailable(availability, unassigned.date, unassigned.start_time, unassigned.end_time);

                             if(isActuallyAvailable) {
                                const opportunity = {
                                    id: `opp-gapfill-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                    type: 'fill_gap_efficiency',
                                    caregiver_id: caregiverId,
                                    caregiver_name: caregiver.name,
                                    existing_schedule_id: assignedSchedule.id,
                                    potential_schedule_to_fill_id: unassigned.id,
                                    gap_duration_minutes: gapDuration,
                                    summary: `Caregiver ${caregiver.name} has a ${gapDuration} min gap on ${assignedSchedule.date} before potentially taking ${unassigned.client_name}'s nearby shift.`,
                                    created_at: new Date().toISOString(),
                                    status: 'pending',
                                    priority: 'low'
                                };
                                efficiencyOpportunities.push(opportunity);
                                await firebaseService.addDocument('opportunities', opportunity);
                             }
                        }
                    }
                }
            }
        }
    }

    console.log(`Identified ${efficiencyOpportunities.length} basic efficiency opportunities.`);
    return efficiencyOpportunities;
  }

  /**
   * Generate an AI recommendation for an opportunity
   * @param {Object} opportunity - The opportunity
   * @param {Array} candidates - The candidate caregivers
   * @returns {Object} The AI recommendation
   */
  generateAIRecommendation(opportunity, candidates) {
    // Check if we have at least one good candidate
    if (candidates.length === 0) {
      return {
        recommendation: 'none',
        confidence: 0,
        reasoning: 'No candidates available'
      };
    }
    
    const bestCandidate = candidates[0];
    
    // Make a recommendation based on the candidate's score
    if (bestCandidate.score >= 85) {
      return {
        recommendation: 'accept',
        confidence: bestCandidate.score / 100,
        reasoning: `${bestCandidate.caregiver_name} is an excellent match with a score of ${bestCandidate.score}/100.`
      };
    } else if (bestCandidate.score >= 70) {
      return {
        recommendation: 'consider',
        confidence: bestCandidate.score / 100,
        reasoning: `${bestCandidate.caregiver_name} is a good match with a score of ${bestCandidate.score}/100.`
      };
    } else {
      return {
        recommendation: 'explore-alternatives',
        confidence: 0.5,
        reasoning: `The best candidate (${bestCandidate.caregiver_name}) has a relatively low score of ${bestCandidate.score}/100. Consider looking for other options.`
      };
    }
  }

  /**
   * Track a request in the circular reference system
   * @param {string} requestId - The request ID
   * @param {string} agentName - The agent name
   * @param {string} message - The message
   */
  trackRequest(requestId, agentName, message) {
    if (!this.circularReferences.has(requestId)) {
      this.circularReferences.set(requestId, []);
    }
    
    const references = this.circularReferences.get(requestId);
    references.push({
      agentName,
      timestamp: Date.now(),
      messagePreview: message.substring(0, 50)
    });
    
    // Clean up old requests (older than 10 minutes)
    this.cleanupCircularReferences();
  }

  /**
   * Check if a circular request can be processed
   * @param {string} requestId - The request ID
   * @param {string} agentName - The agent name
   * @returns {boolean} Whether the request can be processed
   */
  canProcessCircularRequest(requestId, agentName) {
    if (!this.circularReferences.has(requestId)) {
      return true;
    }
    
    const references = this.circularReferences.get(requestId);
    
    // Count how many times this agent has been called in this request chain
    const agentCallCount = references.filter(ref => ref.agentName === agentName).length;
    
    // Allow processing if under the maximum depth
    return agentCallCount < this.maxCircularDepth;
  }

  /**
   * Clear a request from circular reference tracking
   * @param {string} requestId - The request ID
   */
  clearRequest(requestId) {
    this.circularReferences.delete(requestId);
  }

  /**
   * Clean up old circular references
   */
  cleanupCircularReferences() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    this.circularReferences.forEach((references, requestId) => {
      // Check the timestamp of the last reference
      const lastTimestamp = references.length > 0 ? references[references.length - 1].timestamp : 0;
      
      if (now - lastTimestamp > maxAge) {
        this.circularReferences.delete(requestId);
      }
    });
  }
  
  /**
   * Execute a tool request
   * @param {string} userId - The user's ID
   * @param {string} agentName - The agent name
   * @param {string} toolName - The tool name
   * @param {Object} parameters - The tool parameters
   * @returns {Promise<string>} The tool response
   */
  async executeTool(userId, agentName, toolName, parameters) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Get the agent
    const agent = this.agents[agentName];
    if (!agent) {
      throw new Error(`Agent "${agentName}" not found`);
    }
    
    // Check if the agent has the tool
    if (!agent.handleToolRequest) {
      throw new Error(`Agent "${agentName}" does not support tools`);
    }
    
    // Get the conversation history
    const conversation = this.getOrCreateConversation(userId);
    
    // Execute the tool
    const response = await agent.handleToolRequest(toolName, parameters, conversation.history);
    
    // Update conversation with tool use (but mark as internal)
    conversation.history.push({
      sender: 'system',
      text: `Tool ${toolName} executed with parameters: ${JSON.stringify(parameters)}`,
      timestamp: new Date().toISOString(),
      internal: true,
      tool: true
    });
    
    conversation.history.push({
      sender: agentName,
      text: response,
      timestamp: new Date().toISOString(),
      internal: true,
      toolResponse: true
    });
    
    return response;
  }

  /**
   * Get the conversation history for a user
   * @param {string} userId - The user's ID
   * @param {boolean} includeInternal - Whether to include internal messages
   * @returns {Array} The conversation history
   */
  getConversationHistory(userId, includeInternal = false) {
    const conversation = this.getOrCreateConversation(userId);
    
    if (includeInternal) {
      return conversation.history;
    }
    
    // Filter out internal messages
    return conversation.history.filter(msg => !msg.internal);
  }
  
  /**
   * Start a new conversation with a specific agent
   * @param {string} userId - The user's ID
   * @param {string} agentName - The name of the agent to start conversation with
   * @param {string} initialMessage - The initial message to the agent
   * @returns {Promise<Object>} The conversation ID and initial response
   */
  async startConversation(userId, agentName, initialMessage) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Validate agent name
    if (!this.agents[agentName]) {
      throw new Error(`Agent "${agentName}" not found. Available agents: ${Object.keys(this.agents).join(', ')}`);
    }
    
    // Create a new conversation or clear existing one
    const conversation = this.getOrCreateConversation(userId);
    conversation.history = [];
    conversation.currentAgent = agentName;
    conversation.lastUpdated = new Date().toISOString();
    
    // Generate initial response
    const response = await this.processMessage(userId, initialMessage, agentName);
    
    return {
      conversationId: userId, // Using userId as conversationId for simplicity
      agentName,
      initialResponse: response
    };
  }
  
  /**
   * Get a response from an agent in an existing conversation
   * @param {string} conversationId - The conversation ID (userId)
   * @param {string} message - The message to the agent
   * @returns {Promise<Object>} The agent's response
   */
  async getResponse(conversationId, message) {
    // We're using userId as conversationId, so just pass to processMessage
    return await this.processMessage(conversationId, message);
  }
  
  /**
   * Get insights for a specific schedule
   * @param {string} scheduleId - The ID of the schedule
   * @returns {Promise<Object>} Insights about the schedule
   */
  async getInsightsForSchedule(scheduleId) {
    console.log(`Getting insights for schedule ${scheduleId}`);
    
    try {
      // Get the schedule with details
      const firebaseService = require('../../services/firebase').firebaseService;
      const enhancedScheduler = require('../../services/enhanced-scheduler');
      
      const schedule = await firebaseService.getSchedule(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }
      
      // Get related client and caregiver (if assigned)
      const client = schedule.client_id ? await firebaseService.getClient(schedule.client_id) : null;
      const caregiver = schedule.caregiver_id ? await firebaseService.getCaregiver(schedule.caregiver_id) : null;
      
      // Get potential caregivers if not assigned
      const availableCaregivers = !schedule.caregiver_id ? 
        await enhancedScheduler.findAvailableCaregivers(scheduleId) : [];
      
      // Generate insights
      const insights = {
        scheduleId,
        timestamp: new Date().toISOString(),
        insights: []
      };
      
      // Add schedule status insight
      insights.insights.push({
        type: 'status',
        message: schedule.caregiver_id ? 
          `This schedule is assigned to ${caregiver?.name || 'a caregiver'}.` : 
          'This schedule is currently unassigned.',
        priority: schedule.caregiver_id ? 'low' : 'high'
      });
      
      // Add available caregivers insight
      if (availableCaregivers.length > 0) {
        insights.insights.push({
          type: 'available_caregivers',
          message: `There are ${availableCaregivers.length} available caregivers for this schedule. Top match: ${availableCaregivers[0].caregiver.name} (${availableCaregivers[0].score}% match).`,
          priority: 'medium',
          caregivers: availableCaregivers.slice(0, 3)
        });
      }
      
      // Add client preference insight if caregiver assigned
      if (client && caregiver && schedule.caregiver_id) {
        // Check if client has preferences that match/don't match caregiver
        const preferenceMatch = client.preferences && caregiver.skills && 
          client.preferences.some(pref => caregiver.skills.includes(pref));
        
        if (preferenceMatch) {
          insights.insights.push({
            type: 'preference_match',
            message: `${caregiver.name} matches client preferences.`,
            priority: 'low'
          });
        } else {
          insights.insights.push({
            type: 'preference_mismatch',
            message: `${caregiver.name} may not match all client preferences.`,
            priority: 'medium'
          });
        }
      }
      
      // Add scheduling opportunity insight
      const otherSchedules = await firebaseService.getSchedulesInDateRange(schedule.date, schedule.date);
      const sameAreaSchedules = otherSchedules.filter(s => 
        s.id !== scheduleId && 
        s.location && schedule.location && 
        this.areLocationsClose(s.location, schedule.location)
      );
      
      if (sameAreaSchedules.length > 0) {
        insights.insights.push({
          type: 'nearby_schedules',
          message: `There are ${sameAreaSchedules.length} other schedules in the same area on ${schedule.date}.`,
          priority: 'medium',
          schedules: sameAreaSchedules.map(s => s.id)
        });
      }
      
      return insights;
    } catch (error) {
      console.error(`Error getting insights for schedule ${scheduleId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get suggestions for an entity (client or caregiver)
   * @param {string} entityId - The ID of the entity
   * @param {string} entityType - The type of entity ('client' or 'caregiver')
   * @returns {Promise<Object>} Suggestions for the entity
   */
  async getSuggestions(entityId, entityType) {
    console.log(`Getting suggestions for ${entityType} ${entityId}`);
    
    try {
      const firebaseService = require('../../services/firebase').firebaseService;
      
      let entity;
      let suggestions = {
        entityId,
        entityType,
        timestamp: new Date().toISOString(),
        suggestions: []
      };
      
      // Get the entity
      if (entityType === 'client') {
        entity = await firebaseService.getClient(entityId);
        if (!entity) {
          throw new Error(`Client ${entityId} not found`);
        }
        
        // Get client's schedules
        const schedules = await firebaseService.getSchedulesByClientId(entityId);
        
        // Check for unassigned schedules
        const unassignedSchedules = schedules.filter(s => !s.caregiver_id);
        if (unassignedSchedules.length > 0) {
          suggestions.suggestions.push({
            type: 'unassigned_schedules',
            message: `${entity.name} has ${unassignedSchedules.length} unassigned schedules.`,
            priority: 'high',
            schedules: unassignedSchedules.map(s => s.id)
          });
        }
        
        // Check for upcoming schedules
        const now = new Date();
        const upcomingSchedules = schedules.filter(s => {
          const scheduleDate = new Date(s.date);
          const diffDays = Math.floor((scheduleDate - now) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7; // Within next week
        });
        
        if (upcomingSchedules.length > 0) {
          suggestions.suggestions.push({
            type: 'upcoming_schedules',
            message: `${entity.name} has ${upcomingSchedules.length} schedules in the next 7 days.`,
            priority: 'medium',
            schedules: upcomingSchedules.map(s => s.id)
          });
        }
        
        // Check if client has preferences
        if (!entity.preferences || entity.preferences.length === 0) {
          suggestions.suggestions.push({
            type: 'missing_preferences',
            message: `${entity.name} doesn't have any specified preferences. Adding preferences can improve caregiver matching.`,
            priority: 'medium'
          });
        }
        
      } else if (entityType === 'caregiver') {
        entity = await firebaseService.getCaregiver(entityId);
        if (!entity) {
          throw new Error(`Caregiver ${entityId} not found`);
        }
        
        // Get caregiver's schedules
        const schedules = await firebaseService.getSchedulesByCaregiverId(entityId);
        
        // Check for upcoming schedules
        const now = new Date();
        const upcomingSchedules = schedules.filter(s => {
          const scheduleDate = new Date(s.date);
          const diffDays = Math.floor((scheduleDate - now) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7; // Within next week
        });
        
        if (upcomingSchedules.length > 0) {
          suggestions.suggestions.push({
            type: 'upcoming_schedules',
            message: `${entity.name} has ${upcomingSchedules.length} assignments in the next 7 days.`,
            priority: 'medium',
            schedules: upcomingSchedules.map(s => s.id)
          });
        }
        
        // Check for busy days
        const scheduleCounts = {};
        schedules.forEach(s => {
          scheduleCounts[s.date] = (scheduleCounts[s.date] || 0) + 1;
        });
        
        const busyDays = Object.entries(scheduleCounts)
          .filter(([_, count]) => count >= 3)
          .map(([date, count]) => ({ date, count }));
        
        if (busyDays.length > 0) {
          suggestions.suggestions.push({
            type: 'busy_days',
            message: `${entity.name} has busy days with 3+ assignments: ${busyDays.map(d => d.date).join(', ')}`,
            priority: 'medium',
            busyDays
          });
        }
        
        // Check if caregiver has skills
        if (!entity.skills || entity.skills.length === 0) {
          suggestions.suggestions.push({
            type: 'missing_skills',
            message: `${entity.name} doesn't have any specified skills. Adding skills can improve client matching.`,
            priority: 'medium'
          });
        }
        
        // Check if caregiver has availability
        const availability = await firebaseService.getCaregiverAvailability(entityId);
        if (!availability || Object.keys(availability).length === 0) {
          suggestions.suggestions.push({
            type: 'missing_availability',
            message: `${entity.name} doesn't have any specified availability. Adding availability can improve scheduling.`,
            priority: 'high'
          });
        }
      } else {
        throw new Error(`Invalid entity type: ${entityType}`);
      }
      
      return suggestions;
    } catch (error) {
      console.error(`Error getting suggestions for ${entityType} ${entityId}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if two locations are close to each other
   * @param {Object} location1 - The first location
   * @param {Object} location2 - The second location
   * @returns {boolean} Whether the locations are close
   */
  areLocationsClose(location1, location2) {
    // Simple distance calculation (for demonstration)
    // In a real implementation, use a proper distance calculation
    const distanceCalculator = require('../../utils/distance-calculator');
    const distance = distanceCalculator.calculateDistance(location1, location2);
    return distance < 10; // 10 km
  }

  /**
   * Clear the conversation history for a user
   * @param {string} userId - The user's ID
   */
  clearConversation(userId) {
    const conversation = this.getOrCreateConversation(userId);
    conversation.history = [];
    conversation.currentAgent = this.defaultAgent;
    conversation.lastUpdated = new Date().toISOString();
  }
}

module.exports = new AgentManager();

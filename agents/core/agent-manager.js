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
const EnhancedScheduler = require('../../services/enhanced-scheduler');
const { firebaseService: adminFirebaseService } = require('../../services/firebase'); // Alias to avoid conflict

class AgentManager {
  constructor() {
    this.llmService = null;
    this.agents = {};
    this.defaultAgent = 'bruce';
    this.isInitialized = false;
    this.conversations = new Map();
    this.contextBuilder = null;
    this.responseParser = null;
    this.enhancedScheduler = null;
    this.firebaseService = null;
    
    // Circular integration tracking (to prevent infinite loops)
    this.circularReferences = new Map();
    this.maxCircularDepth = 3;
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

      if (!this.enhancedScheduler) {
        this.enhancedScheduler = new EnhancedScheduler();
      }
      if (!this.firebaseService) {
        this.firebaseService = adminFirebaseService;
      }
      
      this.isInitialized = true;
      console.log('Agent Manager initialized successfully with agents, scheduler, and firebase service.');
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
            
          default:
            console.log(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        console.error(`Error handling action ${action.type}:`, error);
      }
    }
  }

  /**
   * Handle a schedule creation action
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleScheduleCreate(userId, parameters) {
    try {
      if (!this.enhancedScheduler || !this.firebaseService) { // Ensure services are initialized
        console.error('AgentManager services not initialized for handleScheduleCreate.');
        // Attempt re-initialization or throw error if critical path
        // For now, let's assume initialize() should have been called by processMessage
        if (!this.isInitialized) await this.initialize(); // Make sure initialize was called
        if (!this.enhancedScheduler) { // Still not there?
            console.error('EnhancedScheduler is still not initialized after re-check.');
            return; // Or throw an error
        }
      }

      const { clientId, caregiverId, date, startTime, endTime, notes, clientName, caregiverName, tasks } = parameters;

      // Basic validation for required fields
      if (!clientId || !date || !startTime || !endTime) {
        console.error('Missing required parameters for schedule creation:', parameters);
        // Optionally, could return a structured error or throw
        return;
      }

      const scheduleData = {
        clientId,
        caregiverId: caregiverId || null, // Ensure null if undefined
        date,
        startTime,
        endTime,
        notes: notes || '',
        clientName: clientName || '', // Optional: client/caregiver names can be denormalized
        caregiverName: caregiverName || '', // Optional
        tasks: tasks || [],
        status: (parameters.status !== undefined && parameters.status !== null && parameters.status !== '') ? parameters.status : 'pending_confirmation', // More explicit check
        createdBy: userId, // Record which user (via agent) initiated this
        // Timestamps should ideally be handled by Firestore (FieldValue.serverTimestamp())
        // or consistently by the service creating the record.
        // enhancedScheduler.createSchedule should handle this.
      };

      console.log(`AgentManager: Calling enhancedScheduler.createSchedule for user ${userId} with data:`, scheduleData);
      const result = await this.enhancedScheduler.createSchedule(scheduleData);
      console.log(`AgentManager: Schedule creation action for user ${userId} processed by EnhancedScheduler. Result:`, result);
      // Potentially, add a system message to conversation history indicating success/failure here
    } catch (error) {
      console.error(`Error in AgentManager.handleScheduleCreate for user ${userId}:`, error);
      // Potentially, add a system message to conversation history about the error
    }
  }

  /**
   * Handle a schedule update action
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleScheduleUpdate(userId, parameters) {
    try {
      if (!this.enhancedScheduler) {
        console.error('AgentManager EnhancedScheduler not initialized for handleScheduleUpdate.');
        if (!this.isInitialized) await this.initialize();
        if (!this.enhancedScheduler) {
             console.error('EnhancedScheduler is still not initialized after re-check.');
             return;
        }
      }
      const { scheduleId, ...updates } = parameters; // Assuming 'updates' is not a nested key, but rather remaining params are updates.
                                                 // If parameters = { scheduleId, updates: { startTime: '10:00' } }, then use:
                                                 // const { scheduleId, updates: actualUpdates } = parameters; and use actualUpdates below.
      if (!scheduleId || Object.keys(updates).length === 0) {
        console.error('Missing scheduleId or update data for schedule update:', parameters);
        return;
      }
      const updateData = { ...updates, updatedBy: userId, updatedAt: new Date().toISOString() }; // Consider service handling timestamp
      console.log(`AgentManager: Calling enhancedScheduler.updateSchedule for user ${userId}, schedule ${scheduleId} with data:`, updateData);
      const result = await this.enhancedScheduler.updateSchedule(scheduleId, updateData);
      console.log(`Schedule update action for user ${userId} (schedule ${scheduleId}) processed. Result:`, result);
    } catch (error) {
      console.error(`Error in AgentManager.handleScheduleUpdate for user ${userId} (schedule ${parameters.scheduleId}):`, error);
    }
  }

  /**
   * Handle a caregiver assignment action
   * @param {string} userId - The user's ID
   * @param {Object} parameters - The action parameters
   * @returns {Promise<void>}
   */
  async handleCaregiverAssign(userId, parameters) {
    console.log(`AgentManager: handleCaregiverAssign for user ${userId} with params:`, parameters);
    try {
      if (!this.enhancedScheduler) {
        console.error('AgentManager EnhancedScheduler not initialized for handleCaregiverAssign.');
        if (!this.isInitialized) await this.initialize();
        if (!this.enhancedScheduler) {
            console.error('EnhancedScheduler is still not initialized after re-check.');
            return;
        }
      }
      const { scheduleId, caregiverId } = parameters;
      if (!scheduleId || !caregiverId) {
        console.error('Missing scheduleId or caregiverId for assignment:', parameters);
        return;
      }
      console.log(`AgentManager: Calling enhancedScheduler.assignCaregiverToSchedule for user ${userId}, schedule ${scheduleId}, caregiver ${caregiverId}`);
      const result = await this.enhancedScheduler.assignCaregiverToSchedule(scheduleId, caregiverId);
      console.log(`Caregiver assignment action for user ${userId} (schedule ${scheduleId}, caregiver ${caregiverId}) processed. Result:`, result);
    } catch (error) {
      console.error(`Error in AgentManager.handleCaregiverAssign for user ${userId}:`, error);
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
  async scanForOpportunities() {
    if (!this.isInitialized || !this.firebaseService || !this.enhancedScheduler) {
      await this.initialize();
      if (!this.isInitialized || !this.firebaseService || !this.enhancedScheduler) {
          console.error("AgentManager or its services not initialized for scanForOpportunities.");
          return [];
      }
    }
    console.log('Scanning for scheduling opportunities...');
    try {
      const firebaseService = this.firebaseService; // Use initialized instance
      const enhancedScheduler = this.enhancedScheduler; // Use initialized instance
      
      // Get all schedules that are unassigned
      const unassignedSchedules = await firebaseService.db.collection('schedules')
        .where('status', '==', 'Pending') // Or 'unassigned', based on actual status used
        .get()
        .then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Process each unassigned schedule to find potential matches
      const opportunities = [];
      
      for (const schedule of unassignedSchedules) {
        if (!schedule.id) { // Guard against schedules without ID
          console.warn("Skipping schedule due to missing ID:", schedule);
          continue;
        }
        // Find potential caregivers for this schedule
        const availableCaregivers = await enhancedScheduler.findAvailableCaregivers(schedule.id);
        
        if (availableCaregivers.length > 0) {
          const opportunity = {
            id: `opp-${schedule.id}-${Date.now()}`, // More stable ID
            type: 'caregiver_assignment',
            schedule_id: schedule.id,
            clientId: schedule.clientId,
            clientName: schedule.clientName,
            date: schedule.date,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            candidates: availableCaregivers.slice(0, 3).map(c => ({
              caregiverId: c.id,
              name: c.name,
              score: c.score,
              distance: c.distance || 'unknown'
            })),
            created_at: new Date().toISOString(),
            status: 'pending',
            priority: availableCaregivers[0].score > 85 ? 'high' : 'medium'
          };
          
          opportunities.push(opportunity);
          
          // Save the opportunity to the database
          await firebaseService.addDocument('opportunities', opportunity);
        }
      }
      
      // Get scheduling efficiency opportunities
      // These would be schedules that could be optimized
      const efficiencyOpportunities = await this.identifyEfficiencyOpportunities();
      opportunities.push(...efficiencyOpportunities);
      
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
      if (!this.isInitialized || !this.firebaseService) { // enhancedScheduler not directly used here, but firebaseService is
        await this.initialize();
        if (!this.isInitialized || !this.firebaseService) {
            console.error("AgentManager or FirebaseService not initialized for getOpportunityDetails.");
            return null;
        }
      }
      const firebaseService = this.firebaseService;
      
      // Get the opportunity from the database
      const opportunity = await firebaseService.getDocument('opportunities', opportunityId);
      
      if (!opportunity) {
        throw new Error(`Opportunity ${opportunityId} not found`);
      }
      
      // Enhance with additional information based on opportunity type
      if (opportunity.type === 'caregiver_assignment' && opportunity.schedule_id) {
        // Get more information about the schedule
        const schedule = await firebaseService.getSchedule(opportunity.schedule_id);
        
        // Get more information about the client
        const client = schedule && schedule.clientId ? await firebaseService.getClient(schedule.clientId) : null;
        
        // Get full details for each candidate caregiver
        let enhancedCandidates = [];
        if (opportunity.candidates && Array.isArray(opportunity.candidates)) {
            for (const candidate of opportunity.candidates) {
                const caregiverIdToFetch = candidate.caregiverId || candidate.caregiver_id; // Handle potential inconsistency
                const nameToUse = candidate.name || candidate.caregiver_name; // Handle potential inconsistency
                const caregiver = caregiverIdToFetch ? await firebaseService.getCaregiver(caregiverIdToFetch) : null;

                enhancedCandidates.push({
                  ...candidate,
                  // Ensure consistent naming if needed by consumers, or keep as is from opportunity record
                  caregiverId: caregiverIdToFetch,
                  name: nameToUse,
                  caregiver_details: caregiver,
                  // Consider if fetching live availability here is too slow or should be a separate action
                  // availability: caregiver ? await firebaseService.getCaregiverAvailability(caregiverIdToFetch) : null
                });
            }
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
      if (!this.isInitialized || !this.firebaseService || !this.enhancedScheduler) {
        await this.initialize();
         if (!this.isInitialized || !this.firebaseService || !this.enhancedScheduler) {
            console.error("AgentManager or its services not initialized for applyOpportunity.");
            throw new Error("Services not initialized.");
        }
      }
      const firebaseService = this.firebaseService;
      const enhancedScheduler = this.enhancedScheduler;
      
      // Get the opportunity
      const opportunity = await firebaseService.getDocument('opportunities', opportunityId);
      
      if (!opportunity) {
        throw new Error(`Opportunity ${opportunityId} not found`);
      }
      
      // Apply the opportunity based on its type
      if (opportunity.type === 'caregiver_assignment') {
        if (!opportunity.candidates || opportunity.candidates.length === 0) {
            throw new Error(`No candidates found for opportunity ${opportunityId}`);
        }
        const bestCandidate = opportunity.candidates[0]; // Assuming first is best
        const caregiverIdToAssign = bestCandidate.caregiverId || bestCandidate.caregiver_id; // Handle variations

        if (!opportunity.schedule_id || !caregiverIdToAssign) {
            console.error("Missing schedule_id or caregiverId in opportunity data for apply:", opportunity);
            throw new Error(`Missing schedule_id or valid caregiverId in opportunity data for ${opportunityId}`);
        }
        
        // Assign the caregiver to the schedule
        const result = await enhancedScheduler.assignCaregiverToSchedule(
          opportunity.schedule_id, 
          caregiverIdToAssign
        );
        
        // Update the opportunity status
        await firebaseService.updateDocument('opportunities', opportunityId, {
          status: result.success ? 'applied' : 'failed_apply', // More specific status
          applied_at: new Date().toISOString(),
          applied_by: options.appliedBy || userId || 'system', // Include userId if available from action handler
          application_result: result,
          selected_caregiver_id: caregiverIdToAssign,
          ...options
        });
        
        return {
          success: result.success,
          opportunity, // Return the original opportunity for context
          result // Return the result of assignment
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
      if (!this.isInitialized || !this.firebaseService) {
        await this.initialize();
        if (!this.isInitialized || !this.firebaseService) {
            console.error("AgentManager or FirebaseService not initialized for rejectOpportunity.");
            throw new Error("FirebaseService not initialized.");
        }
      }
      const firebaseService = this.firebaseService;
      
      // Update the opportunity status
      await firebaseService.updateDocument('opportunities', opportunityId, {
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: options.rejectedBy || 'system', // Default to system if not provided in options
        rejection_reason: options.reason || '', // Ensure reason from params is used
        ...options // Pass other options like notes if any
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
   * @returns {Promise<Array>} The efficiency opportunities
   */
  async identifyEfficiencyOpportunities() {
    // This would analyze the schedules and find opportunities to improve efficiency
    // For example, consolidating multiple visits in the same area
    // For now, return an empty array as a placeholder
    return [];
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
      if (!this.isInitialized || !this.firebaseService || !this.enhancedScheduler) {
        await this.initialize();
        if (!this.isInitialized || !this.firebaseService || !this.enhancedScheduler) {
            console.error("AgentManager or its services not initialized for getInsightsForSchedule.");
            return { scheduleId, insights: [{ type: 'error', message: 'Services not initialized.' }] };
        }
      }
      const firebaseService = this.firebaseService;
      const enhancedScheduler = this.enhancedScheduler;
      
      const schedule = await firebaseService.getSchedule(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }
      
      // Get related client and caregiver (if assigned)
      // Ensure field names used (schedule.clientId, schedule.caregiverId) match the actual data model from firebaseService.getSchedule()
      const client = schedule.clientId ? await firebaseService.getClient(schedule.clientId) : null;
      const caregiver = schedule.caregiverId ? await firebaseService.getCaregiver(schedule.caregiverId) : null;
      
      // Get potential caregivers if not assigned
      const availableCaregivers = !schedule.caregiverId && schedule.id ?
        await enhancedScheduler.findAvailableCaregivers(schedule.id) : []; // Ensure schedule.id is passed
      
      // Generate insights
      const insights = {
        scheduleId,
        timestamp: new Date().toISOString(),
        insights: []
      };
      
      // Add schedule status insight
      insights.insights.push({
        type: 'status',
        message: schedule.caregiverId ? // Corrected to camelCase
          `This schedule is assigned to ${caregiver?.name || 'a caregiver'}.` : 
          'This schedule is currently unassigned.',
        priority: schedule.caregiverId ? 'low' : 'high' // Corrected to camelCase
      });
      
      // Add available caregivers insight
      if (availableCaregivers.length > 0) {
        // Ensure availableCaregivers objects have .name and .score properties
        const topCandidate = availableCaregivers[0];
        const topCandidateName = topCandidate.name || (topCandidate.caregiver && topCandidate.caregiver.name) || 'Unknown Candidate';
        const topCandidateScore = topCandidate.score || 'N/A';

        insights.insights.push({
          type: 'available_caregivers',
          message: `There are ${availableCaregivers.length} available caregivers for this schedule. Top match: ${topCandidateName} (${topCandidateScore}% match).`,
          priority: 'medium',
          caregivers: availableCaregivers.slice(0, 3) // Assuming structure is { id, name, score, ... }
        });
      }
      
      // Add client preference insight if caregiver assigned
      if (client && caregiver && schedule.caregiverId) { // Use schedule.caregiverId
        // Check if client has preferences that match/don't match caregiver
        const preferenceMatch = client.preferences && Array.isArray(client.preferences) &&
                                caregiver.skills && Array.isArray(caregiver.skills) &&
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
        typeof this.areLocationsClose === 'function' &&
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
      if (!this.isInitialized || !this.firebaseService) {
        await this.initialize();
        if (!this.isInitialized || !this.firebaseService) {
            console.error("AgentManager or FirebaseService not initialized for getSuggestions.");
            return { entityId, entityType, suggestions: [{ type: 'error', message: 'FirebaseService not initialized.' }] };
        }
      }
      const firebaseService = this.firebaseService;
      
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
        const unassignedSchedules = schedules.filter(s => !s.caregiverId); // Corrected: s.caregiverId
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
        if (!availability || !availability.regularSchedule || availability.regularSchedule.length === 0) { // More robust check
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

module.exports = AgentManager; // Export the class itself

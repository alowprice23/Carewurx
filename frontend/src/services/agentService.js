/**
 * Agent Service
 * Provides interface to agent-related functionality with browser fallback
 */

// Import the firebaseService to check if we're in Electron mode
import { firebaseService } from './index';

// Mock data for browser-only mode
const MOCK_CONVERSATIONS = {
  'bruce-conv-1': {
    id: 'bruce-conv-1',
    agent: 'Bruce',
    messages: [
      { sender: 'Bruce', text: 'Hello, I\'m Bruce. How can I assist you with scheduling?', timestamp: new Date() }
    ]
  },
  'lexxi-conv-1': {
    id: 'lexxi-conv-1',
    agent: 'Lexxi',
    messages: [
      { sender: 'Lexxi', text: 'Hi there! I\'m Lexxi. I can help you with opportunity management.', timestamp: new Date() }
    ]
  }
};

const MOCK_OPPORTUNITIES = [
  {
    id: 'opp-1',
    title: 'Morning Care Visit',
    score: 9.2,
    clientName: 'John Smith',
    scheduledDate: new Date().toISOString(),
    startTime: '09:00',
    endTime: '11:00',
    description: 'Assistance with morning routine and medication',
    status: null
  },
  {
    id: 'opp-2',
    title: 'Afternoon Check-in',
    score: 8.5,
    clientName: 'Mary Johnson',
    scheduledDate: new Date().toISOString(),
    startTime: '14:00',
    endTime: '15:30',
    description: 'Wellness check and light housekeeping',
    status: null
  },
  {
    id: 'opp-3',
    title: 'Evening Care Visit',
    score: 7.8,
    clientName: 'Robert Davis',
    scheduledDate: new Date().toISOString(),
    startTime: '18:00',
    endTime: '20:00',
    description: 'Dinner preparation and evening medication',
    status: 'applied'
  }
];

// Helper function to simulate network delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class AgentService {
  constructor() {
    // We are removing Electron, so this check is no longer primary.
    // We will rely on API calls. Mocks can be a secondary fallback.
    this.isElectronAvailable = false; // Assume Electron is not available
    this.mockConversations = { ...MOCK_CONVERSATIONS };
    this.mockOpportunities = [...MOCK_OPPORTUNITIES];
    
    console.log('Agent Service initializing for web API communication.');
  }

  async _fetchAPI(endpoint, options = {}) {
    const { body, method = 'GET', params } = options;
    let url = `/api${endpoint}`;

    if (params) {
      url += `?${new URLSearchParams(params)}`;
    }

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Add any other headers like Authorization if needed
      },
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`API Error (${response.status}): ${errorData.message || 'Unknown error'}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  /**
   * Generate a mock response based on input
   * @private
   * @param {string} message - User message
   * @param {string} agentName - Name of the agent
   * @returns {string} - Mock response
   */
  _generateMockResponse(message, agentName = 'Bruce') {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return `Hello! I'm ${agentName}. How can I assist you today?`;
    }
    
    if (lowerMessage.includes('schedule')) {
      return `I can help with scheduling! However, in browser-only mode, I can't access the actual scheduling system. This is just a demonstration of the UI.`;
    }
    
    if (lowerMessage.includes('opportunity') || lowerMessage.includes('opportunities')) {
      return `I found 3 potential opportunities that might interest you. However, this is just a UI demonstration in browser-only mode.`;
    }
    
    if (lowerMessage.includes('help')) {
      return `I'm here to help! In the full application, I could assist with scheduling, finding opportunities, and more. This is a limited demonstration in browser-only mode.`;
    }
    
    return `I understand you're asking about "${message}". In the full application with Electron, I would provide a proper response. This is a limited demonstration in browser-only mode.`;
  }

  /**
   * Process a message through the agent system
   * @param {string} userId - The user ID
   * @param {string} message - The message to process
   * @param {Object} options - Optional parameters
   * @returns {Promise<string>} - The agent's response
   */
  async processMessage(userId, message, options = {}) {
    try {
      return await this._fetchAPI('/agent/processMessage', {
        method: 'POST',
        body: { userId, message, options },
      });
    } catch (error) {
      console.warn('API call failed for processMessage, falling back to mock.', error);
      // Fallback to mock if API fails
      console.log('Agent Service: Using mock response due to API error or browser-only mode');
      await delay(1000);
      const agentName = options.agent || 'Bruce';
      return this._generateMockResponse(message, agentName);
    }
  }

  /**
   * Start a conversation with a specific agent
   * @param {string} userId - The user ID
   * @param {string} agentName - The name of the agent (e.g., 'Lexxi', 'Bruce')
   * @param {string} initialMessage - The initial message to send
   * @returns {Promise<Object>} - Conversation details including ID
   */
  async startConversation(userId, agentName, initialMessage) {
    try {
      // userId might be part of a session/token in a real app, passed in headers
      // For now, sending it in the body if the API expects it.
      return await this._fetchAPI('/agent/startConversation', {
        method: 'POST',
        body: { agentName, initialMessage, userId }, // Assuming userId is needed by API
      });
    } catch (error) {
      console.warn('API call failed for startConversation, falling back to mock.', error);
      // Fallback to mock
      console.log('Agent Service: Creating mock conversation due to API error or browser-only mode');
      await delay(800);
      const conversationId = `${agentName.toLowerCase()}-conv-${Date.now()}`;
      this.mockConversations[conversationId] = {
        id: conversationId,
        agent: agentName,
        messages: [
          { sender: agentName, text: `Hello, I'm ${agentName}. How can I assist you today?`, timestamp: new Date() }
        ]
      };
      return {
        conversationId,
        agent: agentName,
        initialResponse: `Hello, I'm ${agentName}. How can I assist you today?`
      };
    }
  }

  /**
   * Get agent response in an existing conversation
   * @param {string} conversationId - The conversation ID
   * @param {string} message - The message to send
   * @returns {Promise<string>} - The agent's response
   */
  async getResponse(conversationId, message) {
    try {
      return await this._fetchAPI(`/agent/getResponse/${conversationId}`, {
        method: 'POST',
        body: { message },
      });
    } catch (error) {
      console.warn(`API call failed for getResponse (convId: ${conversationId}), falling back to mock.`, error);
      // Fallback to mock
      console.log('Agent Service: Generating mock response due to API error or browser-only mode');
      await delay(1200);
      const conversation = this.mockConversations[conversationId];
      if (!conversation) {
        throw new Error('Conversation not found (mock)');
      }
      conversation.messages.push({ sender: 'user', text: message, timestamp: new Date() });
      const mockResponse = this._generateMockResponse(message, conversation.agent);
      conversation.messages.push({ sender: conversation.agent, text: mockResponse, timestamp: new Date() });
      return mockResponse; // The API might return more structured data
    }
  }

  /**
   * Scan for scheduling opportunities
   * @param {Object} options - Scan options
   * @returns {Promise<Array>} - List of opportunities
   */
  async scanForOpportunities(options = {}) {
    try {
      return await this._fetchAPI('/agent/scanForOpportunities', {
        method: 'POST', // Assuming POST for options, could be GET with query params
        body: { options },
      });
    } catch (error) {
      console.warn('API call failed for scanForOpportunities, falling back to mock.', error);
      // Fallback to mock
      console.log('Agent Service: Using mock opportunities due to API error or browser-only mode');
      await delay(1500);
      return this.mockOpportunities;
    }
  }

  /**
   * Get details for a specific opportunity
   * @param {string} opportunityId - The opportunity ID
   * @returns {Promise<Object>} - Opportunity details
   */
  async getOpportunityDetails(opportunityId) {
    try {
      return await this._fetchAPI(`/agent/opportunityDetails/${opportunityId}`);
    } catch (error) {
      console.warn(`API call failed for getOpportunityDetails (id: ${opportunityId}), falling back to mock.`, error);
      // Fallback to mock
      console.log('Agent Service: Using mock opportunity details due to API error or browser-only mode');
      await delay(800);
      const opportunity = this.mockOpportunities.find(opp => opp.id === opportunityId);
      if (!opportunity) {
        throw new Error('Opportunity not found (mock)');
      }
      return {
        ...opportunity,
        caregivers: [
          { id: 'cg-1', name: 'Alice Brown', rating: 4.8 },
          { id: 'cg-2', name: 'Bob Wilson', rating: 4.5 }
        ],
        notes: 'This is a mock opportunity in browser-only mode'
      };
    }
  }

  /**
   * Apply an opportunity
   * @param {string} opportunityId - The opportunity ID
   * @param {Object} options - Application options
   * @returns {Promise<Object>} - Result of application
   */
  async applyOpportunity(opportunityId, options = {}) {
    try {
      return await this._fetchAPI(`/agent/applyOpportunity/${opportunityId}`, {
        method: 'POST',
        body: { options },
      });
    } catch (error) {
      console.warn(`API call failed for applyOpportunity (id: ${opportunityId}), falling back to mock.`, error);
      // Fallback to mock
      console.log('Agent Service: Updating mock opportunity status due to API error or browser-only mode');
      await delay(1000);
      const opportunity = this.mockOpportunities.find(opp => opp.id === opportunityId);
      if (!opportunity) {
        throw new Error('Opportunity not found (mock)');
      }
      opportunity.status = 'applied';
      return {
        success: true,
        message: 'Opportunity applied successfully (mock)',
        opportunity
      };
    }
  }

  /**
   * Reject an opportunity
   * @param {string} opportunityId - The opportunity ID
   * @param {string} reason - Reason for rejection
   * @returns {Promise<Object>} - Result of rejection
   */
  async rejectOpportunity(opportunityId, reason = '') {
    try {
      return await this._fetchAPI(`/agent/rejectOpportunity/${opportunityId}`, {
        method: 'POST',
        body: { reason },
      });
    } catch (error) {
      console.warn(`API call failed for rejectOpportunity (id: ${opportunityId}), falling back to mock.`, error);
      // Fallback to mock
      console.log('Agent Service: Updating mock opportunity status due to API error or browser-only mode');
      await delay(1000);
      const opportunity = this.mockOpportunities.find(opp => opp.id === opportunityId);
      if (!opportunity) {
        throw new Error('Opportunity not found (mock)');
      }
      opportunity.status = 'rejected';
      opportunity.rejectionReason = reason;
      return {
        success: true,
        message: 'Opportunity rejected successfully (mock)',
        opportunity
      };
    }
  }

  /**
   * Get agent insights for a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Object>} - Insights data
   */
  async getInsights(scheduleId) {
    try {
      return await this._fetchAPI(`/agent/insights/${scheduleId}`);
    } catch (error) {
      console.warn(`API call failed for getInsights (scheduleId: ${scheduleId}), falling back to mock.`, error);
      // Fallback to mock
      console.log('Agent Service: Generating mock insights due to API error or browser-only mode');
      await delay(1200);
      return {
        scheduleCoverage: 85,
        clientSatisfaction: 92,
        caregiverUtilization: 78,
        recommendations: [
          'Consider adjusting evening shifts to improve coverage',
          'Some clients may benefit from longer morning visits',
          'Look into potential scheduling conflicts on Fridays'
        ],
        warning: 'This is mock data in browser-only mode'
      };
    }
  }

  /**
   * Get agent suggestions for an entity
   * @param {string} entityId - The entity ID
   * @param {string} entityType - The entity type ('client', 'caregiver', 'schedule')
   * @returns {Promise<Array>} - List of suggestions
   */
  async getSuggestions(entityId, entityType) {
    try {
      return await this._fetchAPI(`/agent/suggestions/${entityType}/${entityId}`);
    } catch (error) {
      console.warn(`API call failed for getSuggestions (entity: ${entityType}/${entityId}), falling back to mock.`, error);
      // Fallback to mock
      console.log('Agent Service: Generating mock suggestions due to API error or browser-only mode');
      await delay(1000);
      const suggestions = [
        { id: 'sugg-1', title: 'Scheduling Suggestion (Mock)', description: 'Consider adjusting appointment times to optimize travel routes', confidence: 0.85, type: 'schedule' },
        { id: 'sugg-2', title: 'Client Preference (Mock)', description: 'This client prefers morning appointments according to historical data', confidence: 0.92, type: 'client' },
        { id: 'sugg-3', title: 'Caregiver Matching (Mock)', description: 'Based on skills and location, this caregiver might be a good match', confidence: 0.78, type: 'caregiver' }
      ];
      return entityType ? suggestions.filter(s => s.type === entityType) : suggestions;
    }
  }
}

// Create and export singleton instance
const agentService = new AgentService();
export default agentService;

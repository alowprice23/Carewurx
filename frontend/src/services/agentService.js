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
    this.isElectronAvailable = typeof window !== 'undefined' && window.electronAPI;
    this.mockConversations = { ...MOCK_CONVERSATIONS };
    this.mockOpportunities = [...MOCK_OPPORTUNITIES];
    
    console.log(`Agent Service initializing in ${this.isElectronAvailable ? 'Electron' : 'browser-only'} mode`);
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
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        // Match the correct method name in preload.js
        return await window.electronAPI.processMessage(userId, message);
      } else {
        // Browser-only mode: generate a mock response
        console.log('Agent Service: Using mock response in browser-only mode');
        await delay(1000); // Simulate network delay
        const agentName = options.agent || 'Bruce';
        return this._generateMockResponse(message, agentName);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error(`Failed to process agent message: ${error.message}`);
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
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        // Make sure to pass userId if the API expects it
        return await window.electronAPI.startAgentConversation(agentName, initialMessage);
      } else {
        // Browser-only mode: create a mock conversation
        console.log('Agent Service: Creating mock conversation in browser-only mode');
        await delay(800); // Simulate network delay
        
        const conversationId = `${agentName.toLowerCase()}-conv-${Date.now()}`;
        this.mockConversations[conversationId] = {
          id: conversationId,
          agent: agentName,
          messages: [
            { 
              sender: agentName, 
              text: `Hello, I'm ${agentName}. How can I assist you today?`, 
              timestamp: new Date() 
            }
          ]
        };
        
        return { 
          conversationId, 
          agent: agentName,
          initialResponse: `Hello, I'm ${agentName}. How can I assist you today?`
        };
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw new Error(`Failed to start agent conversation: ${error.message}`);
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
      if (this.isElectronAvailable) {
        return await window.electronAPI.getAgentResponse(conversationId, message);
      } else {
        // Browser-only mode: generate a mock response
        console.log('Agent Service: Generating mock response in browser-only mode');
        await delay(1200); // Simulate network delay
        
        const conversation = this.mockConversations[conversationId];
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        
        // Add user message to the conversation
        conversation.messages.push({
          sender: 'user',
          text: message,
          timestamp: new Date()
        });
        
        // Generate and add agent response
        const response = this._generateMockResponse(message, conversation.agent);
        conversation.messages.push({
          sender: conversation.agent,
          text: response,
          timestamp: new Date()
        });
        
        return response;
      }
    } catch (error) {
      console.error('Error getting agent response:', error);
      throw error;
    }
  }

  /**
   * Scan for scheduling opportunities
   * @param {Object} options - Scan options
   * @returns {Promise<Array>} - List of opportunities
   */
  async scanForOpportunities(options = {}) {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI) {
          throw new Error('Electron API not available - backend connection missing');
        }
        return await window.electronAPI.scanForOpportunities(options);
      } else {
        // Browser-only mode: return mock opportunities
        console.log('Agent Service: Using mock opportunities in browser-only mode');
        await delay(1500); // Simulate network delay
        return this.mockOpportunities;
      }
    } catch (error) {
      console.error('Error scanning for opportunities:', error);
      throw new Error(`Failed to scan for opportunities: ${error.message}`);
    }
  }

  /**
   * Get details for a specific opportunity
   * @param {string} opportunityId - The opportunity ID
   * @returns {Promise<Object>} - Opportunity details
   */
  async getOpportunityDetails(opportunityId) {
    try {
      if (this.isElectronAvailable) {
        return await window.electronAPI.getOpportunityDetails(opportunityId);
      } else {
        // Browser-only mode: return mock opportunity details
        console.log('Agent Service: Using mock opportunity details in browser-only mode');
        await delay(800); // Simulate network delay
        
        const opportunity = this.mockOpportunities.find(opp => opp.id === opportunityId);
        if (!opportunity) {
          throw new Error('Opportunity not found');
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
    } catch (error) {
      console.error('Error getting opportunity details:', error);
      throw error;
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
      if (this.isElectronAvailable) {
        return await window.electronAPI.applyOpportunity(opportunityId, options);
      } else {
        // Browser-only mode: update mock opportunity status
        console.log('Agent Service: Updating mock opportunity status in browser-only mode');
        await delay(1000); // Simulate network delay
        
        const opportunity = this.mockOpportunities.find(opp => opp.id === opportunityId);
        if (!opportunity) {
          throw new Error('Opportunity not found');
        }
        
        opportunity.status = 'applied';
        
        return {
          success: true,
          message: 'Opportunity applied successfully',
          opportunity
        };
      }
    } catch (error) {
      console.error('Error applying opportunity:', error);
      throw error;
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
      if (this.isElectronAvailable) {
        return await window.electronAPI.rejectOpportunity(opportunityId, reason);
      } else {
        // Browser-only mode: update mock opportunity status
        console.log('Agent Service: Updating mock opportunity status in browser-only mode');
        await delay(1000); // Simulate network delay
        
        const opportunity = this.mockOpportunities.find(opp => opp.id === opportunityId);
        if (!opportunity) {
          throw new Error('Opportunity not found');
        }
        
        opportunity.status = 'rejected';
        opportunity.rejectionReason = reason;
        
        return {
          success: true,
          message: 'Opportunity rejected successfully',
          opportunity
        };
      }
    } catch (error) {
      console.error('Error rejecting opportunity:', error);
      throw error;
    }
  }

  /**
   * Get agent insights for a schedule
   * @param {string} scheduleId - The schedule ID
   * @returns {Promise<Object>} - Insights data
   */
  async getInsights(scheduleId) {
    try {
      if (this.isElectronAvailable) {
        return await window.electronAPI.getAgentInsights(scheduleId);
      } else {
        // Browser-only mode: return mock insights
        console.log('Agent Service: Generating mock insights in browser-only mode');
        await delay(1200); // Simulate network delay
        
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
    } catch (error) {
      console.error('Error getting insights:', error);
      throw error;
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
      if (this.isElectronAvailable) {
        return await window.electronAPI.getAgentSuggestions(entityId, entityType);
      } else {
        // Browser-only mode: return mock suggestions
        console.log('Agent Service: Generating mock suggestions in browser-only mode');
        await delay(1000); // Simulate network delay
        
        const suggestions = [
          {
            id: 'sugg-1',
            title: 'Scheduling Suggestion',
            description: 'Consider adjusting appointment times to optimize travel routes',
            confidence: 0.85,
            type: 'schedule'
          },
          {
            id: 'sugg-2',
            title: 'Client Preference',
            description: 'This client prefers morning appointments according to historical data',
            confidence: 0.92,
            type: 'client'
          },
          {
            id: 'sugg-3',
            title: 'Caregiver Matching',
            description: 'Based on skills and location, this caregiver might be a good match',
            confidence: 0.78,
            type: 'caregiver'
          }
        ];
        
        // Filter by entity type if specified
        return entityType ? suggestions.filter(s => s.type === entityType) : suggestions;
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw error;
    }
  }

  /**
   * Get API key status from the backend
   * @returns {Promise<Object>} - Object with boolean flags for each provider (e.g., { groq: true, openai: false })
   */
  async getApiKeyStatus() {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI || typeof window.electronAPI.getApiKeyStatus !== 'function') {
          console.warn('Electron API getApiKeyStatus not available, falling back to mock.');
          // Fallback to mock if function specifically isn't there
          return { groq: false, openai: false, anthropic: false, error: 'IPC function missing' };
        }
        return await window.electronAPI.getApiKeyStatus();
      } else {
        console.log('Agent Service: Using mock API key status in browser-only mode');
        await delay(300);
        // In browser mode, assume no keys are valid by default for safety
        return { groq: false, openai: false, anthropic: false };
      }
    } catch (error) {
      console.error('Error getting API key status:', error);
      // Return a default error state
      return { groq: false, openai: false, anthropic: false, error: error.message };
    }
  }

  /**
   * Stream response from an LLM provider
   * @param {Object} params - Parameters including provider, model, prompt, onChunk callback, signal
   * @returns {Promise<Object>} - Object with fullResponse and token counts
   */
  async streamResponse({ provider, model, prompt, onChunk, signal }) {
    try {
      if (this.isElectronAvailable) {
        if (!window.electronAPI || typeof window.electronAPI.streamLLMResponse !== 'function') {
           console.warn('Electron API streamLLMResponse not available, falling back to mock.');
           // Fallback to mock if function specifically isn't there
           const mockResponse = this._generateMockResponse(prompt, 'LLM');
           for (const char of mockResponse) {
             await delay(50);
             if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
             onChunk(char);
           }
           return { fullResponse: mockResponse, promptTokens: 10, responseTokens: mockResponse.length };
        }
        // Assuming the backend will handle the onChunk callback via IPC events
        // The actual implementation of this IPC call might be more complex
        // and involve setting up event listeners for streaming chunks.
        // For now, we assume electronAPI.streamLLMResponse handles this.
        return await window.electronAPI.streamLLMResponse({ provider, model, prompt, signal }, onChunk);
      } else {
        console.log('Agent Service: Using mock LLM stream in browser-only mode');
        const mockFullResponse = `Mock response for "${prompt}" from ${model} via ${provider}. This is a simulated stream.`;
        // Simulate streaming
        for (let i = 0; i < mockFullResponse.length; i++) {
          if (signal?.aborted) {
            console.log('Mock stream aborted');
            throw new DOMException('Aborted by user.', 'AbortError');
          }
          onChunk(mockFullResponse[i]);
          await delay(50); // Simulate typing delay
        }
        return {
          fullResponse: mockFullResponse,
          promptTokens: prompt.length / 4, // Rough estimate
          responseTokens: mockFullResponse.length / 4 // Rough estimate
        };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted by client:', error.message);
      } else {
        console.error('Error streaming LLM response:', error);
      }
      throw error; // Re-throw to be caught by UI
    }
  }

  /**
   * Submit feedback for an LLM response
   * @param {Object} feedbackData - Data including provider, model, prompt, response, quality, feedback
   * @returns {Promise<Object>} - Confirmation of submission
   */
  async submitResponseFeedback(feedbackData) {
    try {
      if (this.isElectronAvailable) {
         if (!window.electronAPI || typeof window.electronAPI.submitLLMFeedback !== 'function') {
          console.warn('Electron API submitLLMFeedback not available, falling back to mock.');
          return { success: true, message: 'Feedback submitted (mock - IPC missing)' };
        }
        return await window.electronAPI.submitLLMFeedback(feedbackData);
      } else {
        console.log('Agent Service: Using mock feedback submission in browser-only mode');
        await delay(500);
        console.log('Mock feedback submitted:', feedbackData);
        return { success: true, message: 'Feedback submitted (mock)' };
      }
    } catch (error) {
      console.error('Error submitting LLM feedback:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const agentService = new AgentService();
export default agentService;

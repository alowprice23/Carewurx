/**
 * Bruce Agent Model
 * The general healthcare assistant for Carewurx
 */

const { getSystemPrompt } = require('../core/prompt-templates');
const LLMService = require('../core/llm-service');

class Bruce {
  constructor(llmService) {
    this.name = 'Bruce';
    this.llmService = llmService;
    this.systemPrompt = getSystemPrompt('bruce');
  }

  /**
   * Generate a response to a user message
   * @param {string} userMessage - The user's message
   * @param {Array} chatHistory - The conversation history
   * @param {Object} context - Additional context for the response
   * @returns {Promise<string>} The generated response
   */
  async generateResponse(userMessage, chatHistory = [], context = {}) {
    console.log(`Bruce: Generating response to: "${userMessage.substring(0, 50)}..."`);
    
    try {
      // Augment the system prompt with context if available
      let enhancedPrompt = this.systemPrompt;
      
      // Add client information if available
      if (context.clients && context.clients.length > 0) {
        enhancedPrompt += `\n\nAvailable client information:`;
        context.clients.forEach(client => {
          enhancedPrompt += `\n- Name: ${client.name}, ${client.age ? `Age: ${client.age}, ` : ''}`;
          enhancedPrompt += `Needs: ${client.care_needs || 'Not specified'}`;
          
          if (client.notes) {
            enhancedPrompt += `, Notes: ${client.notes}`;
          }
        });
      }
      
      // Add caregiver information if available
      if (context.caregivers && context.caregivers.length > 0) {
        enhancedPrompt += `\n\nAvailable caregiver information:`;
        context.caregivers.forEach(caregiver => {
          enhancedPrompt += `\n- Name: ${caregiver.name}, `;
          enhancedPrompt += `Specialties: ${caregiver.specialties || 'General care'}, `;
          enhancedPrompt += `Available: ${caregiver.is_available ? 'Yes' : 'No'}`;
        });
      }
      
      // Add schedule information if available
      if (context.schedules && context.schedules.length > 0) {
        enhancedPrompt += `\n\nRelevant schedules:`;
        context.schedules.slice(0, 5).forEach(schedule => {
          enhancedPrompt += `\n- Client: ${schedule.client_name}, `;
          enhancedPrompt += `Caregiver: ${schedule.caregiver_name || 'Unassigned'}, `;
          enhancedPrompt += `Date: ${schedule.date}, `;
          enhancedPrompt += `Time: ${schedule.start_time} - ${schedule.end_time}`;
        });
        
        if (context.schedules.length > 5) {
          enhancedPrompt += `\n(${context.schedules.length - 5} more schedules not shown)`;
        }
      }
      
      // Add database lookup results if available
      if (context.databaseResults) {
        enhancedPrompt += `\n\nDatabase lookup results:`;
        enhancedPrompt += `\n${JSON.stringify(context.databaseResults, null, 2)}`;
      }
      
      // Add specific user context if available
      if (context.userRole) {
        enhancedPrompt += `\n\nThe user is a ${context.userRole}.`;
      }
      
      // Generate the response using the LLM
      const response = await this.llmService.generateChatResponse(
        enhancedPrompt,
        userMessage,
        chatHistory
      );
      
      return response;
    } catch (error) {
      console.error('Error generating Bruce response:', error);
      return `I apologize, but I'm having trouble providing a response right now. Please try again in a moment or contact technical support if the issue persists.`;
    }
  }

  /**
   * Handle a tool request
   * @param {string} toolName - The name of the tool to use
   * @param {Object} parameters - Parameters for the tool
   * @param {Array} chatHistory - The conversation history
   * @returns {Promise<string>} The tool response
   */
  async handleToolRequest(toolName, parameters, chatHistory = []) {
    console.log(`Bruce: Handling tool request: ${toolName}`);
    
    switch (toolName) {
      case 'lookupClient':
        return this.handleClientLookup(parameters);
        
      case 'lookupCaregiver':
        return this.handleCaregiverLookup(parameters);
        
      case 'searchRecords':
        return this.handleRecordSearch(parameters);
        
      case 'generateSummary':
        return this.handleSummaryGeneration(parameters, chatHistory);
        
      default:
        return `I don't have access to the ${toolName} tool. I can help with client lookups, caregiver lookups, record searches, and summary generation.`;
    }
  }

  /**
   * Handle a client lookup request
   * @param {Object} parameters - The lookup parameters
   * @returns {Promise<string>} The lookup response
   */
  async handleClientLookup(parameters) {
    if (!parameters.clientId && !parameters.clientName) {
      return 'I need either a client ID or name to look up client information.';
    }
    
    try {
      // This would connect to the client lookup service
      return `Here's the client information you requested: [Client data would appear here]`;
    } catch (error) {
      console.error('Error in client lookup:', error);
      return `I'm sorry, I couldn't retrieve the client information. ${error.message}`;
    }
  }

  /**
   * Handle a caregiver lookup request
   * @param {Object} parameters - The lookup parameters
   * @returns {Promise<string>} The lookup response
   */
  async handleCaregiverLookup(parameters) {
    if (!parameters.caregiverId && !parameters.caregiverName) {
      return 'I need either a caregiver ID or name to look up caregiver information.';
    }
    
    try {
      // This would connect to the caregiver lookup service
      return `Here's the caregiver information you requested: [Caregiver data would appear here]`;
    } catch (error) {
      console.error('Error in caregiver lookup:', error);
      return `I'm sorry, I couldn't retrieve the caregiver information. ${error.message}`;
    }
  }

  /**
   * Handle a record search request
   * @param {Object} parameters - The search parameters
   * @returns {Promise<string>} The search response
   */
  async handleRecordSearch(parameters) {
    if (!parameters.query) {
      return 'I need a search query to look up records.';
    }
    
    try {
      // This would connect to the record search service
      return `Here are the search results for "${parameters.query}": [Search results would appear here]`;
    } catch (error) {
      console.error('Error in record search:', error);
      return `I'm sorry, I couldn't search the records. ${error.message}`;
    }
  }

  /**
   * Handle a summary generation request
   * @param {Object} parameters - The generation parameters
   * @param {Array} chatHistory - The conversation history
   * @returns {Promise<string>} The summary response
   */
  async handleSummaryGeneration(parameters, chatHistory) {
    if (!parameters.topic) {
      return 'I need a topic to generate a summary.';
    }
    
    try {
      // Generate a summary based on chat history and parameters
      const summaryPrompt = `Generate a concise summary about ${parameters.topic} based on our conversation.`;
      
      // Use the LLM to generate the summary
      const summary = await this.llmService.generateChatResponse(
        this.systemPrompt,
        summaryPrompt,
        chatHistory
      );
      
      return summary;
    } catch (error) {
      console.error('Error generating summary:', error);
      return `I'm sorry, I couldn't generate a summary. ${error.message}`;
    }
  }
}

module.exports = Bruce;

/**
 * Response Parser
 * Extracts structured data from agent responses using LLM-generated JSON
 * Replaces brittle regex parsing with reliable structured output
 */

const LLMService = require('../core/llm-service');

class ResponseParser {
  constructor() {
    // Initialize the LLM service
    this.llmService = new LLMService(process.env.GROQ_API_KEY);
    
    // Define the response schema for validation
    this.responseSchema = {
      type: "object",
      properties: {
        text: { 
          type: "string",
          description: "The human-readable response text without any action markup"
        },
        actions: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { 
                type: "string", 
                enum: ["schedule_create", "schedule_update", "caregiver_assign", "cross_agent_query", "opportunity_action"],
                description: "The type of action to be performed"
              },
              parameters: {
                type: "object",
                description: "Parameters specific to the action type"
              }
            },
            required: ["type", "parameters"]
          },
          description: "Actions that should be taken based on this response"
        },
        entities: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { 
                type: "string", 
                enum: ["client", "caregiver", "schedule", "opportunity"],
                description: "The type of entity"
              },
              id: { 
                type: "string",
                description: "The entity ID if available"
              },
              name: { 
                type: "string",
                description: "The entity name if available"
              }
            },
            required: ["type"]
          },
          description: "Entities mentioned in the response"
        }
      },
      required: ["text", "actions"]
    };
  }

  /**
   * Parse a response from an agent using LLM-generated structured output
   * @param {string} response - The response text
   * @param {string} agentName - The agent that generated the response
   * @returns {Promise<Object>} The parsed response with extracted actions and entities
   */
  async parse(response, agentName) {
    console.log(`Parsing response from ${agentName} using structured approach`);
    
    if (!response) {
      return { text: '', actions: [] };
    }
    
    try {
      // First check if the response already contains structured JSON
      const existingJson = this.extractExistingJson(response);
      if (existingJson) {
        console.log('Found existing JSON in response');
        return this.validateAndNormalizeResponse(existingJson, response);
      }
      
      // If no existing JSON, use the LLM to generate structured output
      return await this.parseWithLLM(response, agentName);
    } catch (error) {
      console.error('Error parsing response:', error);
      // Return a fallback response
      return { 
        text: response, 
        actions: [],
        entities: []
      };
    }
  }

  /**
   * Extract existing JSON from a response if present
   * @param {string} response - The response text
   * @returns {Object|null} The extracted JSON object or null if not found
   */
  extractExistingJson(response) {
    // Check for JSON code blocks (```json {...} ```)
    const jsonBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1]);
      } catch (error) {
        console.error('Error parsing JSON block:', error);
      }
    }
    
    // Check for JSON object anywhere in the text
    const jsonObjectMatch = response.match(/\{[\s\S]*"text"[\s\S]*"actions"[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]);
      } catch (error) {
        console.error('Error parsing JSON object:', error);
      }
    }
    
    return null;
  }

  /**
   * Parse a response using the LLM service to generate structured output
   * @param {string} response - The response text
   * @param {string} agentName - The agent that generated the response
   * @returns {Promise<Object>} The parsed response
   */
  async parseWithLLM(response, agentName) {
    console.log(`Using LLM to parse response from ${agentName}`);
    
    // Create a system prompt that instructs the LLM how to parse the response
    const systemPrompt = `You are a response parser that extracts structured information from agent responses.
Given a response from the "${agentName}" agent, extract:
1. The clean text response (without any action markup)
2. Any actions that should be taken based on the response
3. Any entities mentioned in the response

Pay careful attention to details like:
- Schedule creation or updates
- Caregiver assignments
- Cross-agent queries (when one agent needs to consult another)
- Opportunity actions (accept/reject)

Extract specific parameters for each action type:
- For schedule_create: client_id, date, start_time, end_time, etc.
- For caregiver_assign: caregiver_id, schedule_id, etc.
- For cross_agent_query: query, targetAgent, etc.`;

    try {
      // Generate structured JSON from the response
      const structuredResponse = await this.llmService.generateStructuredResponse(
        systemPrompt,
        response,
        this.responseSchema,
        [], // no chat history needed
        { temperature: 0.1 } // low temperature for deterministic parsing
      );
      
      return this.validateAndNormalizeResponse(structuredResponse, response);
    } catch (error) {
      console.error('Error parsing with LLM:', error);
      throw error;
    }
  }

  /**
   * Validate and normalize a structured response
   * @param {Object} structuredResponse - The structured response object
   * @param {string} originalResponse - The original response text
   * @returns {Object} The validated and normalized response
   */
  validateAndNormalizeResponse(structuredResponse, originalResponse) {
    // Ensure the response has the required structure
    if (!structuredResponse.text) {
      structuredResponse.text = originalResponse;
    }
    
    if (!Array.isArray(structuredResponse.actions)) {
      structuredResponse.actions = [];
    }
    
    if (!Array.isArray(structuredResponse.entities)) {
      structuredResponse.entities = [];
    }
    
    // Add special handling for cross-agent queries
    structuredResponse.actions = structuredResponse.actions.map(action => {
      if (action.type === 'cross_agent_query') {
        if (!action.parameters) {
          action.parameters = {};
        }
        
        // Generate a request ID if not present
        if (!action.parameters.requestId) {
          action.parameters.requestId = `xq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
      }
      return action;
    });
    
    return structuredResponse;
  }

  /**
   * Create a new instance of the response parser with explicit dependencies
   * This method enables dependency injection for testing
   * @param {Object} llmService - The LLM service to use
   * @returns {ResponseParser} A new instance with the specified dependencies
   */
  static withDependencies(llmService) {
    const parser = new ResponseParser();
    if (llmService) {
      parser.llmService = llmService;
    }
    return parser;
  }
}

module.exports = ResponseParser;

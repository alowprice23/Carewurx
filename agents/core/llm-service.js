/**
 * LLM Service
 * Handles communication with the Groq API for language model generation using the official SDK
 */

const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LLMService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    this.model = 'llama3-70b-8192';
    
    // Initialize the Groq client
    this.client = new Groq({ apiKey: this.apiKey });
    
    // Configure better caching
    this.setupCache();
    
    console.log('LLM Service initialized with model:', this.model);
  }
  
  /**
   * Set up the caching system
   */
  setupCache() {
    this.responseCache = new Map();
    this.cacheMaxSize = 100; // Maximum number of items in cache
    this.cacheExpiryMs = 30 * 60 * 1000; // 30 minutes
    
    // Create cache directory if it doesn't exist
    this.cacheDir = path.join(__dirname, '..', '..', '.cache');
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create cache directory:', error);
      }
    }
  }

  /**
   * Generate a chat response using the Groq API via official SDK
   * @param {string} systemPrompt - The system prompt
   * @param {string} userMessage - The user's message
   * @param {Array} chatHistory - The conversation history
   * @param {Object} options - Additional options
   * @returns {Promise<string>} The generated response
   */
  async generateChatResponse(systemPrompt, userMessage, chatHistory = [], options = {}) {
    // Prepare the messages
    const messages = this.prepareMessages(systemPrompt, userMessage, chatHistory);
    
    // Check if we have a cached response
    const cacheKey = this.generateCacheKey(messages);
    const cachedResponse = await this.getCachedResponse(cacheKey);
    if (cachedResponse && !options.skipCache) {
      console.log('Using cached response for:', userMessage.substring(0, 30) + '...');
      return cachedResponse;
    }
    
    const requestOptions = {
      temperature: options.temperature !== undefined ? options.temperature : 0.5,
      max_tokens: options.maxTokens || 2048,
      top_p: options.topP || 0.9,
      model: options.model || this.model,
      messages
    };
    
    try {
      console.log(`Generating response with ${this.model} for: "${userMessage.substring(0, 30)}..."`);
      
      // Use the official SDK for the request
      const response = await this.client.chat.completions.create(requestOptions);
      
      if (response && response.choices && response.choices.length > 0) {
        const generatedText = response.choices[0].message.content;
        
        // Cache the response
        await this.cacheResponse(cacheKey, generatedText);
        
        return generatedText;
      } else {
        throw new Error('Invalid response format from Groq API');
      }
    } catch (error) {
      console.error('Error generating chat response:', error);
      
      // Handle specific error cases
      if (error.message.includes('rate limit') || error.response?.status === 429) {
        return this.getFallbackResponse('rate_limit', userMessage);
      } else if (error.message.includes('timeout') || error.response?.status === 504) {
        return this.getFallbackResponse('timeout', userMessage);
      }
      
      // General error fallback
      return this.getFallbackResponse('general', userMessage);
    }
  }

  /**
   * Prepare the messages for the chat completion request
   * @param {string} systemPrompt - The system prompt
   * @param {string} userMessage - The user's message
   * @param {Array} chatHistory - The conversation history
   * @returns {Array} The formatted messages
   */
  prepareMessages(systemPrompt, userMessage, chatHistory) {
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add chat history if available
    if (chatHistory && chatHistory.length > 0) {
      // Limit history to the last 10 messages to avoid token limits
      const limitedHistory = chatHistory.slice(-10);
      
      limitedHistory.forEach(msg => {
        let role = 'user';
        if (msg.sender === 'Bruce' || msg.sender === 'Lexxi' || msg.sender === 'System') {
          role = 'assistant';
        }
        
        messages.push({
          role,
          content: msg.text
        });
      });
    }
    
    // Add the current user message
    messages.push({ role: 'user', content: userMessage });
    
    return messages;
  }

  /**
   * Generate a chat response with JSON output
   * This is a critical improvement to make the system more reliable
   * @param {string} systemPrompt - The system prompt
   * @param {string} userMessage - The user's message
   * @param {Object} schema - The JSON schema to conform to
   * @param {Array} chatHistory - The conversation history
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} The structured JSON response
   */
  async generateStructuredResponse(systemPrompt, userMessage, schema, chatHistory = [], options = {}) {
    // Add JSON instructions to the system prompt
    const jsonSystemPrompt = `${systemPrompt}\n\nYou must respond in valid JSON format that conforms to this schema:\n${JSON.stringify(schema, null, 2)}`;
    
    // Create messages with JSON instruction
    const messages = this.prepareMessages(jsonSystemPrompt, userMessage, chatHistory);
    
    try {
      console.log(`Generating structured JSON response for: "${userMessage.substring(0, 30)}..."`);
      
      // Configure the request for JSON output
      const requestOptions = {
        temperature: options.temperature !== undefined ? options.temperature : 0.2, // Lower temperature for more deterministic output
        max_tokens: options.maxTokens || 2048,
        top_p: options.topP || 0.9,
        model: options.model || this.model,
        messages,
        response_format: { type: "json_object" } // Force JSON response
      };
      
      // Use the official SDK
      const response = await this.client.chat.completions.create(requestOptions);
      
      if (response && response.choices && response.choices.length > 0) {
        const jsonContent = response.choices[0].message.content;
        
        try {
          // Parse the JSON response
          return JSON.parse(jsonContent);
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
          // Attempt to extract JSON from the response if it's not pure JSON
          const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch (e) {
              throw new Error('Failed to parse JSON from response');
            }
          } else {
            throw new Error('Response is not in valid JSON format');
          }
        }
      } else {
        throw new Error('Invalid response format from Groq API');
      }
    } catch (error) {
      console.error('Error generating structured response:', error);
      throw error;
    }
  }

  /**
   * Generate a secure cache key for a set of messages
   * @param {Array} messages - The messages
   * @returns {string} The cache key
   */
  generateCacheKey(messages) {
    // Create a simplified version of messages for the cache key
    const simplifiedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content.substring(0, 200) // Use more characters for better uniqueness
    }));
    
    // Create a hash of the stringified messages
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(simplifiedMessages))
      .digest('hex');
    
    return hash;
  }

  /**
   * Get a cached response
   * @param {string} cacheKey - The cache key
   * @returns {Promise<string|null>} The cached response or null if not found
   */
  async getCachedResponse(cacheKey) {
    // First check in-memory cache
    if (this.responseCache.has(cacheKey)) {
      const cachedItem = this.responseCache.get(cacheKey);
      
      // Check if the cached item has expired
      if (Date.now() - cachedItem.timestamp < this.cacheExpiryMs) {
        return cachedItem.response;
      } else {
        // Remove expired item
        this.responseCache.delete(cacheKey);
      }
    }
    
    // If not in memory, check file cache
    const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.json`);
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        
        // Check if the file cache has expired
        if (Date.now() - cacheData.timestamp < this.cacheExpiryMs) {
          // Also store in memory for faster access next time
          this.responseCache.set(cacheKey, cacheData);
          return cacheData.response;
        } else {
          // Remove expired cache file
          fs.unlinkSync(cacheFilePath);
        }
      } catch (error) {
        console.error('Error reading cache file:', error);
      }
    }
    
    return null;
  }

  /**
   * Cache a response in both memory and file system
   * @param {string} cacheKey - The cache key
   * @param {string} response - The response to cache
   * @returns {Promise<void>}
   */
  async cacheResponse(cacheKey, response) {
    const cacheData = {
      response,
      timestamp: Date.now()
    };
    
    // Store in memory
    if (this.responseCache.size >= this.cacheMaxSize) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }
    
    this.responseCache.set(cacheKey, cacheData);
    
    // Store in file system
    const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.json`);
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error writing cache file:', error);
    }
  }

  /**
   * Get a fallback response when the API fails
   * @param {string} errorType - The type of error
   * @param {string} userMessage - The user's message
   * @returns {string} The fallback response
   */
  getFallbackResponse(errorType, userMessage) {
    // Check if we have static fallback responses
    try {
      const fallbacksPath = path.join(__dirname, '..', 'fallbacks', 'responses.json');
      if (fs.existsSync(fallbacksPath)) {
        const fallbacks = JSON.parse(fs.readFileSync(fallbacksPath, 'utf8'));
        if (fallbacks[errorType] && fallbacks[errorType].length > 0) {
          // Return a random fallback response for the given error type
          const randomIndex = Math.floor(Math.random() * fallbacks[errorType].length);
          return fallbacks[errorType][randomIndex];
        }
      }
    } catch (error) {
      console.error('Error loading fallback responses:', error);
    }
    
    // Default fallback responses
    switch (errorType) {
      case 'rate_limit':
        return "I'm currently experiencing high demand. Please try again in a moment while I work on your request.";
      case 'timeout':
        return "I'm taking longer than expected to process your request. Could we break this down into smaller parts?";
      case 'general':
      default:
        return "I'm having trouble processing your request right now. Could you try again or rephrase your question?";
    }
  }

  /**
   * Generate an embedding for a text
   * @param {string} text - The text to embed
   * @returns {Promise<Array<number>>} The embedding vector
   */
  async generateEmbedding(text) {
    try {
      // Use the Groq embeddings API
      const response = await this.client.embeddings.create({
        model: "llama3-embedding-v1",
        input: text,
      });
      
      if (response && response.data && response.data[0].embedding) {
        return response.data[0].embedding;
      } else {
        throw new Error('Invalid embedding response format');
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Return an empty array as fallback
      return [];
    }
  }
  
  /**
   * Process an agent's response to extract actionable insights and opportunities
   * using structured output instead of brittle regex parsing
   * @param {string} agentName - The name of the agent
   * @param {string} response - The agent's response text
   * @param {Object} context - Additional context information
   * @returns {Promise<Object>} The processed response with metadata
   */
  async processAgentResponse(agentName, response, context = {}) {
    console.log(`Processing ${agentName}'s response for actionable insights`);
    
    try {
      // Define the schema for structured output
      const schema = {
        type: "object",
        properties: {
          priority: { 
            type: "string", 
            enum: ["low", "medium", "high"],
            description: "The priority level of this response"
          },
          important: { 
            type: "boolean",
            description: "Whether this response contains important information that requires attention"
          },
          insights: { 
            type: "array",
            items: { type: "string" },
            description: "Key insights extracted from the response"
          },
          opportunities: { 
            type: "array",
            items: { type: "string" },
            description: "Potential opportunities identified in the response"
          },
          actions: { 
            type: "array",
            items: { type: "string" },
            description: "Concrete actions that should be taken based on this response"
          },
          summary: { 
            type: "string",
            description: "A concise summary of the response"
          }
        },
        required: ["priority", "important", "insights", "actions"]
      };
      
      // Craft a system prompt for the processing
      const systemPrompt = `You are an analysis assistant. Your task is to analyze the following response from ${agentName} and extract key information from it.
Extract insights, opportunities, and suggested actions.
Determine the priority and importance of the response.
Create a brief summary if the response is lengthy.`;
      
      // Ask the LLM to analyze the response and return structured data
      const structuredResult = await this.generateStructuredResponse(
        systemPrompt,
        response,
        schema,
        [],
        { temperature: 0.2 } // Low temperature for more deterministic processing
      );
      
      // Combine the structured result with the original text and timestamp
      return {
        text: response,
        timestamp: Date.now(),
        ...structuredResult
      };
      
    } catch (error) {
      console.error('Error processing agent response with structured output:', error);
      
      // Fallback to a simple processed response
      return {
        text: response,
        timestamp: Date.now(),
        important: false,
        priority: 'medium',
        insights: [],
        opportunities: [],
        actions: [],
        summary: response.length > 200 ? response.substring(0, 197) + '...' : response
      };
    }
  }
  
  /**
   * Create a summary of a long response
   * @param {string} response - The full response
   * @param {Array} insights - Any insights already extracted
   * @returns {string} A summary of the response
   */
  summarizeResponse(response, insights = []) {
    // If we have insights, use the first one as a summary
    if (insights.length > 0) {
      return insights[0];
    }
    
    // Otherwise, try to extract a meaningful first sentence
    const firstSentence = response.split(/[.!?]+/)[0].trim();
    
    if (firstSentence.length > 30 && firstSentence.length < 150) {
      return firstSentence;
    }
    
    // If the first sentence is too short or too long, return the first 100 chars
    return response.substring(0, 100) + '...';
  }
  
  /**
   * Analyze an opportunity to provide AI recommendations
   * @param {Object} opportunity - The opportunity data
   * @returns {Promise<Object>} AI recommendation with confidence score
   */
  async analyzeOpportunity(opportunity) {
    console.log(`Analyzing opportunity: ${opportunity.title}`);
    
    try {
      // For simple opportunities, we can use rule-based logic
      if (opportunity.type === 'caregiver_assignment' && opportunity.candidates) {
        const topCandidate = opportunity.candidates[0];
        
        if (topCandidate && topCandidate.score >= 85) {
          return {
            recommendation: 'accept',
            confidence: topCandidate.score / 100,
            reasoning: `${topCandidate.caregiver_name} is an excellent match with a score of ${topCandidate.score}.`
          };
        } else if (topCandidate && topCandidate.score >= 70) {
          return {
            recommendation: 'consider',
            confidence: topCandidate.score / 100,
            reasoning: `${topCandidate.caregiver_name} is a good match with a score of ${topCandidate.score}, but you may want to review the details.`
          };
        } else {
          return {
            recommendation: 'review',
            confidence: (topCandidate ? topCandidate.score : 50) / 100,
            reasoning: 'The available candidates are not ideal matches. Consider looking for alternatives.'
          };
        }
      }
      
      // For more complex opportunities, we could use the LLM in the future
      return {
        recommendation: 'review',
        confidence: 0.5,
        reasoning: 'This opportunity requires human review.'
      };
      
    } catch (error) {
      console.error('Error analyzing opportunity:', error);
      return {
        recommendation: 'error',
        confidence: 0,
        reasoning: 'An error occurred while analyzing this opportunity.'
      };
    }
  }
}

module.exports = LLMService;

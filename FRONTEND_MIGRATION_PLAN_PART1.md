# Frontend Migration Plan - Part 1

## Executive Summary

This comprehensive plan outlines the step-by-step process to migrate all backend functionality to the frontend in the Carewurx application, with a focus on agentic capabilities. The plan addresses the transformation from a hybrid architecture (Electron + Python microservice) to a fully integrated Electron frontend application that handles all functionality directly, including AI agent interactions, scheduling optimization, and database management.

The migration will prioritize a "clean slate" approach to ensure robust integration without legacy artifacts, while preserving and enhancing core functionality including the Bruce agent capabilities and adding the new Lexxi agent. The plan includes detailed implementation strategies, potential challenges, and mitigation approaches for each stage.

## Core Architecture Transformation

```mermaid
graph TD
    subgraph "Current Architecture"
        A1[Electron Frontend]
        B1[Python Flask Backend]
        C1[Firebase]
        D1[Groq API]
        
        A1 -- HTTP Requests --> B1
        A1 -- Direct Access --> C1
        B1 -- LLM Calls --> D1
    end
    
    subgraph "Target Architecture"
        A2[Electron App]
        C2[Firebase]
        D2[Groq API]
        
        A2 -- Direct LLM Calls --> D2
        A2 -- Data Storage/Retrieval --> C2
    end
    
    Current Architecture --> Target Architecture
```

## Stage 1: Setup Development Environment for Frontend Agent Integration

**Objective:** Create a solid foundation for implementing agent functionality directly in the Electron frontend.

**Implementation:**
1. Create a new directory structure in the frontend for agent capabilities:
   ```
   /agents
   ├── /core
   │   ├── agent-manager.js
   │   ├── llm-service.js
   │   ├── prompt-templates.js
   │   └── agent-tools.js
   ├── /models
   │   ├── bruce.js
   │   └── lexxi.js
   └── /utils
       ├── context-builder.js
       └── response-parser.js
   ```
2. Add necessary NPM packages for agent functionality:
   - `axios` for API calls to Groq
   - `node-nlp` for natural language processing
   - `moment` for time-based operations

**Potential Issues:**
1. **Package Compatibility:** Some Node.js packages may not work in Electron's renderer process.
   - **Workaround:** Use the IPC pattern to execute these functions in the main process.

2. **Environment Variable Security:** Need to securely store the Groq API key.
   - **Workaround:** Store API keys in a secure configuration file or use Electron's secure storage.

3. **Development Workflow Disruption:** Major changes could disrupt ongoing development.
   - **Workaround:** Create a feature branch for this migration to isolate changes until ready.

## Stage 2: Implement Groq API Integration in Frontend

**Objective:** Create a direct connection from the Electron app to the Groq API, replacing the Python backend calls.

**Implementation:**
1. Create `llm-service.js` that handles direct communication with Groq:
   ```javascript
   const axios = require('axios');

   class LLMService {
     constructor(apiKey) {
       this.apiKey = apiKey;
       this.baseUrl = 'https://api.groq.com/v1';
     }

     async generateCompletion(messages, options = {}) {
       try {
         const response = await axios.post(
           `${this.baseUrl}/chat/completions`,
           {
             model: options.model || "deepseek-r1-distill-llama-70b",
             messages,
             temperature: options.temperature || 0.6,
             max_tokens: options.maxTokens || 4096,
             top_p: options.topP || 0.95,
             stream: options.stream || false,
             stop: options.stop || null
           },
           {
             headers: {
               'Authorization': `Bearer ${this.apiKey}`,
               'Content-Type': 'application/json'
             }
           }
         );
         return response.data.choices[0].message.content;
       } catch (error) {
         console.error('Error calling Groq API:', error);
         throw error;
       }
     }
   }

   module.exports = LLMService;
   ```

2. Create a secure mechanism to load the Groq API key from system environment or a config file.

**Potential Issues:**
1. **API Rate Limiting:** Direct frontend calls may hit rate limits more quickly.
   - **Workaround:** Implement request throttling and caching strategies.

2. **Error Handling:** Need robust error handling for network failures.
   - **Workaround:** Implement comprehensive retry logic with exponential backoff.

3. **Streaming Support:** The Python implementation supports streaming responses.
   - **Workaround:** Implement a custom streaming solution using Axios's response interceptors.

## Stage 3: Port Bruce Agent Core Functionality

**Objective:** Recreate the Bruce agent's core functionality in JavaScript.

**Implementation:**
1. Create a Bruce agent model class that replicates the healthcare management assistant functionality:
   ```javascript
   const LLMService = require('../core/llm-service');
   const { BRUCE_SYSTEM_PROMPT } = require('../core/prompt-templates');

   class BruceAgent {
     constructor(llmService) {
       this.llmService = llmService;
       this.name = 'Bruce';
       this.role = 'Healthcare Management Assistant';
     }

     async processMessage(userMessage, conversationHistory = []) {
       // Build context from conversation history
       const messages = [
         { role: 'system', content: BRUCE_SYSTEM_PROMPT },
         ...conversationHistory.map(msg => ({
           role: msg.sender === this.name ? 'assistant' : 'user',
           content: msg.text
         })),
         { role: 'user', content: userMessage }
       ];

       // Generate response
       try {
         const response = await this.llmService.generateCompletion(messages);
         return {
           text: response,
           sender: this.name,
           timestamp: new Date()
         };
       } catch (error) {
         console.error('Error in Bruce agent:', error);
         return {
           text: `I apologize, but I encountered an error processing your request. ${error.message}`,
           sender: this.name,
           timestamp: new Date(),
           isError: true
         };
       }
     }
   }

   module.exports = BruceAgent;
   ```

2. Define the system prompt template:
   ```javascript
   const BRUCE_SYSTEM_PROMPT = `You are Bruce, an experienced healthcare management assistant. You help
   manage a care facility's operations, including client information, caregiver profiles,
   scheduling, and answering questions about healthcare policies. You are professional,
   helpful, and compassionate in your responses, focusing on providing clear, actionable
   information while maintaining a warm tone. You always prioritize client care needs when
   making recommendations about scheduling or caregiver assignments.`;

   module.exports = {
     BRUCE_SYSTEM_PROMPT
   };
   ```

**Potential Issues:**
1. **Context Window Management:** Need to handle potentially long conversation histories.
   - **Workaround:** Implement conversation summarization and truncation strategies.

2. **Conversation Continuity:** Need to maintain agent's memory of previous interactions.
   - **Workaround:** Store conversation history in Firebase and retrieve as needed.

3. **Performance Concerns:** JavaScript implementation may have different performance characteristics.
   - **Workaround:** Optimize code and implement caching for frequently accessed data.

## Stage 4: Implement Agent Tools for Database Access

**Objective:** Create tool functions that allow the agents to access and manipulate database information.

**Implementation:**
1. Develop `agent-tools.js` with functions that interface with Firebase services:
   ```javascript
   const { firebaseService } = require('../../services/firebase');

   const AgentTools = {
     async getClientDetails(clientId) {
       try {
         const client = await firebaseService.getClient(clientId);
         return client ? JSON.stringify(client, null, 2) : `Client with ID '${clientId}' not found.`;
       } catch (error) {
         return `Error fetching client details: ${error.message}`;
       }
     },

     async getAllClients() {
       try {
         const clients = await firebaseService.getAllClients();
         return JSON.stringify(clients, null, 2);
       } catch (error) {
         return `Error fetching all clients: ${error.message}`;
       }
     },

     async generateSchedule() {
       try {
         const clients = await firebaseService.getAllClients();
         const caregivers = await firebaseService.getAllCaregivers();
         const schedulerService = require('../../services/scheduler');
         const result = schedulerService.optimizeCaregiverSchedule(clients, caregivers);
         return `Schedule generated successfully:\n${JSON.stringify(result.schedule, null, 2)}`;
       } catch (error) {
         return `Error generating schedule: ${error.message}`;
       }
     },

     async flagCaregiverForMoreHours(caregiverId) {
       try {
         await firebaseService.updateCaregiver(caregiverId, { wants_more_hours: true });
         return `Caregiver ${caregiverId} has been successfully flagged as wanting more hours.`;
       } catch (error) {
         return `Error flagging caregiver: ${error.message}`;
       }
     }
   };

   module.exports = AgentTools;
   ```

2. Create a tool selection function that parses user input to determine which tool to use:
   ```javascript
   function selectTool(userInput) {
     const lowerCase = userInput.toLowerCase();
     
     if (lowerCase.includes('generate schedule') || lowerCase.includes('create schedule')) {
       return { tool: 'generateSchedule', params: {} };
     }
     
     if (lowerCase.includes('list all clients') || lowerCase.includes('show all clients')) {
       return { tool: 'getAllClients', params: {} };
     }
     
     if (lowerCase.includes('flag') && lowerCase.includes('more hours')) {
       const caregiverId = extractId(userInput);
       return { tool: 'flagCaregiverForMoreHours', params: { caregiverId } };
     }
     
     if (lowerCase.includes('client details') || (lowerCase.includes('client') && extractId(userInput))) {
       const clientId = extractId(userInput);
       return { tool: 'getClientDetails', params: { clientId } };
     }
     
     return null;
   }

   function extractId(text) {
     const match = text.match(/([a-zA-Z0-9]+)$/);
     return match ? match[1] : null;
   }
   ```

**Potential Issues:**
1. **Tool Selection Accuracy:** JavaScript regex may differ from Python's pattern matching.
   - **Workaround:** Extensive testing and refinement of pattern matching logic.

2. **Asynchronous Operations:** Need to handle promises correctly in the JavaScript environment.
   - **Workaround:** Use async/await consistently and implement proper error handling.

3. **Transaction Management:** Need to ensure database operations maintain ACID properties.
   - **Workaround:** Use Firebase transactions for operations that require atomicity.

## Stage 5: Implement Agent Manager Class

**Objective:** Create a central manager class that coordinates agent activities and tool usage.

**Implementation:**
1. Develop `agent-manager.js` that orchestrates agent interactions:
   ```javascript
   const BruceAgent = require('../models/bruce');
   const LexxiAgent = require('../models/lexxi');
   const AgentTools = require('./agent-tools');
   const LLMService = require('./llm-service');
   const { firebaseService } = require('../../services/firebase');

   class AgentManager {
     constructor(groqApiKey) {
       this.llmService = new LLMService(groqApiKey);
       this.bruce = new BruceAgent(this.llmService);
       this.lexxi = new LexxiAgent(this.llmService);
       this.agents = {
         'Bruce': this.bruce,
         'Lexxi': this.lexxi
       };
     }

     async processMessage(roomId, messageData) {
       try {
         // First, always store the user's message
         await firebaseService.sendMessage(roomId, messageData);
         
         // Determine which agent to use (default to Bruce)
         const agentName = messageData.text.toLowerCase().includes('lexxi') ? 'Lexxi' : 'Bruce';
         const agent = this.agents[agentName];
         
         // Send a processing message
         await firebaseService.sendMessage(roomId, { 
           text: "Processing your request...", 
           sender: agentName,
           isProcessing: true
         });
         
         // Check if we need to use a tool
         const toolSelection = this.selectTool(messageData.text);
         let response;
         
         if (toolSelection) {
           // Execute the selected tool
           response = await AgentTools[toolSelection.tool](toolSelection.params);
         } else {
           // Get recent conversation history
           const recentMessages = await firebaseService.getChatMessages(roomId, 10);
           // Generate a response from the agent
           response = await agent.processMessage(messageData.text, recentMessages);
           response = response.text; // Extract text from response object
         }
         
         // Send the agent's response
         await firebaseService.sendMessage(roomId, { 
           text: response, 
           sender: agentName 
         });
         
         return { success: true };
       } catch (error) {
         console.error(`Error processing message with ${agentName}:`, error);
         
         // Send error message
         await firebaseService.sendMessage(roomId, { 
           text: `I'm sorry, I encountered an error processing your request. ${error.message}`, 
           sender: agentName,
           isError: true
         });
         
         return { success: false, error: error.message };
       }
     }

     selectTool(userInput) {
       const lowerCase = userInput.toLowerCase();
       
       if (lowerCase.includes('generate schedule') || lowerCase.includes('create schedule')) {
         return { tool: 'generateSchedule', params: {} };
       }
       
       // Additional tool selection logic...
       
       return null;
     }
   }

   module.exports = AgentManager;
   ```

**Potential Issues:**
1. **Agent Selection Logic:** Need clear rules for when to use Bruce vs. Lexxi.
   - **Workaround:** Implement explicit tagging (e.g., @Bruce or @Lexxi) and fallback rules.

2. **Error Propagation:** Errors in one part of the system could cascade.
   - **Workaround:** Implement comprehensive try/catch blocks and error boundaries.

3. **Memory Management:** Long-running Electron processes might accumulate memory usage.
   - **Workaround:** Implement periodic garbage collection and resource cleanup.

## Stage 6: Create Lexxi Agent Implementation

**Objective:** Implement the Lexxi agent as a complement to Bruce, with specialized capabilities.

**Implementation:**
1. Develop `lexxi.js` for the new agent:
   ```javascript
   const LLMService = require('../core/llm-service');
   const { LEXXI_SYSTEM_PROMPT } = require('../core/prompt-templates');

   class LexxiAgent {
     constructor(llmService) {
       this.llmService = llmService;
       this.name = 'Lexxi';
       this.role = 'Schedule Optimization Specialist';
     }

     async processMessage(userMessage, conversationHistory = []) {
       // Build context from conversation history
       const messages = [
         { role: 'system', content: LEXXI_SYSTEM_PROMPT },
         ...conversationHistory.map(msg => ({
           role: msg.sender === this.name ? 'assistant' : 'user',
           content: msg.text
         })),
         { role: 'user', content: userMessage }
       ];

       // Generate response
       try {
         const response = await this.llmService.generateCompletion(messages);
         return {
           text: response,
           sender: this.name,
           timestamp: new Date()
         };
       } catch (error) {
         console.error('Error in Lexxi agent:', error);
         return {
           text: `I apologize, but I encountered an error processing your request. ${error.message}`,
           sender: this.name,
           timestamp: new Date(),
           isError: true
         };
       }
     }
   }

   module.exports = LexxiAgent;
   ```

2. Define Lexxi's system prompt in `prompt-templates.js`:
   ```javascript
   const LEXXI_SYSTEM_PROMPT = `You are Lexxi, a scheduling optimization specialist for healthcare services.
   Your expertise is in creating efficient caregiver schedules that balance client needs,
   caregiver preferences, and operational constraints. You're analytical and solution-oriented,
   offering specific recommendations based on schedule data. You excel at identifying
   opportunities for optimization and can explain complex scheduling decisions in clear terms.`;

   module.exports = {
     BRUCE_SYSTEM_PROMPT, // from previous implementation
     LEXXI_SYSTEM_PROMPT
   };
   ```

**Potential Issues:**
1. **Agent Specialization:** Need clear functional separation between Bruce and Lexxi.
   - **Workaround:** Create distinct prompt templates and tool access profiles for each agent.

2. **User Confusion:** Users might be confused about which agent to use for what.
   - **Workaround:** Implement help commands and clear documentation on agent capabilities.

3. **Performance Impact:** Running multiple agent models might impact performance.
   - **Workaround:** Implement lazy loading of agents and resource sharing where possible.

## Stage 7: Integrate Agents with Main Process

**Objective:** Connect the new agent implementation with the Electron main process.

**Implementation:**
1. Update `main.js` to initialize the agent manager and handle IPC calls:
   ```javascript
   // Existing imports
   const { AgentManager } = require('./agents/core/agent-manager');
   const fs = require('fs');
   const path = require('path');

   // Initialize agent manager with API key
   let agentManager;
   try {
     // Load API key from environment or file
     const groqApiKeyPath = path.join(__dirname, 'Groq API KEY.txt');
     const apiKeyContent = fs.readFileSync(groqApiKeyPath, 'utf8');
     const apiKey = apiKeyContent.trim().replace('GROQ_API_KEY=', '').replace(/"/g, '');
     
     agentManager = new AgentManager(apiKey);
     console.log('Agent manager initialized successfully');
   } catch (error) {
     console.error('Failed to initialize agent manager:', error);
   }

   // Update IPC handler for send-message
   ipcMain.handle('send-message', async (event, roomId, messageData) => {
     try {
       // Always send the user's original message to the chat first
       await firebaseService.sendMessage(roomId, messageData);

       // Process with agents if the message mentions an agent
       if (messageData.text && (
         messageData.text.toLowerCase().includes('bruce') ||
         messageData.text.toLowerCase().includes('lexxi')
       )) {
         console.log(`Agent detected in message: ${messageData.text}`);
         
         try {
           const result = await agentManager.processMessage(roomId, messageData);
           return result;
         } catch (error) {
           console.error("Error with agent processing:", error);
           // Send error message
           await firebaseService.sendMessage(roomId, { 
             text: "I'm sorry, I encountered an error processing your request. " + error.message, 
             sender: 'System',
             isError: true
           });
         }
       }

       return { success: true };
     } catch (error) {
       console.error('Error sending message:', error);
       return { success: false, error: error.message };
     }
   });
   ```

2. Remove the Python agent call from the existing code.

**Potential Issues:**
1. **Backward Compatibility:** Existing messages might expect the old format.
   - **Workaround:** Implement a migration strategy for chat history.

2. **Process Lifetime:** The agent manager should persist for the application lifetime.
   - **Workaround:** Implement proper initialization and cleanup in the app lifecycle events.

3. **Error Handling:** Need to gracefully handle agent initialization failures.
   - **Workaround:** Implement fallback modes and user notifications for agent unavailability.

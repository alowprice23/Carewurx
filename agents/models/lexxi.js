/**
 * Lexxi Agent Model
 * The scheduling optimization specialist for Carewurx
 * Designed as part of the circular integration model (C=2πr)
 */

const { getSystemPrompt } = require('../core/prompt-templates');
const LLMService = require('../core/llm-service');

class Lexxi {
  constructor(llmService) {
    this.name = 'Lexxi';
    this.llmService = llmService;
    this.systemPrompt = getSystemPrompt('lexxi');
    this.specializationAreas = [
      'schedule_optimization',
      'geographic_clustering',
      'workload_balancing',
      'preference_matching',
      'conflict_resolution'
    ];
  }

  /**
   * Generate a response to a user message
   * @param {string} userMessage - The user's message
   * @param {Array} chatHistory - The conversation history
   * @param {Object} context - Additional context for the response
   * @returns {Promise<string>} The generated response
   */
  async generateResponse(userMessage, chatHistory = [], context = {}) {
    console.log(`Lexxi: Generating response to: "${userMessage.substring(0, 50)}..."`);
    
    try {
      // Augment the system prompt with specialized scheduling context
      let enhancedPrompt = this.systemPrompt;
      
      // Add schedule information
      if (context.schedules && context.schedules.length > 0) {
        enhancedPrompt += `\n\nCurrent schedule information:`;
        context.schedules.slice(0, 10).forEach(schedule => {
          enhancedPrompt += `\n- Client: ${schedule.client_name || 'Unknown'}, `;
          enhancedPrompt += `Caregiver: ${schedule.caregiver_name || 'Unassigned'}, `;
          enhancedPrompt += `Date: ${schedule.date}, `;
          enhancedPrompt += `Time: ${schedule.start_time} - ${schedule.end_time}`;
          
          if (schedule.status) {
            enhancedPrompt += `, Status: ${schedule.status}`;
          }
          
          if (schedule.location) {
            enhancedPrompt += `, Location: ${schedule.location}`;
          }
        });
        
        if (context.schedules.length > 10) {
          enhancedPrompt += `\n(${context.schedules.length - 10} more schedules not shown)`;
        }
      }
      
      // Add caregiver availability information
      if (context.caregiverAvailability && Object.keys(context.caregiverAvailability).length > 0) {
        enhancedPrompt += `\n\nCaregiver availability:`;
        Object.entries(context.caregiverAvailability).slice(0, 5).forEach(([caregiverId, availability]) => {
          const caregiver = context.caregivers?.find(c => c.id === caregiverId) || { name: 'Unknown Caregiver' };
          enhancedPrompt += `\n- ${caregiver.name}:`;
          
          if (Array.isArray(availability)) {
            availability.slice(0, 3).forEach(slot => {
              enhancedPrompt += ` ${slot.day} ${slot.start}-${slot.end},`;
            });
            
            if (availability.length > 3) {
              enhancedPrompt += ` and ${availability.length - 3} more slots`;
            }
          } else if (typeof availability === 'string') {
            enhancedPrompt += ` ${availability}`;
          }
        });
        
        if (Object.keys(context.caregiverAvailability).length > 5) {
          enhancedPrompt += `\n(Availability for ${Object.keys(context.caregiverAvailability).length - 5} more caregivers not shown)`;
        }
      }
      
      // Add optimization opportunities if available
      if (context.opportunities && context.opportunities.length > 0) {
        enhancedPrompt += `\n\nDetected optimization opportunities:`;
        context.opportunities.forEach(opportunity => {
          enhancedPrompt += `\n- Type: ${opportunity.type}, `;
          enhancedPrompt += `Priority: ${opportunity.priority}, `;
          enhancedPrompt += `Description: ${opportunity.description}`;
        });
      }
      
      // Add geographic information if available
      if (context.locationData) {
        enhancedPrompt += `\n\nGeographic information:`;
        enhancedPrompt += `\n${JSON.stringify(context.locationData, null, 2)}`;
      }
      
      // Add specific analysis request context if available
      if (context.analysisRequest) {
        enhancedPrompt += `\n\nSpecific analysis request: ${context.analysisRequest}`;
      }
      
      // Generate the response using the LLM
      const response = await this.llmService.generateChatResponse(
        enhancedPrompt,
        userMessage,
        chatHistory,
        { temperature: 0.3 } // Lower temperature for more precise scheduling advice
      );
      
      return response;
    } catch (error) {
      console.error('Error generating Lexxi response:', error);
      return `I apologize, but I'm having trouble providing scheduling advice right now. Please try again in a moment or contact technical support if the issue persists.`;
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
    console.log(`Lexxi: Handling tool request: ${toolName}`);
    
    switch (toolName) {
      case 'analyzeSchedule':
        return this.handleScheduleAnalysis(parameters);
        
      case 'optimizeCaregiverAssignment':
        return this.handleCaregiverOptimization(parameters);
        
      case 'calculateTravelEfficiency':
        return this.handleTravelEfficiencyCalculation(parameters);
        
      case 'resolveScheduleConflict':
        return this.handleConflictResolution(parameters);
        
      case 'generateScheduleSummary':
        return this.handleScheduleSummary(parameters, chatHistory);
        
      default:
        return `I don't have access to the ${toolName} tool. As a scheduling specialist, I can help with schedule analysis, caregiver optimization, travel efficiency calculation, conflict resolution, and schedule summaries.`;
    }
  }

  /**
   * Handle a schedule analysis request
   * @param {Object} parameters - The analysis parameters
   * @returns {Promise<string>} The analysis response
   */
  async handleScheduleAnalysis(parameters) {
    if (!parameters.scheduleId && !parameters.date && !parameters.caregiverId && !parameters.clientId) {
      return 'I need at least one of the following to analyze a schedule: scheduleId, date, caregiverId, or clientId.';
    }
    
    try {
      // This would connect to the schedule analysis service
      const metrics = {
        utilizationRate: Math.random() * 100,
        travelEfficiency: Math.random() * 100,
        clientSatisfaction: Math.random() * 100,
        caregiverWorkloadBalance: Math.random() * 100
      };
      
      return `
## Schedule Analysis Results

${parameters.date ? `For Date: ${parameters.date}` : ''}
${parameters.caregiverId ? `For Caregiver: ${parameters.caregiverId}` : ''}
${parameters.clientId ? `For Client: ${parameters.clientId}` : ''}

### Key Metrics
- **Utilization Rate**: ${metrics.utilizationRate.toFixed(1)}%
- **Travel Efficiency**: ${metrics.travelEfficiency.toFixed(1)}%
- **Client Satisfaction Estimate**: ${metrics.clientSatisfaction.toFixed(1)}%
- **Caregiver Workload Balance**: ${metrics.caregiverWorkloadBalance.toFixed(1)}%

### Opportunities for Improvement
1. ${metrics.utilizationRate < 75 ? 'Increase caregiver utilization by consolidating schedules' : 'Utilization rate is good, maintain current levels'}
2. ${metrics.travelEfficiency < 70 ? 'Optimize travel routes to reduce transit time' : 'Travel efficiency is good, maintain current routing'}
3. ${metrics.caregiverWorkloadBalance < 80 ? 'Redistribute assignments to balance workload better' : 'Workload balance is good'}

Would you like me to suggest specific actions to improve these metrics?
      `;
    } catch (error) {
      console.error('Error in schedule analysis:', error);
      return `I'm sorry, I couldn't complete the schedule analysis. ${error.message}`;
    }
  }

  /**
   * Handle a caregiver optimization request
   * @param {Object} parameters - The optimization parameters
   * @returns {Promise<string>} The optimization response
   */
  async handleCaregiverOptimization(parameters) {
    if (!parameters.scheduleId && !parameters.clientId) {
      return 'I need either a scheduleId or clientId to optimize caregiver assignments.';
    }
    
    try {
      // This would connect to the caregiver optimization service
      const matches = [
        { caregiverId: 'CG-123', matchScore: 92, travelTime: 15, qualification: 'High', availability: 'Excellent' },
        { caregiverId: 'CG-456', matchScore: 87, travelTime: 10, qualification: 'Medium', availability: 'Good' },
        { caregiverId: 'CG-789', matchScore: 84, travelTime: 25, qualification: 'Very High', availability: 'Limited' }
      ];
      
      return `
## Caregiver Optimization Results

${parameters.scheduleId ? `For Schedule: ${parameters.scheduleId}` : ''}
${parameters.clientId ? `For Client: ${parameters.clientId}` : ''}

### Top Caregiver Matches

1. **Caregiver CG-123**
   - Match Score: 92%
   - Travel Time: 15 minutes
   - Qualification Match: High
   - Availability: Excellent
   - *Recommendation: Best overall match*

2. **Caregiver CG-456**
   - Match Score: 87%
   - Travel Time: 10 minutes
   - Qualification Match: Medium
   - Availability: Good
   - *Recommendation: Best if travel time is priority*

3. **Caregiver CG-789**
   - Match Score: 84%
   - Travel Time: 25 minutes
   - Qualification Match: Very High
   - Availability: Limited
   - *Recommendation: Best if specialized qualification is priority*

Would you like to assign one of these caregivers or see more options?
      `;
    } catch (error) {
      console.error('Error in caregiver optimization:', error);
      return `I'm sorry, I couldn't optimize the caregiver assignments. ${error.message}`;
    }
  }

  /**
   * Handle a travel efficiency calculation request
   * @param {Object} parameters - The calculation parameters
   * @returns {Promise<string>} The calculation response
   */
  async handleTravelEfficiencyCalculation(parameters) {
    if (!parameters.caregiverId && !parameters.scheduleIds) {
      return 'I need either a caregiverId or a list of scheduleIds to calculate travel efficiency.';
    }
    
    try {
      // This would connect to the travel efficiency calculation service
      const efficiency = {
        totalDistance: 52.3,
        totalTime: 78,
        fuelCost: 13.45,
        optimizedDistance: 38.7,
        optimizedTime: 58,
        optimizedFuelCost: 9.97,
        savingsPercent: 25.9
      };
      
      return `
## Travel Efficiency Analysis

${parameters.caregiverId ? `For Caregiver: ${parameters.caregiverId}` : ''}
${parameters.scheduleIds ? `For Selected Schedules: ${parameters.scheduleIds.join(', ')}` : ''}

### Current Route
- Total Distance: ${efficiency.totalDistance.toFixed(1)} miles
- Total Travel Time: ${efficiency.totalTime} minutes
- Estimated Fuel Cost: $${efficiency.fuelCost.toFixed(2)}

### Optimized Route
- Optimized Distance: ${efficiency.optimizedDistance.toFixed(1)} miles
- Optimized Travel Time: ${efficiency.optimizedTime} minutes
- Estimated Fuel Cost: $${efficiency.optimizedFuelCost.toFixed(2)}

### Potential Savings
- Distance Reduction: ${(efficiency.totalDistance - efficiency.optimizedDistance).toFixed(1)} miles (${efficiency.savingsPercent}%)
- Time Saved: ${efficiency.totalTime - efficiency.optimizedTime} minutes
- Cost Savings: $${(efficiency.fuelCost - efficiency.optimizedFuelCost).toFixed(2)} per day

Would you like me to suggest a specific optimized route or adjust the current schedule to improve efficiency?
      `;
    } catch (error) {
      console.error('Error in travel efficiency calculation:', error);
      return `I'm sorry, I couldn't calculate the travel efficiency. ${error.message}`;
    }
  }

  /**
   * Handle a schedule conflict resolution request
   * @param {Object} parameters - The resolution parameters
   * @returns {Promise<string>} The resolution response
   */
  async handleConflictResolution(parameters) {
    if (!parameters.conflictId && !parameters.scheduleIds) {
      return 'I need either a conflictId or the conflicting scheduleIds to resolve a schedule conflict.';
    }
    
    try {
      // This would connect to the conflict resolution service
      const resolution = {
        conflictType: 'time_overlap',
        severity: 'high',
        affectedClients: ['Client A', 'Client B'],
        affectedCaregivers: ['Caregiver X'],
        options: [
          { id: 1, description: 'Adjust Schedule A start time from 9:00 to 8:00', impact: 'Minimal', requiresApproval: false },
          { id: 2, description: 'Assign Schedule B to Caregiver Y', impact: 'Medium', requiresApproval: true },
          { id: 3, description: 'Split Schedule A into two parts', impact: 'Significant', requiresApproval: true }
        ]
      };
      
      return `
## Schedule Conflict Resolution

${parameters.conflictId ? `Conflict ID: ${parameters.conflictId}` : ''}
${parameters.scheduleIds ? `Conflicting Schedules: ${parameters.scheduleIds.join(', ')}` : ''}

### Conflict Details
- Type: ${resolution.conflictType.replace('_', ' ')}
- Severity: ${resolution.severity}
- Affected Clients: ${resolution.affectedClients.join(', ')}
- Affected Caregivers: ${resolution.affectedCaregivers.join(', ')}

### Resolution Options

1. **${resolution.options[0].description}**
   - Impact: ${resolution.options[0].impact}
   - Requires Approval: ${resolution.options[0].requiresApproval ? 'Yes' : 'No'}
   - *Recommended first option*

2. **${resolution.options[1].description}**
   - Impact: ${resolution.options[1].impact}
   - Requires Approval: ${resolution.options[1].requiresApproval ? 'Yes' : 'No'}

3. **${resolution.options[2].description}**
   - Impact: ${resolution.options[2].impact}
   - Requires Approval: ${resolution.options[2].requiresApproval ? 'Yes' : 'No'}

Which resolution option would you like to implement?
      `;
    } catch (error) {
      console.error('Error in conflict resolution:', error);
      return `I'm sorry, I couldn't resolve the schedule conflict. ${error.message}`;
    }
  }

  /**
   * Handle a schedule summary generation request
   * @param {Object} parameters - The summary parameters
   * @param {Array} chatHistory - The conversation history
   * @returns {Promise<string>} The summary response
   */
  async handleScheduleSummary(parameters, chatHistory) {
    if (!parameters.period && !parameters.date && !parameters.caregiverId && !parameters.clientId) {
      return 'I need at least one of the following to generate a summary: period, date, caregiverId, or clientId.';
    }
    
    try {
      // This would use the LLM to generate a natural language summary
      const summaryPrompt = `Generate a concise summary of the schedule for ${
        parameters.period || parameters.date || 
        (parameters.caregiverId ? `caregiver ${parameters.caregiverId}` : '') || 
        (parameters.clientId ? `client ${parameters.clientId}` : '')
      }. Focus on key metrics, patterns, and potential improvements.`;
      
      // Use the LLM to generate the summary
      const summary = await this.llmService.generateChatResponse(
        this.systemPrompt,
        summaryPrompt,
        chatHistory,
        { temperature: 0.4 }
      );
      
      return summary;
    } catch (error) {
      console.error('Error generating schedule summary:', error);
      return `I'm sorry, I couldn't generate a schedule summary. ${error.message}`;
    }
  }

  /**
   * Determine if this agent is suitable for handling a specific message
   * @param {string} message - The user message
   * @returns {number} Confidence score (0-1)
   */
  getConfidenceScore(message) {
    const message_lower = message.toLowerCase();
    
    // Check for scheduling related keywords
    const schedulingKeywords = [
      'schedule', 'appointment', 'assign', 'optimize', 'caregiver', 'client', 
      'availability', 'time', 'date', 'shift', 'workload', 'conflict',
      'travel', 'distance', 'route', 'efficiency', 'coverage'
    ];
    
    let keywordCount = 0;
    schedulingKeywords.forEach(keyword => {
      if (message_lower.includes(keyword)) {
        keywordCount++;
      }
    });
    
    // Calculate base confidence score based on keywords
    let score = Math.min(keywordCount / 3, 1);
    
    // Boost score for specific scheduling requests
    if (message_lower.includes('optimize schedule') || 
        message_lower.includes('best caregiver') ||
        message_lower.includes('reduce travel') ||
        message_lower.includes('resolve conflict') ||
        message_lower.includes('balance workload')) {
      score = Math.min(score + 0.4, 1);
    }
    
    // Reduce score for general questions better suited for Bruce
    if (message_lower.includes('who is') ||
        message_lower.includes('what is') ||
        message_lower.includes('how do i') ||
        message_lower.includes('help me understand')) {
      score = Math.max(score - 0.3, 0);
    }
    
    return score;
  }
}

module.exports = Lexxi;

/**
 * Analysis Dashboard Component
 * Displays analytics and insights about the scheduling data
 * Integrates with the agentic system following the circular integration model (C=2πr)
 */

const realTimeUpdatesService = require('../services/real-time-updates');

class AnalysisDashboard {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.stats = {
      totalSchedules: 0,
      unassignedSchedules: 0,
      utilizationRate: 0,
      travelEfficiency: 0
    };
    
    this.agentMetrics = {
      opportunitiesFound: 0,
      opportunitiesApplied: 0,
      schedulesOptimized: 0,
      aiRecommendations: 0,
      successRate: 0
    };
    
    this.insights = [];
    this.subscriptionId = null;
    this.agentSubscriptionId = null;
    this.opportunitySubscriptionId = null;
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    console.log('Initializing Analysis Dashboard');
    
    // Subscribe to schedule updates to re-calculate stats
    this.subscriptionId = realTimeUpdatesService.subscribe('schedule', () => {
      this.updateDashboard();
    });
    
    // Subscribe to agent insights
    this.agentSubscriptionId = realTimeUpdatesService.subscribe('agent', (data) => {
      if (data.insights) {
        this.handleAgentInsights(data.insights);
      }
    });
    
    // Subscribe to opportunity updates
    this.opportunitySubscriptionId = realTimeUpdatesService.subscribe('opportunity', () => {
      this.updateAgentMetrics();
    });
    
    // Initial render
    this.render();
    
    // Fetch initial data
    this.updateDashboard();
    this.updateAgentMetrics();
    this.fetchAgentInsights();
  }

  /**
   * Update the dashboard with the latest data
   */
  async updateDashboard() {
    try {
      // Fetch all schedules for the current month
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      const schedules = await window.fetchAPI('/firebase/schedulesInDateRange', {
        params: { startDate, endDate }
      });
      
      if (schedules && schedules.length > 0) {
        this.calculateStats(schedules);
      }
      
      this.render();
    } catch (error) {
      console.error('Error updating analysis dashboard:', error);
    }
  }

  /**
   * Update agent metrics from opportunities and recommendations
   */
  async updateAgentMetrics() {
    try {
      // Get all opportunities
      const opportunities = await window.fetchAPI('/firebase/opportunities', { params: { limit: 100 } });
      
      if (opportunities && opportunities.length > 0) {
        this.agentMetrics.opportunitiesFound = opportunities.length;
        
        // Count applied opportunities
        this.agentMetrics.opportunitiesApplied = opportunities.filter(
          o => o.status === 'applied'
        ).length;
        
        // Calculate success rate
        const decidedOpportunities = opportunities.filter(
          o => o.status === 'applied' || o.status === 'rejected'
        );
        
        this.agentMetrics.successRate = decidedOpportunities.length > 0 
          ? (this.agentMetrics.opportunitiesApplied / decidedOpportunities.length) * 100
          : 0;
          
        // Count AI recommendations
        this.agentMetrics.aiRecommendations = opportunities.filter(
          o => o.ai_recommendation
        ).length;
        
        // Count schedules optimized through opportunities
        const optimizedScheduleIds = new Set();
        opportunities.filter(o => o.status === 'applied').forEach(o => {
          if (o.schedule_id) {
            optimizedScheduleIds.add(o.schedule_id);
          }
          if (o.schedules) {
            o.schedules.forEach(s => optimizedScheduleIds.add(s));
          }
        });
        
        this.agentMetrics.schedulesOptimized = optimizedScheduleIds.size;
      }
      
      this.render();
    } catch (error) {
      console.error('Error updating agent metrics:', error);
    }
  }

  /**
   * Fetch insights from the agent system
   */
  async fetchAgentInsights() {
    try {
      // Get recent schedules to analyze
      const today = new Date();
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const startDate = oneWeekAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      const schedules = await window.fetchAPI('/firebase/schedulesInDateRange', {
        params: { startDate, endDate }
      });
      
      // Analyze up to 3 schedules for insights
      this.insights = [];
      
      if (schedules && schedules.length > 0) {
        const schedulesToAnalyze = schedules.slice(0, 3);
        
        for (const schedule of schedulesToAnalyze) {
          try {
            // Ensure schedule.id is valid before making the call
            if (!schedule || !schedule.id) {
                console.warn('Skipping agent insights for schedule with no ID:', schedule);
                continue;
            }
            const scheduleInsights = await window.fetchAPI(`/agent/insights/${schedule.id}`);
            if (scheduleInsights && scheduleInsights.insights) { // The API directly returns the insights object
              this.insights.push({
                scheduleId: schedule.id,
                clientName: schedule.client_name,
                date: schedule.date,
                insights: scheduleInsights.insights
              });
            }
          } catch (err) {
            console.error(`Error getting insights for schedule ${schedule.id}:`, err);
          }
        }
      }
      
      this.render();
    } catch (error) {
      console.error('Error fetching agent insights:', error);
    }
  }

  /**
   * Handle new insights from the agent
   * @param {Array} insights - The insights from the agent
   */
  handleAgentInsights(insights) {
    // Add new insights to the top of the list
    if (Array.isArray(insights)) {
      this.insights = [...insights, ...this.insights].slice(0, 10); // Keep only the 10 most recent
      this.render();
    }
  }

  /**
   * Calculate statistics based on the schedules
   * @param {Array} schedules - The list of schedules
   */
  calculateStats(schedules) {
    this.stats.totalSchedules = schedules.length;
    
    this.stats.unassignedSchedules = schedules.filter(s => !s.caregiver_id).length;
    
    // Calculate utilization rate (example calculation)
    const assignedSchedules = schedules.filter(s => s.caregiver_id);
    const totalMinutes = assignedSchedules.reduce((sum, s) => {
      const start = new Date(`1970-01-01T${s.start_time}Z`);
      const end = new Date(`1970-01-01T${s.end_time}Z`);
      return sum + (end - start) / 60000;
    }, 0);
    
    const uniqueCaregivers = [...new Set(assignedSchedules.map(s => s.caregiver_id))];
    const totalAvailableMinutes = uniqueCaregivers.length * 8 * 60 * 22; // 8 hours/day, 22 work days/month
    
    this.stats.utilizationRate = totalAvailableMinutes > 0 ? (totalMinutes / totalAvailableMinutes) * 100 : 0;
    
    // Travel efficiency would require more complex calculation, so we'll use a placeholder
    this.stats.travelEfficiency = 85; // Placeholder
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <h2>Analysis Dashboard</h2>
      <div class="dashboard-section">
        <h3>Schedule Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <h4>Total Schedules</h4>
            <p>${this.stats.totalSchedules}</p>
          </div>
          <div class="stat-item">
            <h4>Unassigned</h4>
            <p>${this.stats.unassignedSchedules}</p>
          </div>
          <div class="stat-item">
            <h4>Utilization Rate</h4>
            <p>${this.stats.utilizationRate.toFixed(1)}%</p>
          </div>
          <div class="stat-item">
            <h4>Travel Efficiency</h4>
            <p>${this.stats.travelEfficiency}%</p>
          </div>
        </div>
      </div>
      
      <div class="dashboard-section">
        <h3>Agentic System Metrics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <h4>Opportunities Found</h4>
            <p>${this.agentMetrics.opportunitiesFound}</p>
          </div>
          <div class="stat-item">
            <h4>Opportunities Applied</h4>
            <p>${this.agentMetrics.opportunitiesApplied}</p>
          </div>
          <div class="stat-item">
            <h4>Success Rate</h4>
            <p>${this.agentMetrics.successRate.toFixed(1)}%</p>
          </div>
          <div class="stat-item">
            <h4>Schedules Optimized</h4>
            <p>${this.agentMetrics.schedulesOptimized}</p>
          </div>
        </div>
      </div>
      
      ${this.renderInsights()}
    `;
  }
  
  /**
   * Render the insights section
   * @returns {string} The HTML for the insights section
   */
  renderInsights() {
    if (this.insights.length === 0) {
      return `
        <div class="dashboard-section">
          <h3>Agent Insights</h3>
          <p>No insights available. The agentic system will generate insights as it analyzes schedules.</p>
        </div>
      `;
    }
    
    return `
      <div class="dashboard-section">
        <h3>Agent Insights</h3>
        <div class="insights-list">
          ${this.insights.map(item => `
            <div class="insight-group">
              <h4>${item.clientName ? `Insights for ${item.clientName}` : 'Schedule Insights'} ${item.date ? `(${item.date})` : ''}</h4>
              <ul class="insights">
                ${item.insights.map(insight => `
                  <li class="insight priority-${insight.priority || 'medium'}">
                    ${insight.message || insight.text}
                  </li>
                `).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Clean up the component
   */
  destroy() {
    console.log('Destroying Analysis Dashboard');
    
    // Unsubscribe from updates
    if (this.subscriptionId) {
      realTimeUpdatesService.unsubscribe('schedule', this.subscriptionId);
      this.subscriptionId = null;
    }
    
    if (this.agentSubscriptionId) {
      realTimeUpdatesService.unsubscribe('agent', this.agentSubscriptionId);
      this.agentSubscriptionId = null;
    }
    
    if (this.opportunitySubscriptionId) {
      realTimeUpdatesService.unsubscribe('opportunity', this.opportunitySubscriptionId);
      this.opportunitySubscriptionId = null;
    }
    
    // Clear the container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

module.exports = AnalysisDashboard;

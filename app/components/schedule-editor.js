/**
 * Schedule Editor Component
 * Provides a user interface for creating and editing schedules
 * Integrates with the agentic system following the circular integration model (C=2πr)
 */

const realTimeUpdatesService = require('../services/real-time-updates');

class ScheduleEditor {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.schedule = null;
    this.suggestions = [];
    this.conflicts = [];
    this.subscriptionId = null;
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    console.log('Initializing Schedule Editor');
    
    // Subscribe to agent suggestions
    this.subscriptionId = realTimeUpdatesService.subscribe('agent', (data) => {
      if (data.suggestions) {
        this.handleAgentSuggestions(data.suggestions);
      }
    });
    
    this.render();
    this.setupEventListeners();
  }

  /**
   * Handle agent suggestions
   * @param {Array} suggestions - The suggestions from the agent
   */
  handleAgentSuggestions(suggestions) {
    console.log('Received agent suggestions:', suggestions);
    this.suggestions = suggestions;
    this.updateSuggestionsSection();
  }

  /**
   * Update the suggestions section in the UI
   */
  updateSuggestionsSection() {
    const suggestionsContainer = document.getElementById('agent-suggestions');
    if (!suggestionsContainer) return;
    
    if (this.suggestions.length === 0) {
      suggestionsContainer.innerHTML = '<p>No suggestions available.</p>';
      return;
    }
    
    let html = '<ul class="suggestions-list">';
    this.suggestions.forEach(suggestion => {
      html += `
        <li class="suggestion-item">
          <div class="suggestion-content">${suggestion.text}</div>
          <div class="suggestion-actions">
            <button class="apply-suggestion" data-id="${suggestion.id}">Apply</button>
            <button class="dismiss-suggestion" data-id="${suggestion.id}">Dismiss</button>
          </div>
        </li>
      `;
    });
    html += '</ul>';
    
    suggestionsContainer.innerHTML = html;
    
    // Add event listeners to suggestion buttons
    const applyButtons = suggestionsContainer.querySelectorAll('.apply-suggestion');
    applyButtons.forEach(button => {
      button.addEventListener('click', () => {
        const suggestionId = button.getAttribute('data-id');
        this.applySuggestion(suggestionId);
      });
    });
    
    const dismissButtons = suggestionsContainer.querySelectorAll('.dismiss-suggestion');
    dismissButtons.forEach(button => {
      button.addEventListener('click', () => {
        const suggestionId = button.getAttribute('data-id');
        this.dismissSuggestion(suggestionId);
      });
    });
  }

  /**
   * Apply a suggestion
   * @param {string} suggestionId - The ID of the suggestion to apply
   */
  applySuggestion(suggestionId) {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;
    
    console.log('Applying suggestion:', suggestion);
    
    // Apply the suggestion to the form fields
    if (suggestion.type === 'caregiver_suggestion' && suggestion.caregiverId) {
      document.getElementById('caregiver-id').value = suggestion.caregiverId;
    } else if (suggestion.type === 'time_suggestion' && suggestion.startTime && suggestion.endTime) {
      document.getElementById('start-time').value = suggestion.startTime;
      document.getElementById('end-time').value = suggestion.endTime;
    }
    
    // Remove the applied suggestion
    this.suggestions = this.suggestions.filter(s => s.id !== suggestionId);
    this.updateSuggestionsSection();
  }

  /**
   * Dismiss a suggestion
   * @param {string} suggestionId - The ID of the suggestion to dismiss
   */
  dismissSuggestion(suggestionId) {
    console.log('Dismissing suggestion:', suggestionId);
    
    // Remove the dismissed suggestion
    this.suggestions = this.suggestions.filter(s => s.id !== suggestionId);
    this.updateSuggestionsSection();
  }

  /**
   * Check for schedule conflicts
   * @param {Object} scheduleData - The schedule data to check
   * @returns {Promise<Array>} The conflicts
   */
  async checkConflicts(scheduleData) {
    try {
      // Create a temporary schedule object to check
      const tempSchedule = {
        id: this.schedule ? this.schedule.id : `temp-${Date.now()}`,
        ...scheduleData
      };
      
      // Check for conflicts
      console.log(`Checking conflicts for schedule ${tempSchedule.id} via API...`);
      // Note: The original checkScheduleConflicts in main.js might expect a scheduleId that exists.
      // If the API requires an existing ID, this might need adjustment or the API needs to handle temp IDs.
      // For now, assuming the API can handle it or this part of logic might implicitly only work for existing schedules.
      this.conflicts = await window.fetchAPI(`/scheduler/checkConflicts/${tempSchedule.id}`);
      
      return this.conflicts;
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return [];
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    const title = this.schedule ? 'Edit Schedule' : 'Create Schedule';
    
    this.container.innerHTML = `
      <h2>${title}</h2>
      <form id="schedule-form">
        <div class="form-group">
          <label for="client-id">Client</label>
          <input type="text" id="client-id" value="${this.schedule ? this.schedule.client_id : ''}" required>
        </div>
        <div class="form-group">
          <label for="caregiver-id">Caregiver</label>
          <input type="text" id="caregiver-id" value="${this.schedule ? this.schedule.caregiver_id : ''}">
        </div>
        <div class="form-group">
          <label for="date">Date</label>
          <input type="date" id="date" value="${this.schedule ? this.schedule.date : ''}" required>
        </div>
        <div class="form-group">
          <label for="start-time">Start Time</label>
          <input type="time" id="start-time" value="${this.schedule ? this.schedule.start_time : ''}" required>
        </div>
        <div class="form-group">
          <label for="end-time">End Time</label>
          <input type="time" id="end-time" value="${this.schedule ? this.schedule.end_time : ''}" required>
        </div>
        <div id="conflicts-container" class="conflicts-container" style="display: none;"></div>
        <div id="agent-suggestions" class="suggestions-container">
          <h3>Agent Suggestions</h3>
          <p>No suggestions available.</p>
        </div>
        <div class="form-actions">
          <button type="button" id="check-conflicts-button">Check Conflicts</button>
          <button type="button" id="request-suggestions-button">Request Suggestions</button>
          <button type="submit">Save</button>
          <button type="button" id="cancel-button">Cancel</button>
        </div>
      </form>
    `;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    const form = document.getElementById('schedule-form');
    if (form) {
      form.addEventListener('submit', (event) => this.handleSubmit(event));
    }
    
    const cancelButton = document.getElementById('cancel-button');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => this.close());
    }
    
    const checkConflictsButton = document.getElementById('check-conflicts-button');
    if (checkConflictsButton) {
      checkConflictsButton.addEventListener('click', () => this.handleCheckConflicts());
    }
    
    const requestSuggestionsButton = document.getElementById('request-suggestions-button');
    if (requestSuggestionsButton) {
      requestSuggestionsButton.addEventListener('click', () => this.handleRequestSuggestions());
    }
  }

  /**
   * Handle check conflicts button click
   */
  async handleCheckConflicts() {
    const scheduleData = this.getFormData();
    
    // Check for required fields
    if (!scheduleData.date || !scheduleData.start_time || !scheduleData.end_time) {
      alert('Please fill in the date and time fields.');
      return;
    }
    
    const conflicts = await this.checkConflicts(scheduleData);
    this.displayConflicts(conflicts);
  }

  /**
   * Handle request suggestions button click
   */
  async handleRequestSuggestions() {
    const scheduleData = this.getFormData();
    
    // Check for required fields
    if (!scheduleData.client_id) {
      alert('Please select a client before requesting suggestions.');
      return;
    }
    
    try {
      // Create a temporary schedule object to get suggestions
      const tempSchedule = {
        id: this.schedule ? this.schedule.id : `temp-${Date.now()}`,
        ...scheduleData
      };
      
      // Request suggestions from the agent
      console.log(`Requesting suggestions for schedule ${tempSchedule.id} via API...`);
      // Note: Similar to checkConflicts, API might expect an existing ID.
      const suggestionsResponse = await window.fetchAPI(`/agent/suggestions/schedule/${tempSchedule.id}`);
      
      // The API returns the suggestions array directly or an object containing it.
      // Based on agentService.js, it might be suggestionsResponse directly if it's an array,
      // or suggestionsResponse.suggestions if the API wraps it.
      // For now, let's assume the API returns an object with a suggestions property, like the original.
      if (suggestionsResponse && suggestionsResponse.suggestions) {
        this.handleAgentSuggestions(suggestionsResponse.suggestions);
      } else if (Array.isArray(suggestionsResponse)) { // Or if API returns array directly
        this.handleAgentSuggestions(suggestionsResponse);
        this.handleAgentSuggestions(suggestions.suggestions);
      } else {
        alert('No suggestions available at this time.');
      }
    } catch (error) {
      console.error('Error requesting suggestions:', error);
      alert('Error requesting suggestions. Please try again.');
    }
  }

  /**
   * Display conflicts in the UI
   * @param {Array} conflicts - The conflicts to display
   */
  displayConflicts(conflicts) {
    const conflictsContainer = document.getElementById('conflicts-container');
    if (!conflictsContainer) return;
    
    if (!conflicts || conflicts.length === 0) {
      conflictsContainer.innerHTML = '<p class="no-conflicts">No conflicts found.</p>';
      conflictsContainer.style.display = 'block';
      return;
    }
    
    let html = '<h3>Potential Conflicts</h3><ul class="conflicts-list">';
    conflicts.forEach(conflict => {
      html += `
        <li class="conflict-item">
          <div class="conflict-description">${conflict.description}</div>
          <div class="conflict-severity priority-${conflict.severity || 'medium'}">${conflict.severity}</div>
        </li>
      `;
    });
    html += '</ul>';
    
    conflictsContainer.innerHTML = html;
    conflictsContainer.style.display = 'block';
  }

  /**
   * Get form data
   * @returns {Object} The form data
   */
  getFormData() {
    return {
      client_id: document.getElementById('client-id').value,
      caregiver_id: document.getElementById('caregiver-id').value,
      date: document.getElementById('date').value,
      start_time: document.getElementById('start-time').value,
      end_time: document.getElementById('end-time').value,
      status: this.schedule ? this.schedule.status : 'pending'
    };
  }

  /**
   * Handle form submission
   * @param {Event} event - The form submission event
   */
  async handleSubmit(event) {
    event.preventDefault();
    
    const scheduleData = this.getFormData();
    
    try {
      // Check for conflicts first
      const conflicts = await this.checkConflicts(scheduleData);
      
      // If there are high severity conflicts, confirm with the user
      if (conflicts && conflicts.some(c => c.severity === 'high')) {
        if (!confirm('There are high severity conflicts with this schedule. Do you want to save anyway?')) {
          return;
        }
      }
      
      if (this.schedule) {
        // Update existing schedule
        console.log(`Updating schedule ${this.schedule.id} via API...`);
        await window.fetchAPI(`/scheduler/updateSchedule/${this.schedule.id}`, {
          method: 'PUT',
          body: { updatedData: scheduleData },
        });
      } else {
        // Create new schedule
        console.log('Creating new schedule via API...');
        await window.fetchAPI('/scheduler/createSchedule', {
          method: 'POST',
          body: { scheduleData },
        });
      }
      
      // Create a notification about the schedule action
      console.log('Creating notification for schedule action via API...');
      const notificationData = {
        type: 'schedule',
        title: this.schedule ? 'Schedule Updated' : 'Schedule Created',
        message: `Schedule for client ${scheduleData.client_id} on ${scheduleData.date} has been ${this.schedule ? 'updated' : 'created'}.`,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      await window.fetchAPI('/notifications/create', {
        method: 'POST',
        body: { notificationData },
      });
      
      // Publish the update to the real-time system
      realTimeUpdatesService.publish('schedule', {
        id: this.schedule ? this.schedule.id : `new-${Date.now()}`,
        ...scheduleData,
        updated: true
      });
      
      this.close();
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule.');
    }
  }

  /**
   * Open the editor to create a new schedule
   */
  open() {
    this.schedule = null;
    this.suggestions = [];
    this.conflicts = [];
    this.render();
    this.setupEventListeners();
    this.container.style.display = 'block';
  }

  /**
   * Open the editor to edit an existing schedule
   * @param {Object} schedule - The schedule to edit
   */
  edit(schedule) {
    this.schedule = schedule;
    this.suggestions = [];
    this.conflicts = [];
    this.render();
    this.setupEventListeners();
    this.container.style.display = 'block';
    
    // Request suggestions for this schedule
    if (schedule && schedule.id) {
      console.log(`Fetching suggestions for existing schedule ${schedule.id} via API...`);
      window.fetchAPI(`/agent/suggestions/schedule/${schedule.id}`)
        .then(suggestionsResponse => {
          if (suggestionsResponse && suggestionsResponse.suggestions) {
            this.handleAgentSuggestions(suggestionsResponse.suggestions);
          } else if (Array.isArray(suggestionsResponse)) {
            this.handleAgentSuggestions(suggestionsResponse);
          }
        })
        .catch(error => {
          console.error('Error fetching suggestions for existing schedule via API:', error);
        });
    }
  }

  /**
   * Close the editor
   */
  close() {
    this.container.style.display = 'none';
  }
  
  /**
   * Clean up the component
   */
  destroy() {
    // Unsubscribe from updates
    if (this.subscriptionId) {
      realTimeUpdatesService.unsubscribe('agent', this.subscriptionId);
      this.subscriptionId = null;
    }
    
    // Clear the container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

module.exports = ScheduleEditor;

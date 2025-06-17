/**
 * Opportunity Viewer Component
 * Displays scheduling opportunities found by the agentic schedule scanner
 * A key part of the circular integration model (C=2πr) on the frontend
 */

const realTimeUpdatesService = require('../services/real-time-updates');

class OpportunityViewer {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.opportunities = [];
    this.subscriptionId = null;
    
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    console.log('Initializing Opportunity Viewer');
    
    // Subscribe to opportunity updates
    this.subscriptionId = realTimeUpdatesService.subscribe('opportunity', (opportunities) => {
      this.handleOpportunityUpdate(opportunities);
    });
    
    // Initial render
    this.render();
    
    // Fetch initial opportunities
    this.fetchInitialOpportunities();
    
    // Set up button for manual scan
    this.setupScanButton();
  }

  /**
   * Set up the manual scan button
   */
  setupScanButton() {
    // Create a scan button element that will be added to the component
    this.scanButton = document.createElement('button');
    this.scanButton.id = 'manual-scan-button';
    this.scanButton.className = 'primary-button';
    this.scanButton.textContent = 'Scan for Opportunities';
    this.scanButton.addEventListener('click', () => this.handleManualScan());
  }

  /**
   * Handle a manual scan request
   */
  async handleManualScan() {
    try {
      this.scanButton.disabled = true;
      this.scanButton.textContent = 'Scanning...';
      
      // Call the backend to scan for opportunities
      const opportunities = await window.electronAPI.scanForOpportunities();
      
      this.scanButton.disabled = false;
      this.scanButton.textContent = 'Scan for Opportunities';
      
      if (opportunities && opportunities.length > 0) {
        this.showConfirmation(`Found ${opportunities.length} new opportunities!`);
      } else {
        this.showConfirmation('No new opportunities found.');
      }
    } catch (error) {
      console.error('Error scanning for opportunities:', error);
      this.scanButton.disabled = false;
      this.scanButton.textContent = 'Scan for Opportunities';
      this.showError('Failed to scan for opportunities.');
    }
  }

  /**
   * Handle an opportunity update from the real-time service
   * @param {Array|Object} opportunities - The updated opportunities
   */
  handleOpportunityUpdate(opportunities) {
    if (!Array.isArray(opportunities)) {
      opportunities = [opportunities];
    }
    
    console.log('Received opportunity update:', opportunities);
    
    // Update the local list of opportunities
    opportunities.forEach(opportunity => {
      const existingIndex = this.opportunities.findIndex(o => o.id === opportunity.id);
      
      if (existingIndex >= 0) {
        // Update existing opportunity
        this.opportunities[existingIndex] = opportunity;
      } else {
        // Add new opportunity
        this.opportunities.push(opportunity);
      }
    });
    
    // Re-render the component
    this.render();
  }

  /**
   * Fetch initial opportunities from the backend
   */
  async fetchInitialOpportunities() {
    try {
      const opportunities = await window.electronAPI.getOpportunities({ status: 'pending' });
      if (opportunities && opportunities.length > 0) {
        this.opportunities = opportunities;
        this.render();
      }
    } catch (error) {
      console.error('Error fetching initial opportunities:', error);
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the header section
    const header = document.createElement('div');
    header.className = 'component-header';
    
    // Create the main title
    const title = document.createElement('h2');
    title.textContent = 'Scheduling Opportunities';
    header.appendChild(title);
    
    // Add the scan button
    header.appendChild(this.scanButton);
    
    this.container.appendChild(header);
    
    // Create the content section
    const content = document.createElement('div');
    content.className = 'component-content';
    
    // Filter active opportunities
    const activeOpportunities = this.opportunities.filter(o => 
      o.status === 'pending' || o.status === 'active'
    );
    
    // If no opportunities, show a message
    if (activeOpportunities.length === 0) {
      const noOpportunitiesMessage = document.createElement('p');
      noOpportunitiesMessage.textContent = 'No scheduling opportunities available at the moment.';
      noOpportunitiesMessage.className = 'no-opportunities';
      content.appendChild(noOpportunitiesMessage);
    } else {
      // Create a list of opportunities
      const opportunityList = document.createElement('ul');
      opportunityList.className = 'opportunity-list';
      
      activeOpportunities.forEach(opportunity => {
        const listItem = this.createOpportunityListItem(opportunity);
        opportunityList.appendChild(listItem);
      });
      
      content.appendChild(opportunityList);
    }
    
    this.container.appendChild(content);
  }

  /**
   * Create a list item for an opportunity
   * @param {Object} opportunity - The opportunity data
   * @returns {HTMLLIElement} The list item element
   */
  createOpportunityListItem(opportunity) {
    const listItem = document.createElement('li');
    listItem.className = `opportunity-item priority-${opportunity.priority || 'medium'}`;
    
    // Create the header
    const header = document.createElement('div');
    header.className = 'opportunity-header';
    
    const title = document.createElement('h3');
    title.textContent = opportunity.title || this.getDefaultTitle(opportunity);
    header.appendChild(title);
    
    const priority = document.createElement('span');
    priority.className = 'opportunity-priority';
    priority.textContent = this.formatPriority(opportunity.priority);
    header.appendChild(priority);
    
    listItem.appendChild(header);
    
    // Create the description
    const description = document.createElement('p');
    description.className = 'opportunity-description';
    description.textContent = opportunity.message || opportunity.description || this.getDefaultDescription(opportunity);
    listItem.appendChild(description);
    
    // Add details based on opportunity type
    if (opportunity.type === 'caregiver_assignment' && opportunity.candidates && opportunity.candidates.length > 0) {
      const candidatesList = document.createElement('div');
      candidatesList.className = 'candidate-list';
      
      const candidatesTitle = document.createElement('h4');
      candidatesTitle.textContent = 'Top Candidates:';
      candidatesList.appendChild(candidatesTitle);
      
      const candidatesUl = document.createElement('ul');
      
      opportunity.candidates.forEach(candidate => {
        const candidateItem = document.createElement('li');
        candidateItem.className = 'candidate-item';
        candidateItem.innerHTML = `
          <strong>${candidate.caregiver_name}</strong> 
          <span class="candidate-score">(${candidate.score}% match)</span>
        `;
        candidatesUl.appendChild(candidateItem);
      });
      
      candidatesList.appendChild(candidatesUl);
      listItem.appendChild(candidatesList);
    }
    
    // Add action buttons
    const actions = document.createElement('div');
    actions.className = 'opportunity-actions';
    
    const viewButton = document.createElement('button');
    viewButton.textContent = 'View Details';
    viewButton.className = 'view-button';
    viewButton.setAttribute('data-id', opportunity.id);
    viewButton.addEventListener('click', () => this.handleViewDetails(opportunity.id));
    actions.appendChild(viewButton);
    
    const acceptButton = document.createElement('button');
    acceptButton.textContent = 'Apply';
    acceptButton.className = 'accept-button';
    acceptButton.setAttribute('data-id', opportunity.id);
    acceptButton.addEventListener('click', () => this.handleApply(opportunity.id));
    actions.appendChild(acceptButton);
    
    const rejectButton = document.createElement('button');
    rejectButton.textContent = 'Dismiss';
    rejectButton.className = 'reject-button';
    rejectButton.setAttribute('data-id', opportunity.id);
    rejectButton.addEventListener('click', () => this.handleDismiss(opportunity.id));
    actions.appendChild(rejectButton);
    
    listItem.appendChild(actions);
    
    return listItem;
  }

  /**
   * Format the priority for display
   * @param {string} priority - The priority value
   * @returns {string} The formatted priority
   */
  formatPriority(priority) {
    if (!priority) return 'Medium';
    
    switch (priority.toLowerCase()) {
      case 'high':
        return 'High Priority';
      case 'medium':
        return 'Medium Priority';
      case 'low':
        return 'Low Priority';
      default:
        return priority.charAt(0).toUpperCase() + priority.slice(1);
    }
  }

  /**
   * Get a default title for an opportunity based on its type
   * @param {Object} opportunity - The opportunity
   * @returns {string} The default title
   */
  getDefaultTitle(opportunity) {
    switch (opportunity.type) {
      case 'caregiver_assignment':
        return `Caregiver Match for ${opportunity.client_name || 'Client'}`;
      case 'schedule_optimization':
        return 'Schedule Optimization Opportunity';
      case 'conflict_resolution':
        return 'Schedule Conflict Detected';
      default:
        return 'New Scheduling Opportunity';
    }
  }

  /**
   * Get a default description for an opportunity based on its type
   * @param {Object} opportunity - The opportunity
   * @returns {string} The default description
   */
  getDefaultDescription(opportunity) {
    switch (opportunity.type) {
      case 'caregiver_assignment':
        return `Potential caregivers found for ${opportunity.client_name || 'client'} on ${opportunity.date || 'scheduled date'}.`;
      case 'schedule_optimization':
        return 'An opportunity to optimize scheduling has been identified.';
      case 'conflict_resolution':
        return 'A scheduling conflict has been detected that requires attention.';
      default:
        return 'A new scheduling opportunity has been identified by the system.';
    }
  }

  /**
   * Handle viewing details of an opportunity
   * @param {string} opportunityId - The ID of the opportunity to view
   */
  async handleViewDetails(opportunityId) {
    console.log(`Viewing details for opportunity ${opportunityId}`);
    
    try {
      // Get detailed information about the opportunity
      const opportunityDetails = await window.electronAPI.getOpportunityDetails(opportunityId);
      
      // Create a modal to display the details
      this.showDetailsModal(opportunityDetails);
      
    } catch (error) {
      console.error('Error viewing opportunity details:', error);
      this.showError('Failed to retrieve opportunity details.');
    }
  }

  /**
   * Show a modal with opportunity details
   * @param {Object} opportunity - The opportunity details
   */
  showDetailsModal(opportunity) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const title = document.createElement('h2');
    title.textContent = opportunity.title || this.getDefaultTitle(opportunity);
    header.appendChild(title);
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'close-button';
    closeButton.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    header.appendChild(closeButton);
    
    modalContent.appendChild(header);
    
    // Create body
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    // Add opportunity details based on type
    if (opportunity.type === 'caregiver_assignment') {
      this.renderCaregiverAssignmentDetails(body, opportunity);
    } else {
      // Generic details rendering
      const description = document.createElement('p');
      description.textContent = opportunity.message || opportunity.description || this.getDefaultDescription(opportunity);
      body.appendChild(description);
      
      // Add JSON representation for debugging/development
      const jsonPre = document.createElement('pre');
      jsonPre.textContent = JSON.stringify(opportunity, null, 2);
      body.appendChild(jsonPre);
    }
    
    modalContent.appendChild(body);
    
    // Create footer with action buttons
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply Opportunity';
    applyButton.className = 'primary-button';
    applyButton.addEventListener('click', () => {
      this.handleApply(opportunity.id);
      document.body.removeChild(modal);
    });
    footer.appendChild(applyButton);
    
    const dismissButton = document.createElement('button');
    dismissButton.textContent = 'Dismiss';
    dismissButton.className = 'secondary-button';
    dismissButton.addEventListener('click', () => {
      this.handleDismiss(opportunity.id);
      document.body.removeChild(modal);
    });
    footer.appendChild(dismissButton);
    
    modalContent.appendChild(footer);
    
    // Add modal to DOM
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  }

  /**
   * Render caregiver assignment opportunity details
   * @param {HTMLElement} container - The container to append to
   * @param {Object} opportunity - The opportunity details
   */
  renderCaregiverAssignmentDetails(container, opportunity) {
    // Client information
    const clientSection = document.createElement('div');
    clientSection.className = 'detail-section';
    
    const clientTitle = document.createElement('h3');
    clientTitle.textContent = 'Client Information';
    clientSection.appendChild(clientTitle);
    
    const clientInfo = document.createElement('div');
    clientInfo.className = 'client-info';
    
    if (opportunity.client_details) {
      clientInfo.innerHTML = `
        <p><strong>Name:</strong> ${opportunity.client_details.name}</p>
        <p><strong>Location:</strong> ${this.formatLocation(opportunity.client_details.location)}</p>
        <p><strong>Required Skills:</strong> ${(opportunity.client_details.required_skills || []).join(', ') || 'None specified'}</p>
      `;
    } else {
      clientInfo.innerHTML = `
        <p><strong>Name:</strong> ${opportunity.client_name || 'Unknown'}</p>
        <p><strong>Schedule Date:</strong> ${opportunity.date || 'Unknown'}</p>
        <p><strong>Time:</strong> ${opportunity.time_range || 'Unknown'}</p>
      `;
    }
    
    clientSection.appendChild(clientInfo);
    container.appendChild(clientSection);
    
    // Schedule information
    if (opportunity.schedule_details) {
      const scheduleSection = document.createElement('div');
      scheduleSection.className = 'detail-section';
      
      const scheduleTitle = document.createElement('h3');
      scheduleTitle.textContent = 'Schedule Details';
      scheduleSection.appendChild(scheduleTitle);
      
      const scheduleInfo = document.createElement('div');
      scheduleInfo.className = 'schedule-info';
      scheduleInfo.innerHTML = `
        <p><strong>Date:</strong> ${opportunity.schedule_details.date}</p>
        <p><strong>Time:</strong> ${opportunity.schedule_details.start_time} - ${opportunity.schedule_details.end_time}</p>
        <p><strong>Status:</strong> ${opportunity.schedule_details.status}</p>
      `;
      
      scheduleSection.appendChild(scheduleInfo);
      container.appendChild(scheduleSection);
    }
    
    // Caregiver candidates
    if (opportunity.enhanced_candidates || opportunity.candidates) {
      const candidatesSection = document.createElement('div');
      candidatesSection.className = 'detail-section';
      
      const candidatesTitle = document.createElement('h3');
      candidatesTitle.textContent = 'Caregiver Candidates';
      candidatesSection.appendChild(candidatesTitle);
      
      const candidatesList = document.createElement('div');
      candidatesList.className = 'candidates-list';
      
      const candidates = opportunity.enhanced_candidates || opportunity.candidates;
      
      candidates.forEach((candidate, index) => {
        const candidateCard = document.createElement('div');
        candidateCard.className = `candidate-card ${index === 0 ? 'top-candidate' : ''}`;
        
        let candidateContent = '';
        
        if (candidate.caregiver_details) {
          candidateContent = `
            <div class="candidate-header">
              <h4>${candidate.caregiver_details.name}</h4>
              <span class="candidate-score">${candidate.score}% match</span>
            </div>
            <div class="candidate-details">
              <p><strong>Skills:</strong> ${(candidate.caregiver_details.skills || []).join(', ') || 'None specified'}</p>
              <p><strong>Location:</strong> ${this.formatLocation(candidate.caregiver_details.location)}</p>
            </div>
          `;
        } else {
          candidateContent = `
            <div class="candidate-header">
              <h4>${candidate.caregiver_name}</h4>
              <span class="candidate-score">${candidate.score}% match</span>
            </div>
          `;
        }
        
        candidateCard.innerHTML = candidateContent;
        candidatesList.appendChild(candidateCard);
      });
      
      candidatesSection.appendChild(candidatesList);
      container.appendChild(candidatesSection);
    }
    
    // AI recommendation
    if (opportunity.ai_recommendation) {
      const aiSection = document.createElement('div');
      aiSection.className = 'detail-section ai-recommendation';
      
      const aiTitle = document.createElement('h3');
      aiTitle.textContent = 'AI Recommendation';
      aiSection.appendChild(aiTitle);
      
      const recommendation = document.createElement('div');
      recommendation.className = `recommendation ${opportunity.ai_recommendation.recommendation}`;
      
      let recommendationText = '';
      switch (opportunity.ai_recommendation.recommendation) {
        case 'accept':
          recommendationText = '✅ Recommended: Apply this opportunity';
          break;
        case 'consider':
          recommendationText = '⚠️ Consider applying this opportunity';
          break;
        case 'explore-alternatives':
          recommendationText = '🔍 Consider exploring alternatives';
          break;
        default:
          recommendationText = opportunity.ai_recommendation.recommendation;
      }
      
      recommendation.innerHTML = `
        <p class="recommendation-text">${recommendationText}</p>
        <p class="recommendation-reason">${opportunity.ai_recommendation.reasoning}</p>
        <p class="recommendation-confidence">Confidence: ${Math.round(opportunity.ai_recommendation.confidence * 100)}%</p>
      `;
      
      aiSection.appendChild(recommendation);
      container.appendChild(aiSection);
    }
  }

  /**
   * Format a location object for display
   * @param {Object} location - The location object
   * @returns {string} The formatted location
   */
  formatLocation(location) {
    if (!location) return 'Unknown';
    
    if (location.address) {
      return location.address;
    }
    
    if (location.latitude && location.longitude) {
      return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }
    
    return 'Unknown';
  }

  /**
   * Handle applying an opportunity
   * @param {string} opportunityId - The ID of the opportunity to apply
   */
  async handleApply(opportunityId) {
    console.log(`Applying opportunity ${opportunityId}`);
    
    try {
      // Send request to apply the opportunity
      const result = await window.electronAPI.applyOpportunity(opportunityId);
      
      if (result.success) {
        // Update the local list of opportunities
        this.opportunities = this.opportunities.filter(o => o.id !== opportunityId);
        this.render();
        
        // Show confirmation
        this.showConfirmation('Opportunity applied successfully!');
      } else {
        this.showError(`Failed to apply opportunity: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error applying opportunity:', error);
      this.showError('Failed to apply the opportunity.');
    }
  }

  /**
   * Handle dismissing an opportunity
   * @param {string} opportunityId - The ID of the opportunity to dismiss
   */
  async handleDismiss(opportunityId) {
    console.log(`Dismissing opportunity ${opportunityId}`);
    
    try {
      // Update the opportunity status
      const opportunity = this.opportunities.find(o => o.id === opportunityId);
      if (!opportunity) {
        console.error('Opportunity not found');
        return;
      }
      
      // Call the API to reject the opportunity
      await window.electronAPI.rejectOpportunity(opportunityId);
      
      // Remove the opportunity from the list
      this.opportunities = this.opportunities.filter(o => o.id !== opportunityId);
      this.render();
      
      // Show confirmation
      this.showConfirmation('Opportunity dismissed.');
      
    } catch (error) {
      console.error('Error dismissing opportunity:', error);
      this.showError('Failed to dismiss the opportunity.');
    }
  }

  /**
   * Show a confirmation message
   * @param {string} message - The message to show
   */
  showConfirmation(message) {
    // This could be implemented with a more sophisticated notification system
    alert(message);
  }

  /**
   * Show an error message
   * @param {string} message - The message to show
   */
  showError(message) {
    // This could be implemented with a more sophisticated notification system
    alert(`Error: ${message}`);
  }

  /**
   * Clean up the component
   */
  destroy() {
    console.log('Destroying Opportunity Viewer');
    
    // Unsubscribe from updates
    if (this.subscriptionId) {
      realTimeUpdatesService.unsubscribe('opportunity', this.subscriptionId);
      this.subscriptionId = null;
    }
    
    // Clear the container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

module.exports = OpportunityViewer;

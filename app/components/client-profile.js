/**
 * Client Profile Component
 * Displays a client's profile and their schedule
 */

const Calendar = require('./calendar');

class ClientProfile {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.client = null;
    this.calendar = null;
  }

  /**
   * Load and display a client's profile
   * @param {string} clientId - The ID of the client to load
   */
  async load(clientId) {
    try {
      console.log(`Loading client profile for ${clientId} via API...`);
      this.client = await window.fetchAPI(`/firebase/client/${clientId}`);
      this.render();
      
      // Initialize the calendar for this client
      if (this.calendar) {
        this.calendar.destroy();
      }
      
      // Create a calendar specific to this client
      this.calendar = new Calendar(`client-calendar-${clientId}`, { 
        clientId: this.client.id,
        clientName: this.client.name
      });
      
    } catch (error) {
      console.error('Error loading client profile:', error);
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container || !this.client) return;
    
    this.container.innerHTML = `
      <div class="profile-header">
        <h2>${this.client.name}</h2>
        <div class="profile-actions">
          <button id="edit-client-profile">Edit Profile</button>
          <button id="add-client-schedule">Add Schedule</button>
        </div>
      </div>
      <div class="profile-details">
        <p><strong>Location:</strong> ${this.client.location.latitude}, ${this.client.location.longitude}</p>
        <p><strong>Required Skills:</strong> ${this.client.required_skills.join(', ')}</p>
        <p><strong>Status:</strong> <span class="status-active">Active</span></p>
      </div>
      <h3>Schedule</h3>
      <div id="client-calendar-${this.client.id}" class="calendar-container"></div>
    `;
    
    // Add event listeners for the profile action buttons
    document.getElementById('add-client-schedule').addEventListener('click', () => {
      // Open schedule editor pre-filled with this client
      window.dispatchEvent(new CustomEvent('open-schedule-editor', {
        detail: { clientId: this.client.id }
      }));
    });
  }
}

module.exports = ClientProfile;

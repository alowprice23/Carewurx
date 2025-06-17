/**
 * Caregiver Profile Component
 * Displays a caregiver's profile and their schedule
 */

const Calendar = require('./calendar');

class CaregiverProfile {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.caregiver = null;
    this.calendar = null;
  }

  /**
   * Load and display a caregiver's profile
   * @param {string} caregiverId - The ID of the caregiver to load
   */
  async load(caregiverId) {
    try {
      this.caregiver = await window.electronAPI.getCaregiver(caregiverId);
      this.render();
      
      // Initialize the calendar for this caregiver
      if (this.calendar) {
        this.calendar.destroy();
      }
      
      // Create a calendar specific to this caregiver
      this.calendar = new Calendar(`caregiver-calendar-${caregiverId}`, { 
        caregiverId: this.caregiver.id,
        caregiverName: this.caregiver.name
      });
      
    } catch (error) {
      console.error('Error loading caregiver profile:', error);
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container || !this.caregiver) return;
    
    this.container.innerHTML = `
      <div class="profile-header">
        <h2>${this.caregiver.name}</h2>
        <div class="profile-actions">
          <button id="edit-caregiver-profile">Edit Profile</button>
          <button id="add-caregiver-availability">Add Availability</button>
        </div>
      </div>
      <div class="profile-details">
        <p><strong>Location:</strong> ${this.caregiver.location.latitude}, ${this.caregiver.location.longitude}</p>
        <p><strong>Skills:</strong> ${this.caregiver.skills.join(', ')}</p>
        <p><strong>Status:</strong> <span class="status-active">Active</span></p>
      </div>
      
      <div class="profile-sections">
        <div class="profile-section">
          <h3>Assigned Schedule</h3>
          <div id="caregiver-calendar-${this.caregiver.id}" class="calendar-container"></div>
        </div>
        
        <div class="profile-section">
          <h3>Availability</h3>
          <div class="availability-container">
            <p>Set the times when this caregiver is available to work.</p>
            <div class="availability-days">
              <div class="availability-day">
                <span>Monday</span>
                <div class="time-range">
                  <select id="monday-start">
                    <option value="08:00">8:00 AM</option>
                    <option value="09:00" selected>9:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                  </select>
                  <span>to</span>
                  <select id="monday-end">
                    <option value="16:00">4:00 PM</option>
                    <option value="17:00" selected>5:00 PM</option>
                    <option value="18:00">6:00 PM</option>
                  </select>
                </div>
              </div>
              <!-- More days would be added here -->
            </div>
            <button id="save-availability">Save Availability</button>
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners for the profile action buttons
    document.getElementById('add-caregiver-availability').addEventListener('click', () => {
      // Toggle availability section visibility
      const availabilitySection = document.querySelector('.availability-container');
      availabilitySection.style.display = availabilitySection.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('save-availability').addEventListener('click', () => {
      // Save availability
      const mondayStart = document.getElementById('monday-start').value;
      const mondayEnd = document.getElementById('monday-end').value;
      
      console.log(`Saving availability: Monday ${mondayStart} - ${mondayEnd}`);
      // Would typically call an API here
    });
  }
}

module.exports = CaregiverProfile;

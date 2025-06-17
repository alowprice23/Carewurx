/**
 * Caregiver List Component
 * Displays a list of caregivers and allows for basic management
 */

class CaregiverList {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.caregivers = [];
    this.init();
  }

  /**
   * Initialize the component
   */
  async init() {
    console.log('Initializing Caregiver List');
    await this.fetchCaregivers();
    this.render();
  }

  /**
   * Fetch caregivers from the backend
   */
  async fetchCaregivers() {
    try {
      this.caregivers = await window.electronAPI.getAllCaregivers();
    } catch (error) {
      console.error('Error fetching caregivers:', error);
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="list-header">
        <h3>Caregivers</h3>
        <button id="add-caregiver-button">Add Caregiver</button>
      </div>
      <ul class="item-list">
        ${this.caregivers.map(caregiver => `
          <li>
            <span>${caregiver.name}</span>
            <div class="actions">
              <button data-id="${caregiver.id}" class="view-caregiver">View Profile</button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }
}

module.exports = CaregiverList;

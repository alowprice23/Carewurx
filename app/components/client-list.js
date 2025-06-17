/**
 * Client List Component
 * Displays a list of clients and allows for basic management
 */

class ClientList {
  constructor(elementId) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.clients = [];
    this.init();
  }

  /**
   * Initialize the component
   */
  async init() {
    console.log('Initializing Client List');
    await this.fetchClients();
    this.render();
  }

  /**
   * Fetch clients from the backend
   */
  async fetchClients() {
    try {
      this.clients = await window.electronAPI.getAllClients();
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="list-header">
        <h3>Clients</h3>
        <button id="add-client-button">Add Client</button>
      </div>
      <ul class="item-list">
        ${this.clients.map(client => `
          <li>
            <span>${client.name}</span>
            <div class="actions">
              <button data-id="${client.id}" class="view-client">View Profile</button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }
}

module.exports = ClientList;

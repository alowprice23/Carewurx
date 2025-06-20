/**
 * Universal Data Service
 *
 * This service provides unified access to data entities across the application.
 * It serves as a facade for underlying data sources, abstracting whether
 * the application is running in Electron (with backend access) or in a browser
 * (using mock data).
 */
import firebase from './firebase'; // For getting ID token
import { isElectronAvailable } from './firebaseService';

// Mock data for browser-only mode
const mockDb = {
  clients: [
    { id: 'mockClient1', name: 'Mock Client Alpha', email: 'alpha@example.mock', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'mockClient2', name: 'Mock Client Beta', email: 'beta@example.mock', isActive: false, createdAt: new Date(), updatedAt: new Date() },
  ],
  caregivers: [
    { id: 'mockCaregiver1', name: 'Mock Caregiver Gamma', email: 'gamma@example.mock', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'mockCaregiver2', name: 'Mock Caregiver Delta', email: 'delta@example.mock', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ],
};

let nextMockId = 1000;

class UniversalDataService {
  /**
   * Get all clients
   * @returns {Promise<Array>} Array of client objects
   */
  async getClients() {
    console.log('UniversalDataService: getClients called');
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get clients.');
        const idToken = await user.getIdToken();
        const result = await window.electronAPI.getAllClients({ idToken });
        return result || [];
      } catch (error) {
        console.error('Error getting clients via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalDataService: Returning mock clients');
      return Promise.resolve([...mockDb.clients]);
    }
  }

  /**
   * Get all caregivers
   * @returns {Promise<Array>} Array of caregiver objects
   */
  async getCaregivers() {
    console.log('UniversalDataService: getCaregivers called');
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get caregivers.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getAllCaregivers({ idToken }) || [];
      } catch (error) {
        console.error('Error getting caregivers via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalDataService: Returning mock caregivers');
      return Promise.resolve([...mockDb.caregivers]);
    }
  }

  /**
   * Get a specific client by ID
   * @param {string} clientId - Client ID
   * @returns {Promise<Object|null>} Client object or null if not found
   */
  async getClient(clientId) {
    console.log('UniversalDataService: getClient called with ID:', clientId);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get client.');
        const idToken = await user.getIdToken();
        // Assuming backend expects { idToken, clientId } or similar if not just one object
        // Based on main.js changes, handlers expect (event, args) where args contains idToken and other params
        return await window.electronAPI.getClient({ idToken, clientId });
      } catch (error) {
        console.error(`Error getting client ${clientId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalDataService: Returning mock client for ID: ${clientId}`);
      const client = mockDb.clients.find(c => c.id === clientId);
      return Promise.resolve(client || null);
    }
  }

  /**
   * Get a specific caregiver by ID
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object|null>} Caregiver object or null if not found
   */
  async getCaregiver(caregiverId) {
    console.log('UniversalDataService: getCaregiver called with ID:', caregiverId);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to get caregiver.');
        const idToken = await user.getIdToken();
        return await window.electronAPI.getCaregiver({ idToken, caregiverId });
      } catch (error) {
        console.error(`Error getting caregiver ${caregiverId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalDataService: Returning mock caregiver for ID: ${caregiverId}`);
      const caregiver = mockDb.caregivers.find(c => c.id === caregiverId);
      return Promise.resolve(caregiver || null);
    }
  }

  /**
   * Create a new client
   * @param {Object} clientData - Client data
   * @returns {Promise<Object>} Created client object (or mock)
   */
  async createClient(clientData) {
    console.log('UniversalDataService: createClient called with data:', clientData);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to create client.');
        const idToken = await user.getIdToken();
        const response = await window.electronAPI.createClient({ idToken, clientData });
        if (response && response.success) {
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to create client via Electron API');
        }
      } catch (error) {
        console.error('Error creating client via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalDataService: Simulating client creation');
      const newClient = {
        id: `mockClient${nextMockId++}`,
        ...clientData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.clients.push(newClient);
      return Promise.resolve(newClient);
    }
  }

  /**
   * Create a new caregiver
   * @param {Object} caregiverData - Caregiver data
   * @returns {Promise<Object>} Created caregiver object (or mock)
   */
  async createCaregiver(caregiverData) {
    console.log('UniversalDataService: createCaregiver called with data:', caregiverData);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to create caregiver.');
        const idToken = await user.getIdToken();
        const response = await window.electronAPI.createCaregiver({ idToken, caregiverData });
        if (response && response.success) {
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to create caregiver via Electron API');
        }
      } catch (error) {
        console.error('Error creating caregiver via Electron API:', error);
        throw error;
      }
    } else {
      console.log('UniversalDataService: Simulating caregiver creation');
      const newCaregiver = {
        id: `mockCaregiver${nextMockId++}`,
        ...caregiverData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.caregivers.push(newCaregiver);
      return Promise.resolve(newCaregiver);
    }
  }

  /**
   * Update a client
   * @param {string} clientId - Client ID
   * @param {Object} clientData - Updated client data
   * @returns {Promise<Object>} Updated client object (or mock)
   */
  async updateClient(clientId, clientData) {
    console.log('UniversalDataService: updateClient called for ID:', clientId, 'with data:', clientData);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to update client.');
        const idToken = await user.getIdToken();
        const response = await window.electronAPI.updateClient({ idToken, clientId, clientData });
         if (response && response.success) {
          return { id: clientId, ...clientData }; // Assuming success means data is applied
        } else {
          throw new Error(response.error || `Failed to update client ${clientId} via Electron API`);
        }
      } catch (error) {
        console.error(`Error updating client ${clientId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalDataService: Simulating client update for ID: ${clientId}`);
      const clientIndex = mockDb.clients.findIndex(c => c.id === clientId);
      if (clientIndex > -1) {
        mockDb.clients[clientIndex] = {
          ...mockDb.clients[clientIndex],
          ...clientData,
          updatedAt: new Date(),
        };
        return Promise.resolve(mockDb.clients[clientIndex]);
      }
      return Promise.reject(new Error(`Mock client with ID ${clientId} not found for update.`));
    }
  }

  /**
   * Update a caregiver
   * @param {string} caregiverId - Caregiver ID
   * @param {Object} caregiverData - Updated caregiver data
   * @returns {Promise<Object>} Updated caregiver object (or mock)
   */
  async updateCaregiver(caregiverId, caregiverData) {
    console.log('UniversalDataService: updateCaregiver called for ID:', caregiverId, 'with data:', caregiverData);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to update caregiver.');
        const idToken = await user.getIdToken();
        const response = await window.electronAPI.updateCaregiver({ idToken, caregiverId, caregiverData });
        if (response && response.success) {
          return { id: caregiverId, ...caregiverData };
        } else {
          throw new Error(response.error || `Failed to update caregiver ${caregiverId} via Electron API`);
        }
      } catch (error) {
        console.error(`Error updating caregiver ${caregiverId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalDataService: Simulating caregiver update for ID: ${caregiverId}`);
      const caregiverIndex = mockDb.caregivers.findIndex(c => c.id === caregiverId);
      if (caregiverIndex > -1) {
        mockDb.caregivers[caregiverIndex] = {
          ...mockDb.caregivers[caregiverIndex],
          ...caregiverData,
          updatedAt: new Date(),
        };
        return Promise.resolve(mockDb.caregivers[caregiverIndex]);
      }
      return Promise.reject(new Error(`Mock caregiver with ID ${caregiverId} not found for update.`));
    }
  }

  /**
   * Delete a client
   * @param {string} clientId - Client ID
   * @returns {Promise<{success: boolean, id?: string, error?: string}>} Result object
   */
  async deleteClient(clientId) {
    console.log('UniversalDataService: deleteClient called for ID:', clientId);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to delete client.');
        const idToken = await user.getIdToken();
        const response = await window.electronAPI.deleteClient({ idToken, clientId });
        if (response && response.success) {
          return response;
        } else {
          throw new Error(response.error || `Failed to delete client ${clientId} via Electron API`);
        }
      } catch (error) {
        console.error(`Error deleting client ${clientId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalDataService: Simulating client deletion for ID: ${clientId}`);
      const clientIndex = mockDb.clients.findIndex(c => c.id === clientId);
      if (clientIndex > -1) {
        mockDb.clients.splice(clientIndex, 1);
        return Promise.resolve({ success: true, id: clientId });
      }
      return Promise.resolve({ success: false, error: `Mock client with ID ${clientId} not found for deletion.` });
    }
  }

  /**
   * Delete a caregiver
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<{success: boolean, id?: string, error?: string}>} Result object
   */
  async deleteCaregiver(caregiverId) {
    console.log('UniversalDataService: deleteCaregiver called for ID:', caregiverId);
    if (isElectronAvailable()) { // Called as a function
      try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('Authentication required to delete caregiver.');
        const idToken = await user.getIdToken();
        const response = await window.electronAPI.deleteCaregiver({ idToken, caregiverId });
         if (response && response.success) {
          return response;
        } else {
          throw new Error(response.error || `Failed to delete caregiver ${caregiverId} via Electron API`);
        }
      } catch (error) {
        console.error(`Error deleting caregiver ${caregiverId} via Electron API:`, error);
        throw error;
      }
    } else {
      console.log(`UniversalDataService: Simulating caregiver deletion for ID: ${caregiverId}`);
      const caregiverIndex = mockDb.caregivers.findIndex(c => c.id === caregiverId);
      if (caregiverIndex > -1) {
        mockDb.caregivers.splice(caregiverIndex, 1);
        return Promise.resolve({ success: true, id: caregiverId });
      }
      return Promise.resolve({ success: false, error: `Mock caregiver with ID ${caregiverId} not found for deletion.` });
    }
  }
}

// Create and export singleton instance
const universalDataService = new UniversalDataService();
export default universalDataService;

/**
 * Universal Data Service
 * 
 * This service provides unified access to data entities across the application.
 * It serves as a facade for underlying data sources.
 */

import firebaseService from './firebaseService';

// We'll use the data from firebaseServiceMock instead of static mock data
// This is needed for integration with the CaregiverProfileForm and ClientProfileForm components
// that save data directly to the firebaseServiceMock's database

class UniversalDataService {
  /**
   * Get all clients
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of client objects
   */
  async getClients(options = {}) {
    try {
      // In a real implementation, this would call the backend
      console.log('UniversalDataService: Getting clients with options:', options);
      
      // Use firebaseServiceMock to get clients
      try {
        // First try to get clients from firebaseServiceMock
        const clients = await firebaseService.getAllClients();
        return clients;
      } catch (error) {
        console.warn('Failed to get clients from firebaseService, using backup method');
        
        // Fallback to direct Firestore collection query if available
        if (firebaseService.db) {
          const snapshot = await firebaseService.db.collection('clients').get();
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error getting clients:', error);
      throw error;
    }
  }
  
  /**
   * Get all caregivers
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of caregiver objects
   */
  async getCaregivers(options = {}) {
    try {
      // In a real implementation, this would call the backend
      console.log('UniversalDataService: Getting caregivers with options:', options);
      
      // Use firebaseServiceMock to get caregivers if available
      try {
        // First try to use method if it exists
        if (typeof firebaseService.getAllCaregivers === 'function') {
          const caregivers = await firebaseService.getAllCaregivers();
          return caregivers;
        }
        
        // Fallback to direct Firestore collection query
        if (firebaseService.db) {
          const snapshot = await firebaseService.db.collection('caregivers').get();
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        
        throw new Error('No method available to get caregivers');
      } catch (error) {
        console.warn('Error getting caregivers from firebaseService:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error getting caregivers:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific client by ID
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} Client object
   */
  async getClient(clientId) {
    try {
      console.log('UniversalDataService: Getting client with ID:', clientId);
      
      // Try to use the firebaseService method first
      try {
        const client = await firebaseService.getClientById(clientId);
        if (client) return client;
      } catch (error) {
        console.warn('Failed to get client using getClientById:', error);
      }
      
      // Fallback to direct Firestore document query
      if (firebaseService.db) {
        const doc = await firebaseService.db.collection('clients').doc(clientId).get();
        if (doc.exists) {
          return {
            id: doc.id,
            ...doc.data()
          };
        }
      }
      
      throw new Error(`Client with ID ${clientId} not found`);
    } catch (error) {
      console.error(`Error getting client ${clientId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a specific caregiver by ID
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} Caregiver object
   */
  async getCaregiver(caregiverId) {
    try {
      console.log('UniversalDataService: Getting caregiver with ID:', caregiverId);
      
      // Try direct Firestore document query
      if (firebaseService.db) {
        const doc = await firebaseService.db.collection('caregivers').doc(caregiverId).get();
        if (doc.exists) {
          return {
            id: doc.id,
            ...doc.data()
          };
        }
      }
      
      throw new Error(`Caregiver with ID ${caregiverId} not found`);
    } catch (error) {
      console.error(`Error getting caregiver ${caregiverId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new client
   * @param {Object} clientData - Client data
   * @returns {Promise<Object>} Created client
   */
  async createClient(clientData) {
    try {
      console.log('UniversalDataService: Creating client with data:', clientData);
      
      // Try to use firebaseService createClient method if available
      if (typeof firebaseService.createClient === 'function') {
        return await firebaseService.createClient(clientData);
      }
      
      // Otherwise use Firestore directly
      if (firebaseService.db) {
        const docRef = await firebaseService.db.collection('clients').add({
          ...clientData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        return {
          id: docRef.id,
          ...clientData
        };
      }
      
      throw new Error('No method available to create client');
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }
  
  /**
   * Create a new caregiver
   * @param {Object} caregiverData - Caregiver data
   * @returns {Promise<Object>} Created caregiver
   */
  async createCaregiver(caregiverData) {
    try {
      console.log('UniversalDataService: Creating caregiver with data:', caregiverData);
      
      // Use Firestore directly
      if (firebaseService.db) {
        const docRef = await firebaseService.db.collection('caregivers').add({
          ...caregiverData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        return {
          id: docRef.id,
          ...caregiverData
        };
      }
      
      throw new Error('No method available to create caregiver');
    } catch (error) {
      console.error('Error creating caregiver:', error);
      throw error;
    }
  }
  
  /**
   * Update a client
   * @param {string} clientId - Client ID
   * @param {Object} clientData - Updated client data
   * @returns {Promise<Object>} Updated client
   */
  async updateClient(clientId, clientData) {
    try {
      console.log('UniversalDataService: Updating client with ID:', clientId);
      
      // Try to use firebaseService updateClient method if available
      if (typeof firebaseService.updateClient === 'function') {
        return await firebaseService.updateClient(clientId, clientData);
      }
      
      // Otherwise use Firestore directly
      if (firebaseService.db) {
        await firebaseService.db.collection('clients').doc(clientId).update({
          ...clientData,
          updatedAt: new Date()
        });
        
        return {
          id: clientId,
          ...clientData
        };
      }
      
      throw new Error('No method available to update client');
    } catch (error) {
      console.error(`Error updating client ${clientId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update a caregiver
   * @param {string} caregiverId - Caregiver ID
   * @param {Object} caregiverData - Updated caregiver data
   * @returns {Promise<Object>} Updated caregiver
   */
  async updateCaregiver(caregiverId, caregiverData) {
    try {
      console.log('UniversalDataService: Updating caregiver with ID:', caregiverId);
      
      // Use Firestore directly
      if (firebaseService.db) {
        await firebaseService.db.collection('caregivers').doc(caregiverId).update({
          ...caregiverData,
          updatedAt: new Date()
        });
        
        return {
          id: caregiverId,
          ...caregiverData
        };
      }
      
      throw new Error('No method available to update caregiver');
    } catch (error) {
      console.error(`Error updating caregiver ${caregiverId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a client
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} Result
   */
  async deleteClient(clientId) {
    try {
      console.log('UniversalDataService: Deleting client with ID:', clientId);
      
      // Use Firestore directly
      if (firebaseService.db) {
        await firebaseService.db.collection('clients').doc(clientId).delete();
        return { success: true };
      }
      
      throw new Error('No method available to delete client');
    } catch (error) {
      console.error(`Error deleting client ${clientId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a caregiver
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} Result
   */
  async deleteCaregiver(caregiverId) {
    try {
      console.log('UniversalDataService: Deleting caregiver with ID:', caregiverId);
      
      // Use Firestore directly
      if (firebaseService.db) {
        await firebaseService.db.collection('caregivers').doc(caregiverId).delete();
        return { success: true };
      }
      
      throw new Error('No method available to delete caregiver');
    } catch (error) {
      console.error(`Error deleting caregiver ${caregiverId}:`, error);
      throw error;
    }
  }
}

// Create and export singleton instance
const universalDataService = new UniversalDataService();
export default universalDataService;

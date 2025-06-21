/**
 * Universal Data Service
 * 
 * This service provides unified access to data entities across the application.
 * It serves as a facade for underlying data sources.
 */

// This service should use Electron IPC or Firebase Functions, not direct client-side Firestore access.
// import firebaseService from './firebaseService'; // This would be the client SDK, not for direct full CRUD.

class UniversalDataService {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  }

  // Generic method to get entities
  async getEntities(entityType, options = {}) {
    console.log(`UniversalDataService: Getting ${entityType} with options:`, options);
    if (this.isElectron && window.electronAPI.getEntities) {
      return window.electronAPI.getEntities(entityType, options);
    }
    // TODO: Implement Firebase Function call for web: firebase.functions().httpsCallable('getEntities')({ entityType, options });
    console.warn(`getEntities for ${entityType}: Web environment or IPC method not implemented. Returning mock data.`);
    return []; // Mock
  }

  async getEntity(entityType, entityId) {
    console.log(`UniversalDataService: Getting ${entityType} with ID:`, entityId);
    if (this.isElectron && window.electronAPI.getEntity) {
      return window.electronAPI.getEntity(entityType, entityId);
    }
    // TODO: Implement Firebase Function call for web
    console.warn(`getEntity for ${entityType}/${entityId}: Web environment or IPC method not implemented. Returning mock data.`);
    return null; // Mock
  }

  async createEntity(entityType, data) {
    console.log(`UniversalDataService: Creating ${entityType} with data:`, data);
    if (this.isElectron && window.electronAPI.createEntity) {
      return window.electronAPI.createEntity(entityType, data);
    }
    // TODO: Implement Firebase Function call for web
    console.warn(`createEntity for ${entityType}: Web environment or IPC method not implemented. Mocking success.`);
    return { id: `mock-${entityType}-${Date.now()}`, ...data }; // Mock
  }

  async updateEntity(entityType, entityId, data) {
    console.log(`UniversalDataService: Updating ${entityType} with ID ${entityId}:`, data);
    if (this.isElectron && window.electronAPI.updateEntity) {
      return window.electronAPI.updateEntity(entityType, entityId, data);
    }
    // TODO: Implement Firebase Function call for web
    console.warn(`updateEntity for ${entityType}/${entityId}: Web environment or IPC method not implemented. Mocking success.`);
    return { id: entityId, ...data }; // Mock
  }

  async deleteEntity(entityType, entityId) {
    console.log(`UniversalDataService: Deleting ${entityType} with ID:`, entityId);
    if (this.isElectron && window.electronAPI.deleteEntity) {
      return window.electronAPI.deleteEntity(entityType, entityId);
    }
    // TODO: Implement Firebase Function call for web
    console.warn(`deleteEntity for ${entityType}/${entityId}: Web environment or IPC method not implemented. Mocking success.`);
    return { success: true }; // Mock
  }

  // Specific entity methods (can call generic ones or have specific IPC/HTTP endpoints)
  async getClients(options = {}) { return this.getEntities('clients', options); }
  async getClient(clientId) { return this.getEntity('clients', clientId); }
  async createClient(clientData) { return this.createEntity('clients', clientData); }
  async updateClient(clientId, clientData) { return this.updateEntity('clients', clientId, clientData); }
  async deleteClient(clientId) { return this.deleteEntity('clients', clientId); }

  async getCaregivers(options = {}) { return this.getEntities('caregivers', options); }
  async getCaregiver(caregiverId) { return this.getEntity('caregivers', caregiverId); }
  async createCaregiver(caregiverData) { return this.createEntity('caregivers', caregiverData); }
  async updateCaregiver(caregiverId, caregiverData) { return this.updateEntity('caregivers', caregiverId, caregiverData); }
  async deleteCaregiver(caregiverId) { return this.deleteEntity('caregivers', caregiverId); }
  
  // Schedules might have more specific methods in universalScheduleService, but basic CRUD could be here
  async getSchedules(options = {}) { return this.getEntities('schedules', options); }
  async createSchedule(scheduleData) { return this.createEntity('schedules', scheduleData); }
  async updateSchedule(scheduleId, scheduleData) { return this.updateEntity('schedules', scheduleId, scheduleData); }
  async deleteSchedule(scheduleId) { return this.deleteEntity('schedules', scheduleId); }

}

// Create and export singleton instance
const universalDataService = new UniversalDataService();
export default universalDataService;
    } catch (error) {
      console.error(`Error deleting caregiver ${caregiverId}:`, error);
      throw error;
    }
  }
}

// Create and export singleton instance
const universalDataService = new UniversalDataService();
export default universalDataService;

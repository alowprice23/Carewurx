import universalDataService from '../universalDataService';
import { isElectronAvailable } from '../firebaseService'; // To be mocked

// Mock the firebaseService to control isElectronAvailable
jest.mock('../firebaseService', () => ({
  isElectronAvailable: jest.fn(),
}));

// Mock window.electronAPI
global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: {
    getAllClients: jest.fn(),
    getClient: jest.fn(),
    createClient: jest.fn(),
    updateClient: jest.fn(),
    deleteClient: jest.fn(),
    getAllCaregivers: jest.fn(),
    getCaregiver: jest.fn(),
    createCaregiver: jest.fn(),
    updateCaregiver: jest.fn(),
    deleteCaregiver: jest.fn(),
  },
  writable: true,
});

describe('UniversalDataService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // --- Client Methods ---
  describe('Client Operations', () => {
    const sampleClientData = { name: 'Test Client', email: 'test@client.com' };
    const sampleClientId = 'client123';

    // getClients
    describe('getClients', () => {
      it('should call window.electronAPI.getAllClients if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockClients = [{ id: 'eClient1', name: 'Electron Client' }];
        window.electronAPI.getAllClients.mockResolvedValue(mockClients);

        const clients = await universalDataService.getClients();
        expect(window.electronAPI.getAllClients).toHaveBeenCalledTimes(1);
        expect(clients).toEqual(mockClients);
      });

      it('should return mock clients if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const clients = await universalDataService.getClients();
        expect(window.electronAPI.getAllClients).not.toHaveBeenCalled();
        expect(clients).toEqual(expect.any(Array)); // Checks if it returns the mock array structure
        expect(clients.length).toBeGreaterThanOrEqual(0); // Check if mock data has items or is empty
      });
    });

    // getClient
    describe('getClient', () => {
      it('should call window.electronAPI.getClient if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockClient = { id: sampleClientId, name: 'Electron Client' };
        window.electronAPI.getClient.mockResolvedValue(mockClient);

        const client = await universalDataService.getClient(sampleClientId);
        expect(window.electronAPI.getClient).toHaveBeenCalledWith(sampleClientId);
        expect(client).toEqual(mockClient);
      });

      it('should return a mock client if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        // Ensure mockDb has a client with id 'mockClient1' for this test path
        const client = await universalDataService.getClient('mockClient1');
        expect(window.electronAPI.getClient).not.toHaveBeenCalled();
        expect(client).toHaveProperty('id', 'mockClient1');
      });

      it('should return null for non-existent mock client if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const client = await universalDataService.getClient('nonExistentMock');
        expect(client).toBeNull();
      });
    });

    // createClient
    describe('createClient', () => {
      it('should call window.electronAPI.createClient if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockResponse = { success: true, data: { id: sampleClientId, ...sampleClientData } };
        window.electronAPI.createClient.mockResolvedValue(mockResponse);

        const client = await universalDataService.createClient(sampleClientData);
        expect(window.electronAPI.createClient).toHaveBeenCalledWith(sampleClientData);
        expect(client).toEqual(mockResponse.data);
      });

      it('should throw error if electronAPI.createClient fails', async () => {
        isElectronAvailable.mockReturnValue(true);
        window.electronAPI.createClient.mockResolvedValue({ success: false, error: 'IPC error' });
        await expect(universalDataService.createClient(sampleClientData)).rejects.toThrow('IPC error');
      });

      it('should create a mock client if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const client = await universalDataService.createClient(sampleClientData);
        expect(window.electronAPI.createClient).not.toHaveBeenCalled();
        expect(client).toHaveProperty('id');
        expect(client.name).toBe(sampleClientData.name);
      });
    });

    // updateClient
    describe('updateClient', () => {
      it('should call window.electronAPI.updateClient if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockResponse = { success: true, id: sampleClientId }; // Backend returns id
        window.electronAPI.updateClient.mockResolvedValue(mockResponse);

        const updatedClient = await universalDataService.updateClient(sampleClientId, sampleClientData);
        expect(window.electronAPI.updateClient).toHaveBeenCalledWith(sampleClientId, sampleClientData);
        expect(updatedClient).toEqual({ id: sampleClientId, ...sampleClientData }); // Service combines response
      });

      it('should update a mock client if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const existingMockClientId = 'mockClient1'; // from mockDb
        const updates = { name: 'Updated Mock Client' };
        const client = await universalDataService.updateClient(existingMockClientId, updates);
        expect(window.electronAPI.updateClient).not.toHaveBeenCalled();
        expect(client.name).toBe(updates.name);
      });
    });

    // deleteClient
    describe('deleteClient', () => {
      it('should call window.electronAPI.deleteClient if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockResponse = { success: true, id: sampleClientId };
        window.electronAPI.deleteClient.mockResolvedValue(mockResponse);

        const result = await universalDataService.deleteClient(sampleClientId);
        expect(window.electronAPI.deleteClient).toHaveBeenCalledWith(sampleClientId);
        expect(result).toEqual(mockResponse);
      });

      it('should delete a mock client if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const existingMockClientId = 'mockClient1';
        const result = await universalDataService.deleteClient(existingMockClientId);
        expect(window.electronAPI.deleteClient).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        // Optionally, verify it's removed from mockDb by trying to get it
        const clientAfterDelete = await universalDataService.getClient(existingMockClientId);
        expect(clientAfterDelete).toBeNull();
      });
    });
  });

  // --- Caregiver Methods (similar structure to Client Methods) ---
  describe('Caregiver Operations', () => {
    const sampleCaregiverData = { name: 'Test Caregiver', email: 'test@cg.com' };
    const sampleCaregiverId = 'cg123';

    // getCaregivers
    describe('getCaregivers', () => {
      it('should call window.electronAPI.getAllCaregivers if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockCaregivers = [{ id: 'eCG1', name: 'Electron Caregiver' }];
        window.electronAPI.getAllCaregivers.mockResolvedValue(mockCaregivers);

        const caregivers = await universalDataService.getCaregivers();
        expect(window.electronAPI.getAllCaregivers).toHaveBeenCalledTimes(1);
        expect(caregivers).toEqual(mockCaregivers);
      });

      it('should return mock caregivers if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const caregivers = await universalDataService.getCaregivers();
        expect(window.electronAPI.getAllCaregivers).not.toHaveBeenCalled();
        expect(caregivers).toEqual(expect.any(Array));
        expect(caregivers.length).toBeGreaterThanOrEqual(0);
      });
    });

    // getCaregiver
    describe('getCaregiver', () => {
      it('should call window.electronAPI.getCaregiver if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockCaregiver = { id: sampleCaregiverId, name: 'Electron Caregiver' };
        window.electronAPI.getCaregiver.mockResolvedValue(mockCaregiver);

        const caregiver = await universalDataService.getCaregiver(sampleCaregiverId);
        expect(window.electronAPI.getCaregiver).toHaveBeenCalledWith(sampleCaregiverId);
        expect(caregiver).toEqual(mockCaregiver);
      });

      it('should return a mock caregiver if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const caregiver = await universalDataService.getCaregiver('mockCaregiver1');
        expect(window.electronAPI.getCaregiver).not.toHaveBeenCalled();
        expect(caregiver).toHaveProperty('id', 'mockCaregiver1');
      });
    });

    // createCaregiver
    describe('createCaregiver', () => {
      it('should call window.electronAPI.createCaregiver if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockResponse = { success: true, data: { id: sampleCaregiverId, ...sampleCaregiverData } };
        window.electronAPI.createCaregiver.mockResolvedValue(mockResponse);

        const caregiver = await universalDataService.createCaregiver(sampleCaregiverData);
        expect(window.electronAPI.createCaregiver).toHaveBeenCalledWith(sampleCaregiverData);
        expect(caregiver).toEqual(mockResponse.data);
      });

      it('should create a mock caregiver if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const caregiver = await universalDataService.createCaregiver(sampleCaregiverData);
        expect(window.electronAPI.createCaregiver).not.toHaveBeenCalled();
        expect(caregiver).toHaveProperty('id');
        expect(caregiver.name).toBe(sampleCaregiverData.name);
      });
    });

    // updateCaregiver
    describe('updateCaregiver', () => {
      it('should call window.electronAPI.updateCaregiver if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockResponse = { success: true, id: sampleCaregiverId };
        window.electronAPI.updateCaregiver.mockResolvedValue(mockResponse);

        const updatedCaregiver = await universalDataService.updateCaregiver(sampleCaregiverId, sampleCaregiverData);
        expect(window.electronAPI.updateCaregiver).toHaveBeenCalledWith(sampleCaregiverId, sampleCaregiverData);
        expect(updatedCaregiver).toEqual({ id: sampleCaregiverId, ...sampleCaregiverData });
      });

      it('should update a mock caregiver if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const existingMockCaregiverId = 'mockCaregiver1';
        const updates = { name: 'Updated Mock CG' };
        const caregiver = await universalDataService.updateCaregiver(existingMockCaregiverId, updates);
        expect(window.electronAPI.updateCaregiver).not.toHaveBeenCalled();
        expect(caregiver.name).toBe(updates.name);
      });
    });

    // deleteCaregiver
    describe('deleteCaregiver', () => {
      it('should call window.electronAPI.deleteCaregiver if in Electron', async () => {
        isElectronAvailable.mockReturnValue(true);
        const mockResponse = { success: true, id: sampleCaregiverId };
        window.electronAPI.deleteCaregiver.mockResolvedValue(mockResponse);

        const result = await universalDataService.deleteCaregiver(sampleCaregiverId);
        expect(window.electronAPI.deleteCaregiver).toHaveBeenCalledWith(sampleCaregiverId);
        expect(result).toEqual(mockResponse);
      });

      it('should delete a mock caregiver if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const existingMockCaregiverId = 'mockCaregiver1'; // Ensure this exists in mockDb for the test
        const result = await universalDataService.deleteCaregiver(existingMockCaregiverId);
        expect(window.electronAPI.deleteCaregiver).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        const caregiverAfterDelete = await universalDataService.getCaregiver(existingMockCaregiverId);
        expect(caregiverAfterDelete).toBeNull();
      });
    });
  });
});

import universalDataService from '../universalDataService';
import { isElectronAvailable } from '../firebaseService'; // To be mocked
import firebase from '../firebase'; // To be mocked for auth

// Mock firebaseService to control isElectronAvailable
jest.mock('../firebaseService', () => ({
  isElectronAvailable: jest.fn(),
}));

// Mock firebase for auth
const mockGetIdToken = jest.fn().mockResolvedValue('test-id-token');
let mockCurrentUser = null; // To be set in tests

jest.mock('../firebase', () => ({
  auth: () => ({
    currentUser: mockCurrentUser, // This will be dynamically set in test cases
  }),
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
    // Reset mockCurrentUser before each test
    mockCurrentUser = null;
    // Reset getIdToken mock if it's part of mockCurrentUser that gets reassigned
    // If mockGetIdToken is global, clear it here:
    mockGetIdToken.mockClear().mockResolvedValue('test-id-token');
  });

  // --- Client Methods ---
  describe('Client Operations', () => {
    const sampleClientData = { name: 'Test Client', email: 'test@client.com' };
    const sampleClientId = 'client123';
    const mockToken = 'test-id-token';

    // getClients
    describe('getClients', () => {
      it('should call window.electronAPI.getAllClients with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockClients = [{ id: 'eClient1', name: 'Electron Client' }];
        window.electronAPI.getAllClients.mockResolvedValue(mockClients);

        const clients = await universalDataService.getClients();
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.getAllClients).toHaveBeenCalledWith({ idToken: mockToken });
        expect(clients).toEqual(mockClients);
      });

      it('should throw error if in Electron and not authenticated for getClients', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.getClients()).rejects.toThrow('Authentication required');
        expect(window.electronAPI.getAllClients).not.toHaveBeenCalled();
      });

      it('should return mock clients if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const clients = await universalDataService.getClients();
        expect(window.electronAPI.getAllClients).not.toHaveBeenCalled();
        expect(clients).toEqual(expect.any(Array));
        expect(clients.length).toBeGreaterThanOrEqual(0);
      });
    });

    // getClient
    describe('getClient', () => {
      it('should call window.electronAPI.getClient with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockClient = { id: sampleClientId, name: 'Electron Client' };
        window.electronAPI.getClient.mockResolvedValue(mockClient);

        const client = await universalDataService.getClient(sampleClientId);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.getClient).toHaveBeenCalledWith({ idToken: mockToken, clientId: sampleClientId });
        expect(client).toEqual(mockClient);
      });

      it('should throw error if in Electron and not authenticated for getClient', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.getClient(sampleClientId)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.getClient).not.toHaveBeenCalled();
      });

      it('should return a mock client if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
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
      it('should call window.electronAPI.createClient with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, data: { id: sampleClientId, ...sampleClientData } };
        window.electronAPI.createClient.mockResolvedValue(mockResponse);

        const client = await universalDataService.createClient(sampleClientData);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.createClient).toHaveBeenCalledWith({ idToken: mockToken, clientData: sampleClientData });
        expect(client).toEqual(mockResponse.data);
      });

      it('should throw error if in Electron and not authenticated for createClient', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.createClient(sampleClientData)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.createClient).not.toHaveBeenCalled();
      });

      it('should throw error if electronAPI.createClient fails even if authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
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
      it('should call window.electronAPI.updateClient with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, id: sampleClientId };
        window.electronAPI.updateClient.mockResolvedValue(mockResponse);

        const updatedClient = await universalDataService.updateClient(sampleClientId, sampleClientData);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.updateClient).toHaveBeenCalledWith({ idToken: mockToken, clientId: sampleClientId, clientData: sampleClientData });
        expect(updatedClient).toEqual({ id: sampleClientId, ...sampleClientData });
      });

      it('should throw error if in Electron and not authenticated for updateClient', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.updateClient(sampleClientId, sampleClientData)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.updateClient).not.toHaveBeenCalled();
      });

      it('should update a mock client if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const existingMockClientId = 'mockClient1';
        const updates = { name: 'Updated Mock Client' };
        const client = await universalDataService.updateClient(existingMockClientId, updates);
        expect(window.electronAPI.updateClient).not.toHaveBeenCalled();
        expect(client.name).toBe(updates.name);
      });
    });

    // deleteClient
    describe('deleteClient', () => {
      it('should call window.electronAPI.deleteClient with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, id: sampleClientId };
        window.electronAPI.deleteClient.mockResolvedValue(mockResponse);

        const result = await universalDataService.deleteClient(sampleClientId);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.deleteClient).toHaveBeenCalledWith({ idToken: mockToken, clientId: sampleClientId });
        expect(result).toEqual(mockResponse);
      });

      it('should throw error if in Electron and not authenticated for deleteClient', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.deleteClient(sampleClientId)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.deleteClient).not.toHaveBeenCalled();
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
    const mockToken = 'test-id-token'; // Re-declare for clarity in this scope

    // getCaregivers
    describe('getCaregivers', () => {
      it('should call window.electronAPI.getAllCaregivers with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockCaregivers = [{ id: 'eCG1', name: 'Electron Caregiver' }];
        window.electronAPI.getAllCaregivers.mockResolvedValue(mockCaregivers);

        const caregivers = await universalDataService.getCaregivers();
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.getAllCaregivers).toHaveBeenCalledWith({ idToken: mockToken });
        expect(caregivers).toEqual(mockCaregivers);
      });

      it('should throw error if in Electron and not authenticated for getCaregivers', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.getCaregivers()).rejects.toThrow('Authentication required');
        expect(window.electronAPI.getAllCaregivers).not.toHaveBeenCalled();
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
      it('should call window.electronAPI.getCaregiver with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockCaregiver = { id: sampleCaregiverId, name: 'Electron Caregiver' };
        window.electronAPI.getCaregiver.mockResolvedValue(mockCaregiver);

        const caregiver = await universalDataService.getCaregiver(sampleCaregiverId);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.getCaregiver).toHaveBeenCalledWith({ idToken: mockToken, caregiverId: sampleCaregiverId });
        expect(caregiver).toEqual(mockCaregiver);
      });

      it('should throw error if in Electron and not authenticated for getCaregiver', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.getCaregiver(sampleCaregiverId)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.getCaregiver).not.toHaveBeenCalled();
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
      it('should call window.electronAPI.createCaregiver with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, data: { id: sampleCaregiverId, ...sampleCaregiverData } };
        window.electronAPI.createCaregiver.mockResolvedValue(mockResponse);

        const caregiver = await universalDataService.createCaregiver(sampleCaregiverData);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.createCaregiver).toHaveBeenCalledWith({ idToken: mockToken, caregiverData: sampleCaregiverData });
        expect(caregiver).toEqual(mockResponse.data);
      });

      it('should throw error if in Electron and not authenticated for createCaregiver', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.createCaregiver(sampleCaregiverData)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.createCaregiver).not.toHaveBeenCalled();
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
      it('should call window.electronAPI.updateCaregiver with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, id: sampleCaregiverId };
        window.electronAPI.updateCaregiver.mockResolvedValue(mockResponse);

        const updatedCaregiver = await universalDataService.updateCaregiver(sampleCaregiverId, sampleCaregiverData);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.updateCaregiver).toHaveBeenCalledWith({ idToken: mockToken, caregiverId: sampleCaregiverId, caregiverData: sampleCaregiverData });
        expect(updatedCaregiver).toEqual({ id: sampleCaregiverId, ...sampleCaregiverData });
      });

      it('should throw error if in Electron and not authenticated for updateCaregiver', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.updateCaregiver(sampleCaregiverId, sampleCaregiverData)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.updateCaregiver).not.toHaveBeenCalled();
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
      it('should call window.electronAPI.deleteCaregiver with idToken if in Electron and authenticated', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, id: sampleCaregiverId };
        window.electronAPI.deleteCaregiver.mockResolvedValue(mockResponse);

        const result = await universalDataService.deleteCaregiver(sampleCaregiverId);
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(window.electronAPI.deleteCaregiver).toHaveBeenCalledWith({ idToken: mockToken, caregiverId: sampleCaregiverId });
        expect(result).toEqual(mockResponse);
      });

      it('should throw error if in Electron and not authenticated for deleteCaregiver', async () => {
        isElectronAvailable.mockReturnValue(true);
        mockCurrentUser = null;
        await expect(universalDataService.deleteCaregiver(sampleCaregiverId)).rejects.toThrow('Authentication required');
        expect(window.electronAPI.deleteCaregiver).not.toHaveBeenCalled();
      });

      it('should delete a mock caregiver if not in Electron', async () => {
        isElectronAvailable.mockReturnValue(false);
        const existingMockCaregiverId = 'mockCaregiver1';
        const result = await universalDataService.deleteCaregiver(existingMockCaregiverId);
        expect(window.electronAPI.deleteCaregiver).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        const caregiverAfterDelete = await universalDataService.getCaregiver(existingMockCaregiverId);
        expect(caregiverAfterDelete).toBeNull();
      });
    });
  });
});

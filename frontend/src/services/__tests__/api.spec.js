import apiClient from '../api'; // The module we're testing
import { firebase } from '../firebase'; // To mock firebase.auth()

// Mock Firebase Auth
jest.mock('../firebase', () => ({
  firebase: {
    auth: jest.fn(() => ({
      currentUser: null, // Default to no user
    })),
  },
}));

// Mock global fetch
global.fetch = jest.fn();

describe('API Client (api.js)', () => {
  const mockApiBaseUrl = 'http://mockapi.com'; // Consistent with what might be in .env for testing
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Clear module cache to reset apiClient and its API_BASE_URL for each test
    process.env = {
      ...originalEnv,
      REACT_APP_API_BASE_URL: mockApiBaseUrl,
    };
    fetch.mockClear(); // Clear fetch mock calls

    // Default mock for currentUser and getIdToken
    firebase.auth.mockReturnValue({
      currentUser: {
        getIdToken: jest.fn().mockResolvedValue('test-id-token'),
      },
    });
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original env
  });

  const mockApiResponse = (data, ok = true, status = 200, statusText = 'OK') => {
    fetch.mockResolvedValueOnce({
      ok,
      status,
      statusText,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => data,
      text: async () => JSON.stringify(data), // Or just text for non-JSON
    });
  };

  const mockApiTextResponse = (text, ok = true, status = 200, statusText = 'OK') => {
     fetch.mockResolvedValueOnce({
      ok,
      status,
      statusText,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      json: async () => { throw new Error("Not JSON"); }, // Should not be called for text
      text: async () => text,
    });
  };

   const mockApiNoContentResponse = (ok = true, status = 204, statusText = 'No Content') => {
     fetch.mockResolvedValueOnce({
      ok,
      status,
      statusText,
      headers: new Headers(), // No content-type usually for 204
      json: async () => { throw new Error("No JSON content"); },
      text: async () => "",
    });
  };


  describe('Generic request function', () => {
    it('should include Authorization header if user is signed in', async () => {
      mockApiResponse({ success: true });
      await apiClient.request('/test-auth');
      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/test-auth`,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-id-token' }),
        })
      );
    });

    it('should not include Authorization header if no user is signed in', async () => {
      firebase.auth.mockReturnValue({ currentUser: null }); // No user
      mockApiResponse({ success: true });
      await apiClient.request('/test-no-auth');
      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/test-no-auth`,
        expect.objectContaining({
          headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
        })
      );
    });

    it('should handle getIdToken failure gracefully and proceed without auth header', async () => {
      firebase.auth.mockReturnValue({
        currentUser: {
          getIdToken: jest.fn().mockRejectedValue(new Error('Token fetch failed')),
        },
      });
      mockApiResponse({ success: true });
      // We expect a console.error for "Error getting ID token:", but the request should still proceed.
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await apiClient.request('/test-token-fail');
      expect(fetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error getting ID token:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should stringify JSON body and set Content-Type', async () => {
      mockApiResponse({ success: true });
      const body = { data: 'test' };
      await apiClient.request('/test-body', { method: 'POST', body });
      expect(fetch).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/test-body`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        })
      );
    });

    it('should throw an error for non-ok responses with JSON error message', async () => {
      const errorPayload = { message: 'Something went wrong', code: 'ERROR_CODE' };
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => errorPayload,
        text: async () => JSON.stringify(errorPayload),
      });
      await expect(apiClient.request('/test-fail')).rejects.toThrow('Something went wrong');
    });

     it('should throw an error for non-ok responses with text error message', async () => {
      const errorText = 'Server Error Text';
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        json: async () => { throw new Error("not json")}, // Simulate non-JSON parseable body
        text: async () => errorText,
      });
      await expect(apiClient.request('/test-fail-text')).rejects.toThrow(errorText);
    });

    it('should return null for 204 No Content responses', async () => {
        mockApiNoContentResponse();
        const result = await apiClient.request('/test-delete-no-content', {method: 'DELETE'});
        expect(result).toBeNull();
    });
  });

  // --- Client Methods ---
  describe('Client API methods', () => {
    it('getClients should call GET /getClients', async () => {
      mockApiResponse([]);
      await apiClient.getClients();
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/getClients`, expect.anything());
    });
    it('getClientById should call GET /getClientById?id=:id', async () => {
      mockApiResponse({});
      await apiClient.getClientById('client1');
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/getClientById?id=client1`, expect.anything());
    });
    it('createClient should call POST /createClient', async () => {
      const clientData = { name: 'New Client' };
      mockApiResponse({ id: 'c1', ...clientData });
      await apiClient.createClient(clientData);
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/createClient`, expect.objectContaining({ method: 'POST', body: JSON.stringify(clientData) }));
    });
    it('updateClient should call PUT /updateClient?id=:id', async () => {
      const clientData = { name: 'Updated Client' };
      mockApiResponse({ id: 'c1', ...clientData });
      await apiClient.updateClient('c1', clientData);
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/updateClient?id=c1`, expect.objectContaining({ method: 'PUT', body: JSON.stringify(clientData) }));
    });
    it('deleteClient should call DELETE /deleteClient?id=:id', async () => {
      mockApiNoContentResponse(); // Or mockApiResponse({success: true}) if it returns a body
      await apiClient.deleteClient('c1');
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/deleteClient?id=c1`, expect.objectContaining({ method: 'DELETE' }));
    });
  });

  // --- Caregiver Methods ---
  describe('Caregiver API methods', () => {
    it('getCaregivers should call GET /getCaregivers', async () => {
      mockApiResponse([]);
      await apiClient.getCaregivers();
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/getCaregivers`, expect.anything());
    });
    it('getCaregiverById should call GET /getCaregiverById?id=:id', async () => {
      mockApiResponse({});
      await apiClient.getCaregiverById('cg1');
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/getCaregiverById?id=cg1`, expect.anything());
    });
    it('createCaregiver should call POST /createCaregiver', async () => {
      const caregiverData = { name: 'New CG' };
      mockApiResponse({ id: 'cg1', ...caregiverData });
      await apiClient.createCaregiver(caregiverData);
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/createCaregiver`, expect.objectContaining({ method: 'POST', body: JSON.stringify(caregiverData) }));
    });
    // ... similar tests for updateCaregiver, deleteCaregiver
  });

  // --- Schedule Methods ---
  describe('Schedule API methods', () => {
    it('getSchedules should call GET /getSchedules with query params', async () => {
      mockApiResponse([]);
      const filters = { clientId: 'c1', date: '2024-01-01' };
      await apiClient.getSchedules(filters);
      const expectedQuery = new URLSearchParams(filters).toString();
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/getSchedules?${expectedQuery}`, expect.anything());
    });
     it('getSchedules should call GET /getSchedules without query params if filters empty', async () => {
      mockApiResponse([]);
      await apiClient.getSchedules({});
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/getSchedules`, expect.anything());
    });
    it('getScheduleById should call GET /getScheduleById?id=:id', async () => {
      mockApiResponse({});
      await apiClient.getScheduleById('s1');
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/getScheduleById?id=s1`, expect.anything());
    });
    it('createSchedule should call POST /createSchedule', async () => {
      const scheduleData = { clientId: 'c1', date: '2024-10-10' };
      mockApiResponse({ id: 's1', ...scheduleData });
      await apiClient.createSchedule(scheduleData);
      expect(fetch).toHaveBeenCalledWith(`${mockApiBaseUrl}/createSchedule`, expect.objectContaining({ method: 'POST', body: JSON.stringify(scheduleData) }));
    });
    // ... similar tests for updateSchedule, deleteSchedule
  });
});

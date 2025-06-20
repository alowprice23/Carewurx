import { firebase } from './firebase'; // Assuming this exports the initialized firebase app

// Define API_BASE_URL using an environment variable, with a fallback for local development/emulator
// IMPORTANT: Replace 'carewurx-test' and 'us-central1' with your actual Firebase project ID and region if they differ.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `https://${process.env.REACT_APP_FIREBASE_REGION || 'us-central1'}-${process.env.REACT_APP_FIREBASE_PROJECT_ID || 'carewurx-test'}.cloudfunctions.net`;

/**
 * Generic request function to interact with the backend API.
 * @param {string} endpoint - The API endpoint (e.g., "/getClients").
 * @param {object} options - Options for the fetch call (method, headers, body).
 * @returns {Promise<any>} The JSON response from the API or processed response.
 * @throws {Error} If the API call fails or returns a non-ok response.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = { ...options.headers };

  const currentUser = firebase.auth().currentUser;
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch (error) {
      console.error("Error getting ID token:", error);
      // Allow request to proceed; backend will handle auth failure.
    }
  }

  const config = { ...options, headers };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
  }

  console.log(`[API Client] Requesting: ${config.method || 'GET'} ${url}`);
  // Avoid logging potentially large or sensitive FormData bodies
  if (config.body && !(options.body instanceof FormData)) {
      console.log(`[API Client] Body:`, config.body);
  }


  const response = await fetch(url, config);

  if (!response.ok) {
    let errorData;
    const responseText = await response.text(); // Get text first, might not be JSON
    try {
      errorData = JSON.parse(responseText);
    } catch (e) {
      errorData = { message: responseText || response.statusText || 'API request failed (no error message body)' };
    }
    console.error(`[API Client] Error: ${response.status} ${response.statusText}`, errorData);
    const error = new Error(errorData.message || response.statusText || 'API request failed');
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  // Handle cases where there might be no JSON body (e.g., 204 No Content)
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    const text = await response.text(); // Re-getting text if not JSON, already got it above though
    return text ? { message: text } : null;
  }
}

const apiClient = {
  // Generic request function
  request,

  // Client-related API calls
  getClients: () => request('/getClients'),
  getClientById: (clientId) => request(`/getClientById?id=${clientId}`),
  createClient: (clientData) => request('/createClient', { method: 'POST', body: clientData }),
  updateClient: (clientId, clientData) => request(`/updateClient?id=${clientId}`, { method: 'PUT', body: clientData }),
  deleteClient: (clientId) => request(`/deleteClient?id=${clientId}`, { method: 'DELETE' }),

  // Caregiver-related API calls
  getCaregivers: () => request('/getCaregivers'),
  getCaregiverById: (caregiverId) => request(`/getCaregiverById?id=${caregiverId}`),
  createCaregiver: (caregiverData) => request('/createCaregiver', { method: 'POST', body: caregiverData }),
  updateCaregiver: (caregiverId, caregiverData) => request(`/updateCaregiver?id=${caregiverId}`, { method: 'PUT', body: caregiverData }),
  deleteCaregiver: (caregiverId) => request(`/deleteCaregiver?id=${caregiverId}`, { method: 'DELETE' }),

  // Schedule-related API calls
  getSchedules: (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    return request(queryParams ? `/getSchedules?${queryParams}` : '/getSchedules');
  },
  getScheduleById: (scheduleId) => request(`/getScheduleById?id=${scheduleId}`),
  createSchedule: (scheduleData) => request('/createSchedule', { method: 'POST', body: scheduleData }),
  updateSchedule: (scheduleId, scheduleData) => request(`/updateSchedule?id=${scheduleId}`, { method: 'PUT', body: scheduleData }),
  deleteSchedule: (scheduleId) => request(`/deleteSchedule?id=${scheduleId}`, { method: 'DELETE' }),

  // Batch Upload related (if any direct frontend calls are needed besides what universalDataService handles via Electron)
  // Example: if frontend needs to initiate or check status via HTTP when not in Electron
  // For now, these are primarily handled via Electron IPC as per previous tasks.
  // uploadBatchFile: (formData) => request('/uploadBatchFile', { method: 'POST', body: formData }), // Assuming an HTTP endpoint for this too
  // getBatchUploadProgress: (batchId) => request(`/getBatchUploadProgress?id=${batchId}`),
  // cancelBatchUpload: (batchId) => request(`/cancelBatchUpload?id=${batchId}`, { method: 'POST' }),
};

export default apiClient;

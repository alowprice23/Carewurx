/**
 * Firebase Service
 * Provides authentication functionality with fallback for browser environments
 */

// We will replace direct Electron checks with API calls.
// Mocks will serve as fallbacks.

// Set up mock users for browser-only mode / fallback
const MOCK_USERS = {
  'admin@carewurx.com': {
    uid: 'admin-123',
    email: 'admin@carewurx.com',
    displayName: 'Admin User',
    role: 'admin'
  },
  'guest@example.com': {
    uid: 'guest-456',
    email: 'guest@example.com',
    displayName: 'Guest User',
    role: 'guest',
    isGuest: true
  }
};

let currentUser = null;
let authStateListeners = [];

// Log environment
console.log('Firebase Service initializing for web API communication.');

// Helper function to simulate network delay for mocks
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function _fetchAPI(endpoint, options = {}) {
  const { body, method = 'GET', params } = options;
  let url = `/api${endpoint}`;

  if (params) {
    url += `?${new URLSearchParams(params)}`;
  }

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Add any other headers like Authorization if needed
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API Error (${response.status}): ${errorData.message || 'Unknown error'}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

/**
 * Sign in a user
 * Uses API calls with a fallback to mock authentication.
 */
const signIn = async (email, password) => {
  try {
    console.log("Firebase Service: Attempting sign in via API with:", email);
    const result = await _fetchAPI('/auth/signIn', {
      method: 'POST',
      body: { email, password },
    });
    console.log("Firebase Service: API Sign in result:", result);
    currentUser = result.user;
    authStateListeners.forEach(listener => listener && listener(currentUser));
    return result;
  } catch (apiError) {
    console.warn("Firebase Service: API sign in error, falling back to mock auth.", apiError);
    // Fallback to mock authentication
    if (!email || !password) {
      throw new Error("Email and password are required (mock auth)");
    }
    const mockUser = MOCK_USERS[email];
    if (mockUser || (process.env.NODE_ENV === 'development')) {
      currentUser = mockUser || {
        uid: `dev-${Date.now()}`,
        email: email,
        displayName: email.split('@')[0],
        role: 'user'
      };
      authStateListeners.forEach(listener => listener && listener(currentUser));
      return { user: currentUser };
    } else {
      throw new Error("Invalid email or password (mock auth)");
    }
  }
};

/**
 * Sign out the current user
 * Uses API calls with a fallback for local state clearing.
 */
const signOut = async () => {
  try {
    await _fetchAPI('/auth/signOut', { method: 'POST' });
  } catch (apiError) {
    console.warn("Firebase Service: API sign out error. Clearing local state regardless.", apiError);
    // Continue to clear local state even if API fails
  }
  currentUser = null;
  authStateListeners.forEach(listener => listener && listener(null));
  return { success: true };
};

/**
 * Get the current user
 * Uses API calls with a fallback to local cache or null.
 */
const getCurrentUser = async () => {
  // Return cached user first if available and valid (e.g., not explicitly signed out)
  if (currentUser) {
    return currentUser;
  }
  try {
    const user = await _fetchAPI('/auth/currentUser');
    currentUser = user;
    return user;
  } catch (apiError) {
    console.warn("Firebase Service: API get current user error. No active session or API unavailable.", apiError);
    // If API fails (e.g. no session server-side, or server down), rely on local currentUser (which would be null if not set)
    // or return null explicitly if there's no cached user.
    return null; // Explicitly return null if API fails and no local cache.
  }
};

const onAuthStateChanged = (callback) => {
  if (typeof callback !== 'function') {
    console.error("onAuthStateChanged expects a function callback.");
    return () => {}; // Return a no-op unsubscribe function
  }
  authStateListeners.push(callback);
  // Immediately invoke with current user status
  // This ensures the listener gets the current state upon subscription
  getCurrentUser().then(user => {
    // Check if callback is still in listeners, in case it was unsubscribed immediately
    if (authStateListeners.includes(callback)) {
      try {
        callback(user);
      } catch (e) {
        console.error("Error in onAuthStateChanged callback execution:", e);
      }
    }
  }).catch(e => {
    // Catch errors from getCurrentUser, potentially call callback with null
    console.error("Error in getCurrentUser for onAuthStateChanged initial call:", e);
    if (authStateListeners.includes(callback)) {
      try {
        callback(null);
      } catch (cbError) {
        console.error("Error in onAuthStateChanged callback execution (error path):", cbError);
      }
    }
  });

  return () => {
    authStateListeners = authStateListeners.filter(listener => listener !== callback);
  };
};

// Data access methods (to be added based on preload.js)
const getSchedulesInDateRange = (startDate, endDate) => _fetchAPI('/firebase/schedulesInDateRange', { params: { startDate, endDate } });
const getOpportunities = (options) => _fetchAPI('/firebase/opportunities', { params: options });
const getClient = (clientId) => _fetchAPI(`/firebase/client/${clientId}`);
const getCaregiver = (caregiverId) => _fetchAPI(`/firebase/caregiver/${caregiverId}`);
const getAllClients = () => _fetchAPI('/firebase/clients');
const getAllCaregivers = () => _fetchAPI('/firebase/caregivers');

const getSchedulesByClientId = (clientId, startDate, endDate) =>
  _fetchAPI(`/firebase/schedulesByClientId/${clientId}`, { params: { startDate, endDate } });
const getSchedulesByCaregiverId = (caregiverId, startDate, endDate) =>
  _fetchAPI(`/firebase/schedulesByCaregiverId/${caregiverId}`, { params: { startDate, endDate } });

const updateClient = (clientId, data) => _fetchAPI(`/firebase/client/${clientId}`, { method: 'PUT', body: data });
const updateCaregiver = (caregiverId, data) => _fetchAPI(`/firebase/caregiver/${caregiverId}`, { method: 'PUT', body: data });

const getCaregiverAvailability = (caregiverId) => _fetchAPI(`/firebase/caregiverAvailability/${caregiverId}`);
const updateCaregiverAvailability = (caregiverId, availabilityData) =>
  _fetchAPI(`/firebase/caregiverAvailability/${caregiverId}`, { method: 'PUT', body: availabilityData });

const getSchedule = (scheduleId) => _fetchAPI(`/firebase/schedule/${scheduleId}`);

// updateCircularEntity and getCircularEntities are more generic.
// The preload script exposes them under 'firebase:' namespace.
// The server.js has them as /api/firebase/circularEntity/:entityType/:entityId and /api/firebase/circularEntities/:entityType
const updateCircularEntity = (entityType, entityId, data) =>
  _fetchAPI(`/firebase/circularEntity/${entityType}/${entityId}`, { method: 'PUT', body: data });

const getCircularEntities = (entityType, filter) =>
  _fetchAPI(`/firebase/circularEntities/${entityType}`, { params: filter });


// Attempt to get the current user on initialization to set the initial auth state.
getCurrentUser().then(user => {
  if (user) {
    console.log("Firebase Service: Initial user state loaded.", user);
  } else {
    console.log("Firebase Service: No initial user session found.");
  }
}).catch(error => {
  console.error("Firebase Service: Failed to get current user during initialization:", error);
});

const forceGuestLogin = async () => {
  console.log("Firebase Service: Attempting force guest login.");
  // This will use the mock fallback if API fails or if MOCK_USERS['guest@example.com'] is hit.
  return signIn(MOCK_USERS['guest@example.com'].email, 'guest');
};

console.log("Firebase Service (Auth and Data) initialized for web API.");

const firebaseService = {
  // Auth
  signIn,
  signOut,
  onAuthStateChanged,
  getCurrentUser,
  forceGuestLogin, // Useful for mock/dev

  // Data Access (formerly from electronAPI.firebase)
  getSchedulesInDateRange,
  getOpportunities,
  getClient,
  getCaregiver,
  getAllClients,
  getAllCaregivers,
  getSchedulesByClientId,
  getSchedulesByCaregiverId,
  updateClient,
  updateCaregiver,
  getCaregiverAvailability,
  updateCaregiverAvailability,
  getSchedule,
  updateCircularEntity,
  getCircularEntities,
  // No longer needed: isElectronAvailable
};

export default firebaseService;

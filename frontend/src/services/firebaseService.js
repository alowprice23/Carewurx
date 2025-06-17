/**
 * Firebase Service
 * Provides authentication functionality with fallback for browser environments
 */

// Check if we're running in Electron or browser-only environment
const isElectronAvailable = typeof window !== 'undefined' && window.electronAPI;

// Set up mock users for browser-only mode
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
console.log(`Firebase Service initializing in ${isElectronAvailable ? 'Electron' : 'browser-only'} mode`);

/**
 * Sign in a user
 * Uses Electron IPC if available, otherwise falls back to browser-only mode
 */
const signIn = async (email, password) => {
  try {
    console.log("Firebase Service: Attempting sign in with:", email);
    
    if (isElectronAvailable) {
      // Electron mode: Use the IPC bridge
      try {
        const result = await window.electronAPI.signIn(email, password);
        console.log("Firebase Service: Sign in result:", result);
        
        // Update current user
        currentUser = result.user;
        
        // Notify listeners
        authStateListeners.forEach(listener => {
          if (listener) listener(currentUser);
        });
        
        return result;
      } catch (electronError) {
        console.error("Firebase Service: Electron sign in error:", electronError);
        throw electronError;
      }
    } else {
      // Browser-only mode: Use mock authentication
      console.log("Firebase Service: Using browser-only authentication");
      
      // Simple validation
      if (!email || !password) {
        throw new Error("Email and password are required");
      }
      
      // Check if user exists in mock data (for admin/guest)
      // or allow any credentials in development for easy testing
      const mockUser = MOCK_USERS[email];
      
      if (mockUser || (process.env.NODE_ENV === 'development')) {
        // Create result object similar to what Electron would return
        const user = mockUser || {
          uid: `dev-${Date.now()}`,
          email: email,
          displayName: email.split('@')[0],
          role: 'user'
        };
        
        // Update current user
        currentUser = user;
        
        // Notify listeners
        authStateListeners.forEach(listener => {
          if (listener) listener(currentUser);
        });
        
        return { user: currentUser };
      } else {
        throw new Error("Invalid email or password");
      }
    }
  } catch (error) {
    console.error("Firebase Service: Sign in error:", error);
    throw error;
  }
};

/**
 * Sign out the current user
 * Uses Electron IPC if available, otherwise falls back to browser-only mode
 */
const signOut = async () => {
  try {
    if (isElectronAvailable) {
      // Electron mode: Use the IPC bridge
      try {
        await window.electronAPI.signOut();
      } catch (electronError) {
        console.error("Firebase Service: Electron sign out error:", electronError);
        // Continue even if Electron fails, to ensure UI state is updated
      }
    }
    
    // Always clear the current user regardless of mode
    currentUser = null;
    
    // Notify listeners
    authStateListeners.forEach(listener => {
      if (listener) listener(null);
    });
    
    return { success: true };
  } catch (error) {
    console.error("Firebase Service: Sign out error:", error);
    throw error;
  }
};

/**
 * Get the current user
 * Uses Electron IPC if available, otherwise falls back to browser-only mode
 */
const getCurrentUser = async () => {
  try {
    // Return cached user if available
    if (currentUser) {
      return currentUser;
    }
    
    if (isElectronAvailable) {
      // Electron mode: Use the IPC bridge
      try {
        const user = await window.electronAPI.getCurrentUser();
        currentUser = user;
        return user;
      } catch (electronError) {
        console.error("Firebase Service: Electron get current user error:", electronError);
        // Fall through to return null
      }
    } else {
      // Browser-only mode: No persistent sessions yet
      console.log("Firebase Service: No user session in browser-only mode");
    }
    
    return null;
  } catch (error) {
    console.error("Firebase Service: Get current user error:", error);
    return null;
  }
};

const onAuthStateChanged = (callback) => {
  // Add callback to listeners
  if (callback) {
    authStateListeners.push(callback);
    
    // Immediately invoke with current user
    getCurrentUser().then(user => {
      callback(user);
    });
  }
  
  // Return function to unsubscribe
  return () => {
    const index = authStateListeners.indexOf(callback);
    if (index > -1) {
      authStateListeners.splice(index, 1);
    }
  };
};

// Initialize service
getCurrentUser().catch(error => {
  console.error("Failed to get current user during initialization:", error);
});

// Provide a special method for forcing a guest login (useful for browser-only mode)
const forceGuestLogin = async () => {
  try {
    return await signIn('guest@example.com', 'guest');
  } catch (error) {
    console.error("Firebase Service: Force guest login error:", error);
    throw error;
  }
};

// Log that the service is ready
console.log("Firebase Auth Service initialized");

const firebaseService = {
  signIn,
  signOut,
  onAuthStateChanged,
  getCurrentUser,
  forceGuestLogin,
  isElectronAvailable
};

export default firebaseService;

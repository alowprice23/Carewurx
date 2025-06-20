/**
 * Firebase Service
 * Provides authentication functionality using Firebase client-side SDK
 * and notifies backend in Electron environment.
 */
import firebase from './firebase'; // Corrected path: ./firebase within services directory

const isElectronAvailable = typeof window !== 'undefined' && window.electronAPI;

let currentUser = null; // Local cache of the user object from Firebase Auth
const authStateListeners = new Set(); // Use a Set for listeners for easier management

// Log environment
console.log(`Firebase Service initializing. Electron available: ${isElectronAvailable}`);

// Subscribe to Firebase Auth state changes
firebase.auth().onAuthStateChanged(async (user) => {
  console.log("Firebase Service: onAuthStateChanged triggered. User:", user ? user.uid : null);
  if (user) {
    // User is signed in.
    currentUser = { // Store a serializable version or relevant fields
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      // Add other fields like photoURL if needed
      // Note: custom claims from ID token are not directly on the user object here.
      // Roles/custom claims would typically be fetched/verified via ID token.
    };
    // It's good practice to refresh the token if needed, though not strictly required just on auth change.
    // const idToken = await user.getIdToken(true); // Force refresh if needed
  } else {
    // User is signed out.
    currentUser = null;
  }

  // Notify all registered listeners
  authStateListeners.forEach(listener => {
    try {
      listener(currentUser);
    } catch (e) {
      console.error("Firebase Service: Error in authStateListener", e);
    }
  });
});

/**
 * Sign in a user using Firebase client-side auth.
 * If in Electron, notifies the backend after successful client-side sign-in.
 */
const signIn = async (email, password) => {
  console.log("Firebase Service: Attempting sign in with:", email);
  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log("Firebase Service: Client-side sign in successful. User:", userCredential.user.uid);

    if (isElectronAvailable) {
      try {
        const idToken = await userCredential.user.getIdToken();
        console.log("Firebase Service: Got ID token. Notifying backend (userSignedIn).");
        await window.electronAPI.userSignedIn({ idToken });
        console.log("Firebase Service: Backend notified of sign-in.");
      } catch (electronError) {
        console.error("Firebase Service: Error notifying backend of sign-in:", electronError);
        // Decide if this should throw or if client-side sign-in is enough.
        // For now, log and continue as client is signed in.
      }
    }
    // currentUser will be updated by the onAuthStateChanged listener.
    // Return a representation of the user.
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName
    };
  } catch (error) {
    console.error("Firebase Service: Client-side sign in error:", error);
    throw error; // Rethrow the original Firebase auth error
  }
};

/**
 * Sign out the current user using Firebase client-side auth.
 * If in Electron, notifies the backend after successful client-side sign-out.
 */
const signOut = async () => {
  console.log("Firebase Service: Attempting sign out.");
  try {
    await firebase.auth().signOut();
    console.log("Firebase Service: Client-side sign out successful.");

    if (isElectronAvailable) {
      try {
        console.log("Firebase Service: Notifying backend (userSignedOut).");
        await window.electronAPI.userSignedOut({}); // No token needed for sign-out notification
        console.log("Firebase Service: Backend notified of sign-out.");
      } catch (electronError) {
        console.error("Firebase Service: Error notifying backend of sign-out:", electronError);
        // Log and continue as client is signed out.
      }
    }
    // currentUser will be updated by the onAuthStateChanged listener.
    return { success: true };
  } catch (error) {
    console.error("Firebase Service: Client-side sign out error:", error);
    throw error;
  }
};

/**
 * Get the current user synchronously from the local cache.
 * This cache is updated by the `onAuthStateChanged` listener.
 */
const getCurrentUser = () => {
  // console.log("Firebase Service: getCurrentUser called. Returning:", currentUser);
  return currentUser;
};

/**
 * Register a listener for authentication state changes.
 * @param {function} callback - Function to call when auth state changes.
 * @returns {function} Unsubscribe function.
 */
const onAuthStateChangedSubscribe = (callback) => {
  if (typeof callback !== 'function') {
    console.error("Firebase Service: Invalid callback provided to onAuthStateChangedSubscribe.");
    return () => {}; // Return a no-op unsubscribe function
  }
  
  authStateListeners.add(callback);
  console.log("Firebase Service: Listener added. Total listeners:", authStateListeners.size);

  // Immediately invoke with current user state
  // Use a timeout to ensure the callback is called after the current execution stack clears,
  // similar to how onAuthStateChanged behaves (async).
  setTimeout(() => {
    try {
      callback(currentUser);
    } catch (e) {
      console.error("Firebase Service: Error in initial authStateListener call", e);
    }
  }, 0);

  // Return function to unsubscribe
  return () => {
    authStateListeners.delete(callback);
    console.log("Firebase Service: Listener removed. Total listeners:", authStateListeners.size);
  };
};


// Mock user for browser-only development if Electron API is not available AND not using real Firebase.
// This part might need adjustment depending on how `../firebase.js` handles non-Electron environments.
// For now, the above logic assumes `firebase.auth()` works. If `../firebase.js` provides mocks for browser, that's fine.
// The old MOCK_USERS logic is removed as we rely on actual Firebase SDK or its mocks via `../firebase.js`.

// Provide a special method for forcing a guest login (useful for browser-only mode if needed)
// This would require `../firebase.js` to handle this concept or have a mock user.
// For now, commenting out as it depends on `../firebase.js` implementation.
/*
const forceGuestLogin = async () => {
  // This would need to either use a mock Firebase user or specific guest credentials
  // if not using real Firebase in browser.
  try {
    // Example: if firebase.js has a mock signInWithCustomToken or similar for guests
    // For now, this is a placeholder.
    console.warn("Firebase Service: forceGuestLogin is a placeholder and needs proper implementation or mock in firebase.js for browser mode.");
    // const guestUser = await signIn('guest@example.com', 'guest'); // Or a specific guest method
    // return guestUser;
    return null;
  } catch (error) {
    console.error("Firebase Service: Force guest login error:", error);
    throw error;
  }
};
*/

// Log that the service is ready
console.log("Firebase Auth Service (client-SDK based) initialized");

const firebaseService = {
  signIn,
  signOut,
  onAuthStateChanged: onAuthStateChangedSubscribe, // Renamed to avoid confusion with SDK's own
  getCurrentUser,
  // forceGuestLogin, // Keep commented if not fully implemented for browser mock
  isElectronAvailable // Expose this for services that might need it
};

export default firebaseService;

// frontend/src/services/__tests__/firebaseService.spec.js

// Mock the firebase client SDK - This MUST be at the top
jest.mock('../firebase', () => {
  const mockUserTemplate = { // A template for a user object
    uid: 'test-uid-template',
    email: 'template@example.com',
    displayName: 'Template User',
  };
  const mockAuthInternal = {
    signInWithEmailAndPassword: jest.fn().mockImplementation(async (email, password) => {
      // Return a new user object for each call to avoid shared mock state issues for getIdToken
      return {
        user: {
          ...mockUserTemplate,
          uid: `signed-in-${email}`, // Make UID somewhat dynamic for clarity
          getIdToken: jest.fn().mockResolvedValue(`id-token-for-${email}`)
        }
      };
    }),
    signOut: jest.fn().mockResolvedValue(undefined),
    onAuthStateChanged: jest.fn((callback) => {
      // Store the callback to simulate auth state changes
      // This mock assumes only one onAuthStateChanged listener is set up by the service.
      mockAuthInternal._onAuthStateChangedCallback = callback;
      return () => {}; // Return an unsubscribe function
    }),
    currentUser: null, // Initially no user
    _onAuthStateChangedCallback: null, // To store the callback
  };
  return {
    auth: () => mockAuthInternal,
  };
});

// Mock Electron API - Define it once at the top
const MOCK_ELECTRON_API = {
  userSignedIn: jest.fn().mockResolvedValue({ success: true }),
  userSignedOut: jest.fn().mockResolvedValue({ success: true }),
};

describe('FirebaseService', () => {
  let firebaseService;
  let mockFirebaseAuth; // This will hold the single instance of mockAuthInternal
  let originalWindowElectronAPI;

  // Helper function to simulate auth state change
  const simulateAuthStateChange = (user) => {
    mockFirebaseAuth.currentUser = user; // Update the SDK's current user
    if (mockFirebaseAuth._onAuthStateChangedCallback) {
      mockFirebaseAuth._onAuthStateChangedCallback(user); // Trigger the service's listener
    }
  };

  // This function sets up the environment for tests that need firebaseService
  const setupTestEnvironment = (isElectron = true) => {
    jest.resetModules(); // Crucial for resetting module state including isElectronAvailable

    originalWindowElectronAPI = window.electronAPI;
    window.electronAPI = isElectron ? MOCK_ELECTRON_API : undefined;

    // Dynamically import the service to test after setting window.electronAPI
    firebaseService = require('../firebaseService').default;

    // Get the mocked firebase.auth() instance (it's always the same mockAuthInternal instance)
    mockFirebaseAuth = require('../firebase').auth();

    // Clear all mock function calls before each test to ensure test isolation
    mockFirebaseAuth.signInWithEmailAndPassword.mockClear();
    mockFirebaseAuth.signOut.mockClear();
    // Note: onAuthStateChanged itself is usually only called once by the service.
    // We don't clear its mock.calls unless specifically testing its registration.
    // We *do* want to clear calls on the callback it receives.
    if (mockFirebaseAuth._onAuthStateChangedCallback) {
        // If a callback was captured and it's a Jest mock, clear it.
        // However, it's an actual function from the service, not a mock.
    }
    MOCK_ELECTRON_API.userSignedIn.mockClear();
    MOCK_ELECTRON_API.userSignedOut.mockClear();

    // Simulate initial state (no user) for the service via the captured callback
    simulateAuthStateChange(null);
  };


  afterEach(() => {
    window.electronAPI = originalWindowElectronAPI; // Restore original electronAPI
    jest.resetModules(); // Clean up modules after each test
  });

  describe('signIn', () => {
    it('should sign in with Firebase, get ID token, and notify backend in Electron', async () => {
      setupTestEnvironment(true); // Electron mode
      const email = 'test-electron@example.com';
      const password = 'password';

      // The mock for signInWithEmailAndPassword will generate a user with a specific getIdToken mock
      const result = await firebaseService.signIn(email, password);

      expect(mockFirebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(email, password);
      // The user object is created inside the mock implementation, so we need to get it from the result
      // or from the mock call's resolution if we want to check getIdToken on that specific instance.
      // For this test, we trust the mock implementation to call getIdToken.
      // The mock for getIdToken is fresh for each signIn call due to mockImplementation.
      const signInUser = (await mockFirebaseAuth.signInWithEmailAndPassword.mock.results[0].value).user;
      expect(signInUser.getIdToken).toHaveBeenCalled();
      expect(MOCK_ELECTRON_API.userSignedIn).toHaveBeenCalledWith({ idToken: `id-token-for-${email}` });
      expect(result).toEqual(expect.objectContaining({ uid: `signed-in-${email}` }));
    });

    it('should sign in with Firebase and NOT notify backend if not in Electron', async () => {
      setupTestEnvironment(false); // Browser mode
      const email = 'test-browser@example.com';
      const password = 'password';

      const signInUserPromise = mockFirebaseAuth.signInWithEmailAndPassword(email, password);
      const result = await firebaseService.signIn(email, password);

      expect(mockFirebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(email, password);
      const signInUser = (await signInUserPromise).user; // Get the user from the promise
      expect(signInUser.getIdToken).not.toHaveBeenCalled();
      expect(MOCK_ELECTRON_API.userSignedIn).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ uid: `signed-in-${email}` }));
    });

    it('should throw Firebase error on failed client-side sign-in', async () => {
      setupTestEnvironment(true);
      const authError = new Error('Firebase auth error');
      // Override the default mock implementation for this specific test
      mockFirebaseAuth.signInWithEmailAndPassword.mockRejectedValueOnce(authError);

      await expect(firebaseService.signIn('fail@example.com', 'password')).rejects.toThrow(authError);
      expect(MOCK_ELECTRON_API.userSignedIn).not.toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('should sign out with Firebase and notify backend in Electron', async () => {
      setupTestEnvironment(true);
      simulateAuthStateChange({ uid: 'test-uid' }); // Simulate a logged-in user

      await firebaseService.signOut();

      expect(mockFirebaseAuth.signOut).toHaveBeenCalled();
      expect(MOCK_ELECTRON_API.userSignedOut).toHaveBeenCalledWith({});
    });

    it('should sign out with Firebase and NOT notify backend if not in Electron', async () => {
      setupTestEnvironment(false);
      simulateAuthStateChange({ uid: 'test-uid' });

      await firebaseService.signOut();

      expect(mockFirebaseAuth.signOut).toHaveBeenCalled();
      expect(MOCK_ELECTRON_API.userSignedOut).not.toHaveBeenCalled();
    });
  });

  describe('onAuthStateChangedSubscribe and getCurrentUser', () => {
    let authCallback;

    beforeEach(() => {
      // This group of tests can share an environment setup,
      // as isElectronAvailable doesn't change their core logic.
      setupTestEnvironment(true);
      authCallback = jest.fn();
    });

    it('should register a listener and call it immediately with current user (null initially)', async () => {
      simulateAuthStateChange(null); // Ensure initial state is null

      const unsubscribe = firebaseService.onAuthStateChanged(authCallback);
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for setTimeout

      expect(authCallback).toHaveBeenCalledWith(null);
      expect(firebaseService.getCurrentUser()).toBeNull();
      unsubscribe();
    });

    it('should update currentUser and notify listeners when Firebase auth state changes to logged in', async () => {
      const userFromMock = { uid: 'test-user-auth-change', email: 'test@test.com', displayName: 'Test Auth Change' };
      simulateAuthStateChange(null); // Start as null

      const unsubscribe = firebaseService.onAuthStateChanged(authCallback);
      authCallback.mockClear(); // Clear initial call

      simulateAuthStateChange(userFromMock); // Simulate auth change
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(authCallback).toHaveBeenCalledWith(expect.objectContaining({ uid: userFromMock.uid }));
      expect(firebaseService.getCurrentUser()).toEqual(expect.objectContaining({ uid: userFromMock.uid }));
      unsubscribe();
    });

    it('should update currentUser to null and notify listeners when Firebase auth state changes to logged out', async () => {
      const userFromMock = { uid: 'test-user-auth-change' };
      simulateAuthStateChange(userFromMock); // Start as logged in

      const unsubscribe = firebaseService.onAuthStateChanged(authCallback);
      authCallback.mockClear();

      simulateAuthStateChange(null); // Simulate logout
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(authCallback).toHaveBeenCalledWith(null);
      expect(firebaseService.getCurrentUser()).toBeNull();
      unsubscribe();
    });

    it('getCurrentUser should return the cached user', () => {
      const userFromMock = { uid: 'test-user-get-current' };
      simulateAuthStateChange(userFromMock);
      expect(firebaseService.getCurrentUser()).toEqual(expect.objectContaining({ uid: userFromMock.uid }));

      simulateAuthStateChange(null);
      expect(firebaseService.getCurrentUser()).toBeNull();
    });

    it('should allow unsubscribing a listener', async () => {
      const unsubscribe = firebaseService.onAuthStateChanged(authCallback);

      // Allow the initial setTimeout callback to fire
      await new Promise(resolve => setTimeout(resolve, 20));
      // At this point, authCallback would have been called once with the initial currentUser state.
      // We are interested if it's called AGAIN after unsubscribing.
      authCallback.mockClear(); // Clear any calls that happened due to initial subscription

      unsubscribe();

      const userFromMock = { uid: 'test-user-unsub' };
      simulateAuthStateChange(userFromMock); // Simulate a new auth change AFTER unsubscribe

      // Wait a bit to ensure no async operations call it
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(authCallback).not.toHaveBeenCalled(); // Listener should not be called again
    });
  });
});

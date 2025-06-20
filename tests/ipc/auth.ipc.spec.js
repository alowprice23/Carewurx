// tests/ipc/auth.ipc.spec.js
const admin = require('firebase-admin');

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const mockAuth = {
    verifyIdToken: jest.fn(),
    setCustomUserClaims: jest.fn(),
    JSONParser: { // Used in userSignedOut for peeking into token
        parse: jest.fn(buffer => JSON.parse(buffer.toString()))
    }
  };
  // Mock the behavior of admin.auth() to return our mockAuth object
  // This allows us to call admin.auth().verifyIdToken(), etc.
  return {
    auth: () => mockAuth,
    // Mock other admin services if needed by handlers being tested, e.g., firestore
    firestore: () => ({}),
    // apps: [], // if main.js checks admin.apps.length
    // initializeApp: jest.fn(), // if main.js tries to initialize
  };
});

// Mock any services that the handlers might call after authentication
const mockFirebaseService = {
  getAllClients: jest.fn(),
  // Add other methods called by protected handlers
};
const mockEnhancedScheduler = {
  createSchedule: jest.fn(),
};
const mockFileProcessors = {
  processExcelFile: jest.fn(),
  processPdfFile: jest.fn(),
  processWordFile: jest.fn(),
};
const mockLlmDocumentProcessor = {
  processDocument: jest.fn(),
};
const mockEntityDataProcessor = {
  processEntities: jest.fn(),
};

// This is to prevent errors if main.js or its imports try to use GROQ_API_KEY
process.env.GROQ_API_KEY = 'mock-api-key-for-tests';

// Copied from main.js for direct testing
async function ensureAuthenticated(token) {
  if (!token) {
    console.warn('[Auth] ensureAuthenticated: No ID token provided.');
    throw { code: 'unauthenticated', message: 'No ID token provided.' };
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('[Auth] ensureAuthenticated: Token verification failed:', error.message);
    throw { code: 'permission-denied', message: `Invalid ID token: ${error.message}`, originalError: error };
  }
}

// --- Test Suite ---
describe('IPC Authentication Logic', () => {
  let mockVerifyIdToken;
  let mockSetCustomUserClaims;

  beforeEach(() => {
    // Get the mock functions from the admin.auth() mock
    mockVerifyIdToken = admin.auth().verifyIdToken;
    mockSetCustomUserClaims = admin.auth().setCustomUserClaims;

    mockVerifyIdToken.mockReset();
    mockSetCustomUserClaims.mockReset();
    mockFirebaseService.getAllClients.mockReset();
    mockEnhancedScheduler.createSchedule.mockReset();
    // Reset other service mocks here
  });

  describe('ensureAuthenticated utility', () => {
    it('should return decoded token for a valid token', async () => {
      const mockDecodedToken = { uid: 'user123', email: 'test@example.com' };
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);
      const token = 'valid-token';
      await expect(ensureAuthenticated(token)).resolves.toEqual(mockDecodedToken);
      expect(mockVerifyIdToken).toHaveBeenCalledWith(token);
    });

    it('should throw "unauthenticated" if no token is provided', async () => {
      await expect(ensureAuthenticated(null)).rejects.toEqual({
        code: 'unauthenticated',
        message: 'No ID token provided.',
      });
    });

    it('should throw "permission-denied" if token verification fails', async () => {
      const verifyError = new Error('Token expired');
      mockVerifyIdToken.mockRejectedValue(verifyError);
      const token = 'invalid-token';
      await expect(ensureAuthenticated(token)).rejects.toEqual({
        code: 'permission-denied',
        message: `Invalid ID token: ${verifyError.message}`,
        originalError: verifyError,
      });
    });
  });

  describe('auth:userSignedIn handler logic', () => {
    // Simplified handler logic copied/adapted from main.js
    const userSignedInHandler = async (args) => {
      if (!args || !args.idToken) {
        throw { code: 'invalid-argument', message: 'idToken is required for userSignedIn.' };
      }
      const decodedToken = await ensureAuthenticated(args.idToken);
      // Mocked custom claims logic for testing if it were active
      // await admin.auth().setCustomUserClaims(decodedToken.uid, { role: 'user' });
      return { success: true, uid: decodedToken.uid, email: decodedToken.email };
    };

    it('should verify token and return user info on success', async () => {
      const mockDecoded = { uid: 'user123', email: 'test@example.com', customClaims: {} };
      mockVerifyIdToken.mockResolvedValue(mockDecoded);
      // mockSetCustomUserClaims.mockResolvedValue(undefined); // If claims were set

      const result = await userSignedInHandler({ idToken: 'valid-token' });
      expect(result).toEqual({ success: true, uid: 'user123', email: 'test@example.com' });
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
      // expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user123', { role: 'user' });
    });

    it('should throw if idToken is missing', async () => {
      await expect(userSignedInHandler({})).rejects.toEqual({
        code: 'invalid-argument', message: 'idToken is required for userSignedIn.'
      });
    });

    it('should propagate error from ensureAuthenticated if token is invalid', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Test verification error'));
      await expect(userSignedInHandler({ idToken: 'invalid-token' })).rejects.toMatchObject({
        code: 'permission-denied',
        message: expect.stringContaining('Test verification error'),
      });
    });
  });

  describe('auth:userSignedOut handler logic', () => {
    // Simplified handler logic copied/adapted from main.js
    const userSignedOutHandler = async (args) => {
      const token = args && args.idToken;
      let uid = 'unknown_user';
      if (token) {
        try {
          const decoded = await admin.auth().verifyIdToken(token, true);
          uid = decoded.uid;
        } catch (e) {
          const claimsBuffer = Buffer.from(token.split('.')[1] || '', 'base64');
          // Corrected: admin.auth() is a function
          const claims = admin.auth().JSONParser.parse(claimsBuffer);
          uid = claims && claims.user_id ? claims.user_id : 'unknown_user_from_payload';
          console.warn(`[Auth] auth:userSignedOut: Provided token was invalid or expired... UID for logging: ${uid}`);
        }
      }
      console.log(`[Auth] User ${uid} signed out (notification received by backend).`);
      return { success: true };
    };

    const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    beforeEach(() => {
        mockConsoleWarn.mockClear();
        mockConsoleLog.mockClear();
        // Corrected: admin.auth() is a function
        if (admin.auth().JSONParser && typeof admin.auth().JSONParser.parse.mockClear === 'function') {
            admin.auth().JSONParser.parse.mockClear();
        }
    });

    it('should return success: true when called without token', async () => {
      await expect(userSignedOutHandler(null)).resolves.toEqual({ success: true });
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('User unknown_user signed out'));
    });

    it('should return success: true and log UID if valid token provided', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'user123' });
      await expect(userSignedOutHandler({ idToken: 'valid.token.here' })).resolves.toEqual({ success: true });
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.token.here', true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('User user123 signed out'));
    });

    it('should return success: true and attempt to log UID from payload if expired token provided', async () => {
        mockVerifyIdToken.mockRejectedValue(new Error('Expired token'));
        // Simulate a token payload: { "user_id": "parsedUserUid", ... }
        const mockPayload = { user_id: "parsedUserUid", exp: Date.now() / 1000 - 3600 };
        const mockToken = `header.${Buffer.from(JSON.stringify(mockPayload)).toString('base64')}.signature`;
        // Corrected: admin.auth() is a function
        admin.auth().JSONParser.parse.mockReturnValue(mockPayload);

        await expect(userSignedOutHandler({ idToken: mockToken })).resolves.toEqual({ success: true });
        expect(mockVerifyIdToken).toHaveBeenCalledWith(mockToken, true);
        expect(mockConsoleWarn).toHaveBeenCalled();
        expect(admin.auth().JSONParser.parse).toHaveBeenCalled(); // Corrected this line
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('User parsedUserUid signed out'));
      });
  });

  describe('Protected IPC Handler (firebase:getAllClients)', () => {
    // Simplified handler logic
    const getAllClientsHandler = async (args) => {
      await ensureAuthenticated(args && args.idToken);
      return await mockFirebaseService.getAllClients();
    };

    it('should call service method if token is valid', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'user123' });
      mockFirebaseService.getAllClients.mockResolvedValue([{ id: 'client1' }]);

      const result = await getAllClientsHandler({ idToken: 'valid-token' });
      expect(result).toEqual([{ id: 'client1' }]);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(mockFirebaseService.getAllClients).toHaveBeenCalled();
    });

    it('should throw if token is invalid', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
      await expect(getAllClientsHandler({ idToken: 'invalid-token' })).rejects.toMatchObject({
        code: 'permission-denied',
      });
      expect(mockFirebaseService.getAllClients).not.toHaveBeenCalled();
    });

    it('should throw if no token is provided in args', async () => {
        await expect(getAllClientsHandler({})).rejects.toMatchObject({
          code: 'unauthenticated',
        });
        expect(mockFirebaseService.getAllClients).not.toHaveBeenCalled();
      });
  });

  describe('Protected IPC Handler (scheduler:createSchedule)', () => {
    // Simplified handler logic
    const createScheduleHandler = async (args) => {
        const decodedToken = await ensureAuthenticated(args && args.idToken);
        if (!args || !args.scheduleData) {
            throw { code: 'invalid-argument', message: 'scheduleData is required.'};
        }
        return await mockEnhancedScheduler.createSchedule(args.scheduleData, decodedToken.uid);
    };
    const schedulePayload = { date: '2024-01-01', notes: 'Test schedule' };

    it('should call service method with scheduleData and uid if token is valid', async () => {
        mockVerifyIdToken.mockResolvedValue({ uid: 'userUID123' });
        mockEnhancedScheduler.createSchedule.mockResolvedValue({ id: 'sch123', ...schedulePayload });

        const result = await createScheduleHandler({ idToken: 'valid-token', scheduleData: schedulePayload });
        expect(result).toEqual({ id: 'sch123', ...schedulePayload });
        expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
        expect(mockEnhancedScheduler.createSchedule).toHaveBeenCalledWith(schedulePayload, 'userUID123');
    });

    it('should throw if scheduleData is missing', async () => {
        mockVerifyIdToken.mockResolvedValue({ uid: 'userUID123' });
        await expect(createScheduleHandler({ idToken: 'valid-token' })).rejects.toMatchObject({
            code: 'invalid-argument', message: 'scheduleData is required.'
        });
        expect(mockEnhancedScheduler.createSchedule).not.toHaveBeenCalled();
    });
  });

  describe('Protected IPC Handler (upload-batch-file)', () => {
    // Simplified handler logic
    const uploadBatchFileHandler = async (args) => {
        const decodedToken = await ensureAuthenticated(args && args.idToken);
        const { filePath, entityType, fileType } = args;
        if (!filePath || !entityType || !fileType) {
          throw { code: 'invalid-argument', message: 'filePath, entityType, and fileType are required.' };
        }
        // Mock actual processing, just test auth and arg passing
        return { success: true, message: `Processed ${fileType} for ${entityType} by ${decodedToken.uid}`, filePath };
    };
    const uploadArgs = { filePath: '/tmp/test.xlsx', entityType: 'client', fileType: 'excel' };

    it('should proceed if token is valid and args are present', async () => {
        mockVerifyIdToken.mockResolvedValue({ uid: 'uploaderUID' });
        const result = await uploadBatchFileHandler({ idToken: 'valid-token', ...uploadArgs });
        expect(result.success).toBe(true);
        expect(result.message).toContain('uploaderUID');
        expect(result.filePath).toBe(uploadArgs.filePath);
        expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw if required file args are missing', async () => {
        mockVerifyIdToken.mockResolvedValue({ uid: 'uploaderUID' });
        await expect(uploadBatchFileHandler({ idToken: 'valid-token', entityType: 'client' })).rejects.toMatchObject({
            code: 'invalid-argument', message: expect.stringContaining('filePath, entityType, and fileType are required'),
        });
    });
  });

});

// Restore console.warn and console.log
afterAll(() => {
  jest.restoreAllMocks();
});

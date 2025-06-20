const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

// Attempt to ensure emulator host is set for tests
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

/** @type {RulesTestEnvironment} */
let testEnv;

// Define a project ID for the emulator
const PROJECT_ID = `rules-spec-${Date.now()}`;

/**
 * Initializes the test environment for Firestore emulator.
 * @param {string} [rulesPath] - Path to the Firestore rules file. Defaults to '../../firestore.rules'.
 * @returns {Promise<RulesTestEnvironment>} The initialized test environment.
 */
async function setupFirestoreTestEnvironment(rulesPath = 'firestore.rules') {
  const resolvedRulesPath = path.resolve(__dirname, '../../', rulesPath); // Adjust path as needed
  let rules = null;
  if (fs.existsSync(resolvedRulesPath)) {
    rules = fs.readFileSync(resolvedRulesPath, 'utf8');
  } else {
    console.warn(`Warning: Firestore rules file not found at ${resolvedRulesPath}. Proceeding with default open rules.`);
    // Default open rules if no file is found for basic DB testing
    rules = `
      service cloud.firestore {
        match /databases/{database}/documents {
          match /{document=**} {
            allow read, write: if true;
          }
        }
      }
    `;
  }

  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rules,
        host: 'localhost', // Explicitly set
        port: 8080,      // Explicitly set
      },
    });
  } catch (error) {
    console.error('Error initializing test environment:', error);
    throw error;
  }
  return testEnv;
}

/**
 * Tears down the test environment and cleans up resources.
 */
async function teardownFirestoreTestEnvironment() {
  if (testEnv) {
    await testEnv.cleanup();
  }
}

/**
 * Clears all data from Firestore emulator.
 */
async function clearFirestoreData() {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
}

/**
 * Gets an unauthenticated Firestore client.
 * @returns {import('firebase/firestore').Firestore} Firestore instance.
 */
function getFirestoreUnauthenticated() {
  if (!testEnv) throw new Error('Test environment not initialized. Call setupFirestoreTestEnvironment first.');
  return testEnv.unauthenticatedContext().firestore();
}

/**
 * Gets an authenticated Firestore client.
 * @param {object} [auth] - Optional auth object (e.g., { uid: 'test-user', email: 'test@example.com' })
 * @returns {import('firebase/firestore').Firestore} Firestore instance.
 */
function getFirestoreAuthenticated(auth = { uid: 'test-user' }) {
  if (!testEnv) throw new Error('Test environment not initialized. Call setupFirestoreTestEnvironment first.');
  return testEnv.authenticatedContext(auth.uid, auth).firestore();
}

module.exports = {
  PROJECT_ID,
  setupFirestoreTestEnvironment,
  teardownFirestoreTestEnvironment,
  clearFirestoreData,
  getFirestoreUnauthenticated,
  getFirestoreAuthenticated,
  assertFails,
  assertSucceeds,
};

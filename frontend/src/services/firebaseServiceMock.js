/**
 * Firebase Service Mock
 * 
 * This file provides a comprehensive mock for the firebaseService,
 * including auth, Firestore operations, and higher-level service methods.
 * It also includes a utility to reset mock data for test isolation.
 */

// --- Mock Data Store ---
let MOCK_AVAILABILITY = {};
let MOCK_SCHEDULES = [];
let MOCK_CAREGIVERS = [];
let MOCK_CLIENTS = [];
let mockCurrentUser = null;
let mockAuthStateListeners = [];

const initialMockData = {
  availability: {
    'caregiver-1': {
      caregiverId: 'caregiver-1',
      regularSchedule: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', recurrenceType: 'Weekly' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', recurrenceType: 'Weekly' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '13:00', recurrenceType: 'Weekly' }
      ],
      timeOff: [{ startDate: '2023-07-10', endDate: '2023-07-14', reason: 'Vacation', status: 'Approved' }],
      lastUpdated: new Date('2023-07-01T10:00:00Z').toISOString()
    },
    'caregiver-2': {
      caregiverId: 'caregiver-2',
      regularSchedule: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' }
      ],
      timeOff: [],
      lastUpdated: new Date('2023-07-01T11:00:00Z').toISOString()
    }
  },
  schedules: [
    { id: 'schedule-1', client_id: 'client-1', caregiver_id: 'caregiver-1', date: '2023-07-03', startTime: '09:00', endTime: '12:00', status: 'Confirmed' },
    { id: 'schedule-2', client_id: 'client-2', caregiver_id: 'caregiver-1', date: '2023-07-05', startTime: '09:00', endTime: '11:00', status: 'Confirmed' },
    { id: 'schedule-3', client_id: 'client-1', caregiver_id: 'caregiver-2', date: '2023-07-02', startTime: '10:00', endTime: '14:00', status: 'Confirmed' }
  ],
  caregivers: [
    { id: 'caregiver-1', firstName: 'Michael', lastName: 'Johnson', email: 'michael.j@example.com', phone: '555-222-3333', address: '789 Elm St, Othertown, US 34567', skills: ['mobility', 'medication', 'bathing'], transportation: { hasCar: true, hasLicense: true, usesPublicTransport: false } },
    { id: 'caregiver-2', firstName: 'Sarah', lastName: 'Williams', email: 'sarah.w@example.com', phone: '555-444-5555', address: '321 Pine Rd, Somewhere, US 67890', skills: ['meals', 'companionship', 'light housekeeping'], transportation: { hasCar: false, hasLicense: true, usesPublicTransport: true } }
  ],
  clients: [
    { id: 'client-1', firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com', phone: '555-111-2222', address: '123 Main St, Anytown, US 12345', careNeeds: [{ type: 'mobility', description: 'Mobility Assistance', priority: 3 }, { type: 'medication', description: 'Medication Management', priority: 5 }], transportation: { onBusLine: true, requiresDriverCaregiver: false, mobilityEquipment: ['walker'] }, serviceHours: { hoursPerWeek: 20, preferredDays: [1, 3, 5], preferredTimeRanges: [{ startTime: '09:00', endTime: '13:00' }] }, serviceStatus: 'Active', createdAt: '2023-01-15T00:00:00Z', updatedAt: '2023-06-01T00:00:00Z' },
    { id: 'client-2', firstName: 'Alice', lastName: 'Johnson', email: 'alice.j@example.com', phone: '555-333-4444', address: '456 Oak St, Sometown, US 23456', careNeeds: [{ type: 'meals', description: 'Meal Preparation', priority: 3 }, { type: 'companionship', description: 'Companionship', priority: 2 }, { type: 'housekeeping', description: 'Light Housekeeping', priority: 2 }], transportation: { onBusLine: false, requiresDriverCaregiver: true, mobilityEquipment: [] }, serviceHours: { hoursPerWeek: 15, preferredDays: [0, 2, 4], preferredTimeRanges: [{ startTime: '14:00', endTime: '17:00' }] }, serviceStatus: 'Active', createdAt: '2023-02-20T00:00:00Z', updatedAt: '2023-05-15T00:00:00Z' }
  ],
  users: { // For mock auth
    'admin@carewurx.com': { uid: 'admin-123', email: 'admin@carewurx.com', displayName: 'Admin User', role: 'admin' },
    'guest@example.com': { uid: 'guest-456', email: 'guest@example.com', displayName: 'Guest User', role: 'guest', isGuest: true },
    'test@example.com': { uid: 'test-789', email: 'test@example.com', displayName: 'Test User', role: 'user' }
  }
};

const deepClone = (data) => {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return new Date(data.getTime());
  }
  if (Array.isArray(data)) {
    return data.map(item => deepClone(item));
  }
  const cloned = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      cloned[key] = deepClone(data[key]);
    }
  }
  return cloned;
};


export const resetMockData = () => {
  MOCK_AVAILABILITY = deepClone(initialMockData.availability);
  MOCK_SCHEDULES = deepClone(initialMockData.schedules);
  MOCK_CAREGIVERS = deepClone(initialMockData.caregivers);
  MOCK_CLIENTS = deepClone(initialMockData.clients);
  mockCurrentUser = null;
  mockAuthStateListeners = [];
  console.log('Mock Firebase: Data reset');
};

// --- Mock Auth ---
const mockSignIn = async (email, password) => {
  console.log('Mock Firebase: signIn attempt with', email);
  if (!email || !password) throw new Error('Mock: Email and password are required.');

  const user = initialMockData.users[email]; // Use initialMockData for users lookup
  if (user && (password === 'password' || user.isGuest)) { // Simple password check
    mockCurrentUser = deepClone(user);
    mockAuthStateListeners.forEach(listener => listener(deepClone(mockCurrentUser)));
    return { user: deepClone(mockCurrentUser) };
  }
  throw new Error('Mock: Invalid email or password');
};

const mockSignOut = async () => {
  console.log('Mock Firebase: signOut');
  mockCurrentUser = null;
  mockAuthStateListeners.forEach(listener => listener(null));
  return { success: true };
};

const mockGetCurrentUser = async () => {
  console.log('Mock Firebase: getCurrentUser');
  return mockCurrentUser ? deepClone(mockCurrentUser) : null;
};

const mockOnAuthStateChanged = (callback) => {
  console.log('Mock Firebase: onAuthStateChanged subscribed');
  if (callback) {
    mockAuthStateListeners.push(callback);
    Promise.resolve(mockCurrentUser ? deepClone(mockCurrentUser) : null).then(callback);
  }
  return () => {
    const index = mockAuthStateListeners.indexOf(callback);
    if (index > -1) mockAuthStateListeners.splice(index, 1);
    console.log('Mock Firebase: onAuthStateChanged unsubscribed');
  };
};

const mockForceGuestLogin = async () => {
  return mockSignIn('guest@example.com', 'password'); // Use 'password' as per mockSignIn logic
};

// --- Mock Firestore Structure ---
const mockDb = {
  batch: function() {
    const operations = [];
    const batchInstance = {
      set: function(docRef, data) { operations.push({ type: 'set', docRef, data }); return batchInstance; },
      delete: function(docRef) { operations.push({ type: 'delete', docRef }); return batchInstance; },
      update: function(docRef, data) { operations.push({ type: 'update', docRef, data }); return batchInstance; },
      commit: async function() {
        console.log('Mock Firestore: Committing batch with operations:', operations);
        await new Promise(resolve => setTimeout(resolve, 50)); // Shorter delay for batch
        for (const op of operations) {
          // Assuming docRef has id and parent.id (collectionName)
          const collectionName = op.docRef.parent.id;
          const docId = op.docRef.id;
          const docRefForOp = mockDb.collection(collectionName).doc(docId);

          if (op.type === 'set') await docRefForOp.set(op.data);
          else if (op.type === 'delete') await docRefForOp.delete();
          else if (op.type === 'update') await docRefForOp.update(op.data);
        }
        return { success: true };
      }
    };
    return batchInstance;
  },
  collection: function(collectionName) {
    const collectionRefMock = {
      id: collectionName,
      get: async function() {
        console.log(`Mock Firestore: Getting all documents from ${collectionName}`);
        await new Promise(resolve => setTimeout(resolve, 30));
        let results = [];
        if (collectionName === 'schedules') results = MOCK_SCHEDULES;
        else if (collectionName === 'clients') results = MOCK_CLIENTS;
        else if (collectionName === 'caregivers') results = MOCK_CAREGIVERS;
        else if (collectionName === 'caregiver_availability') results = Object.values(MOCK_AVAILABILITY); // Availability is an object
        else console.warn(`Mock Firestore: Unhandled collection for get all: ${collectionName}`);
        
        return {
          empty: results.length === 0,
          docs: results.map(doc => ({
            id: doc.id,
            data: () => deepClone(doc),
            exists: true,
            ref: mockDb.collection(collectionName).doc(doc.id)
          }))
        };
      },
      add: async function(data) {
        console.log(`Mock Firestore: Adding document to ${collectionName}`, data);
        await new Promise(resolve => setTimeout(resolve, 50));
        const id = `${collectionName.slice(0, -1)}-${Date.now()}`;
        const timestamp = new Date().toISOString();
        const newDoc = { ...data, id, createdAt: timestamp, updatedAt: timestamp };

        if (collectionName === 'caregivers') MOCK_CAREGIVERS.push(deepClone(newDoc));
        else if (collectionName === 'clients') MOCK_CLIENTS.push(deepClone(newDoc));
        else if (collectionName === 'caregiver_availability') MOCK_AVAILABILITY[newDoc.caregiverId || id] = deepClone(newDoc);
        else if (collectionName === 'schedules') MOCK_SCHEDULES.push(deepClone(newDoc));
        else console.warn(`Mock Firestore: Unhandled collection for add: ${collectionName}`);
        return mockDb.collection(collectionName).doc(id); // Return a mock DocRef
      },
      doc: function(docId) {
        const docRefMock = {
          id: docId,
          parent: collectionRefMock, // Reference to parent collection
          get: async function() {
            console.log(`Mock Firestore: Getting document ${collectionName}/${docId}`);
            await new Promise(resolve => setTimeout(resolve, 30));
            let doc;
            if (collectionName === 'caregivers') doc = MOCK_CAREGIVERS.find(c => c.id === docId);
            else if (collectionName === 'clients') doc = MOCK_CLIENTS.find(c => c.id === docId);
            else if (collectionName === 'caregiver_availability') doc = MOCK_AVAILABILITY[docId];
            else if (collectionName === 'schedules') doc = MOCK_SCHEDULES.find(s => s.id === docId);
            else console.warn(`Mock Firestore: Unhandled collection for doc get: ${collectionName}`);
            
            return {
              exists: !!doc,
              data: () => (doc ? deepClone(doc) : undefined),
              id: docId,
              ref: docRefMock
            };
          },
          update: async function(updateData) {
            console.log(`Mock Firestore: Updating ${collectionName}/${docId}`, updateData);
            await new Promise(resolve => setTimeout(resolve, 50));
            let store, index = -1;
            if (collectionName === 'caregivers') store = MOCK_CAREGIVERS;
            else if (collectionName === 'clients') store = MOCK_CLIENTS;
            else if (collectionName === 'schedules') store = MOCK_SCHEDULES;
            else if (collectionName === 'caregiver_availability') {
              if (MOCK_AVAILABILITY[docId]) {
                MOCK_AVAILABILITY[docId] = { ...MOCK_AVAILABILITY[docId], ...updateData, updatedAt: new Date().toISOString() };
                return { success: true };
              }
              throw new Error(`Mock Firestore: Document ${collectionName}/${docId} not found for update.`);
            } else { throw new Error(`Mock Firestore: Unhandled collection ${collectionName} for update.`); }

            index = store.findIndex(item => item.id === docId);
            if (index !== -1) {
              store[index] = { ...store[index], ...updateData, updatedAt: new Date().toISOString() };
              return { success: true };
            }
            throw new Error(`Mock Firestore: Document ${collectionName}/${docId} not found for update.`);
          },
          set: async function(setData, options) {
            console.log(`Mock Firestore: Setting ${collectionName}/${docId}`, setData, options);
            await new Promise(resolve => setTimeout(resolve, 50));
            let store, index = -1;
            const timestamp = new Date().toISOString();
            
            if (collectionName === 'caregiver_availability') {
              const currentDoc = MOCK_AVAILABILITY[docId];
              if (currentDoc && options?.merge) {
                MOCK_AVAILABILITY[docId] = { ...currentDoc, ...setData, updatedAt: timestamp };
              } else {
                MOCK_AVAILABILITY[docId] = { id: docId, ...setData, createdAt: currentDoc?.createdAt || timestamp, updatedAt: timestamp };
              }
              return { success: true };
            } else if (collectionName === 'caregivers') store = MOCK_CAREGIVERS;
            else if (collectionName === 'clients') store = MOCK_CLIENTS;
            else if (collectionName === 'schedules') store = MOCK_SCHEDULES;
            else { throw new Error(`Mock Firestore: Unhandled collection ${collectionName} for set.`); }

            index = store.findIndex(item => item.id === docId);
            if (index !== -1) {
              if (options?.merge) {
                store[index] = { ...store[index], ...setData, updatedAt: timestamp };
              } else {
                store[index] = { id: docId, ...setData, createdAt: store[index].createdAt || timestamp, updatedAt: timestamp };
              }
            } else {
              store.push({ id: docId, ...setData, createdAt: timestamp, updatedAt: timestamp });
            }
            return { success: true };
          },
          delete: async function() {
            console.log(`Mock Firestore: Deleting ${collectionName}/${docId}`);
            await new Promise(resolve => setTimeout(resolve, 30));
            let store, index = -1;
            if (collectionName === 'caregivers') store = MOCK_CAREGIVERS;
            else if (collectionName === 'clients') store = MOCK_CLIENTS;
            else if (collectionName === 'schedules') store = MOCK_SCHEDULES;
            else if (collectionName === 'caregiver_availability') {
                if (MOCK_AVAILABILITY[docId]) { delete MOCK_AVAILABILITY[docId]; return { success: true }; }
                throw new Error(`Mock Firestore: Document ${collectionName}/${docId} not found for delete.`);
            } else { throw new Error(`Mock Firestore: Unhandled collection ${collectionName} for delete.`);}
            
            index = store.findIndex(item => item.id === docId);
            if (index !== -1) { store.splice(index, 1); return { success: true }; }
            throw new Error(`Mock Firestore: Document ${collectionName}/${docId} not found for delete.`);
          }
        };
        return docRefMock;
      },
      where: function(field, operator, value) {
        let queryResults = [];
        if (collectionName === 'caregivers') queryResults = deepClone(MOCK_CAREGIVERS);
        else if (collectionName === 'clients') queryResults = deepClone(MOCK_CLIENTS);
        else if (collectionName === 'schedules') queryResults = deepClone(MOCK_SCHEDULES);
        else if (collectionName === 'caregiver_availability') queryResults = deepClone(Object.values(MOCK_AVAILABILITY));
        else console.warn(`Mock Firestore: Unhandled collection for where: ${collectionName}`);

        const conditions = [{ field, operator, value }];

        const queryBuilder = {
          where: function(field2, operator2, value2) {
            conditions.push({ field: field2, operator: operator2, value: value2 });
            return this;
          },
          get: async function() {
            console.log(`Mock Firestore: Querying ${collectionName} with conditions:`, conditions);
            await new Promise(resolve => setTimeout(resolve, 30));
            
            const filtered = queryResults.filter(doc => {
              return conditions.every(cond => {
                const docVal = doc[cond.field];
                if (cond.operator === '==') return docVal === cond.value;
                if (cond.operator === '>') return docVal > cond.value;
                if (cond.operator === '<') return docVal < cond.value;
                if (cond.operator === '!=') return docVal !== cond.value;
                if (cond.operator === 'array-contains') return Array.isArray(docVal) && docVal.includes(cond.value);
                // Add more operators as needed
                console.warn(`Mock Firestore: Unsupported operator ${cond.operator}`);
                return false;
              });
            });
            return {
              empty: filtered.length === 0,
              docs: filtered.map(doc => ({
                id: doc.id,
                data: () => deepClone(doc),
                exists: true,
                ref: mockDb.collection(collectionName).doc(doc.id)
              }))
            };
          }
          // TODO: Add orderBy, limit if needed
        };
        return queryBuilder;
      }
    };
    return collectionRefMock;
  }
};

// --- Main Exported Mock Service ---
const firebaseServiceMock = {
  signIn: mockSignIn,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  getCurrentUser: mockGetCurrentUser,
  forceGuestLogin: mockForceGuestLogin,
  isElectronAvailable: false, // Default to browser-like mock behavior

  db: mockDb,

  getCaregiverAvailability: async (caregiverId) => {
    console.log('Mock Service: getCaregiverAvailability for', caregiverId);
    const availability = MOCK_AVAILABILITY[caregiverId];
    return availability ? deepClone(availability) : null;
  },
  updateCaregiverAvailability: async (caregiverId, availabilityData) => {
    console.log('Mock Service: updateCaregiverAvailability for', caregiverId, availabilityData);
    MOCK_AVAILABILITY[caregiverId] = {
      ...MOCK_AVAILABILITY[caregiverId],
      ...availabilityData,
      caregiverId,
      lastUpdated: new Date().toISOString()
    };
    return { success: true };
  },
  getSchedulesByCaregiverAndDate: async (caregiverId, date) => {
    console.log('Mock Service: getSchedulesByCaregiverAndDate for', caregiverId, date);
    const schedules = MOCK_SCHEDULES.filter(s => s.caregiver_id === caregiverId && s.date === date);
    return deepClone(schedules);
  },
  getAvailableCaregivers: async (date, startTime, endTime) => {
    console.log('Mock Service: getAvailableCaregivers for', date, startTime, endTime);
    // Basic: returns all. TODO: More realistic filtering if needed for tests.
    return deepClone(MOCK_CAREGIVERS);
  },
  createSchedule: async (scheduleData) => {
    console.log('Mock Service: createSchedule', scheduleData);
    const id = `schedule-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const newSchedule = { id, ...scheduleData, status: scheduleData.status || 'Pending', createdAt: timestamp, updatedAt: timestamp };
    MOCK_SCHEDULES.push(newSchedule);
    return deepClone(newSchedule);
  },
  updateSchedule: async (scheduleId, scheduleData) => {
    console.log('Mock Service: updateSchedule', scheduleId, scheduleData);
    const index = MOCK_SCHEDULES.findIndex(s => s.id === scheduleId);
    if (index !== -1) {
      MOCK_SCHEDULES[index] = { ...MOCK_SCHEDULES[index], ...scheduleData, updatedAt: new Date().toISOString() };
      return deepClone(MOCK_SCHEDULES[index]);
    }
    throw new Error(`Mock Service: Schedule ${scheduleId} not found.`);
  },
  getAllCaregivers: async () => {
    console.log('Mock Service: getAllCaregivers');
    return deepClone(MOCK_CAREGIVERS);
  },
  getCaregiverById: async (caregiverId) => {
    console.log('Mock Service: getCaregiverById', caregiverId);
    const caregiver = MOCK_CAREGIVERS.find(c => c.id === caregiverId);
    return caregiver ? deepClone(caregiver) : null;
  },
  createCaregiver: async (caregiverData) => {
    console.log('Mock Service: createCaregiver', caregiverData);
    const id = `caregiver-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const newCaregiver = { id, ...caregiverData, createdAt: timestamp, updatedAt: timestamp };
    MOCK_CAREGIVERS.push(newCaregiver);
    return deepClone(newCaregiver);
  },
  updateCaregiver: async (caregiverId, caregiverData) => {
    console.log('Mock Service: updateCaregiver', caregiverId, caregiverData);
    const index = MOCK_CAREGIVERS.findIndex(c => c.id === caregiverId);
    if (index !== -1) {
      MOCK_CAREGIVERS[index] = { ...MOCK_CAREGIVERS[index], ...caregiverData, updatedAt: new Date().toISOString() };
      return deepClone(MOCK_CAREGIVERS[index]);
    }
    throw new Error(`Mock Service: Caregiver ${caregiverId} not found.`);
  },
  getClientById: async (clientId) => {
    console.log('Mock Service: getClientById', clientId);
    const client = MOCK_CLIENTS.find(c => c.id === clientId);
    return client ? deepClone(client) : null;
  },
  getAllClients: async () => {
    console.log('Mock Service: getAllClients');
    return deepClone(MOCK_CLIENTS);
  },
  createClient: async (clientData) => {
    console.log('Mock Service: createClient', clientData);
    const id = `client-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const newClient = { id, ...clientData, createdAt: timestamp, updatedAt: timestamp };
    MOCK_CLIENTS.push(newClient);
    return deepClone(newClient);
  },
  updateClient: async (clientId, clientData) => {
    console.log('Mock Service: updateClient', clientId, clientData);
    const index = MOCK_CLIENTS.findIndex(c => c.id === clientId);
    if (index !== -1) {
      MOCK_CLIENTS[index] = { ...MOCK_CLIENTS[index], ...clientData, updatedAt: new Date().toISOString() };
      return deepClone(MOCK_CLIENTS[index]);
    }
    throw new Error(`Mock Service: Client ${clientId} not found.`);
  },
  getRecurringSchedulesByClient: async (clientId) => {
    console.log('Mock Service: getRecurringSchedulesByClient for', clientId);
    // Static mock, can be improved if tests need dynamic recurring schedules
    const recurring = [
      { id: `recurring-${clientId}-1`, client_id: clientId, dayOfWeek: 1, startTime: '09:00', endTime: '12:00', careNeeds: ['mobility', 'medication'], notes: 'Regular Monday morning session', isRecurring: true, status: 'Needs Assignment' },
      { id: `recurring-${clientId}-2`, client_id: clientId, dayOfWeek: 3, startTime: '13:00', endTime: '15:00', careNeeds: ['mobility'], notes: 'Regular Wednesday afternoon session', isRecurring: true, status: 'Needs Assignment' }
    ];
    return deepClone(recurring);
  },

  // Expose reset function for tests
  resetMockData,
};

// Initialize data when module is loaded
resetMockData();

export default firebaseServiceMock;

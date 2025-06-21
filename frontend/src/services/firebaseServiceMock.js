/**
 * Firebase Service Mock
 * 
 * This file extends the default firebaseService with mock implementations
 * of backend methods needed for the scheduling components.
 */

import firebaseService from './firebaseService';

const createMockDataStore = (initialData = []) => {
  let storeData = JSON.parse(JSON.stringify(initialData)); // Deep copy for initial state

  return {
    get: () => JSON.parse(JSON.stringify(storeData)), // Return deep copy for safe reads
    findById: (id) => {
      const item = storeData.find(i => i.id === id);
      return item ? JSON.parse(JSON.stringify(item)) : null;
    },
    find: (predicate) => {
      const item = storeData.find(predicate);
      return item ? JSON.parse(JSON.stringify(item)) : null;
    },
    filter: (predicate) => JSON.parse(JSON.stringify(storeData.filter(predicate))),
    add: (item) => {
      const newItemId = item.id || `mockid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newItem = { ...item, id: newItemId };
      storeData.push(newItem);
      return JSON.parse(JSON.stringify(newItem));
    },
    update: (id, updates) => {
      const index = storeData.findIndex(item => item.id === id);
      if (index !== -1) {
        storeData[index] = { ...storeData[index], ...updates };
        return JSON.parse(JSON.stringify(storeData[index]));
      }
      console.warn(`MockDataStore: Item with id ${id} not found for update.`);
      return null;
    },
    set: (id, item, options = { merge: false }) => {
      const index = storeData.findIndex(i => i.id === id);
      const newItemWithId = { ...item, id };

      if (index !== -1) {
        if (options.merge) {
          storeData[index] = { ...storeData[index], ...newItemWithId };
        } else {
          storeData[index] = newItemWithId;
        }
      } else {
        storeData.push(newItemWithId);
      }
      const resultItem = storeData.find(i => i.id === id);
      return resultItem ? JSON.parse(JSON.stringify(resultItem)) : null;
    },
    delete: (id) => {
      const initialLength = storeData.length;
      storeData = storeData.filter(item => item.id !== id);
      return storeData.length < initialLength;
    },
    reset: () => {
      storeData = JSON.parse(JSON.stringify(initialData));
    },
    _inspect: () => storeData
  };
};

// Define initial mock data (will be used by the stores)
const INITIAL_MOCK_CAREGIVERS_DATA = [
  {
    id: 'caregiver-1',
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.j@example.com',
    phone: '555-222-3333',
    address: '789 Elm St, Othertown, US 34567',
    skills: ['mobility', 'medication', 'bathing'],
    transportation: { hasCar: true, hasLicense: true, usesPublicTransport: false }
  },
  {
    id: 'caregiver-2',
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah.w@example.com',
    phone: '555-444-5555',
    address: '321 Pine Rd, Somewhere, US 67890',
    skills: ['meals', 'companionship', 'light housekeeping'],
    transportation: { hasCar: false, hasLicense: true, usesPublicTransport: true }
  }
];

const INITIAL_MOCK_CLIENTS_DATA = [
  {
    id: 'client-1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '555-111-2222',
    address: '123 Main St, Anytown, US 12345',
    careNeeds: [ { type: 'mobility', description: 'Mobility Assistance', priority: 3 }, { type: 'medication', description: 'Medication Management', priority: 5 } ],
    transportation: { onBusLine: true, requiresDriverCaregiver: false, mobilityEquipment: ['walker'] },
    serviceHours: { hoursPerWeek: 20, preferredDays: [1, 3, 5], preferredTimeRanges: [ { startTime: '09:00', endTime: '13:00' } ] },
    serviceStatus: 'Active', createdAt: '2023-01-15', updatedAt: '2023-06-01'
  },
  {
    id: 'client-2',
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.j@example.com',
    phone: '555-333-4444',
    address: '456 Oak St, Sometown, US 23456',
    careNeeds: [ { type: 'meals', description: 'Meal Preparation', priority: 3 }, { type: 'companionship', description: 'Companionship', priority: 2 }, { type: 'housekeeping', description: 'Light Housekeeping', priority: 2 } ],
    transportation: { onBusLine: false, requiresDriverCaregiver: true, mobilityEquipment: [] },
    serviceHours: { hoursPerWeek: 15, preferredDays: [0, 2, 4], preferredTimeRanges: [ { startTime: '14:00', endTime: '17:00' } ] },
    serviceStatus: 'Active', createdAt: '2023-02-20', updatedAt: '2023-05-15'
  }
];

const INITIAL_MOCK_SCHEDULES_DATA = [
  { id: 'schedule-1', client_id: 'client-1', caregiver_id: 'caregiver-1', date: '2023-07-03', startTime: '09:00', endTime: '12:00', status: 'Confirmed' },
  { id: 'schedule-2', client_id: 'client-2', caregiver_id: 'caregiver-1', date: '2023-07-05', startTime: '09:00', endTime: '11:00', status: 'Confirmed' },
  { id: 'schedule-3', client_id: 'client-1', caregiver_id: 'caregiver-2', date: '2023-07-02', startTime: '10:00', endTime: '14:00', status: 'Confirmed' }
];

const caregiversStore = createMockDataStore(INITIAL_MOCK_CAREGIVERS_DATA);
const clientsStore = createMockDataStore(INITIAL_MOCK_CLIENTS_DATA);
const schedulesStore = createMockDataStore(INITIAL_MOCK_SCHEDULES_DATA);

// Mock availability data (can be refactored into a store if it grows more complex)
const MOCK_AVAILABILITY = {
  'caregiver-1': {
    caregiverId: 'caregiver-1',
    regularSchedule: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '13:00', recurrenceType: 'Weekly' }
    ],
    timeOff: [ { startDate: '2023-07-10', endDate: '2023-07-14', reason: 'Vacation', status: 'Approved' } ],
    lastUpdated: new Date().toISOString()
  },
  'caregiver-2': {
    caregiverId: 'caregiver-2',
    regularSchedule: [
      { dayOfWeek: 0, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' }
    ],
    timeOff: [],
    lastUpdated: new Date().toISOString()
  }
};


// Create a mock Firestore-like structure to handle the db.collection() calls
// that CaregiverProfileForm and ClientProfileForm are using
firebaseService.db = {
  batch: function() {
    const operations = [];
    
    return {
      set: function(docRef, data) {
        operations.push({
          type: 'set',
          docRef: docRef,
          data: data
        });
      },
      delete: function(docRef) {
        operations.push({
          type: 'delete',
          docRef: docRef
        });
      },
      update: function(docRef, data) {
        operations.push({
          type: 'update',
          docRef: docRef,
          data: data
        });
      },
      commit: async function() {
        console.log('Mock: Committing batch with operations:', operations);
        
        // Add slight delay to simulate network request
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Process all operations
        for (const op of operations) {
          if (op.type === 'set') {
            await op.docRef.set(op.data);
          } else if (op.type === 'delete') {
            // Actually perform the delete
            if (op.docRef && typeof op.docRef.delete === 'function') {
              await op.docRef.delete();
            } else {
              console.warn('Mock: Delete operation could not be performed on docRef:', op.docRef);
            }
          } else if (op.type === 'update') {
            await op.docRef.update(op.data);
          }
        }
        
        return { success: true };
      }
    };
  },
  collection: function(collectionName) {
    return {
      get: async function() {
        console.log(`Mock: Getting all documents from ${collectionName}`);
        
        // Add slight delay to simulate network request
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let results = [];
        if (collectionName === 'schedules') {
          results = schedulesStore.get();
        } else if (collectionName === 'clients') {
          results = clientsStore.get();
        } else if (collectionName === 'caregivers') {
          results = caregiversStore.get();
        } else {
          console.warn(`Mock DB: Unhandled collection in get(): ${collectionName}`);
        }
        
        // Return mock query snapshot
        return {
          empty: results.length === 0,
          docs: results.map(doc => ({
            id: doc.id,
            data: () => ({ ...doc }),
            exists: true,
            ref: {
              delete: async () => {
                let success = false;
                if (collectionName === 'schedules') {
                  success = schedulesStore.delete(doc.id);
                } else if (collectionName === 'clients') {
                  success = clientsStore.delete(doc.id);
                } else if (collectionName === 'caregivers') {
                  success = caregiversStore.delete(doc.id);
                } else {
                  console.warn(`Mock DB: Unhandled collection in ref.delete(): ${collectionName}`);
                }
                return { success };
              }
            }
          }))
        };
      },
      add: async function(data) {
        console.log(`Mock: Adding document to ${collectionName}`, data);
        
        // Add slight delay to simulate network request
        await new Promise(resolve => setTimeout(resolve, 500));
        
        let addedDoc;
        // data might not have an id, the store's add method should generate one if absent
        if (collectionName === 'caregivers') {
          addedDoc = caregiversStore.add(data);
        } else if (collectionName === 'clients') {
          addedDoc = clientsStore.add(data);
        } else if (collectionName === 'schedules') {
          addedDoc = schedulesStore.add(data);
        } else if (collectionName === 'caregiver_availability') {
          // MOCK_AVAILABILITY is not using the store yet, handle separately
          const id = data.caregiverId || `avail-${Date.now()}`; // Ensure an ID
          MOCK_AVAILABILITY[id] = { ...data, id };
          addedDoc = MOCK_AVAILABILITY[id];
        } else {
          console.warn(`Mock DB: Unhandled collection in add(): ${collectionName}`);
          throw new Error(`Mock DB: Unhandled collection ${collectionName}`);
        }
        
        // Return mock document reference (id is the important part)
        return {
          id: addedDoc.id
        };
      },
      doc: function(docId) {
        return {
          get: async function() {
            console.log(`Mock: Getting document from ${collectionName} with ID ${docId}`);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Find the document based on collection
            let docData = null;
            if (collectionName === 'caregivers') {
              docData = caregiversStore.findById(docId);
            } else if (collectionName === 'clients') {
              docData = clientsStore.findById(docId);
            } else if (collectionName === 'schedules') {
              docData = schedulesStore.findById(docId);
            } else if (collectionName === 'caregiver_availability') {
              // MOCK_AVAILABILITY is not using the store yet
              docData = MOCK_AVAILABILITY[docId];
            } else {
              console.warn(`Mock DB: Unhandled collection in doc.get(): ${collectionName}`);
            }
            
            // Return mock document snapshot
            return {
              exists: !!docData,
              data: function() {
                return docData; // This will be a deep copy from the store
              },
              id: docId // Include docId in the snapshot
            };
          },
          update: async function(data) {
            console.log(`Mock: Updating document in ${collectionName} with ID ${docId}`, data);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update the document based on collection
            let success = false;
            if (collectionName === 'caregivers') {
              success = !!caregiversStore.update(docId, data);
            } else if (collectionName === 'clients') {
              success = !!clientsStore.update(docId, data);
            } else if (collectionName === 'schedules') {
              success = !!schedulesStore.update(docId, data);
            } else if (collectionName === 'caregiver_availability') {
              if (MOCK_AVAILABILITY[docId]) {
                MOCK_AVAILABILITY[docId] = { ...MOCK_AVAILABILITY[docId], ...data };
                success = true;
              }
            } else {
              console.warn(`Mock DB: Unhandled collection in doc.update(): ${collectionName}`);
            }
            
            return { success };
          },
          set: async function(data, options) {
            console.log(`Mock: Setting document in ${collectionName} with ID ${docId}`, data);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Handle specific collections
            let success = false;
            if (collectionName === 'caregivers') {
              success = !!caregiversStore.set(docId, data, options);
            } else if (collectionName === 'clients') {
              success = !!clientsStore.set(docId, data, options);
            } else if (collectionName === 'schedules') {
              success = !!schedulesStore.set(docId, data, options);
            } else if (collectionName === 'caregiver_availability') {
              // MOCK_AVAILABILITY is not using the store yet
              if (options?.merge && MOCK_AVAILABILITY[docId]) {
                MOCK_AVAILABILITY[docId] = { ...MOCK_AVAILABILITY[docId], ...data, id: docId };
              } else {
                MOCK_AVAILABILITY[docId] = { ...data, id: docId };
              }
              success = true;
            } else {
              console.warn(`Mock DB: Unhandled collection in doc.set(): ${collectionName}`);
            }
            
            return { success };
          },
          delete: async function() {
            console.log(`Mock: Deleting document from ${collectionName} with ID ${docId}`);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Handle specific collections
            let success = false;
            if (collectionName === 'caregivers') {
              success = caregiversStore.delete(docId);
            } else if (collectionName === 'clients') {
              success = clientsStore.delete(docId);
            } else if (collectionName === 'schedules') {
              success = schedulesStore.delete(docId);
            } else if (collectionName === 'caregiver_availability') {
              if (MOCK_AVAILABILITY[docId]) {
                delete MOCK_AVAILABILITY[docId];
                success = true;
              }
            } else {
              console.warn(`Mock DB: Unhandled collection in doc.delete(): ${collectionName}`);
            }
            
            return { success };
          }
        };
      },
      where: function(field, operator, value) {
        return {
          get: async function() {
            console.log(`Mock: Querying ${collectionName} where ${field} ${operator} ${value}`);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Filter the documents based on the query
            let sourceData = [];
            if (collectionName === 'caregivers') {
              sourceData = caregiversStore.get();
            } else if (collectionName === 'clients') {
              sourceData = clientsStore.get();
            } else if (collectionName === 'schedules') {
              sourceData = schedulesStore.get();
            } else {
              console.warn(`Mock DB: Unhandled collection in where().get(): ${collectionName}`);
            }

            const filteredResults = sourceData.filter(doc => {
              // Basic '==' operator support for now
              if (operator === '==') {
                return doc[field] === value;
              }
              // TODO: Add support for other operators if needed by tests
              console.warn(`Mock DB: Unsupported operator in where().get(): ${operator}`);
              return false;
            });
            
            // Return mock query snapshot
            return {
              empty: filteredResults.length === 0,
              docs: filteredResults.map(doc => ({
                id: doc.id,
                data: () => ({ ...doc }), // Return a copy
                exists: true,
                ref: { // Mock ref for potential chained operations on these results
                  delete: async () => {
                    let success = false;
                    if (collectionName === 'schedules') success = schedulesStore.delete(doc.id);
                    else if (collectionName === 'clients') success = clientsStore.delete(doc.id);
                    else if (collectionName === 'caregivers') success = caregiversStore.delete(doc.id);
                    return { success };
                  }
                }
              }))
            };
          },
          // Keep the chained where, but it will also need to be updated to use stores
          // and handle combined predicates properly. For now, this is a partial update.
          where: function(field2, operator2, value2) {
            // Support for chained where clauses
            return {
              get: async function() {
                console.log(`Mock: Querying ${collectionName} where ${field} ${operator} ${value} and ${field2} ${operator2} ${value2}`);
                await new Promise(resolve => setTimeout(resolve, 300));
                
                let sourceData = [];
                if (collectionName === 'caregivers') sourceData = caregiversStore.get();
                else if (collectionName === 'clients') sourceData = clientsStore.get();
                else if (collectionName === 'schedules') sourceData = schedulesStore.get();
                else console.warn(`Mock DB: Unhandled collection in chained where().get(): ${collectionName}`);

                const filteredResults = sourceData.filter(doc => {
                  let match1 = false;
                  let match2 = false;
                  if (operator === '==') match1 = doc[field] === value;
                  else console.warn(`Mock DB: Unsupported operator1 in chained where(): ${operator}`);

                  if (operator2 === '==') match2 = doc[field2] === value2;
                  else console.warn(`Mock DB: Unsupported operator2 in chained where(): ${operator2}`);

                  return match1 && match2;
                });
                
                return {
                  empty: filteredResults.length === 0,
                  docs: filteredResults.map(doc => ({
                    id: doc.id,
                    data: () => ({ ...doc }),
                    exists: true,
                    ref: {
                      delete: async () => {
                        let success = false;
                        if (collectionName === 'schedules') success = schedulesStore.delete(doc.id);
                        else if (collectionName === 'clients') success = clientsStore.delete(doc.id);
                        else if (collectionName === 'caregivers') success = caregiversStore.delete(doc.id);
                        return { success };
                      }
                    }
                  }))
                };
              }
            };
          }
        };
      }
    };
  }
};

// Mock availability data (remains as is for now, not using createMockDataStore)
const MOCK_AVAILABILITY = {
  'caregiver-1': {
    caregiverId: 'caregiver-1',
    regularSchedule: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '13:00', recurrenceType: 'Weekly' }
    ],
    timeOff: [
      { 
        startDate: '2023-07-10', 
        endDate: '2023-07-14', 
        reason: 'Vacation', 
        status: 'Approved' 
      }
    ],
    lastUpdated: new Date().toISOString()
  },
  'caregiver-2': {
    caregiverId: 'caregiver-2',
    regularSchedule: [
      { dayOfWeek: 0, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' },
      { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' }
    ],
    timeOff: [],
    lastUpdated: new Date().toISOString()
  }
};

// Mock schedules data
const MOCK_SCHEDULES = [
  {
    id: 'schedule-1',
    client_id: 'client-1',
    caregiver_id: 'caregiver-1',
    date: '2023-07-03',
    startTime: '09:00',
    endTime: '12:00',
    status: 'Confirmed'
  },
  {
    id: 'schedule-2',
    client_id: 'client-2',
    caregiver_id: 'caregiver-1',
    date: '2023-07-05',
    startTime: '09:00',
    endTime: '11:00',
    status: 'Confirmed'
  },
  {
    id: 'schedule-3',
    client_id: 'client-1',
    caregiver_id: 'caregiver-2',
    date: '2023-07-02',
    startTime: '10:00',
    endTime: '14:00',
    status: 'Confirmed'
  }
];

// Mock caregivers data
const MOCK_CAREGIVERS = [
  {
    id: 'caregiver-1',
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.j@example.com',
    phone: '555-222-3333',
    address: '789 Elm St, Othertown, US 34567',
    skills: ['mobility', 'medication', 'bathing'],
    transportation: {
      hasCar: true,
      hasLicense: true,
      usesPublicTransport: false
    }
  },
  {
    id: 'caregiver-2',
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah.w@example.com',
    phone: '555-444-5555',
    address: '321 Pine Rd, Somewhere, US 67890',
    skills: ['meals', 'companionship', 'light housekeeping'],
    transportation: {
      hasCar: false,
      hasLicense: true,
      usesPublicTransport: true
    }
  }
];

// Mock clients data
const MOCK_CLIENTS = [
  {
    id: 'client-1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '555-111-2222',
    address: '123 Main St, Anytown, US 12345',
    careNeeds: [
      { type: 'mobility', description: 'Mobility Assistance', priority: 3 },
      { type: 'medication', description: 'Medication Management', priority: 5 }
    ],
    transportation: {
      onBusLine: true,
      requiresDriverCaregiver: false,
      mobilityEquipment: ['walker']
    },
    serviceHours: {
      hoursPerWeek: 20,
      preferredDays: [1, 3, 5],
      preferredTimeRanges: [
        { startTime: '09:00', endTime: '13:00' }
      ]
    },
    serviceStatus: 'Active',
    createdAt: '2023-01-15',
    updatedAt: '2023-06-01'
  },
  {
    id: 'client-2',
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.j@example.com',
    phone: '555-333-4444',
    address: '456 Oak St, Sometown, US 23456',
    careNeeds: [
      { type: 'meals', description: 'Meal Preparation', priority: 3 },
      { type: 'companionship', description: 'Companionship', priority: 2 },
      { type: 'housekeeping', description: 'Light Housekeeping', priority: 2 }
    ],
    transportation: {
      onBusLine: false,
      requiresDriverCaregiver: true,
      mobilityEquipment: []
    },
    serviceHours: {
      hoursPerWeek: 15,
      preferredDays: [0, 2, 4],
      preferredTimeRanges: [
        { startTime: '14:00', endTime: '17:00' }
      ]
    },
    serviceStatus: 'Active',
    createdAt: '2023-02-20',
    updatedAt: '2023-05-15'
  }
];

/**
 * Get caregiver availability settings
 * @param {string} caregiverId - The ID of the caregiver
 * @returns {Promise<Object>} Availability data
 */
firebaseService.getCaregiverAvailability = async (caregiverId) => {
  console.log('Mock: Getting availability for caregiver', caregiverId);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return MOCK_AVAILABILITY[caregiverId] || null;
};

/**
 * Update caregiver availability settings
 * @param {string} caregiverId - The ID of the caregiver
 * @param {Object} availabilityData - The availability data to save
 * @returns {Promise<Object>} Success response
 */
firebaseService.updateCaregiverAvailability = async (caregiverId, availabilityData) => {
  console.log('Mock: Updating availability for caregiver', caregiverId);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // In a real implementation, this would update the database
  // For now, we'll just update our mock data
  MOCK_AVAILABILITY[caregiverId] = {
    caregiverId,
    ...availabilityData,
    lastUpdated: new Date().toISOString()
  };
  
  return { success: true };
};

/**
 * Get schedules for a caregiver on a specific date
 * @param {string} caregiverId - The ID of the caregiver
 * @param {string} date - The date in YYYY-MM-DD format
 * @returns {Promise<Array<Object>>} Array of schedule objects
 */
firebaseService.getSchedulesByCaregiverAndDate = async (caregiverId, date) => {
  console.log('Mock: Getting schedules for caregiver', caregiverId, 'on date', date);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return schedulesStore.filter(schedule =>
    schedule.caregiver_id === caregiverId && schedule.date === date
  );
};

/**
 * Get caregivers available for a specific time slot
 * @param {string} date - The date in YYYY-MM-DD format
 * @param {string} startTime - The start time in HH:MM format
 * @param {string} endTime - The end time in HH:MM format
 * @returns {Promise<Array<Object>>} Array of available caregivers
 */
firebaseService.getAvailableCaregivers = async (date, startTime, endTime) => {
  console.log('Mock: Getting available caregivers for', date, startTime, 'to', endTime);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Logic to determine which caregivers are available
  // For this mock, we'll just return all caregivers from the store as available
  return caregiversStore.get();
};

/**
 * Create a new schedule
 * @param {Object} scheduleData - Schedule data
 * @returns {Promise<Object>} Created schedule
 */
firebaseService.createSchedule = async (scheduleData) => {
  console.log('Mock: Creating schedule', scheduleData);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Generate a new ID
  const newSchedule = {
    // id will be generated by the store if not provided
    ...scheduleData,
    status: scheduleData.status || 'Pending'
  };
  
  // Add to store
  return schedulesStore.add(newSchedule);
};

/**
 * Update an existing schedule
 * @param {string} scheduleId - Schedule ID
 * @param {Object} scheduleData - Updated schedule data
 * @returns {Promise<Object>} Updated schedule
 */
firebaseService.updateSchedule = async (scheduleId, scheduleData) => {
  console.log('Mock: Updating schedule', scheduleId, scheduleData);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Find and update the schedule in the store
  const updatedSchedule = schedulesStore.update(scheduleId, scheduleData);
  
  if (updatedSchedule) {
    return updatedSchedule;
  }
  
  throw new Error(`Mock: Schedule with ID ${scheduleId} not found for update`);
};

/**
 * Get all caregivers
 * @returns {Promise<Array<Object>>} Array of caregivers
 */
firebaseService.getAllCaregivers = async () => {
  console.log('Mock: Getting all caregivers');
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return caregiversStore.get();
};

/**
 * Get caregiver by ID
 * @param {string} caregiverId - The ID of the caregiver
 * @returns {Promise<Object>} Caregiver data
 */
firebaseService.getCaregiverById = async (caregiverId) => {
  console.log('Mock: Getting caregiver by ID', caregiverId);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return caregiversStore.findById(caregiverId);
};

/**
 * Create a new caregiver
 * @param {Object} caregiverData - Caregiver data
 * @returns {Promise<Object>} Created caregiver
 */
firebaseService.createCaregiver = async (caregiverData) => {
  console.log('Mock: Creating caregiver', caregiverData);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // id will be generated by store if not present in caregiverData
  const newCaregiverData = {
    ...caregiverData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return caregiversStore.add(newCaregiverData);
};

/**
 * Update an existing caregiver
 * @param {string} caregiverId - Caregiver ID
 * @param {Object} caregiverData - Updated caregiver data
 * @returns {Promise<Object>} Updated caregiver
 */
firebaseService.updateCaregiver = async (caregiverId, caregiverData) => {
  console.log('Mock: Updating caregiver', caregiverId, caregiverData);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const updatedCaregiverData = {
    ...caregiverData,
    updatedAt: new Date().toISOString()
  };
  const updatedCaregiver = caregiversStore.update(caregiverId, updatedCaregiverData);
  
  if (updatedCaregiver) {
    return updatedCaregiver;
  }
  
  throw new Error(`Mock: Caregiver with ID ${caregiverId} not found for update`);
};

/**
 * Get client by ID
 * @param {string} clientId - The ID of the client
 * @returns {Promise<Object>} Client data
 */
firebaseService.getClientById = async (clientId) => {
  console.log('Mock: Getting client by ID', clientId);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return clientsStore.findById(clientId);
};

/**
 * Get all clients
 * @returns {Promise<Array<Object>>} Array of clients
 */
firebaseService.getAllClients = async () => {
  console.log('Mock: Getting all clients');
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return clientsStore.get();
};

/**
 * Create a new client
 * @param {Object} clientData - Client data
 * @returns {Promise<Object>} Created client
 */
firebaseService.createClient = async (clientData) => {
  console.log('Mock: Creating client', clientData);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // id will be generated by store if not present in clientData
  const newClientData = {
    ...clientData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return clientsStore.add(newClientData);
};

/**
 * Update an existing client
 * @param {string} clientId - Client ID
 * @param {Object} clientData - Updated client data
 * @returns {Promise<Object>} Updated client
 */
firebaseService.updateClient = async (clientId, clientData) => {
  console.log('Mock: Updating client', clientId, clientData);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const updatedClientData = {
    ...clientData,
    updatedAt: new Date().toISOString()
  };
  const updatedClient = clientsStore.update(clientId, updatedClientData);
  
  if (updatedClient) {
    return updatedClient;
  }
  
  throw new Error(`Mock: Client with ID ${clientId} not found for update`);
};

/**
 * Get recurring schedules for a client
 * @param {string} clientId - The ID of the client
 * @returns {Promise<Array<Object>>} Array of recurring schedules
 */
firebaseService.getRecurringSchedulesByClient = async (clientId) => {
  console.log('Mock: Getting recurring schedules for client', clientId);
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return [
    {
      id: `recurring-${clientId}-1`,
      client_id: clientId,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
      careNeeds: ['mobility', 'medication'],
      notes: 'Regular Monday morning session',
      isRecurring: true,
      status: 'Needs Assignment'
    },
    {
      id: `recurring-${clientId}-2`,
      client_id: clientId,
      dayOfWeek: 3,
      startTime: '13:00',
      endTime: '15:00',
      careNeeds: ['mobility'],
      notes: 'Regular Wednesday afternoon session',
      isRecurring: true,
      status: 'Needs Assignment'
    }
  ];
};

export default firebaseService;

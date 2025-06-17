/**
 * Firebase Service Mock
 * 
 * This file extends the default firebaseService with mock implementations
 * of backend methods needed for the scheduling components.
 */

import firebaseService from './firebaseService';

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
          results = MOCK_SCHEDULES;
        } else if (collectionName === 'clients') {
          results = MOCK_CLIENTS;
        } else if (collectionName === 'caregivers') {
          results = MOCK_CAREGIVERS;
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
                if (collectionName === 'schedules') {
                  const index = MOCK_SCHEDULES.findIndex(s => s.id === doc.id);
                  if (index !== -1) {
                    MOCK_SCHEDULES.splice(index, 1);
                  }
                }
                return { success: true };
              }
            }
          }))
        };
      },
      add: async function(data) {
        console.log(`Mock: Adding document to ${collectionName}`, data);
        
        // Add slight delay to simulate network request
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Generate a new ID
        const id = `${collectionName}-${Date.now()}`;
        
        // Handle specific collections
        if (collectionName === 'caregivers') {
          // Add to mock caregivers
          MOCK_CAREGIVERS.push({
            id,
            ...data
          });
        } else if (collectionName === 'clients') {
          // Add to mock clients
          MOCK_CLIENTS.push({
            id,
            ...data
          });
        } else if (collectionName === 'caregiver_availability') {
          // Add to mock availability data
          MOCK_AVAILABILITY[data.caregiverId] = {
            ...data
          };
        } else if (collectionName === 'schedules') {
          // Add to mock schedules
          MOCK_SCHEDULES.push({
            id,
            ...data
          });
        }
        
        // Return mock document reference
        return {
          id
        };
      },
      doc: function(docId) {
        return {
          get: async function() {
            console.log(`Mock: Getting document from ${collectionName} with ID ${docId}`);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Find the document based on collection
            let data = null;
            if (collectionName === 'caregivers') {
              data = MOCK_CAREGIVERS.find(c => c.id === docId);
            } else if (collectionName === 'clients') {
              data = MOCK_CLIENTS.find(c => c.id === docId);
            } else if (collectionName === 'caregiver_availability') {
              data = MOCK_AVAILABILITY[docId];
            } else if (collectionName === 'schedules') {
              data = MOCK_SCHEDULES.find(s => s.id === docId);
            }
            
            // Return mock document snapshot
            return {
              exists: !!data,
              data: function() {
                return data;
              }
            };
          },
          update: async function(data) {
            console.log(`Mock: Updating document in ${collectionName} with ID ${docId}`, data);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update the document based on collection
            if (collectionName === 'caregivers') {
              const index = MOCK_CAREGIVERS.findIndex(c => c.id === docId);
              if (index !== -1) {
                MOCK_CAREGIVERS[index] = {
                  ...MOCK_CAREGIVERS[index],
                  ...data
                };
              }
            } else if (collectionName === 'clients') {
              const index = MOCK_CLIENTS.findIndex(c => c.id === docId);
              if (index !== -1) {
                MOCK_CLIENTS[index] = {
                  ...MOCK_CLIENTS[index],
                  ...data
                };
              }
            } else if (collectionName === 'schedules') {
              const index = MOCK_SCHEDULES.findIndex(s => s.id === docId);
              if (index !== -1) {
                MOCK_SCHEDULES[index] = {
                  ...MOCK_SCHEDULES[index],
                  ...data
                };
              }
            }
            
            return { success: true };
          },
          set: async function(data, options) {
            console.log(`Mock: Setting document in ${collectionName} with ID ${docId}`, data);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Handle specific collections
            if (collectionName === 'caregiver_availability') {
              MOCK_AVAILABILITY[docId] = {
                ...data
              };
            } else if (collectionName === 'caregivers') {
              const index = MOCK_CAREGIVERS.findIndex(c => c.id === docId);
              if (index !== -1) {
                if (options?.merge) {
                  MOCK_CAREGIVERS[index] = {
                    ...MOCK_CAREGIVERS[index],
                    ...data
                  };
                } else {
                  MOCK_CAREGIVERS[index] = {
                    id: docId,
                    ...data
                  };
                }
              } else {
                MOCK_CAREGIVERS.push({
                  id: docId,
                  ...data
                });
              }
            } else if (collectionName === 'clients') {
              const index = MOCK_CLIENTS.findIndex(c => c.id === docId);
              if (index !== -1) {
                if (options?.merge) {
                  MOCK_CLIENTS[index] = {
                    ...MOCK_CLIENTS[index],
                    ...data
                  };
                } else {
                  MOCK_CLIENTS[index] = {
                    id: docId,
                    ...data
                  };
                }
              } else {
                MOCK_CLIENTS.push({
                  id: docId,
                  ...data
                });
              }
            } else if (collectionName === 'schedules') {
              const index = MOCK_SCHEDULES.findIndex(s => s.id === docId);
              if (index !== -1) {
                if (options?.merge) {
                  MOCK_SCHEDULES[index] = {
                    ...MOCK_SCHEDULES[index],
                    ...data
                  };
                } else {
                  MOCK_SCHEDULES[index] = {
                    id: docId,
                    ...data
                  };
                }
              } else {
                MOCK_SCHEDULES.push({
                  id: docId,
                  ...data
                });
              }
            }
            
            return { success: true };
          },
          delete: async function() {
            console.log(`Mock: Deleting document from ${collectionName} with ID ${docId}`);
            
            // Add slight delay to simulate network request
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Handle specific collections
            if (collectionName === 'caregivers') {
              const index = MOCK_CAREGIVERS.findIndex(c => c.id === docId);
              if (index !== -1) {
                MOCK_CAREGIVERS.splice(index, 1);
              }
            } else if (collectionName === 'clients') {
              const index = MOCK_CLIENTS.findIndex(c => c.id === docId);
              if (index !== -1) {
                MOCK_CLIENTS.splice(index, 1);
              }
            } else if (collectionName === 'schedules') {
              const index = MOCK_SCHEDULES.findIndex(s => s.id === docId);
              if (index !== -1) {
                MOCK_SCHEDULES.splice(index, 1);
              }
            }
            
            return { success: true };
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
            let results = [];
            if (collectionName === 'caregivers') {
              results = MOCK_CAREGIVERS.filter(doc => {
                if (operator === '==') {
                  return doc[field] === value;
                }
                return false;
              });
            } else if (collectionName === 'clients') {
              results = MOCK_CLIENTS.filter(doc => {
                if (operator === '==') {
                  return doc[field] === value;
                }
                return false;
              });
            } else if (collectionName === 'schedules') {
              results = MOCK_SCHEDULES.filter(doc => {
                if (operator === '==') {
                  return doc[field] === value;
                }
                return false;
              });
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
                    if (collectionName === 'schedules') {
                      const index = MOCK_SCHEDULES.findIndex(s => s.id === doc.id);
                      if (index !== -1) {
                        MOCK_SCHEDULES.splice(index, 1);
                      }
                    }
                    return { success: true };
                  }
                }
              }))
            };
          },
          where: function(field2, operator2, value2) {
            // Support for chained where clauses
            return {
              get: async function() {
                console.log(`Mock: Querying ${collectionName} where ${field} ${operator} ${value} and ${field2} ${operator2} ${value2}`);
                
                // Add slight delay to simulate network request
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Filter the documents based on both queries
                let results = [];
                if (collectionName === 'schedules') {
                  results = MOCK_SCHEDULES.filter(doc => {
                    if (operator === '==' && operator2 === '==') {
                      return doc[field] === value && doc[field2] === value2;
                    }
                    return false;
                  });
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
                        if (collectionName === 'schedules') {
                          const index = MOCK_SCHEDULES.findIndex(s => s.id === doc.id);
                          if (index !== -1) {
                            MOCK_SCHEDULES.splice(index, 1);
                          }
                        }
                        return { success: true };
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

// Mock availability data
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
  
  return MOCK_SCHEDULES.filter(schedule => 
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
  // For this mock, we'll just return all caregivers as available
  return MOCK_CAREGIVERS;
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
    id: `schedule-${Date.now()}`,
    ...scheduleData,
    status: scheduleData.status || 'Pending'
  };
  
  // Add to mock data
  MOCK_SCHEDULES.push(newSchedule);
  
  return newSchedule;
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
  
  // Find and update the schedule in our mock data
  const index = MOCK_SCHEDULES.findIndex(schedule => schedule.id === scheduleId);
  
  if (index !== -1) {
    MOCK_SCHEDULES[index] = {
      ...MOCK_SCHEDULES[index],
      ...scheduleData
    };
    
    return MOCK_SCHEDULES[index];
  }
  
  throw new Error(`Schedule with ID ${scheduleId} not found`);
};

/**
 * Get all caregivers
 * @returns {Promise<Array<Object>>} Array of caregivers
 */
firebaseService.getAllCaregivers = async () => {
  console.log('Mock: Getting all caregivers');
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return MOCK_CAREGIVERS.map(caregiver => ({ ...caregiver }));
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
  
  const caregiver = MOCK_CAREGIVERS.find(caregiver => caregiver.id === caregiverId);
  
  if (caregiver) {
    return { ...caregiver, id: caregiverId };
  }
  
  return null;
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
  
  // Generate a new ID
  const newCaregiver = {
    id: `caregiver-${Date.now()}`,
    ...caregiverData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Add to mock data
  MOCK_CAREGIVERS.push(newCaregiver);
  
  return newCaregiver;
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
  
  // Find and update the caregiver in our mock data
  const index = MOCK_CAREGIVERS.findIndex(caregiver => caregiver.id === caregiverId);
  
  if (index !== -1) {
    MOCK_CAREGIVERS[index] = {
      ...MOCK_CAREGIVERS[index],
      ...caregiverData,
      updatedAt: new Date().toISOString()
    };
    
    return MOCK_CAREGIVERS[index];
  }
  
  throw new Error(`Caregiver with ID ${caregiverId} not found`);
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
  
  const client = MOCK_CLIENTS.find(client => client.id === clientId);
  
  if (client) {
    return { ...client, id: clientId };
  }
  
  return null;
};

/**
 * Get all clients
 * @returns {Promise<Array<Object>>} Array of clients
 */
firebaseService.getAllClients = async () => {
  console.log('Mock: Getting all clients');
  
  // Add slight delay to simulate network request
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return MOCK_CLIENTS.map(client => ({ ...client }));
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
  
  // Generate a new ID
  const newClient = {
    id: `client-${Date.now()}`,
    ...clientData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Add to mock data
  MOCK_CLIENTS.push(newClient);
  
  return newClient;
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
  
  // Find and update the client in our mock data
  const index = MOCK_CLIENTS.findIndex(client => client.id === clientId);
  
  if (index !== -1) {
    MOCK_CLIENTS[index] = {
      ...MOCK_CLIENTS[index],
      ...clientData,
      updatedAt: new Date().toISOString()
    };
    
    return MOCK_CLIENTS[index];
  }
  
  throw new Error(`Client with ID ${clientId} not found`);
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

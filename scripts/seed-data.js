// Firebase Admin SDK for interacting with Firestore
const admin = require('firebase-admin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore'); // For serverTimestamp

// Configuration: Path to your service account key JSON file
// IMPORTANT: Ensure this file is in .gitignore and not committed to your repository!
// You might need to adjust this path based on your project structure.
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json'; // Or process.env.GOOGLE_APPLICATION_CREDENTIALS

// --- Helper Functions ---

/**
 * Initializes Firebase Admin SDK.
 * Exits process if initialization fails.
 */
function initializeFirebaseAdmin() {
  try {
    // Check if already initialized (e.g., in a hot-reload environment)
    if (admin.apps.length) {
      console.log('Firebase Admin SDK already initialized.');
      return;
    }

    if (SERVICE_ACCOUNT_PATH && require('fs').existsSync(SERVICE_ACCOUNT_PATH)) {
      const serviceAccount = require(SERVICE_ACCOUNT_PATH);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin SDK initialized successfully using service account file.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
       admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      console.log('Firebase Admin SDK initialized successfully using GOOGLE_APPLICATION_CREDENTIALS.');
    } else {
      console.error('Service account key path or GOOGLE_APPLICATION_CREDENTIALS env var not found.');
      console.error('Please set GOOGLE_APPLICATION_CREDENTIALS or provide a serviceAccountKey.json for the seed script in the ./scripts directory (ensure it is gitignored).');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    process.exit(1);
  }
}

/**
 * Gets a reference to the Firestore database.
 * @returns {admin.firestore.Firestore} Firestore database instance.
 */
function getDb() {
  if (!admin.apps.length) {
    console.error('Firebase Admin SDK not initialized. Call initializeFirebaseAdmin() first.');
    process.exit(1);
  }
  return admin.firestore();
}

/**
 * Deletes all documents in a collection.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 * @param {string} collectionPath - Path to the collection.
 * @param {string[]} [specificIdsToKeep] - Optional array of document IDs to NOT delete.
 * @returns {Promise<void>}
 */
async function clearCollection(db, collectionPath, specificIdsToKeep = []) {
  console.log(`Clearing collection: ${collectionPath} (keeping ${specificIdsToKeep.length} specific IDs)`);
  const collectionRef = db.collection(collectionPath);
  let snapshot;
  let count = 0;

  do {
    snapshot = await collectionRef.limit(100).get(); // Batch delete in chunks of 100
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      if (!specificIdsToKeep.includes(doc.id)) {
        batch.delete(doc.ref);
        count++;
      }
    });
    await batch.commit();
  } while (!snapshot.empty); // Continue if snapshot wasn't empty, meaning there might be more

  if (count > 0) {
    console.log(`Finished clearing collection: ${collectionPath}. Deleted ${count} documents.`);
  } else {
    console.log(`Collection ${collectionPath} was already clear or only contained IDs to keep.`);
  }
}


/**
 * Deletes all documents in a subcollection for a given parent document.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 * @param {string} parentCollectionPath - Path to the parent collection.
 * @param {string} parentDocId - ID of the parent document.
 * @param {string} subcollectionName - Name of the subcollection.
 * @returns {Promise<void>}
 */
async function clearSubcollection(db, parentCollectionPath, parentDocId, subcollectionName) {
  const subcollectionPath = `${parentCollectionPath}/${parentDocId}/${subcollectionName}`;
  // Check if parent document exists before trying to clear subcollection
  const parentDoc = await db.collection(parentCollectionPath).doc(parentDocId).get();
  if (!parentDoc.exists) {
    console.warn(`Parent document ${parentCollectionPath}/${parentDocId} does not exist. Skipping clearing of subcollection ${subcollectionName}.`);
    return;
  }
  console.log(`Clearing subcollection: ${subcollectionPath}`);
  await clearCollection(db, subcollectionPath); // Re-use clearCollection for subcollections
}


// --- Data Definitions & Seeding Functions ---

// Sample IDs (to link data and allow for idempotency if we clear by these IDs)
const USER_ADMIN_ID = 'seed_admin_user_001';
const USER_CAREGIVER_ID = 'seed_caregiver_user_001';
const USER_FAMILY_ID = 'seed_family_user_001';

const CAREGIVER_PROFILE_ID = 'seed_caregiver_profile_001'; // Linked to USER_CAREGIVER_ID
const CLIENT_ID_1 = 'seed_client_001';
const CLIENT_ID_2 = 'seed_client_002';

/**
 * Seeds Users collection.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 */
async function seedUsers(db) {
  console.log('Seeding Users...');
  const usersCol = db.collection('users');

  const adminUser = {
    // uid: USER_ADMIN_ID, // Firestore document ID will be USER_ADMIN_ID
    email: 'admin.seed@example.com',
    emailVerified: true,
    role: 'admin',
    profile: {
      displayName: 'Seed Admin',
      timezone: 'America/New_York',
    },
    preferences: {
      language: 'en',
      receiveNotifications: true,
    },
    isDisabled: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
  };

  const caregiverUser = {
    // uid: USER_CAREGIVER_ID,
    email: 'caregiver.seed@example.com',
    emailVerified: true,
    role: 'caregiver',
    profile: {
      displayName: 'Seed Caregiver One',
      timezone: 'America/Los_Angeles',
    },
    preferences: {
      language: 'en',
      receiveNotifications: true,
    },
    caregiverId: CAREGIVER_PROFILE_ID, // Link to caregiver profile in 'caregivers' collection
    isDisabled: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
  };

  const familyUser = {
    // uid: USER_FAMILY_ID,
    email: 'family.seed@example.com',
    emailVerified: true,
    role: 'clientFamily',
    profile: {
        displayName: 'Seed Family Member (Vance)',
    },
    assignedClientIds: [CLIENT_ID_1], // Access to Eleanor Vance's data
    isDisabled: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
  };

  await usersCol.doc(USER_ADMIN_ID).set(adminUser);
  await usersCol.doc(USER_CAREGIVER_ID).set(caregiverUser);
  await usersCol.doc(USER_FAMILY_ID).set(familyUser);
  console.log('Users seeded: 3');
}

/**
 * Seeds Clients collection.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 */
async function seedClients(db) {
  console.log('Seeding Clients...');
  const clientsCol = db.collection('clients');

  const client1 = {
    // clientId: CLIENT_ID_1, // Firestore document ID will be CLIENT_ID_1
    name: 'Eleanor Vance',
    address: '123 Main St, Anytown, USA 12345',
    contactInfo: {
      phone: '555-0101',
      email: 'eleanor.vance.seed@example.com',
    },
    careNeeds: ['Medication Reminders', 'Meal Preparation', 'Companionship'],
    emergencyContacts: [
      { name: 'John Vance', relationship: 'Son', phone: '555-0102' },
    ],
    schedulePreferences: {
      preferredDays: ['Monday', 'Wednesday', 'Friday'],
      preferredTimeSlots: ['Morning'],
      notes: 'Prefers quiet caregivers.',
    },
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    additionalNotes: 'Loves to read and discuss history.',
    managedBy: USER_ADMIN_ID,
    familyContactId: USER_FAMILY_ID, // Link for family portal access
  };

  const client2 = {
    // clientId: CLIENT_ID_2,
    name: 'Marcus Cole',
    address: '456 Oak Ave, Anytown, USA 12345',
    contactInfo: {
      phone: '555-0201',
      email: 'marcus.cole.seed@example.com',
    },
    careNeeds: ['Mobility Assistance', 'Physical Therapy Exercises'],
    emergencyContacts: [
      { name: 'Sarah Cole', relationship: 'Wife', phone: '555-0202' },
    ],
    schedulePreferences: {
      preferredDays: ['Tuesday', 'Thursday'],
      preferredTimeSlots: ['Afternoon'],
    },
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    managedBy: USER_ADMIN_ID,
  };

  await clientsCol.doc(CLIENT_ID_1).set(client1);
  await clientsCol.doc(CLIENT_ID_2).set(client2);
  console.log('Clients seeded: 2');
}


/**
 * Seeds Caregivers collection and their availability subcollections.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 */
async function seedCaregivers(db) {
  console.log('Seeding Caregivers...');
  const caregiversCol = db.collection('caregivers');

  const caregiver1Profile = {
    // caregiverId: CAREGIVER_PROFILE_ID, // Firestore document ID will be CAREGIVER_PROFILE_ID
    userId: USER_CAREGIVER_ID, // Link to the User document
    firstName: 'Alice',
    lastName: 'Smith',
    dateOfBirth: '1985-07-15', // YYYY-MM-DD
    contactInfo: {
      phone: '555-0301',
      email: 'caregiver.seed@example.com', // Should match User's email
    },
    address: {
      street: '789 Pine Ln',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'USA',
    },
    skills: ['Dementia Care', 'CPR Certified', 'Medication Administration', 'Hoyer Lift Operation'],
    certifications: [
      { name: 'Certified Nursing Assistant (CNA)', authority: 'State Board of Nursing', licenseNumber: 'CNA12345', validUntil: '2025-12-31', documentUrl: 'path/to/cna_cert.pdf' },
      { name: 'CPR Basic Life Support', authority: 'American Heart Association', validUntil: '2024-10-15', licenseNumber: 'CPR56789' }
    ],
    yearsOfExperience: 5,
    preferences: {
      maxTravelDistance: 20, // miles
      preferredClientAges: ['senior'],
      preferredClientConditions: ['dementia care', 'companionship'],
    },
    languagesSpoken: ['English', 'Spanish'],
    isActive: true,
    profileImageUrl: 'path/to/alice_smith_profile.jpg',
    emergencyContactName: 'Bob Smith (Husband)',
    emergencyContactPhone: '555-0302',
    backgroundCheck: { status: 'completed', date: '2023-01-15', reportUrl: 'path/to/background_check.pdf'},
    assignedClientIds: [CLIENT_ID_1], // Example assignment
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await caregiversCol.doc(CAREGIVER_PROFILE_ID).set(caregiver1Profile);

  // Seed availability for this caregiver
  const availabilityCol = caregiversCol.doc(CAREGIVER_PROFILE_ID).collection('availability');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2)

  const formatDate = (date) => date.toISOString().split('T')[0]; // YYYY-MM-DD

  const availabilityToday = {
    // availabilityId: formatDate(today), // Firestore doc ID will be this date
    caregiverId: CAREGIVER_PROFILE_ID,
    date: formatDate(today),
    slots: [
      { startTime: '09:00', endTime: '12:00', status: 'available' },
      { startTime: '13:00', endTime: '17:00', status: 'available' },
    ],
    notes: "Available for urgent calls in the evening.",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await availabilityCol.doc(formatDate(today)).set(availabilityToday);

  const availabilityTomorrow = {
    // availabilityId: formatDate(tomorrow),
    caregiverId: CAREGIVER_PROFILE_ID,
    date: formatDate(tomorrow),
    slots: [
      { startTime: '10:00', endTime: '15:00', status: 'booked' }, // Example of a booked slot
      { startTime: '16:00', endTime: '18:00', status: 'available' },
    ],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await availabilityCol.doc(formatDate(tomorrow)).set(availabilityTomorrow);

  const availabilityDayAfterTomorrow = {
    caregiverId: CAREGIVER_PROFILE_ID,
    date: formatDate(dayAfterTomorrow),
    slots: [
      { startTime: '08:00', endTime: '17:00', status: 'available'},
    ],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await availabilityCol.doc(formatDate(dayAfterTomorrow)).set(availabilityDayAfterTomorrow);


  console.log('Caregivers seeded: 1, Availability entries seeded: 3');
}

/**
 * Seeds Schedules collection.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 */
async function seedSchedules(db) {
  console.log('Seeding Schedules...');
  const schedulesCol = db.collection('schedules');

  const now = new Date();
  const startTime1 = new Date(now);
  startTime1.setDate(now.getDate() + 1); // Tomorrow
  startTime1.setHours(10, 0, 0, 0); // 10:00 AM
  const endTime1 = new Date(startTime1);
  endTime1.setHours(startTime1.getHours() + 2); // 2 hour duration

  const startTime2 = new Date(now);
  startTime2.setDate(now.getDate() + 2); // Day after tomorrow
  startTime2.setHours(14, 0, 0, 0); // 2:00 PM
  const endTime2 = new Date(startTime2);
  endTime2.setHours(startTime2.getHours() + 3); // 3 hour duration

  const schedule1Id = 'seed_schedule_001';
  const schedule1 = {
    // scheduleId: schedule1Id,
    clientId: CLIENT_ID_1,
    clientName: 'Eleanor Vance', // Denormalized
    caregiverId: CAREGIVER_PROFILE_ID,
    caregiverName: 'Alice Smith', // Denormalized
    startTime: Timestamp.fromDate(startTime1),
    endTime: Timestamp.fromDate(endTime1),
    status: 'confirmed',
    tasks: ['Medication Reminders', 'Companionship'],
    location: { address: '123 Main St, Anytown, USA 12345', notes: 'Front door access code: 1234' },
    notesForCaregiver: 'Client enjoys talking about her garden. Please ensure medication box A is used.',
    expectedDurationMinutes: 120,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: USER_ADMIN_ID,
    updatedBy: USER_ADMIN_ID,
  };

  const schedule2Id = 'seed_schedule_002';
  const schedule2 = {
    // scheduleId: schedule2Id,
    clientId: CLIENT_ID_2,
    clientName: 'Marcus Cole', // Denormalized
    // No caregiverId initially for an "pending" schedule that could become an opportunity
    startTime: Timestamp.fromDate(startTime2),
    endTime: Timestamp.fromDate(endTime2),
    status: 'pending', // This could be a basis for an opportunity
    tasks: ['Mobility Assistance', 'Stand-by assist for shower'],
    location: { address: '456 Oak Ave, Anytown, USA 12345' },
    notesForCaregiver: 'Client may need encouragement for PT exercises.',
    isRecurring: true,
    recurrenceRule: 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20241231T235959Z',
    expectedDurationMinutes: 180,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: USER_ADMIN_ID,
  };

  await schedulesCol.doc(schedule1Id).set(schedule1);
  await schedulesCol.doc(schedule2Id).set(schedule2);
  console.log('Schedules seeded: 2');
}

/**
 * Seeds Opportunities collection.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 */
async function seedOpportunities(db) {
  console.log('Seeding Opportunities...');
  const opportunitiesCol = db.collection('opportunities');

  const now = new Date();
  const serviceStartTime1 = new Date(now);
  serviceStartTime1.setDate(now.getDate() + 3); // In 3 days
  serviceStartTime1.setHours(9, 0, 0, 0);
  const serviceEndTime1 = new Date(serviceStartTime1);
  serviceEndTime1.setHours(serviceStartTime1.getHours() + 4); // 4 hour opportunity

  const serviceStartTime2 = new Date(now);
  serviceStartTime2.setDate(now.getDate() + 4); // In 4 days
  serviceStartTime2.setHours(11, 0, 0, 0);
  const serviceEndTime2 = new Date(serviceStartTime2);
  serviceEndTime2.setHours(serviceStartTime2.getHours() + 3);

  const opportunity1Id = 'seed_opportunity_001';
  const opportunity1 = {
    // opportunityId: opportunity1Id,
    clientId: CLIENT_ID_1,
    clientName: 'Eleanor Vance', // Denormalized
    serviceStartTime: Timestamp.fromDate(serviceStartTime1),
    serviceEndTime: Timestamp.fromDate(serviceEndTime1),
    location: { address: '123 Main St, Anytown, USA 12345', city: 'Anytown', zipCode: '12345' },
    careNeeds: ['Meal Preparation', 'Light Housekeeping', 'Companionship'],
    requiredSkills: [{ skillName: 'Good communication skills' }],
    description: 'Seeking a caregiver for morning assistance for Eleanor. Includes preparing breakfast and lunch, and light tidying. Client enjoys conversation.',
    status: 'open',
    offeredRate: 22.50,
    rateType: 'hourly',
    priority: 'medium',
    interestedCaregiverIds: [USER_CAREGIVER_ID], // Example: Alice showed interest
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: USER_ADMIN_ID,
    expiryDate: Timestamp.fromDate(new Date(now.setDate(now.getDate() + 7))), // Expires in 7 days
  };

  const opportunity2Id = 'seed_opportunity_002';
  const opportunity2 = {
    // opportunityId: opportunity2Id,
    clientId: CLIENT_ID_2,
    clientName: 'Marcus Cole', // Denormalized
    serviceStartTime: Timestamp.fromDate(serviceStartTime2),
    serviceEndTime: Timestamp.fromDate(serviceEndTime2),
    location: { address: '456 Oak Ave, Anytown, USA 12345', city: 'Anytown', zipCode: '12345' },
    careNeeds: ['Companionship', 'Errands - Grocery Shopping'],
    requiredSkills: [{ skillName: "Valid Driver's License", proficiencyLevel: "Required" }, { skillName: "Ability to lift 20lbs" }],
    description: 'Afternoon companionship and help with running errands (groceries) for Marcus. Must have own vehicle.',
    status: 'assigned',
    assignedCaregiverId: CAREGIVER_PROFILE_ID,
    assignedCaregiverName: 'Alice Smith', // Denormalized
    assignmentTimestamp: FieldValue.serverTimestamp(),
    offeredRate: 70, // Fixed rate for the 3-hour shift
    rateType: 'fixed',
    priority: 'high',
    scheduleId: 'seed_schedule_placeholder_003', // Imagine this got converted to a schedule
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: USER_ADMIN_ID,
  };

  await opportunitiesCol.doc(opportunity1Id).set(opportunity1);
  await opportunitiesCol.doc(opportunity2Id).set(opportunity2);
  console.log('Opportunities seeded: 2');
}

/**
 * Seeds Notifications collection.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 */
async function seedNotifications(db) {
  console.log('Seeding Notifications...');
  const notificationsCol = db.collection('notifications');
  const opp1Id = 'seed_opportunity_001'; // from opportunity seed

  const notification1Id = 'seed_notification_001';
  const notification1 = {
    // notificationId: notification1Id,
    userId: USER_ADMIN_ID,
    type: 'system_alert',
    title: 'System Maintenance Scheduled',
    message: 'System maintenance will occur tonight from 11 PM to 1 AM PST. Please plan accordingly.',
    isRead: false,
    priority: 'medium',
    sender: { name: 'System Operations Center' },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const notification2Id = 'seed_notification_002';
  const notification2 = {
    // notificationId: notification2Id,
    userId: USER_CAREGIVER_ID,
    type: 'new_opportunity',
    title: 'New Opportunity: Eleanor Vance',
    message: `A new opportunity matching your skills is available for client Eleanor Vance. Starts in 3 days.`,
    isRead: false,
    priority: 'high',
    sender: { name: 'Care Coordination System' },
    metadata: { clientId: CLIENT_ID_1, opportunityId: opp1Id },
    actions: [
      { label: 'View Opportunity', type: 'navigate', payload: { path: `/opportunities/${opp1Id}` } },
      { label: 'Dismiss', type: 'api_call', payload: { apiEndpoint: `/notifications/${notification2Id}/dismiss`}}
    ],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const notification3Id = 'seed_notification_003';
  const notification3 = {
    userId: USER_FAMILY_ID,
    type: 'schedule_update',
    title: 'Schedule Confirmed for Eleanor Vance',
    message: `A schedule for Eleanor Vance with caregiver Alice S. on ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()} at 10:00 AM has been confirmed.`,
    isRead: true,
    readAt: Timestamp.now(), // Mark as read since it's informational
    priority: 'low',
    sender: { name: 'Care Coordination System'},
    metadata: { clientId: CLIENT_ID_1, scheduleId: "seed_schedule_001"},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await notificationsCol.doc(notification1Id).set(notification1);
  await notificationsCol.doc(notification2Id).set(notification2);
  await notificationsCol.doc(notification3Id).set(notification3);
  console.log('Notifications seeded: 3');
}

/**
 * Seeds BatchUploads collection.
 * @param {admin.firestore.Firestore} db - Firestore instance.
 */
async function seedBatchUploads(db) {
  console.log('Seeding BatchUploads...');
  const batchUploadsCol = db.collection('batchUploads');
  const batchId1 = 'seed_batchupload_001';

  const batchUpload1 = {
    // batchId: batchId1,
    uploadedByUserId: USER_ADMIN_ID,
    uploadTimestamp: Timestamp.fromDate(new Date(Date.now() - 48 * 60 * 60 * 1000)), // Two days ago
    originalFile: {
      fileName: 'client_import_jan2024.csv',
      storagePath: 'gs://your-bucket-name/seed_data_files/client_import_jan2024.csv', // Replace with actual bucket if used
      fileType: 'text/csv',
      fileSize: 12345, // bytes
    },
    entityType: 'clients',
    status: 'completed',
    totalItems: 2, // Small example
    processedItems: 2,
    successfulItems: 2,
    failedItems: 0,
    processingStartTime: Timestamp.fromDate(new Date(Date.now() - 47 * 60 * 60 * 1000)),
    processingEndTime: Timestamp.fromDate(new Date(Date.now() - 47 * 60 * 60 * 1000 + 5 * 60 * 1000)), // 5 mins later
    itemDetails: [ // Only if small, otherwise log/subcollection
      { itemId: 'CSV_ROW_2', status: 'success', documentId: 'imported_client_A', message: 'Client A imported successfully.' },
      { itemId: 'CSV_ROW_3', status: 'success', documentId: 'imported_client_B', message: 'Client B imported successfully.' },
    ],
    summary: { clientsAdded: 2, clientsUpdated: 0, errors: 0 },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await batchUploadsCol.doc(batchId1).set(batchUpload1);
  console.log('BatchUploads seeded: 1');
}


// --- Main Execution ---
const SEED_DOCUMENT_IDS_TO_KEEP = {
    users: [], // Add any specific user UIDs you absolutely don't want this script to touch
    clients: [],
    caregivers: [],
    // Add other collections if needed
};

/**
 * Main function to clear existing data and seed new data.
 */
async function main() {
  initializeFirebaseAdmin();
  const db = getDb();

  console.log('Starting Firestore data seeding process...');

  const collectionsToClear = [
    // Order can be important for subcollections or if rules enforce referential integrity.
    // Subcollections are handled separately for targeted deletion.
    'notifications',
    'opportunities',
    'schedules',
    'batchUploads',
    'caregivers', // Will clear caregivers first, then their availability subcollections
    'clients',
    'users'
  ];

  // Clear known subcollections first
  // This script only creates availability for CAREGIVER_PROFILE_ID
  // If other caregivers had seed data, they'd need explicit clearing too.
  await clearSubcollection(db, 'caregivers', CAREGIVER_PROFILE_ID, 'availability');

  // Clear top-level collections
  for (const coll of collectionsToClear) {
    await clearCollection(db, coll, SEED_DOCUMENT_IDS_TO_KEEP[coll] || []);
  }

  console.log('Finished clearing data based on seed script definitions.');
  console.log('---');

  console.log('Starting data population...');
  // Order of seeding can also matter if there are logical dependencies
  // (e.g., create users/caregivers/clients before schedules/opportunities that reference them)
  await seedUsers(db);
  await seedClients(db);
  await seedCaregivers(db); // Also seeds availability for CAREGIVER_PROFILE_ID
  await seedSchedules(db);
  await seedOpportunities(db);
  await seedNotifications(db);
  await seedBatchUploads(db);

  console.log('---');
  console.log('Firestore data seeding process completed successfully!');
  console.log('Remember to have a serviceAccountKey.json in the ./scripts directory (and ensure it is .gitignored) or have GOOGLE_APPLICATION_CREDENTIALS set in your environment.');
}

main().catch(error => {
  console.error('Error during seeding process:', error);
  process.exit(1);
});

const admin = require('firebase-admin');

// IMPORTANT: Replace with your actual service account key details or load from a secure path/env variable
// For local development, you might download a service account key JSON file.
// Ensure 'serviceAccountKey.json' is in your .gitignore if you use a local file.
try {
  const serviceAccount = require('./serviceAccountKey.json'); // Placeholder path

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  console.error("Please ensure you have a valid serviceAccountKey.json in the ./scripts directory or configure alternative authentication.");
  process.exit(1); // Exit if Firebase Admin SDK cannot be initialized
}


const db = admin.firestore();
const auth = admin.auth();

// --- Helper Functions ---
const { Timestamp } = admin.firestore;

const log = (message) => console.log(`[SeedData] ${message}`);

/**
 * Deletes all documents in a collection.
 * @param {admin.firestore.CollectionReference} collectionRef
 * @param {string} collectionName For logging purposes
 */
async function clearCollection(collectionRef, collectionName) {
  log(`Clearing collection: ${collectionName}...`);
  const snapshot = await collectionRef.limit(50).get(); // Limit to avoid timeouts on large collections, run multiple times if needed

  if (snapshot.empty) {
    log(`${collectionName} is already empty.`);
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  log(`Cleared ${snapshot.size} documents from ${collectionName}.`);

  // If there might be more documents than the limit, recurse or inform user
  if (snapshot.size === 50) {
    log(`There might be more documents in ${collectionName}. Consider running clear script again or increasing limit.`);
  }
}

// --- Data Seeding Functions ---

async function seedUsers() {
  log('Seeding users...');
  const usersCollection = db.collection('users');
  // For idempotency, we can try to delete specific known users if they exist,
  // or clear the relevant part of the collection if it's purely seed data.
  // For this example, we'll create users with specific UIDs if possible,
  // or let auth generate them and store the UID.

  // Sample Admin User
  const adminUID = 'seedAdminUser001';
  try {
    await auth.deleteUser(adminUID).catch(() => log(`User ${adminUID} not found, no need to delete.`)); // Clear existing
    const adminUserRecord = await auth.createUser({
      uid: adminUID,
      email: 'admin@example.com',
      password: 'securePassword123',
      displayName: 'Admin User',
      disabled: false,
    });
    await usersCollection.doc(adminUserRecord.uid).set({
      email: adminUserRecord.email,
      displayName: adminUserRecord.displayName,
      role: 'admin',
      isDisabled: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      photoURL: null,
      phoneNumber: null,
    });
    log(`Created admin user: ${adminUserRecord.uid}`);
  } catch (error) {
    if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
        log(`Admin user ${adminUID} or email admin@example.com already exists. Skipping creation.`);
        // Optionally update the Firestore document
        await usersCollection.doc(adminUID).set({
            email: 'admin@example.com',
            displayName: 'Admin User (Seed)',
            role: 'admin',
            isDisabled: false,
            createdAt: Timestamp.now(), // Or use FieldValue.serverTimestamp() if appropriate
            updatedAt: Timestamp.now(),
        }, { merge: true });
    } else {
        console.error('Error creating admin user:', error);
    }
  }


  // Sample Caregiver User
  const caregiverUID = 'seedCaregiverUser001';
  try {
    await auth.deleteUser(caregiverUID).catch(() => log(`User ${caregiverUID} not found, no need to delete.`)); // Clear existing
    const caregiverUserRecord = await auth.createUser({
      uid: caregiverUID,
      email: 'caregiver@example.com',
      password: 'securePassword123',
      displayName: 'Caregiver User',
      disabled: false,
    });
    await usersCollection.doc(caregiverUserRecord.uid).set({
      email: caregiverUserRecord.email,
      displayName: caregiverUserRecord.displayName,
      role: 'caregiver',
      isDisabled: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      photoURL: null,
      phoneNumber: null,
    });
    log(`Created caregiver user: ${caregiverUserRecord.uid}`);
    return { adminUID, caregiverUID }; // Return UIDs for linking
  } catch (error) {
    if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
        log(`Caregiver user ${caregiverUID} or email caregiver@example.com already exists. Skipping creation.`);
         await usersCollection.doc(caregiverUID).set({
            email: 'caregiver@example.com',
            displayName: 'Caregiver User (Seed)',
            role: 'caregiver',
            isDisabled: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        }, { merge: true });
        return { adminUID, caregiverUID }; // Still return UIDs
    } else {
        console.error('Error creating caregiver user:', error);
        return { adminUID, caregiverUID: null }; // Return adminUID even if caregiver fails
    }
  }
}

async function seedClients() {
  log('Seeding clients...');
  const clientsCollection = db.collection('clients');
  // Example: Clear previous seed data based on known IDs or a flag
  // For this example, we'll add new ones. If running multiple times, this will create duplicates.
  // A better approach for idempotency would be to use specific document IDs and set/overwrite them.

  const client1Id = 'seedClient001';
  const client2Id = 'seedClient002';

  await clientsCollection.doc(client1Id).set({
    name: 'John Doe',
    address: '123 Main St, Anytown, USA',
    contactInfo: { phone: '555-0101', email: 'john.doe@example.com' },
    careNeeds: ['medication reminder', 'meal prep', 'light housekeeping'],
    emergencyContacts: [{ name: 'Jane Doe', relationship: 'Spouse', phone: '555-0102' }],
    schedulePreferences: { preferredDays: ['Monday', 'Wednesday', 'Friday'], preferredTimeOfDay: 'morning' },
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    additionalNotes: 'Loves to talk about gardening.',
  });

  await clientsCollection.doc(client2Id).set({
    name: 'Maria Garcia',
    address: '456 Oak Ave, Otherville, USA',
    contactInfo: { phone: '555-0201', email: 'maria.garcia@example.com' },
    careNeeds: ['mobility assistance', 'personal care'],
    emergencyContacts: [{ name: 'Carlos Garcia', relationship: 'Son', phone: '555-0202' }],
    schedulePreferences: { preferredDays: ['Tuesday', 'Thursday'], preferredTimeOfDay: 'afternoon' },
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  log('Seeded 2 clients.');
  return [client1Id, client2Id];
}

async function seedCaregivers(caregiverUserId) {
  if (!caregiverUserId) {
    log('Skipping caregiver seeding as caregiverUserId was not provided (likely due to user creation error).');
    return [];
  }
  log('Seeding caregivers...');
  const caregiversCollection = db.collection('caregivers');
  const caregiver1Id = caregiverUserId; // Use the auth UID as the caregiver doc ID

  await caregiversCollection.doc(caregiver1Id).set({
    userId: caregiverUserId,
    name: 'Caregiver User (Alice Smith)', // Match displayName or use a specific caregiver name
    address: '789 Pine Rd, Sometown, USA',
    contactInfo: { phone: '555-0301', email: 'caregiver@example.com' }, // Match user email
    dateOfBirth: Timestamp.fromDate(new Date(1990, 5, 15)),
    skills: ['dementia care', 'CPR certified', 'first aid'],
    certifications: [
      { name: 'Certified Nursing Assistant (CNA)', issuingOrganization: 'State Board of Nursing', issueDate: Timestamp.fromDate(new Date(2020, 1, 10)) },
      { name: 'CPR Basic Life Support', issuingOrganization: 'American Heart Association', issueDate: Timestamp.fromDate(new Date(2022, 8, 20)), expiryDate: Timestamp.fromDate(new Date(2024, 8, 20)) }
    ],
    yearsOfExperience: 5,
    preferredClientGroups: ['elderly', 'post-operative care'],
    isActive: true,
    profilePictureUrl: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Seed availability for this caregiver
  const availabilityCollection = caregiversCollection.doc(caregiver1Id).collection('availability');
  const availability1Id = 'defaultWeek';
  await availabilityCollection.doc(availability1Id).set({
    caregiverId: caregiver1Id,
    slots: [
      { dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'Friday', startTime: '10:00', endTime: '15:00' },
    ],
    lastUpdated: Timestamp.now(),
  });

  log('Seeded 1 caregiver with availability.');
  return [caregiver1Id];
}

async function seedSchedules(clientIds, caregiverIds) {
  if (!clientIds.length || !caregiverIds.length) {
    log('Skipping schedule seeding due to missing client or caregiver IDs.');
    return;
  }
  log('Seeding schedules...');
  const schedulesCollection = db.collection('schedules');

  const schedule1Id = 'seedSchedule001';
  await schedulesCollection.doc(schedule1Id).set({
    clientId: clientIds[0], // Link to John Doe
    caregiverId: caregiverIds[0], // Link to Alice Smith (Caregiver User)
    date: Timestamp.fromDate(new Date(new Date().setDate(new Date().getDate() + 7))), // Next week
    time: { startTime: '10:00', endTime: '12:00' },
    tasks: ['medication reminder', 'meal prep'],
    status: 'confirmed',
    isRecurring: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const schedule2Id = 'seedSchedule002';
  await schedulesCollection.doc(schedule2Id).set({
    clientId: clientIds[1], // Link to Maria Garcia
    caregiverId: caregiverIds[0], // Link to Alice Smith
    date: Timestamp.fromDate(new Date(new Date().setDate(new Date().getDate() + 3))), // 3 days from now
    time: { startTime: '14:00', endTime: '16:00' },
    tasks: ['mobility assistance'],
    status: 'pending', // Caregiver needs to confirm
    isRecurring: true,
    recurringInfo: {
        frequency: "weekly",
        daysOfWeek: ["Tuesday", "Thursday"],
        endDate: Timestamp.fromDate(new Date(new Date().setMonth(new Date().getMonth() + 3))) // 3 months from now
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  log('Seeded 2 schedules.');
}

async function seedOpportunities(clientIds, adminUserId) {
  if (!clientIds.length || !adminUserId) {
    log('Skipping opportunity seeding due to missing client or admin IDs.');
    return;
  }
  log('Seeding opportunities...');
  const opportunitiesCollection = db.collection('opportunities');

  const opportunity1Id = 'seedOpportunity001';
  await opportunitiesCollection.doc(opportunity1Id).set({
    clientId: clientIds[0],
    timeDetails: {
      date: Timestamp.fromDate(new Date(new Date().setDate(new Date().getDate() + 10))), // 10 days from now
      startTime: '09:00',
      endTime: '13:00',
      durationHours: 4,
    },
    location: { address: '123 Main St, Anytown, USA', notes: 'Client has a small dog.' },
    requiredSkills: ['meal prep', 'light housekeeping'],
    careNeeds: ['Assist with breakfast and lunch', 'Tidy kitchen and living room'],
    status: 'open',
    compensationRate: 20, // $/hr
    urgency: 'medium',
    createdBy: adminUserId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const opportunity2Id = 'seedOpportunity002';
  await opportunitiesCollection.doc(opportunity2Id).set({
    clientId: clientIds[1],
    timeDetails: {
      date: Timestamp.fromDate(new Date(new Date().setDate(new Date().getDate() + 5))), // 5 days from now
      startTime: '15:00',
      endTime: '17:00',
      durationHours: 2,
    },
    location: { address: '456 Oak Ave, Otherville, USA' },
    requiredSkills: ['personal care', 'mobility assistance'],
    careNeeds: ['Assist with evening routine', 'Help with transfers'],
    status: 'assigned', // This one is already assigned
    assignedCaregiverId: 'seedCaregiverUser001', // Assuming this caregiver exists
    assignedBy: adminUserId,
    assignmentDate: Timestamp.now(),
    compensationRate: 25, // $/hr
    urgency: 'high',
    createdBy: adminUserId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  log('Seeded 2 opportunities.');
}

async function seedNotifications(userIds) {
  if (!userIds.adminUID && !userIds.caregiverUID) {
    log('Skipping notification seeding as no user IDs were provided.');
    return;
  }
  log('Seeding notifications...');
  const notificationsCollection = db.collection('notifications');

  if (userIds.caregiverUID) {
    const notification1Id = 'seedNotification001';
    await notificationsCollection.doc(notification1Id).set({
      userId: userIds.caregiverUID,
      type: 'new_opportunity',
      title: 'New Opportunity Available!',
      message: 'A new opportunity matching your skills is available near Anytown. Client: John D.',
      isRead: false,
      createdAt: Timestamp.now(),
      relatedEntity: { id: 'seedOpportunity001', type: 'opportunity' },
      ctaLink: '/opportunities/seedOpportunity001',
    });
  }

  if (userIds.adminUID) {
    const notification2Id = 'seedNotification002';
    await notificationsCollection.doc(notification2Id).set({
      userId: userIds.adminUID,
      type: 'system_alert',
      title: 'Seed Data Loaded',
      message: 'The database has been successfully seeded with initial data.',
      isRead: false,
      createdAt: Timestamp.now(),
    });
  }
  log('Seeded notifications.');
}

async function seedBatchUploads(adminUserId) {
    if (!adminUserId) {
        log('Skipping batch upload seeding as adminUserId was not provided.');
        return;
    }
    log('Seeding batch uploads...');
    const batchUploadsCollection = db.collection('batchUploads');

    const batch1Id = 'seedBatchUpload001';
    await batchUploadsCollection.doc(batch1Id).set({
        uploadedByUserId: adminUserId,
        uploadTimestamp: Timestamp.now(),
        originalFileName: 'client_data_jan_2024.csv',
        fileType: 'client_csv',
        status: 'completed',
        totalItems: 150,
        processedItemsCount: 150,
        successCount: 148,
        errorCount: 2,
        storagePath: 'gs://your-bucket-name/uploads/client_data_jan_2024.csv', // Example path
        processingResults: [ // Example results - in reality, this might be too verbose for large files
            { itemId: 'row_1', status: 'success', documentId: 'client_xyz' },
            { itemId: 'row_2', status: 'error', errorDetails: 'Missing required field: email' }
        ],
        completedTimestamp: Timestamp.now(),
    });

    const batch2Id = 'seedBatchUpload002';
    await batchUploadsCollection.doc(batch2Id).set({
        uploadedByUserId: adminUserId,
        uploadTimestamp: Timestamp.now(),
        originalFileName: 'caregiver_applications_feb_2024.zip',
        fileType: 'caregiver_json_archive',
        status: 'pending',
        totalItems: 50,
        processedItemsCount: 0,
        successCount: 0,
        errorCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    log('Seeded 2 batch uploads.');
}


// --- Main Seeding Function ---
async function main() {
  log('Starting database seeding process...');

  // In a real scenario, you might want to clear specific data.
  // For this example, we are not clearing entire collections automatically
  // to prevent accidental data loss on a real project.
  // Consider adding specific document IDs to clear or a command-line flag.
  // await clearCollection(db.collection('users'), 'users'); // Be very careful with this in production
  // await clearCollection(db.collection('clients'), 'clients');
  // ... and so on for other collections.

  // It's often better to make seed functions idempotent by checking for existing data
  // or using fixed IDs for seed documents and overwriting them.

  const userIds = await seedUsers(); // Returns { adminUID, caregiverUID }
  const clientIds = await seedClients(); // Returns [client1Id, client2Id]
  const caregiverIds = await seedCaregivers(userIds.caregiverUID); // Returns [caregiver1Id]

  await seedSchedules(clientIds, caregiverIds);
  await seedOpportunities(clientIds, userIds.adminUID);
  await seedNotifications(userIds);
  await seedBatchUploads(userIds.adminUID);

  log('Database seeding process completed.');
}

main().then(() => {
  log('Seed script finished execution.');
  process.exit(0);
}).catch(error => {
  console.error('Error during seeding process:', error);
  process.exit(1);
});

const {
  setupFirestoreTestEnvironment,
  teardownFirestoreTestEnvironment,
  clearFirestoreData,
  getFirestoreAuthenticated,
  getFirestoreUnauthenticated,
} = require('../utils/firestore.test.utils');
const { doc, collection, addDoc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } = require('firebase/firestore');

describe.skip('Firestore: Clients Collection', () => { // SKIPPING due to emulator issues in CI
  let testEnv;
  let db; // Authenticated Firestore instance
  let unauthedDb; // Unauthenticated Firestore instance
  const collections = {
    clients: 'clients_test', // Use a distinct collection for tests
  };

  // Client data conforming to ClientDocument JSDoc (from models/firestore/client.model.js)
  const sampleClientData = {
    name: 'Test Client One',
    address: '100 Test Ave, Testville, TST 12345',
    contactInfo: { phone: '555-123-4567', email: 'client.one@example.test' },
    careNeeds: ['companionship', 'meal prep'],
    emergencyContacts: [{ name: 'Emergency Test', relationship: 'Friend', phone: '555-765-4321' }],
    schedulePreferences: { preferredDays: ['Monday'], preferredTimeOfDay: 'afternoon' },
    isActive: true,
    // createdAt and updatedAt will be set by Firestore
  };

  beforeAll(async () => {
    testEnv = await setupFirestoreTestEnvironment('firestore.rules');
    // For these tests, we'll primarily use an authenticated context,
    // as if an admin or system process is managing client data.
    db = getFirestoreAuthenticated({ uid: 'test-admin-user' });
    unauthedDb = getFirestoreUnauthenticated(); // For testing rules later if needed
  });

  afterAll(async () => {
    await teardownFirestoreTestEnvironment();
  });

  beforeEach(async () => {
    // Clear data before each test to ensure isolation
    // When clearing, make sure to target the specific test collections if possible,
    // or use clearFirestoreData() which clears the whole test project.
    await clearFirestoreData(); // Clears all data in the test project's Firestore
  });

  describe('Create', () => {
    it('should create a new client document with correct data and timestamps', async () => {
      const clientDataWithTimestamp = {
        ...sampleClientData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const clientRef = await addDoc(collection(db, collections.clients), clientDataWithTimestamp);
      expect(clientRef.id).toBeDefined();

      const clientSnap = await getDoc(doc(db, collections.clients, clientRef.id));
      expect(clientSnap.exists()).toBe(true);
      const data = clientSnap.data();

      expect(data.name).toBe(sampleClientData.name);
      expect(data.address).toBe(sampleClientData.address);
      expect(data.contactInfo.email).toBe(sampleClientData.contactInfo.email);
      expect(data.isActive).toBe(sampleClientData.isActive);
      expect(data.createdAt).toBeInstanceOf(Object); // Firestore Timestamp object
      expect(data.updatedAt).toBeInstanceOf(Object); // Firestore Timestamp object
      // Note: Direct comparison of serverTimestamp objects is tricky.
      // We check for existence and type. For more precision, you might allow a small delta from Date.now().
    });
  });

  describe('Read', () => {
    it('should read a client document by its ID', async () => {
      const clientDataWithTimestamp = {
        ...sampleClientData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const addedDoc = await addDoc(collection(db, collections.clients), clientDataWithTimestamp);

      const clientSnap = await getDoc(doc(db, collections.clients, addedDoc.id));
      expect(clientSnap.exists()).toBe(true);
      const data = clientSnap.data();
      expect(data.name).toBe(sampleClientData.name);
      expect(data.careNeeds).toEqual(expect.arrayContaining(sampleClientData.careNeeds));
    });

    it('should not find a non-existent client document', async () => {
      const clientSnap = await getDoc(doc(db, collections.clients, 'nonExistentId123'));
      expect(clientSnap.exists()).toBe(false);
    });
  });

  describe('Update', () => {
    it('should update specific fields in a client document', async () => {
      const initialData = {
        ...sampleClientData,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const clientRef = await addDoc(collection(db, collections.clients), initialData);

      const updates = {
        isActive: false,
        address: '200 Updated Rd, Testville',
        'contactInfo.phone': '555-999-0000', // Example of updating a nested field
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, collections.clients, clientRef.id), updates);

      const clientSnap = await getDoc(doc(db, collections.clients, clientRef.id));
      expect(clientSnap.exists()).toBe(true);
      const data = clientSnap.data();

      expect(data.isActive).toBe(false);
      expect(data.address).toBe('200 Updated Rd, Testville');
      expect(data.contactInfo.phone).toBe('555-999-0000');
      expect(data.name).toBe(initialData.name); // Unchanged field
      expect(data.updatedAt).not.toEqual(initialData.updatedAt); // Timestamp should change
    });
  });

  describe('Delete', () => {
    it('should delete a client document', async () => {
      const clientRef = await addDoc(collection(db, collections.clients), {
        ...sampleClientData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      expect((await getDoc(doc(db, collections.clients, clientRef.id))).exists()).toBe(true);

      await deleteDoc(doc(db, collections.clients, clientRef.id));

      const clientSnap = await getDoc(doc(db, collections.clients, clientRef.id));
      expect(clientSnap.exists()).toBe(false);
    });
  });

  describe('List/Query', () => {
    it('should list all active clients', async () => {
      // Add a few clients
      await addDoc(collection(db, collections.clients), { ...sampleClientData, name: 'Active Client 1', isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await addDoc(collection(db, collections.clients), { ...sampleClientData, name: 'Inactive Client 1', isActive: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await addDoc(collection(db, collections.clients), { ...sampleClientData, name: 'Active Client 2', isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

      const q = query(collection(db, collections.clients), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);

      expect(querySnapshot.size).toBe(2);
      const names = querySnapshot.docs.map(d => d.data().name);
      expect(names).toContain('Active Client 1');
      expect(names).toContain('Active Client 2');
      expect(names).not.toContain('Inactive Client 1');
    });

     it('should list all clients if no query specified (up to default limit)', async () => {
      await addDoc(collection(db, collections.clients), { ...sampleClientData, name: 'Client A', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await addDoc(collection(db, collections.clients), { ...sampleClientData, name: 'Client B', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

      const querySnapshot = await getDocs(collection(db, collections.clients));
      expect(querySnapshot.size).toBe(2);
    });
  });
});

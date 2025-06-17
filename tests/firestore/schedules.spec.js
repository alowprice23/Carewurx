const {
  setupFirestoreTestEnvironment,
  teardownFirestoreTestEnvironment,
  clearFirestoreData,
  getFirestoreAuthenticated,
} = require('../utils/firestore.test.utils');
const {
  doc,
  collection,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp, // Import Timestamp for date comparisons/creation
  serverTimestamp
} = require('firebase/firestore');

describe('Firestore: Schedules Collection', () => {
  let testEnv;
  let db; // Authenticated Firestore instance
  const collections = {
    schedules: 'schedules_test', // Use a distinct collection for tests
    clients: 'clients_test', // For creating mock client/caregiver IDs
    caregivers: 'caregivers_test',
  };

  // Sample data conforming to ScheduleDocument JSDoc
  const sampleScheduleData = {
    // clientId and caregiverId will be set dynamically in tests
    date: Timestamp.fromDate(new Date('2024-07-15')), // Use a fixed future date for predictability
    time: { startTime: '10:00', endTime: '12:00' },
    tasks: ['medication reminder', 'check vitals'],
    status: 'pending', // e.g., "pending", "confirmed", "completed", "cancelled"
    isRecurring: false,
    // createdAt and updatedAt will be set by Firestore
  };

  let mockClientId = 'mockClient123';
  let mockCaregiverId = 'mockCaregiver456';

  beforeAll(async () => {
    testEnv = await setupFirestoreTestEnvironment('firestore.rules');
    db = getFirestoreAuthenticated({ uid: 'test-scheduler-user' });

    // Create mock client and caregiver documents to get valid IDs, or use fixed IDs
    // For simplicity, we'll use fixed IDs here. In a more complex setup,
    // you might actually create these in a setup step if your rules require their existence.
    // For now, permissive rules mean we just need the ID strings.
  });

  afterAll(async () => {
    await teardownFirestoreTestEnvironment();
  });

  beforeEach(async () => {
    await clearFirestoreData(); // Clears all data
    // If you had test setup that creates specific client/caregiver docs for FK constraints:
    // await addDoc(collection(db, collections.clients), { clientId: mockClientId, name: "Test Client for Schedules" });
    // await addDoc(collection(db, collections.caregivers), { caregiverId: mockCaregiverId, name: "Test Caregiver for Schedules" });
  });

  describe('Create', () => {
    it('should create a new schedule document with correct data', async () => {
      const scheduleData = {
        ...sampleScheduleData,
        clientId: mockClientId,
        caregiverId: mockCaregiverId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const scheduleRef = await addDoc(collection(db, collections.schedules), scheduleData);
      expect(scheduleRef.id).toBeDefined();

      const scheduleSnap = await getDoc(doc(db, collections.schedules, scheduleRef.id));
      expect(scheduleSnap.exists()).toBe(true);
      const data = scheduleSnap.data();

      expect(data.clientId).toBe(mockClientId);
      expect(data.caregiverId).toBe(mockCaregiverId);
      expect(data.status).toBe(sampleScheduleData.status);
      expect(data.tasks).toEqual(expect.arrayContaining(sampleScheduleData.tasks));
      // Compare Timestamps by converting them to Dates or milliseconds
      expect(data.date.toMillis()).toBe(sampleScheduleData.date.toMillis());
      expect(data.createdAt).toBeInstanceOf(Object); // Firestore Timestamp
      expect(data.updatedAt).toBeInstanceOf(Object); // Firestore Timestamp
    });
  });

  describe('Read', () => {
    it('should read a schedule document by its ID', async () => {
      const scheduleData = { ...sampleScheduleData, clientId: mockClientId, caregiverId: mockCaregiverId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const addedDoc = await addDoc(collection(db, collections.schedules), scheduleData);

      const scheduleSnap = await getDoc(doc(db, collections.schedules, addedDoc.id));
      expect(scheduleSnap.exists()).toBe(true);
      const data = scheduleSnap.data();
      expect(data.clientId).toBe(mockClientId);
      expect(data.status).toBe(sampleScheduleData.status);
    });
  });

  describe('Update', () => {
    it('should update specific fields in a schedule document', async () => {
      const initialData = { ...sampleScheduleData, clientId: mockClientId, caregiverId: mockCaregiverId, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const scheduleRef = await addDoc(collection(db, collections.schedules), initialData);

      const updates = {
        status: 'confirmed',
        'time.endTime': '12:30',
        notes: 'Client requested an earlier start if possible next time.',
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, collections.schedules, scheduleRef.id), updates);

      const scheduleSnap = await getDoc(doc(db, collections.schedules, scheduleRef.id));
      expect(scheduleSnap.exists()).toBe(true);
      const data = scheduleSnap.data();

      expect(data.status).toBe('confirmed');
      expect(data.time.endTime).toBe('12:30');
      expect(data.notes).toBe('Client requested an earlier start if possible next time.');
      expect(data.clientId).toBe(initialData.clientId); // Unchanged
      expect(data.updatedAt).not.toEqual(initialData.updatedAt);
    });
  });

  describe('Delete', () => {
    it('should delete a schedule document', async () => {
      const scheduleRef = await addDoc(collection(db, collections.schedules), { ...sampleScheduleData, clientId: mockClientId, caregiverId: mockCaregiverId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      expect((await getDoc(doc(db, collections.schedules, scheduleRef.id))).exists()).toBe(true);

      await deleteDoc(doc(db, collections.schedules, scheduleRef.id));

      const scheduleSnap = await getDoc(doc(db, collections.schedules, scheduleRef.id));
      expect(scheduleSnap.exists()).toBe(false);
    });
  });

  describe('Queries', () => {
    const date1 = Timestamp.fromDate(new Date('2024-08-01'));
    const date2 = Timestamp.fromDate(new Date('2024-08-02'));

    beforeEach(async () => {
      // Seed data for query tests
      await addDoc(collection(db, collections.schedules), { ...sampleScheduleData, clientId: 'client1', caregiverId: 'cg1', date: date1, status: 'confirmed', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await addDoc(collection(db, collections.schedules), { ...sampleScheduleData, clientId: 'client1', caregiverId: 'cg2', date: date2, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await addDoc(collection(db, collections.schedules), { ...sampleScheduleData, clientId: 'client2', caregiverId: 'cg1', date: date1, status: 'confirmed', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });

    it('should query schedules by clientId', async () => {
      const q = query(collection(db, collections.schedules), where('clientId', '==', 'client1'));
      const querySnapshot = await getDocs(q);
      expect(querySnapshot.size).toBe(2);
      querySnapshot.forEach(docSnap => {
        expect(docSnap.data().clientId).toBe('client1');
      });
    });

    it('should query schedules by caregiverId', async () => {
      const q = query(collection(db, collections.schedules), where('caregiverId', '==', 'cg1'));
      const querySnapshot = await getDocs(q);
      expect(querySnapshot.size).toBe(2);
      querySnapshot.forEach(docSnap => {
        expect(docSnap.data().caregiverId).toBe('cg1');
      });
    });

    it('should query schedules by date', async () => {
      const q = query(collection(db, collections.schedules), where('date', '==', date1));
      const querySnapshot = await getDocs(q);
      expect(querySnapshot.size).toBe(2);
      querySnapshot.forEach(docSnap => {
        expect(docSnap.data().date.isEqual(date1)).toBe(true);
      });
    });

    it('should query schedules by clientId and date', async () => {
        const q = query(collection(db, collections.schedules),
            where('clientId', '==', 'client1'),
            where('date', '==', date2)
        );
        const querySnapshot = await getDocs(q);
        expect(querySnapshot.size).toBe(1);
        querySnapshot.forEach(docSnap => {
            expect(docSnap.data().clientId).toBe('client1');
            expect(docSnap.data().caregiverId).toBe('cg2'); // From our seeded data
            expect(docSnap.data().date.isEqual(date2)).toBe(true);
        });
    });
  });
});

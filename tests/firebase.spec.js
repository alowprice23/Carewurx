/**
 * Firebase Service Unit Tests
 * 
 * These tests use Jest to test the Firebase service with mocked Firestore
 */

// Import Jest testing functions
const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Import the Firebase service class (not the singleton instance)
const { FirebaseService } = require('../services/firebase');

// Mock Firebase Admin SDK
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(serviceAccount => serviceAccount)
}));

// Mock Firestore
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockGet = jest.fn();
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockSet = jest.fn();
const mockBatch = jest.fn();

// Mock Firestore query builder pattern
mockCollection.mockReturnValue({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockGet,
  add: mockAdd
});

mockDoc.mockReturnValue({
  get: mockGet,
  update: mockUpdate,
  delete: mockDelete,
  set: mockSet
});

mockWhere.mockReturnValue({
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockGet
});

mockOrderBy.mockReturnValue({
  limit: mockLimit,
  get: mockGet
});

mockLimit.mockReturnValue({
  get: mockGet
});

// Mock batch operations
const mockBatchCommit = jest.fn();
mockBatch.mockReturnValue({
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  commit: mockBatchCommit
});

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: mockCollection,
    batch: mockBatch
  })),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 123456789 }))
  },
  FieldValue: {
    serverTimestamp: jest.fn()
  }
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn()
}));

describe('FirebaseService', () => {
  let firebaseService;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new instance for each test
    firebaseService = new FirebaseService();
    
    // Mock db connection
    firebaseService.db = {
      collection: mockCollection,
      batch: mockBatch
    };
  });
  
  describe('initialize', () => {
    test('should initialize Firebase with credentials from file', async () => {
      // Setup
      const mockRequire = jest.fn(() => ({ type: 'service_account' }));
      require.cache['../path/to/service-account.json'] = { exports: mockRequire() };
      
      // Execute
      await firebaseService.initialize();
      
      // Verify
      expect(firebaseService.db).not.toBeNull();
    });
  });
  
  describe('addDocument', () => {
    test('should add a document with timestamps', async () => {
      // Setup
      const mockData = { name: 'Test Document' };
      const mockDocRef = { id: 'doc123' };
      mockAdd.mockResolvedValueOnce(mockDocRef);
      
      // Execute
      const result = await firebaseService.addDocument('test-collection', mockData);
      
      // Verify
      expect(mockCollection).toHaveBeenCalledWith('test-collection');
      expect(mockAdd).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'doc123');
      expect(result).toHaveProperty('name', 'Test Document');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('updated_at');
    });
    
    test('should handle errors when adding documents', async () => {
      // Setup
      mockAdd.mockRejectedValueOnce(new Error('Database error'));
      
      // Execute & Verify
      await expect(
        firebaseService.addDocument('test-collection', { name: 'Test' })
      ).rejects.toThrow('Failed to add document to test-collection');
    });
  });
  
  describe('getDocument', () => {
    test('should get a document by ID', async () => {
      // Setup
      const mockDocData = { name: 'Test Document', createdAt: new Date() };
      mockGet.mockResolvedValueOnce({
        exists: true,
        id: 'doc123',
        data: () => mockDocData
      });
      
      // Execute
      const result = await firebaseService.getDocument('test-collection', 'doc123');
      
      // Verify
      expect(mockCollection).toHaveBeenCalledWith('test-collection');
      expect(mockDoc).toHaveBeenCalledWith('doc123');
      expect(result).toEqual({ id: 'doc123', ...mockDocData });
    });
    
    test('should return null when document does not exist', async () => {
      // Setup
      mockGet.mockResolvedValueOnce({ exists: false });
      
      // Execute
      const result = await firebaseService.getDocument('test-collection', 'non-existent');
      
      // Verify
      expect(result).toBeNull();
    });
  });
  
  describe('updateDocument', () => {
    test('should update a document with timestamp', async () => {
      // Setup
      const mockData = { name: 'Updated Document' };
      mockUpdate.mockResolvedValueOnce({});
      
      // Execute
      const result = await firebaseService.updateDocument('test-collection', 'doc123', mockData);
      
      // Verify
      expect(mockCollection).toHaveBeenCalledWith('test-collection');
      expect(mockDoc).toHaveBeenCalledWith('doc123');
      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual({ success: true, id: 'doc123' });
    });
  });
  
  describe('executeQuery', () => {
    test('should execute a query and return results', async () => {
      // Setup
      const mockQueryFn = jest.fn(() => ({ get: mockGet }));
      const mockDocs = [
        { id: 'doc1', data: () => ({ name: 'Document 1' }) },
        { id: 'doc2', data: () => ({ name: 'Document 2' }) }
      ];
      mockGet.mockResolvedValueOnce({ docs: mockDocs });
      
      // Execute
      const results = await firebaseService.executeQuery(mockQueryFn, 'test-query', { skipCache: true });
      
      // Verify
      expect(mockQueryFn).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: 'doc1', name: 'Document 1' });
      expect(results[1]).toEqual({ id: 'doc2', name: 'Document 2' });
    });
    
    test('should return cached results if available', async () => {
      // Setup
      const mockQueryFn = jest.fn(() => ({ get: mockGet }));
      const cachedData = [{ id: 'cached', name: 'Cached Document' }];
      
      // Add item to cache
      firebaseService.queryCache = new Map();
      firebaseService.queryCache.set('test-query', {
        data: cachedData,
        timestamp: Date.now()
      });
      
      // Execute
      const results = await firebaseService.executeQuery(mockQueryFn, 'test-query');
      
      // Verify
      expect(mockQueryFn).not.toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
      expect(results).toEqual(cachedData);
    });
  });
  
  describe('executeBatch', () => {
    test('should execute a batch of operations', async () => {
      // Setup
      const operations = [
        { collection: 'clients', type: 'set', data: { name: 'Client 1' } },
        { collection: 'caregivers', type: 'update', id: 'cg1', data: { status: 'active' } },
        { collection: 'schedules', type: 'delete', id: 'sch1' }
      ];
      mockBatchCommit.mockResolvedValueOnce({});
      
      // Execute
      const result = await firebaseService.executeBatch(operations);
      
      // Verify
      expect(mockBatch).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(result).toEqual({ success: true, count: 3 });
    });
  });
});

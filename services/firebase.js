/**
 * Firebase Service
 * Handles all interactions with the Firebase database with improved security and performance
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore'); // FieldValue removed
// path removed
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class FirebaseService {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize the Firebase app
   * @param {Object} options - Optional configuration overrides
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.db) {
      return;
    }
    
    try {
      let serviceAccount; // This variable will hold the loaded service account JSON
      
      // let serviceAccount; // This was the duplicate line, now removed.
      const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const firebaseServiceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;

      if (googleAppCreds) {
        // GOOGLE_APPLICATION_CREDENTIALS can be a path to the file or the JSON content itself.
        // The admin SDK handles this automatically if 'credential' is given 'applicationDefault()'.
        // However, to be explicit and align with 'cert()', we'll try to load if it's a path.
        // For this refactor, we'll assume GOOGLE_APPLICATION_CREDENTIALS is a path if set.
        if (fs.existsSync(googleAppCreds)) {
          try {
            serviceAccount = require(googleAppCreds);
            console.log('Using Firebase credentials from GOOGLE_APPLICATION_CREDENTIALS path.');
          } catch (e) {
            console.error(`Error loading service account from GOOGLE_APPLICATION_CREDENTIALS path ${googleAppCreds}: ${e.message}`);
            // Fall through to try base64 or fail
          }
        } else {
            // If it's not a valid path, it might be the JSON content itself (less common for this var)
            // or SDK handles it, or it's an error. For cert(), we need the object.
            // This path is less robust; preferring base64 if direct path fails.
            console.warn(`GOOGLE_APPLICATION_CREDENTIALS path "${googleAppCreds}" does not exist. Attempting other methods.`);
        }
      }

      if (!serviceAccount && firebaseServiceAccountBase64) {
        try {
          serviceAccount = JSON.parse(Buffer.from(firebaseServiceAccountBase64, 'base64').toString('utf-8'));
          console.log('Using Firebase credentials from FIREBASE_SERVICE_ACCOUNT_JSON_BASE64.');
        } catch (e) {
          console.error(`Error parsing FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: ${e.message}`);
          // Fall through to fail
        }
      }
      
      if (!serviceAccount) {
        // If neither GOOGLE_APPLICATION_CREDENTIALS (as a loadable path) nor FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is provided and valid,
        // then we cannot initialize.
        // The old code also checked for process.env.FIREBASE_SERVICE_ACCOUNT (raw JSON string)
        // and process.env.FIREBASE_SERVICE_ACCOUNT_PATH.
        // We are simplifying to the two more standard/secure methods.
        // The previous direct fallback to 'carewurx-firebase-adminsdk-fbsvc-e7fcc4b08e.json' is removed.
        throw new Error('Firebase Admin SDK credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS (path) or FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (base64 JSON content).');
      }
      
      // Configure Firebase app
      const firebaseConfig = {
        credential: cert(serviceAccount), // cert() expects the service account JSON object
        ...options
      };
      
      initializeApp(firebaseConfig);
      this.db = getFirestore();
      
      // Set up the cache for query results
      this.queryCache = new Map();
      this.cacheExpiryMs = 60 * 1000; // 1 minute cache expiry
      
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add a document to a collection with proper error handling
   * @param {string} collectionName - The name of the collection
   * @param {Object} data - The data to add
   * @returns {Promise<Object>} The added document
   * @throws {Error} If the operation fails
   */
  async addDocument(collectionName, data) {
    try {
      // Add created_at timestamp if not present
      const documentData = {
        ...data,
        created_at: data.created_at || Timestamp.now(),
        updated_at: Timestamp.now()
      };
      
      const docRef = await this.db.collection(collectionName).add(documentData);
      return { id: docRef.id, ...documentData };
    } catch (error) {
      console.error(`Error adding document to ${collectionName}:`, error);
      throw new Error(`Failed to add document to ${collectionName}: ${error.message}`);
    }
  }

  /**
   * Get a document from a collection by ID with proper error handling
   * @param {string} collectionName - The name of the collection
   * @param {string} docId - The ID of the document
   * @returns {Promise<Object>} The document data or null if not found
   * @throws {Error} If the operation fails for reasons other than document not found
   */
  async getDocument(collectionName, docId) {
    try {
      const doc = await this.db.collection(collectionName).doc(docId).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      throw new Error(`Failed to get document ${docId} from ${collectionName}: ${error.message}`);
    }
  }

  /**
   * Update a document in a collection with proper error handling
   * @param {string} collectionName - The name of the collection
   * @param {string} docId - The ID of the document
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} The result with success status
   * @throws {Error} If the operation fails
   */
  async updateDocument(collectionName, docId, data) {
    try {
      // Add updated_at timestamp
      const updateData = {
        ...data,
        updated_at: Timestamp.now()
      };
      
      await this.db.collection(collectionName).doc(docId).update(updateData);
      
      // Invalidate cache for this collection
      this.invalidateCache(collectionName);
      
      return { success: true, id: docId };
    } catch (error) {
      console.error(`Error updating document ${docId} in ${collectionName}:`, error);
      throw new Error(`Failed to update document ${docId} in ${collectionName}: ${error.message}`);
    }
  }

  /**
   * Delete a document from a collection
   * @param {string} collectionName - The name of the collection
   * @param {string} docId - The ID of the document
   * @returns {Promise<void>}
   */
  async deleteDocument(collectionName, docId) {
    await this.db.collection(collectionName).doc(docId).delete();
  }

  // Schedule specific methods
  async addSchedule(schedule) { return this.addDocument('schedules', schedule); }
  async getSchedule(scheduleId) { return this.getDocument('schedules', scheduleId); }
  async updateSchedule(scheduleId, data) { return this.updateDocument('schedules', scheduleId, data); }
  async deleteSchedule(scheduleId) { return this.deleteDocument('schedules', scheduleId); }
  
  async getSchedulesInDateRange(startDate, endDate) {
    const snapshot = await this.db.collection('schedules')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getSchedulesByClientId(clientId) {
    const snapshot = await this.db.collection('schedules')
      .where('client_id', '==', clientId)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getSchedulesByCaregiverId(caregiverId) {
    const snapshot = await this.db.collection('schedules')
      .where('caregiver_id', '==', caregiverId)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getSchedulesByClientIdInDateRange(clientId, startDate, endDate) {
    const snapshot = await this.db.collection('schedules')
      .where('client_id', '==', clientId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getSchedulesByCaregiverIdInDateRange(caregiverId, startDate, endDate) {
    const snapshot = await this.db.collection('schedules')
      .where('caregiver_id', '==', caregiverId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getSchedulesByCaregiverAndDate(caregiverId, date) {
    const snapshot = await this.db.collection('schedules')
      .where('caregiver_id', '==', caregiverId)
      .where('date', '==', date)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Execute a batch of write operations as a single atomic unit
   * @param {Array<Object>} operations - Array of operations to execute
   * @returns {Promise<Object>} The result with success status
   * @throws {Error} If the operation fails
   */
  async executeBatch(operations) {
    try {
      const batch = this.db.batch();
      
      for (const op of operations) {
        const docRef = this.db.collection(op.collection).doc(op.id || this.db.collection(op.collection).doc().id);
        
        if (op.type === 'set') {
          batch.set(docRef, {
            ...op.data,
            updated_at: Timestamp.now(),
            created_at: op.data.created_at || Timestamp.now()
          }, { merge: op.merge || false });
        } else if (op.type === 'update') {
          batch.update(docRef, {
            ...op.data,
            updated_at: Timestamp.now()
          });
        } else if (op.type === 'delete') {
          batch.delete(docRef);
        }
      }
      
      await batch.commit();
      
      // Invalidate cache for affected collections
      const collections = [...new Set(operations.map(op => op.collection))];
      collections.forEach(collection => this.invalidateCache(collection));
      
      return { success: true, count: operations.length };
    } catch (error) {
      console.error('Error executing batch operations:', error);
      throw new Error(`Failed to execute batch operations: ${error.message}`);
    }
  }
  
  /**
   * Execute a query with caching
   * @param {Function} queryFn - Function that returns a Firestore query
   * @param {string} cacheKey - Key to use for caching
   * @param {Object} options - Options for the query
   * @returns {Promise<Array<Object>>} The query results
   */
  async executeQuery(queryFn, cacheKey, options = {}) {
    // Check cache first if caching is enabled
    if (!options.skipCache && this.queryCache.has(cacheKey)) {
      const cachedItem = this.queryCache.get(cacheKey);
      if (Date.now() - cachedItem.timestamp < this.cacheExpiryMs) {
        return cachedItem.data;
      }
    }
    
    try {
      const query = queryFn();
      const snapshot = await query.get();
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Cache the results if caching is enabled
      if (!options.skipCache) {
        this.queryCache.set(cacheKey, {
          data: results,
          timestamp: Date.now()
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error executing query:', error);
      throw new Error(`Failed to execute query: ${error.message}`);
    }
  }
  
  /**
   * Invalidate cache for a collection
   * @param {string} collectionName - The name of the collection
   */
  invalidateCache(collectionName) {
    // Remove all cache entries that start with the collection name
    for (const key of this.queryCache.keys()) {
      if (key.startsWith(collectionName)) {
        this.queryCache.delete(key);
      }
    }
  }
  
  // Client specific methods
  async addClient(client) { return this.addDocument('clients', client); }
  async getClient(clientId) { return this.getDocument('clients', clientId); }
  async updateClient(clientId, data) { return this.updateDocument('clients', clientId, data); }
  
  async getAllClients(options = {}) {
    const cacheKey = 'clients_all';
    return this.executeQuery(
      () => this.db.collection('clients').orderBy('name'),
      cacheKey,
      options
    );
  }
  
  async searchClients(name, options = {}) {
    const cacheKey = `clients_search_${name}`;
    return this.executeQuery(
      () => this.db.collection('clients')
        .where('name', '>=', name)
        .where('name', '<=', name + '\uf8ff')
        .orderBy('name'),
      cacheKey,
      options
    );
  }
  
  // Caregiver specific methods
  async addCaregiver(caregiver) { return this.addDocument('caregivers', caregiver); }
  async getCaregiver(caregiverId) { return this.getDocument('caregivers', caregiverId); }
  async updateCaregiver(caregiverId, data) { return this.updateDocument('caregivers', caregiverId, data); }
  
  async getAllCaregivers(options = {}) {
    const cacheKey = 'caregivers_all';
    return this.executeQuery(
      () => this.db.collection('caregivers').orderBy('name'),
      cacheKey,
      options
    );
  }
  
  async searchCaregivers(name, options = {}) {
    const cacheKey = `caregivers_search_${name}`;
    return this.executeQuery(
      () => this.db.collection('caregivers')
        .where('name', '>=', name)
        .where('name', '<=', name + '\uf8ff')
        .orderBy('name'),
      cacheKey,
      options
    );
  }
  
  async getCaregiverAvailability(caregiverId) {
    try {
      const doc = await this.db.collection('caregiver_availability').doc(caregiverId).get();
      if (doc.exists) {
        return doc.data().availability;
      }
      
      // If not found, return null instead of a misleading default
      console.log(`No availability found for caregiver ${caregiverId}`);
      return null;
    } catch (error) {
      console.error('Error getting caregiver availability:', error);
      throw new Error(`Failed to get availability for caregiver ${caregiverId}: ${error.message}`);
    }
  }
  
  async updateCaregiverAvailability(caregiverId, availabilityData) {
    // Create or update the availability document
    try {
      await this.db.collection('caregiver_availability').doc(caregiverId).set({
        caregiver_id: caregiverId,
        availability: availabilityData,
        updated_at: new Date().toISOString()
      }, { merge: true });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating caregiver availability:', error);
      throw error;
    }
  }

  // User specific methods
  async getUserInfo(userId) {
    // This is a placeholder. In a real app, you might have a 'users' collection
    return { id: userId, name: 'Admin User', role: 'admin' };
  }

  // Notification specific methods
  async addNotification(notification) { return this.addDocument('notifications', notification); }
  
  async getNotifications(options = {}) {
    try {
      // Build a query with proper ordering at the database level
      let query = this.db.collection('notifications');
      
      // Apply filters
      if (options.read === false) {
        query = query.where('read', '==', false);
      }
      
      if (options.userId) {
        query = query.where('user_id', '==', options.userId);
      }
      
      // Apply sorting at the database level
      query = query.orderBy('timestamp', 'desc');
      
      // Apply limit at the database level
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      // Execute query
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw new Error(`Failed to get notifications: ${error.message}`);
    }
  }
  async updateNotification(notificationId, data) { 
    return this.updateDocument('notifications', notificationId, data); 
  }
  
  async deleteNotification(notificationId) { 
    return this.deleteDocument('notifications', notificationId); 
  }
  
  async markAllNotificationsAsRead(userId) {
    try {
      // Get all unread notifications for user
      const unreadNotifications = await this.executeQuery(
        () => this.db.collection('notifications')
          .where('read', '==', false)
          .where('user_id', '==', userId),
        `notifications_unread_${userId}`,
        { skipCache: true }
      );
      
      // If none found, return early
      if (unreadNotifications.length === 0) {
        return { success: true, count: 0 };
      }
      
      // Create batch operations to update all
      const operations = unreadNotifications.map(notification => ({
        collection: 'notifications',
        id: notification.id,
        type: 'update',
        data: { read: true }
      }));
      
      // Execute batch update
      const result = await this.executeBatch(operations);
      return { success: true, count: unreadNotifications.length };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  // Opportunity specific methods
  async getOpportunities(options = {}) {
    const cacheKey = `opportunities_${JSON.stringify(options)}`;
    
    return this.executeQuery(
      () => {
        let query = this.db.collection('opportunities');
        
        if (options.status) {
          query = query.where('status', '==', options.status);
        }
        
        if (options.type) {
          query = query.where('type', '==', options.type);
        }
        
        // Always order by creation date for consistency
        query = query.orderBy('created_at', 'desc');
        
        if (options.limit) {
          query = query.limit(options.limit);
        }
        
        return query;
      },
      cacheKey,
      options
    );
  }
}

/**
 * Create a FirebaseService instance with singleton pattern
 */
const firebaseService = new FirebaseService();

module.exports = {
  firebaseService,
  FirebaseService // Also export the class for testing with dependency injection
};

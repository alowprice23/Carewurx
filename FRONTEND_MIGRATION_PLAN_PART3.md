# Frontend Migration Plan - Part 3

## Stage 11 (continued): Implement Interactive Schedule Editing

**Implementation (continued):**

```javascript
// Continuing from the previous code...
           <div class="recurring-options" style="display: ${this.scheduleData.recurring ? 'block' : 'none'}">
             <div class="form-group">
               <label for="recurrence_pattern">Recurrence Pattern</label>
               <select id="recurrence_pattern" name="recurrence_pattern">
                 <option value="daily" ${this.scheduleData.recurrence_pattern === 'daily' ? 'selected' : ''}>Daily</option>
                 <option value="weekly" ${this.scheduleData.recurrence_pattern === 'weekly' ? 'selected' : ''}>Weekly</option>
                 <option value="monthly" ${this.scheduleData.recurrence_pattern === 'monthly' ? 'selected' : ''}>Monthly</option>
               </select>
             </div>
             
             <div class="form-group">
               <label for="recurrence_end_date">End Date</label>
               <input type="date" id="recurrence_end_date" name="recurrence_end_date" value="${
                 this.scheduleData.recurrence_end_date ? new Date(this.scheduleData.recurrence_end_date).toISOString().split('T')[0] : ''
               }">
             </div>
           </div>
         </div>
         
         <div class="form-actions">
           <button type="submit" class="save-btn">Save</button>
           <button type="button" class="cancel-btn">Cancel</button>
         </div>
       `;
       
       this.container.appendChild(form);
       
       // Set up event listeners
       this.setupEventListeners();
       
       // Initialize data
       this.initialize();
     }
     
     renderClientOptions() {
       const clientSelect = this.container.querySelector('#client');
       this.clients.forEach(client => {
         const option = document.createElement('option');
         option.value = client.id;
         option.textContent = client.name;
         if (this.scheduleData.client_id === client.id) {
           option.selected = true;
         }
         clientSelect.appendChild(option);
       });
     }
     
     renderCaregiverOptions() {
       const caregiverSelect = this.container.querySelector('#caregiver');
       this.caregivers.forEach(caregiver => {
         const option = document.createElement('option');
         option.value = caregiver.id;
         option.textContent = caregiver.name;
         if (this.scheduleData.caregiver_id === caregiver.id) {
           option.selected = true;
         }
         caregiverSelect.appendChild(option);
       });
     }
     
     setupEventListeners() {
       // Toggle recurring options
       const recurringCheckbox = this.container.querySelector('#recurring');
       const recurringOptions = this.container.querySelector('.recurring-options');
       
       recurringCheckbox.addEventListener('change', () => {
         recurringOptions.style.display = recurringCheckbox.checked ? 'block' : 'none';
       });
       
       // Form submission
       const form = this.container.querySelector('form');
       form.addEventListener('submit', (event) => {
         event.preventDefault();
         this.saveSchedule();
       });
       
       // Cancel button
       const cancelButton = this.container.querySelector('.cancel-btn');
       cancelButton.addEventListener('click', () => {
         this.options.onCancel();
       });
     }
     
     async saveSchedule() {
       try {
         // Get form data
         const form = this.container.querySelector('form');
         const formData = new FormData(form);
         
         // Convert to schedule object
         const scheduleData = {
           ...this.scheduleData, // Keep existing data like ID
           client_id: formData.get('client_id'),
           caregiver_id: formData.get('caregiver_id') || null, // Empty string becomes null
           date: formData.get('date'),
           start_time: formData.get('start_time'),
           end_time: formData.get('end_time'),
           status: formData.get('status'),
           notes: formData.get('notes'),
           recurring: formData.get('recurring') === 'on',
         };
         
         // Add recurring data if checked
         if (scheduleData.recurring) {
           scheduleData.recurrence_pattern = formData.get('recurrence_pattern');
           scheduleData.recurrence_end_date = formData.get('recurrence_end_date') || null;
         } else {
           scheduleData.recurrence_pattern = null;
           scheduleData.recurrence_end_date = null;
         }
         
         // Add client and caregiver names for display purposes
         const selectedClient = this.clients.find(c => c.id === scheduleData.client_id);
         const selectedCaregiver = this.caregivers.find(c => c.id === scheduleData.caregiver_id);
         
         scheduleData.client_name = selectedClient ? selectedClient.name : '';
         scheduleData.caregiver_name = selectedCaregiver ? selectedCaregiver.name : '';
         
         // Save the schedule
         let result;
         if (scheduleData.id) {
           // Update existing schedule
           result = await window.electronAPI.updateSchedule(scheduleData.id, scheduleData);
         } else {
           // Create new schedule
           result = await window.electronAPI.createSchedule(scheduleData);
         }
         
         if (result.success) {
           this.options.onSave(result.schedule || scheduleData);
         } else {
           this.showError(result.error || 'Failed to save schedule.');
         }
       } catch (error) {
         console.error('Error saving schedule:', error);
         this.showError(error.message);
       }
     }
     
     showError(message) {
       // Check if error element exists, create if not
       let errorElement = this.container.querySelector('.error-message');
       if (!errorElement) {
         errorElement = document.createElement('div');
         errorElement.className = 'error-message';
         this.container.querySelector('.form-title').after(errorElement);
       }
       
       errorElement.textContent = message;
       errorElement.style.display = 'block';
       
       // Auto-hide after 5 seconds
       setTimeout(() => {
         errorElement.style.display = 'none';
       }, 5000);
     }
   }

   module.exports = ScheduleEditor;
   ```

2. Update the IPC handler in `main.js` to support schedule operations:
   ```javascript
   // Add these IPC handlers to main.js
   
   // Create a new schedule
   ipcMain.handle('create-schedule', async (event, scheduleData) => {
     try {
       const newSchedule = await firebaseService.createScheduleEntry(scheduleData);
       
       // If recurring, generate the recurring instances
       if (scheduleData.recurring && scheduleData.recurrence_pattern) {
         await generateRecurringSchedules(newSchedule);
       }
       
       return { success: true, schedule: newSchedule };
     } catch (error) {
       console.error('Error creating schedule:', error);
       return { success: false, error: error.message };
     }
   });
   
   // Update an existing schedule
   ipcMain.handle('update-schedule', async (event, scheduleId, updateData) => {
     try {
       await firebaseService.updateSchedule(scheduleId, updateData);
       
       // If updating a recurring schedule, handle recurrence changes
       if (updateData.recurring !== undefined) {
         if (updateData.recurring) {
           // Schedule is now recurring, generate instances
           if (updateData.recurrence_pattern) {
             const scheduleWithId = { id: scheduleId, ...updateData };
             await generateRecurringSchedules(scheduleWithId);
           }
         } else {
           // Schedule is no longer recurring, remove future instances
           await removeFutureRecurrences(scheduleId);
         }
       }
       
       return { success: true };
     } catch (error) {
       console.error('Error updating schedule:', error);
       return { success: false, error: error.message };
     }
   });
   
   // Helper function to generate recurring schedules
   async function generateRecurringSchedules(baseSchedule) {
     try {
       const { recurrence_pattern, recurrence_end_date } = baseSchedule;
       if (!recurrence_pattern) return;
       
       const startDate = new Date(baseSchedule.date);
       const endDate = recurrence_end_date ? new Date(recurrence_end_date) : null;
       
       // If no end date, generate for the next 3 months max
       const maxEndDate = new Date(startDate);
       maxEndDate.setMonth(maxEndDate.getMonth() + 3);
       
       const finalEndDate = endDate && endDate < maxEndDate ? endDate : maxEndDate;
       
       // Generate recurring instances
       const recurringSchedules = [];
       
       // Start from the day after the base schedule
       const currentDate = new Date(startDate);
       currentDate.setDate(currentDate.getDate() + 1);
       
       while (currentDate <= finalEndDate) {
         // Check if we should create an instance on this date
         let shouldCreate = false;
         
         switch (recurrence_pattern) {
           case 'daily':
             shouldCreate = true;
             break;
           case 'weekly':
             shouldCreate = currentDate.getDay() === startDate.getDay();
             break;
           case 'monthly':
             shouldCreate = currentDate.getDate() === startDate.getDate();
             break;
         }
         
         if (shouldCreate) {
           // Create a new schedule instance for this date
           const newSchedule = { ...baseSchedule };
           delete newSchedule.id; // Remove ID to create a new entry
           
           newSchedule.date = currentDate.toISOString().split('T')[0];
           newSchedule.parent_schedule_id = baseSchedule.id;
           
           recurringSchedules.push(newSchedule);
         }
         
         // Move to the next day
         currentDate.setDate(currentDate.getDate() + 1);
       }
       
       // Batch create the recurring schedules
       for (const schedule of recurringSchedules) {
         await firebaseService.createScheduleEntry(schedule);
       }
       
       console.log(`Generated ${recurringSchedules.length} recurring schedules`);
     } catch (error) {
       console.error('Error generating recurring schedules:', error);
       throw error;
     }
   }
   
   // Helper function to remove future recurrences
   async function removeFutureRecurrences(parentScheduleId) {
     try {
       // Get all schedules with this parent ID
       const schedules = await firebaseService.getSchedulesByParentId(parentScheduleId);
       
       // Get today's date for comparison
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       
       // Filter to future schedules only
       const futureSchedules = schedules.filter(schedule => {
         const scheduleDate = new Date(schedule.date);
         return scheduleDate > today;
       });
       
       // Delete each future schedule
       for (const schedule of futureSchedules) {
         await firebaseService.deleteSchedule(schedule.id);
       }
       
       console.log(`Removed ${futureSchedules.length} future recurring schedules`);
     } catch (error) {
       console.error('Error removing future recurrences:', error);
       throw error;
     }
   }
   ```

**Potential Issues:**
1. **Complex Recurrence Rules:** Implementing more sophisticated recurrence patterns could be challenging.
   - **Workaround:** Start with basic daily/weekly/monthly patterns and expand later if needed.

2. **Timezone Edge Cases:** Handling recurring schedules across daylight saving time boundaries could cause issues.
   - **Workaround:** Store dates in local timezone but include timezone info in the stored date.

3. **Bulk Operations:** Creating many recurring schedules could impact performance.
   - **Workaround:** Implement batch operations or background processing for large schedule sets.

## Stage 12: Implement Opportunity Management System

**Objective:** Create an interface for users to view and act on scheduling opportunities identified by the scanner.

**Implementation:**
1. Add methods to the Firebase service to handle opportunities:
   ```javascript
   // In firebase.js, add these methods
   
   async createOpportunity(opportunityData) {
     try {
       const docRef = await db.collection('opportunities').add({
         ...opportunityData,
         created: admin.firestore.FieldValue.serverTimestamp(),
         status: 'pending' // pending, accepted, rejected
       });
       console.log(`Opportunity created with ID: ${docRef.id}`);
       return { id: docRef.id, ...opportunityData };
     } catch (error) {
       console.error("Error creating opportunity:", error);
       throw error;
     }
   },
   
   async getOpportunities(status = null) {
     try {
       let query = db.collection('opportunities');
       
       if (status) {
         query = query.where('status', '==', status);
       }
       
       // Sort by creation date, newest first
       query = query.orderBy('created', 'desc');
       
       const snapshot = await query.get();
       const opportunities = [];
       
       snapshot.forEach(doc => {
         opportunities.push({ id: doc.id, ...doc.data() });
       });
       
       return opportunities;
     } catch (error) {
       console.error("Error getting opportunities:", error);
       throw error;
     }
   },
   
   async updateOpportunity(opportunityId, updateData) {
     try {
       const opportunityRef = db.collection('opportunities').doc(opportunityId);
       await opportunityRef.update({
         ...updateData,
         updated: admin.firestore.FieldValue.serverTimestamp()
       });
       console.log(`Opportunity ${opportunityId} updated successfully`);
       return { success: true };
     } catch (error) {
       console.error("Error updating opportunity:", error);
       throw error;
     }
   },
   
   async updateOpportunities(opportunities) {
     try {
       // Create a batch to update all opportunities at once
       const batch = db.batch();
       
       // Prepare each opportunity update
       for (const opportunity of opportunities) {
         // If it's a new opportunity, create it
         if (!opportunity.id) {
           const newDocRef = db.collection('opportunities').doc();
           batch.set(newDocRef, {
             ...opportunity,
             created: admin.firestore.FieldValue.serverTimestamp(),
             status: 'pending'
           });
         } else {
           // Otherwise, update existing
           const docRef = db.collection('opportunities').doc(opportunity.id);
           batch.update(docRef, {
             ...opportunity,
             updated: admin.firestore.FieldValue.serverTimestamp()
           });
         }
       }
       
       // Commit the batch
       await batch.commit();
       console.log(`Updated ${opportunities.length} opportunities`);
       return { success: true };
     } catch (error) {
       console.error("Error updating opportunities:", error);
       throw error;
     }
   }
   ```

2. Create an opportunity viewer component in `app/components/opportunity-viewer.js`:
   ```javascript
   class OpportunityViewer {
     constructor(containerElement, options = {}) {
       this.container = containerElement;
       this.options = {
         onAccept: options.onAccept || (() => {}),
         onReject: options.onReject || (() => {}),
         ...options
       };
       this.opportunities = [];
       this.currentFilter = 'pending'; // 'pending', 'all', 'accepted', 'rejected'
       
       this.render();
     }
     
     async initialize() {
       await this.loadOpportunities();
     }
     
     async loadOpportunities() {
       try {
         // Show loading indicator
         this.showLoading(true);
         
         // Get opportunities based on current filter
         const status = this.currentFilter === 'all' ? null : this.currentFilter;
         this.opportunities = await window.electronAPI.getOpportunities(status);
         
         // Render the opportunities
         this.renderOpportunities();
       } catch (error) {
         console.error('Error loading opportunities:', error);
         this.showError('Failed to load opportunities: ' + error.message);
       } finally {
         this.showLoading(false);
       }
     }
     
     render() {
       // Create basic structure
       this.container.innerHTML = '';
       this.container.classList.add('opportunity-viewer');
       
       // Create header with filters
       const header = document.createElement('div');
       header.className = 'viewer-header';
       header.innerHTML = `
         <h3>Scheduling Opportunities</h3>
         <div class="filter-controls">
           <label>Filter:</label>
           <select class="status-filter">
             <option value="pending" selected>Pending</option>
             <option value="all">All</option>
             <option value="accepted">Accepted</option>
             <option value="rejected">Rejected</option>
           </select>
           <button class="refresh-btn">Refresh</button>
         </div>
       `;
       this.container.appendChild(header);
       
       // Create loading indicator
       const loadingIndicator = document.createElement('div');
       loadingIndicator.className = 'loading-indicator';
       loadingIndicator.textContent = 'Loading...';
       loadingIndicator.style.display = 'none';
       this.container.appendChild(loadingIndicator);
       
       // Create error message area
       const errorMessage = document.createElement('div');
       errorMessage.className = 'error-message';
       errorMessage.style.display = 'none';
       this.container.appendChild(errorMessage);
       
       // Create opportunities container
       const opportunitiesContainer = document.createElement('div');
       opportunitiesContainer.className = 'opportunities-container';
       this.container.appendChild(opportunitiesContainer);
       
       // Setup event listeners
       this.setupEventListeners();
       
       // Initialize data
       this.initialize();
     }
     
     renderOpportunities() {
       const container = this.container.querySelector('.opportunities-container');
       container.innerHTML = '';
       
       if (this.opportunities.length === 0) {
         const emptyMessage = document.createElement('div');
         emptyMessage.className = 'empty-message';
         emptyMessage.textContent = 'No opportunities found.';
         container.appendChild(emptyMessage);
         return;
       }
       
       // Group opportunities by type
       const groupedOpportunities = {};
       this.opportunities.forEach(opportunity => {
         const type = opportunity.type || 'other';
         if (!groupedOpportunities[type]) {
           groupedOpportunities[type] = [];
         }
         groupedOpportunities[type].push(opportunity);
       });
       
       // Render each group
       Object.entries(groupedOpportunities).forEach(([type, opportunities]) => {
         // Create group header
         const groupHeader = document.createElement('h4');
         groupHeader.textContent = this.formatGroupTitle(type);
         container.appendChild(groupHeader);
         
         // Create opportunity cards
         opportunities.forEach(opportunity => {
           const card = this.createOpportunityCard(opportunity);
           container.appendChild(card);
         });
       });
     }
     
     createOpportunityCard(opportunity) {
       const card = document.createElement('div');
       card.className = `opportunity-card status-${opportunity.status}`;
       card.dataset.id = opportunity.id;
       
       // Format the card content based on opportunity type
       let cardContent = '';
       
       switch (opportunity.type) {
         case 'unassigned_client':
           cardContent = `
             <div class="card-header">
               <h5>Unassigned Client Opportunity</h5>
               <span class="status-badge">${opportunity.status}</span>
             </div>
             <div class="card-body">
               <p><strong>Client:</strong> ${opportunity.client.name}</p>
               <p><strong>Needs:</strong> ${opportunity.client.needs_driver ? 'Driver Required' : 'No Driver Needed'}</p>
               <p><strong>Potential Caregivers:</strong> ${opportunity.potentialCaregivers.length}</p>
               <ul class="caregiver-list">
                 ${opportunity.potentialCaregivers.map(cg => `
                   <li>${cg.name} ${cg.is_driver ? '(Driver)' : ''}</li>
                 `).join('')}
               </ul>
             </div>
           `;
           break;
           
         default:
           cardContent = `
             <div class="card-header">
               <h5>Scheduling Opportunity</h5>
               <span class="status-badge">${opportunity.status}</span>
             </div>
             <div class="card-body">
               <p>Generic opportunity (${opportunity.type})</p>
             </div>
           `;
       }
       
       // Add actions if pending
       if (opportunity.status === 'pending') {
         cardContent += `
           <div class="card-actions">
             <button class="accept-btn" data-id="${opportunity.id}">Accept</button>
             <button class="reject-btn" data-id="${opportunity.id}">Reject</button>
           </div>
         `;
       }
       
       card.innerHTML = cardContent;
       
       // Add event listeners for buttons
       if (opportunity.status === 'pending') {
         const acceptBtn = card.querySelector('.accept-btn');
         const rejectBtn = card.querySelector('.reject-btn');
         
         acceptBtn.addEventListener('click', () => this.acceptOpportunity(opportunity));
         rejectBtn.addEventListener('click', () => this.rejectOpportunity(opportunity));
       }
       
       return card;
     }
     
     formatGroupTitle(type) {
       switch (type) {
         case 'unassigned_client':
           return 'Unassigned Clients';
         default:
           return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
       }
     }
     
     setupEventListeners() {
       // Filter change handler
       const filterSelect = this.container.querySelector('.status-filter');
       filterSelect.addEventListener('change', () => {
         this.currentFilter = filterSelect.value;
         this.loadOpportunities();
       });
       
       // Refresh button handler
       const refreshBtn = this.container.querySelector('.refresh-btn');
       refreshBtn.addEventListener('click', () => {
         this.loadOpportunities();
       });
     }
     
     async acceptOpportunity(opportunity) {
       try {
         this.showLoading(true);
         
         // Update opportunity status
         const result = await window.electronAPI.updateOpportunity(opportunity.id, {
           status: 'accepted'
         });
         
         if (result.success) {
           // Call the accept handler with the opportunity
           await this.options.onAccept(opportunity);
           
           // Reload opportunities
           await this.loadOpportunities();
         } else {
           this.showError('Failed to accept opportunity: ' + result.error);
         }
       } catch (error) {
         console.error('Error accepting opportunity:', error);
         this.showError('Error accepting opportunity: ' + error.message);
       } finally {
         this.showLoading(false);
       }
     }
     
     async rejectOpportunity(opportunity) {
       try {
         this.showLoading(true);
         
         // Update opportunity status
         const result = await window.electronAPI.updateOpportunity(opportunity.id, {
           status: 'rejected'
         });
         
         if (result.success) {
           // Call the reject handler with the opportunity
           await this.options.onReject(opportunity);
           
           // Reload opportunities
           await this.loadOpportunities();
         } else {
           this.showError('Failed to reject opportunity: ' + result.error);
         }
       } catch (error) {
         console.error('Error rejecting opportunity:', error);
         this.showError('Error rejecting opportunity: ' + error.message);
       } finally {
         this.showLoading(false);
       }
     }
     
     showLoading(isLoading) {
       const loadingIndicator = this.container.querySelector('.loading-indicator');
       loadingIndicator.style.display = isLoading ? 'block' : 'none';
     }
     
     showError(message) {
       const errorMessage = this.container.querySelector('.error-message');
       errorMessage.textContent = message;
       errorMessage.style.display = 'block';
       
       // Auto-hide after 5 seconds
       setTimeout(() => {
         errorMessage.style.display = 'none';
       }, 5000);
     }
   }

   module.exports = OpportunityViewer;
   ```

3. Add opportunity-related IPC handlers to `main.js`:
   ```javascript
   // Add these IPC handlers to main.js
   
   // Get opportunities
   ipcMain.handle('get-opportunities', async (event, status) => {
     try {
       const opportunities = await firebaseService.getOpportunities(status);
       return opportunities;
     } catch (error) {
       console.error('Error getting opportunities:', error);
       return [];
     }
   });
   
   // Update opportunity
   ipcMain.handle('update-opportunity', async (event, opportunityId, updateData) => {
     try {
       await firebaseService.updateOpportunity(opportunityId, updateData);
       
       // If accepting an unassigned client opportunity, create a schedule
       if (updateData.status === 'accepted' && updateData.type === 'unassigned_client') {
         // Get the full opportunity data
         const opportunities = await firebaseService.getOpportunities();
         const opportunity = opportunities.find(o => o.id === opportunityId);
         
         if (opportunity && opportunity.client && opportunity.selectedCaregiver) {
           // Create a new schedule entry
           const scheduleData = {
             client_id: opportunity.client.id,
             client_name: opportunity.client.name,
             caregiver_id: opportunity.selectedCaregiver.id,
             caregiver_name: opportunity.selectedCaregiver.name,
             date: new Date().toISOString().split('T')[0], // Today's date
             start_time: '09:00', // Default time
             end_time: '17:00', // Default time
             status: 'pending',
             notes: `Created from opportunity ${opportunityId}`
           };
           
           await firebaseService.createScheduleEntry(scheduleData);
         }
       }
       
       return { success: true };
     } catch (error) {
       console.error('Error updating opportunity:', error);
       return { success: false, error: error.message };
     }
   });
   ```

**Potential Issues:**
1. **Data Structure Complexity:** Opportunity data structure might get complex over time.
   - **Workaround:** Use a flexible schema design and implement versioning.

2. **Manual vs. Automated Actions:** Balance between manual approval and automatic assignment.
   - **Workaround:** Implement confidence scores and auto-approval for high-confidence matches.

3. **Notification Overload:** Too many opportunities might overwhelm users.
   - **Workaround:** Implement batching, prioritization, and filtering mechanisms.

## Stage 13: Create In-App Notification System

**Objective:** Implement a notification system to alert users about opportunities, schedule changes, and important events.

**Implementation:**
1. Create a notification service in `services/notification-service.js`:
   ```javascript
   const { ipcMain } = require('electron');
   const { firebaseService } = require('./firebase');

   class NotificationService {
     constructor() {
       this.mainWindow = null;
       this.notifications = [];
       this.lastCheckTime = new Date();
       this.checkIntervalId = null;
       this.checkIntervalMinutes = 5;
     }
     
     initialize(mainWindow) {
       this.mainWindow = mainWindow;
       
       // Start periodic checks
       this.startPeriodicChecks();
       
       // Set up IPC handlers
       this.setupIpcHandlers();
     }
     
     startPeriodicChecks() {
       if (this.checkIntervalId) {
         clearInterval(this.checkIntervalId);
       }
       
       // Check immediately
       this.checkForNotifications();
       
       // Then set up interval
       this.checkIntervalId = setInterval(() => {
         this.checkForNotifications();
       }, this.checkIntervalMinutes * 60 * 1000);
     }
     
     stopPeriodicChecks() {
       if (this.checkIntervalId) {
         clearInterval(this.checkIntervalId);
         this.checkIntervalId = null;
       }
     }
     
     setupIpcHandlers() {
       // Get all notifications
       ipcMain.handle('get-notifications', async (event, includeRead = false) => {
         try {
           return await this.getNotifications(includeRead);
         } catch (error) {
           console.error('Error getting notifications:', error);
           return [];
         }
       });
       
       // Mark notification as read
       ipcMain.handle('mark-notification-read', async (event, notificationId, isRead = true) => {
         try {
           await firebaseService.updateNotification(notificationId, { read: isRead });
           return { success: true };
         } catch (error) {
           console.error('Error marking notification as read:', error);
           return { success: false, error: error.message };
         }
       });
       
       // Mark all notifications as read
       ipcMain.handle('mark-all-notifications-read', async () => {
         try {
           const notifications = await this.getNotifications(false);
           
           // Update each notification
           for (const notification of notifications) {
             await firebaseService.updateNotification(notification.id, { read: true });
           }
           
           return { success: true };
         } catch (error) {
           console.error('Error marking all notifications as read:', error);
           return { success: false, error: error.message };
         }
       });
     }
     
     async checkForNotifications() {
       try {
         console.log('Checking for new notifications...');
         
         // Get unread notifications
         const notifications = await this.getNotifications(false);
         
         if (notifications.length > 0) {
           console.log(`Found ${notifications.length} unread notifications`);
           
           // Send to renderer if window exists
           if (this.mainWindow && !this.mainWindow.isDestroyed()) {
             this.mainWindow.webContents.send('new-notifications', notifications);
           }
           
           // Also display system notification for the newest one
           if (notifications.length > 0) {

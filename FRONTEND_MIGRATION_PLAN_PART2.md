# Frontend Migration Plan - Part 2

## Stage 8: Implement Periodic Schedule Scanning

**Objective:** Create a schedule scanning system that runs every 30 minutes to optimize caregiver assignments.

**Implementation:**
1. Create a scheduler service in `services/schedule-scanner.js`:
   ```javascript
   const { firebaseService } = require('./firebase');
   const schedulerService = require('./scheduler');

   class ScheduleScanner {
     constructor() {
       this.intervalId = null;
       this.scanIntervalMinutes = 30;
     }

     start() {
       if (this.intervalId) {
         console.log('Schedule scanner already running');
         return;
       }

       console.log(`Starting schedule scanner (interval: ${this.scanIntervalMinutes} minutes)`);
       
       // Run immediately on start
       this.scanSchedules();
       
       // Then set up interval
       this.intervalId = setInterval(() => {
         this.scanSchedules();
       }, this.scanIntervalMinutes * 60 * 1000);
     }

     stop() {
       if (this.intervalId) {
         clearInterval(this.intervalId);
         this.intervalId = null;
         console.log('Schedule scanner stopped');
       }
     }

     async scanSchedules() {
       console.log('Scanning schedules...');
       try {
         // Get all clients and caregivers
         const clients = await firebaseService.getAllClients();
         const caregivers = await firebaseService.getAllCaregivers();
         
         // Check for opportunities
         const opportunities = this.identifyOpportunities(clients, caregivers);
         
         if (opportunities.length > 0) {
           console.log(`Found ${opportunities.length} scheduling opportunities`);
           
           // Store opportunities for review
           await this.storeOpportunities(opportunities);
           
           // Optionally notify users
           this.notifyAboutOpportunities(opportunities);
         } else {
           console.log('No scheduling opportunities found');
         }
       } catch (error) {
         console.error('Error scanning schedules:', error);
       }
     }

     identifyOpportunities(clients, caregivers) {
       const opportunities = [];
       
       // Find clients without caregivers
       const unassignedClients = clients.filter(client => 
         !client.assigned_caregiver_id || client.assigned_caregiver_id === 'TBD'
       );
       
       // Find caregivers wanting more hours
       const availableCaregivers = caregivers.filter(caregiver => 
         caregiver.wants_more_hours === true
       );
       
       // Find potential matches
       unassignedClients.forEach(client => {
         const potentialCaregivers = availableCaregivers.filter(caregiver => {
           // Check if caregiver meets client requirements
           return this.isCaregiverCompatible(client, caregiver);
         });
         
         if (potentialCaregivers.length > 0) {
           opportunities.push({
             client,
             potentialCaregivers,
             type: 'unassigned_client'
           });
         }
       });
       
       // Additional opportunity types can be added here
       
       return opportunities;
     }

     isCaregiverCompatible(client, caregiver) {
       // Check basic compatibility
       if (client.needs_driver && !caregiver.is_driver) {
         return false;
       }
       
       // Check gender preference
       if (client.gender_preference && 
           client.gender_preference !== caregiver.gender) {
         return false;
       }
       
       // Check schedule compatibility
       // This would require more detailed schedule data
       
       return true;
     }

     async storeOpportunities(opportunities) {
       try {
         // Store in Firebase for later review
         await firebaseService.updateOpportunities(opportunities);
       } catch (error) {
         console.error('Error storing opportunities:', error);
       }
     }

     notifyAboutOpportunities(opportunities) {
       // This could send in-app notifications or emails
       console.log('Notifications would be sent for new opportunities');
     }
   }

   module.exports = new ScheduleScanner();
   ```

2. Update `main.js` to start the schedule scanner on app launch:
   ```javascript
   const scheduleScanner = require('./services/schedule-scanner');

   app.on('ready', async () => {
     createWindow();
     
     // Start the schedule scanner
     scheduleScanner.start();
     
     // Existing code...
   });

   app.on('will-quit', () => {
     // Stop the schedule scanner when the app is closing
     scheduleScanner.stop();
   });
   ```

**Potential Issues:**
1. **Resource Consumption:** Regular scanning might consume resources.
   - **Workaround:** Implement adaptive intervals based on system load and user activity.

2. **Schedule Data Structure:** Need consistent data structures for compatibility checks.
   - **Workaround:** Define clear schemas for client and caregiver schedule data.

3. **Notifications:** Need a way to notify users about opportunities.
   - **Workaround:** Implement a notification system using Electron's native notification API.

## Stage 9: Create Universal Schedule Database Schema

**Objective:** Design and implement a unified database schema for schedules, dates, and times.

**Implementation:**
1. Define a new Firebase collection structure for the universal schedule database:
   ```javascript
   // In firebase.js, add these new methods

   async createScheduleEntry(scheduleData) {
     try {
       // Add validation here
       const docRef = await db.collection('schedules').add({
         ...scheduleData,
         created: admin.firestore.FieldValue.serverTimestamp(),
         updated: admin.firestore.FieldValue.serverTimestamp()
       });
       console.log(`Schedule created with ID: ${docRef.id}`);
       return { id: docRef.id, ...scheduleData };
     } catch (error) {
       console.error("Error creating schedule entry:", error);
       throw error;
     }
   },

   async getSchedulesByClientId(clientId) {
     try {
       const snapshot = await db.collection('schedules')
         .where('client_id', '==', clientId)
         .get();
       
       const schedules = [];
       snapshot.forEach(doc => {
         schedules.push({ id: doc.id, ...doc.data() });
       });
       return schedules;
     } catch (error) {
       console.error("Error getting client schedules:", error);
       throw error;
     }
   },

   async getSchedulesByCaregiverId(caregiverId) {
     try {
       const snapshot = await db.collection('schedules')
         .where('caregiver_id', '==', caregiverId)
         .get();
       
       const schedules = [];
       snapshot.forEach(doc => {
         schedules.push({ id: doc.id, ...doc.data() });
       });
       return schedules;
     } catch (error) {
       console.error("Error getting caregiver schedules:", error);
       throw error;
     }
   },

   async getSchedulesInDateRange(startDate, endDate) {
     try {
       const snapshot = await db.collection('schedules')
         .where('date', '>=', startDate)
         .where('date', '<=', endDate)
         .get();
       
       const schedules = [];
       snapshot.forEach(doc => {
         schedules.push({ id: doc.id, ...doc.data() });
       });
       return schedules;
     } catch (error) {
       console.error("Error getting schedules in date range:", error);
       throw error;
     }
   },

   async updateSchedule(scheduleId, updateData) {
     try {
       const scheduleRef = db.collection('schedules').doc(scheduleId);
       await scheduleRef.update({
         ...updateData,
         updated: admin.firestore.FieldValue.serverTimestamp()
       });
       console.log(`Schedule ${scheduleId} updated successfully`);
       return { success: true };
     } catch (error) {
       console.error("Error updating schedule:", error);
       throw error;
     }
   }
   ```

2. Create a schedule model in `models/schedule.js`:
   ```javascript
   class Schedule {
     constructor(data = {}) {
       this.id = data.id || null;
       this.client_id = data.client_id || null;
       this.client_name = data.client_name || '';
       this.caregiver_id = data.caregiver_id || null;
       this.caregiver_name = data.caregiver_name || '';
       this.date = data.date || null; // Firebase Timestamp or ISO string
       this.start_time = data.start_time || ''; // '09:00'
       this.end_time = data.end_time || ''; // '17:00'
       this.status = data.status || 'pending'; // 'pending', 'confirmed', 'completed', 'cancelled'
       this.notes = data.notes || '';
       this.created = data.created || null;
       this.updated = data.updated || null;
       this.recurring = data.recurring || false;
       this.recurrence_pattern = data.recurrence_pattern || null; // 'daily', 'weekly', 'monthly'
       this.recurrence_end_date = data.recurrence_end_date || null;
     }

     // Calculate duration in hours
     getDuration() {
       if (!this.start_time || !this.end_time) return 0;
       
       const [startHour, startMinute] = this.start_time.split(':').map(Number);
       const [endHour, endMinute] = this.end_time.split(':').map(Number);
       
       const startMinutes = startHour * 60 + startMinute;
       const endMinutes = endHour * 60 + endMinute;
       
       return (endMinutes - startMinutes) / 60;
     }

     // Check if the schedule overlaps with another schedule
     overlaps(otherSchedule) {
       if (this.date.toDate().toDateString() !== otherSchedule.date.toDate().toDateString()) {
         return false;
       }
       
       const [thisStartHour, thisStartMinute] = this.start_time.split(':').map(Number);
       const [thisEndHour, thisEndMinute] = this.end_time.split(':').map(Number);
       const [otherStartHour, otherStartMinute] = otherSchedule.start_time.split(':').map(Number);
       const [otherEndHour, otherEndMinute] = otherSchedule.end_time.split(':').map(Number);
       
       const thisStart = thisStartHour * 60 + thisStartMinute;
       const thisEnd = thisEndHour * 60 + thisEndMinute;
       const otherStart = otherStartHour * 60 + otherStartMinute;
       const otherEnd = otherEndHour * 60 + otherEndMinute;
       
       // Check for overlap
       return (thisStart < otherEnd && thisEnd > otherStart);
     }
   }

   module.exports = Schedule;
   ```

**Potential Issues:**
1. **Schema Migration:** Existing data might need to be migrated to the new schema.
   - **Workaround:** Implement a one-time migration script to convert old format to new.

2. **Data Validation:** Need comprehensive validation for schedule entries.
   - **Workaround:** Create validation utilities and use them consistently in the create/update methods.

3. **Index Performance:** Firebase queries might need proper indexes for performance.
   - **Workaround:** Set up composite indexes for common query patterns like date ranges and client/caregiver filters.

## Stage 10: Implement Calendar View for Schedules

**Objective:** Create a visual calendar interface for viewing and managing schedules.

**Implementation:**
1. Create a new calendar component in `app/components/calendar.js`:
   ```javascript
   // Simple calendar view component for Electron
   class CalendarView {
     constructor(containerElement, options = {}) {
       this.container = containerElement;
       this.options = {
         startHour: options.startHour || 7, // 7 AM
         endHour: options.endHour || 20, // 8 PM
         slotDuration: options.slotDuration || 30, // 30-minute slots
         daysToShow: options.daysToShow || 7, // Show a week by default
         ...options
       };
       this.events = [];
       this.onEventClick = options.onEventClick || (() => {});
       this.onSlotClick = options.onSlotClick || (() => {});
       
       this.render();
     }
     
     setEvents(events) {
       this.events = events;
       this.renderEvents();
     }
     
     render() {
       // Create calendar grid
       this.container.innerHTML = '';
       this.container.classList.add('calendar-container');
       
       // Create header with days
       const header = document.createElement('div');
       header.className = 'calendar-header';
       
       // Add time column header
       const timeHeader = document.createElement('div');
       timeHeader.className = 'time-header';
       timeHeader.textContent = 'Time';
       header.appendChild(timeHeader);
       
       // Add day columns
       const now = new Date();
       for (let i = 0; i < this.options.daysToShow; i++) {
         const date = new Date(now);
         date.setDate(date.getDate() + i);
         
         const dayHeader = document.createElement('div');
         dayHeader.className = 'day-header';
         dayHeader.textContent = date.toLocaleDateString('en-US', { 
           weekday: 'short', 
           month: 'short', 
           day: 'numeric' 
         });
         dayHeader.dataset.date = date.toISOString().split('T')[0];
         header.appendChild(dayHeader);
       }
       
       this.container.appendChild(header);
       
       // Create time grid
       const grid = document.createElement('div');
       grid.className = 'calendar-grid';
       
       // Create time slots
       const slotsPerHour = 60 / this.options.slotDuration;
       const totalHours = this.options.endHour - this.options.startHour;
       const totalSlots = totalHours * slotsPerHour;
       
       for (let i = 0; i < totalSlots; i++) {
         const hour = Math.floor(i / slotsPerHour) + this.options.startHour;
         const minute = (i % slotsPerHour) * this.options.slotDuration;
         
         // Create time label for each hour
         if (minute === 0) {
           const timeLabel = document.createElement('div');
           timeLabel.className = 'time-label';
           timeLabel.textContent = `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
           grid.appendChild(timeLabel);
         }
         
         // Create time slots for each day
         for (let j = 0; j < this.options.daysToShow; j++) {
           const date = new Date(now);
           date.setDate(date.getDate() + j);
           date.setHours(hour, minute, 0, 0);
           
           const slot = document.createElement('div');
           slot.className = 'time-slot';
           slot.dataset.time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
           slot.dataset.date = date.toISOString().split('T')[0];
           slot.dataset.datetime = date.toISOString();
           
           slot.addEventListener('click', () => {
             this.onSlotClick({
               date: date,
               hour,
               minute,
               element: slot
             });
           });
           
           grid.appendChild(slot);
         }
       }
       
       this.container.appendChild(grid);
       this.gridElement = grid;
       
       // Render any existing events
       if (this.events.length > 0) {
         this.renderEvents();
       }
     }
     
     renderEvents() {
       // Clear existing events
       const existingEvents = this.container.querySelectorAll('.calendar-event');
       existingEvents.forEach(element => element.remove());
       
       // Render each event
       this.events.forEach(event => {
         const startDate = new Date(event.start_time);
         const endDate = new Date(event.end_time);
         
         // Check if event is in the current view
         const startDay = startDate.toISOString().split('T')[0];
         const dayElements = this.container.querySelectorAll('.day-header');
         const visibleDays = Array.from(dayElements).map(el => el.dataset.date);
         
         if (!visibleDays.includes(startDay)) {
           return; // Event not in current view
         }
         
         // Find the slot where this event starts
         const startHour = startDate.getHours();
         const startMinute = startDate.getMinutes();
         
         // Calculate event position and height
         const dayIndex = visibleDays.indexOf(startDay);
         const slotHeight = 30; // Height of each 30-minute slot in pixels
         
         const startTime = startHour * 60 + startMinute;
         const endTime = endDate.getHours() * 60 + endDate.getMinutes();
         const durationMinutes = endTime - startTime;
         
         const eventHeight = (durationMinutes / this.options.slotDuration) * slotHeight;
         const eventTop = ((startHour - this.options.startHour) * 60 + startMinute) / this.options.slotDuration * slotHeight;
         
         // Create event element
         const eventElement = document.createElement('div');
         eventElement.className = 'calendar-event';
         eventElement.textContent = event.title || 'Untitled Event';
         eventElement.style.height = `${eventHeight}px`;
         eventElement.style.top = `${eventTop}px`;
         eventElement.style.left = `${(dayIndex + 1) * 100}px`; // +1 for the time column
         eventElement.dataset.eventId = event.id;
         
         if (event.color) {
           eventElement.style.backgroundColor = event.color;
         }
         
         eventElement.addEventListener('click', () => {
           this.onEventClick(event, eventElement);
         });
         
         this.container.appendChild(eventElement);
       });
     }
   }

   module.exports = CalendarView;
   ```

2. Create CSS styles for the calendar in `app/style.css`:
   ```css
   /* Calendar Styles */
   .calendar-container {
     display: flex;
     flex-direction: column;
     height: 100%;
     position: relative;
     font-family: 'Poppins', sans-serif;
   }

   .calendar-header {
     display: flex;
     background-color: #f8f9fa;
     border-bottom: 1px solid #dee2e6;
   }

   .time-header, .day-header {
     flex: 1;
     padding: 10px;
     text-align: center;
     font-weight: 500;
   }

   .time-header {
     flex: 0 0 60px;
   }

   .calendar-grid {
     display: grid;
     grid-template-columns: 60px repeat(7, 1fr);
     grid-auto-rows: 30px;
     flex: 1;
     overflow-y: auto;
   }

   .time-label {
     grid-column: 1;
     padding: 5px;
     text-align: right;
     font-size: 12px;
     color: #6c757d;
   }

   .time-slot {
     border-bottom: 1px solid #f0f0f0;
     border-right: 1px solid #f0f0f0;
     cursor: pointer;
   }

   .time-slot:hover {
     background-color: rgba(0, 123, 255, 0.1);
   }

   .calendar-event {
     position: absolute;
     background-color: #007bff;
     color: white;
     padding: 5px;
     border-radius: 3px;
     overflow: hidden;
     cursor: pointer;
     font-size: 12px;
     width: calc(100% / 8); /* 1/8 for the time column + 7 days */
     box-sizing: border-box;
     margin-right: 2px;
     z-index: 1;
   }

   .calendar-event:hover {
     opacity: 0.9;
   }
   ```

3. Update `app/renderer.js` to initialize the calendar when the schedule tab is selected:
   ```javascript
   // Add calendar initialization code to the existing renderer.js
   const CalendarView = require('./components/calendar');
   let calendarView = null;

   // Modify the existing showView function to handle the schedule view
   function showView(viewName) {
     // Existing code...
     
     switch(viewName) {
       // Existing cases...
       case 'schedule':
         document.querySelector('.chat-panel').style.display = 'none';
         document.querySelector('.main-content').style.display = 'block';
         scheduleTab.classList.add('active');
         initializeCalendarView();
         break;
     }
     
     currentView = viewName;
   }

   // New function to initialize the calendar
   async function initializeCalendarView() {
     dataDisplay.innerHTML = '<h2>Schedule</h2><div id="calendar-container" style="height: 600px;"></div>';
     
     const calendarContainer = document.getElementById('calendar-container');
     
     if (!calendarView) {
       calendarView = new CalendarView(calendarContainer, {
         onEventClick: (event, element) => {
           showEventDetails(event);
         },
         onSlotClick: (slotInfo) => {
           showNewEventForm(slotInfo);
         }
       });
     }
     
     try {
       // Get schedule data for the current view
       const now = new Date();
       const endDate = new Date(now);
       endDate.setDate(endDate.getDate() + 7);
       
       const schedule = await window.electronAPI.getSchedule(
         now.toISOString(),
         endDate.toISOString()
       );
       
       if (schedule.success) {
         const events = schedule.schedule.map(item => ({
           id: item.id,
           title: `${item.client_name} - ${item.caregiver_name || 'Unassigned'}`,
           start_time: new Date(`${item.date}T${item.start_time}`),
           end_time: new Date(`${item.date}T${item.end_time}`),
           color: item.caregiver_id ? '#28a745' : '#ffc107', // Green if assigned, yellow if not
           // Include all original data for reference
           ...item
         }));
         
         calendarView.setEvents(events);
       } else {
         dataDisplay.innerHTML = `<h2>Schedule</h2><p>Error loading schedule: ${schedule.error}</p>`;
       }
     } catch (error) {
       dataDisplay.innerHTML = `<h2>Schedule</h2><p>Error: ${error.message}</p>`;
     }
   }

   // Helper function to show event details when clicked
   function showEventDetails(event) {
     const detailsHTML = `
       <div class="event-details">
         <h3>${event.title}</h3>
         <p><strong>Date:</strong> ${new Date(event.start_time).toLocaleDateString()}</p>
         <p><strong>Time:</strong> ${new Date(event.start_time).toLocaleTimeString()} - ${new Date(event.end_time).toLocaleTimeString()}</p>
         <p><strong>Client:</strong> ${event.client_name}</p>
         <p><strong>Caregiver:</strong> ${event.caregiver_name || 'Unassigned'}</p>
         <p><strong>Status:</strong> ${event.status}</p>
         <div class="button-group">
           <button class="edit-event-btn" data-id="${event.id}">Edit</button>
           <button class="delete-event-btn" data-id="${event.id}">Delete</button>
           ${!event.caregiver_id ? '<button class="assign-caregiver-btn" data-id="' + event.id + '">Assign Caregiver</button>' : ''}
         </div>
       </div>
     `;
     
     // Show in a modal or side panel
     // For simplicity, we'll just replace the calendar temporarily
     document.getElementById('calendar-container').innerHTML = detailsHTML;
     
     // Add event listeners for the buttons
     document.querySelector('.edit-event-btn').addEventListener('click', () => {
       editEvent(event);
     });
     
     document.querySelector('.delete-event-btn').addEventListener('click', () => {
       deleteEvent(event.id);
     });
     
     if (!event.caregiver_id) {
       document.querySelector('.assign-caregiver-btn').addEventListener('click', () => {
         assignCaregiver(event.id);
       });
     }
     
     // Add a back button to return to calendar view
     const backButton = document.createElement('button');
     backButton.textContent = 'Back to Calendar';
     backButton.className = 'back-button';
     backButton.addEventListener('click', () => {
       initializeCalendarView(); // Refresh the calendar
     });
     
     document.querySelector('.event-details').prepend(backButton);
   }

   // More helper functions for calendar operations...
   ```

**Potential Issues:**
1. **Performance with Large Datasets:** Calendar might slow down with many events.
   - **Workaround:** Implement pagination or lazy loading for events.

2. **Browser Compatibility:** Calendar view might have CSS issues in different environments.
   - **Workaround:** Test across platforms and implement fallbacks for Electron's rendering engine.

3. **Time Zone Handling:** Need to handle time zones consistently.
   - **Workaround:** Store all times in UTC and convert to local time only for display.

## Stage 11: Implement Interactive Schedule Editing

**Objective:** Create an interface for users to add, edit, and manage schedules with real-time updates.

**Implementation:**
1. Create a schedule editor component in `app/components/schedule-editor.js`:
   ```javascript
   class ScheduleEditor {
     constructor(containerElement, options = {}) {
       this.container = containerElement;
       this.options = {
         onSave: options.onSave || (() => {}),
         onCancel: options.onCancel || (() => {}),
         ...options
       };
       this.scheduleData = options.scheduleData || {};
       this.clients = [];
       this.caregivers = [];
       
       this.render();
     }
     
     async initialize() {
       try {
         // Load clients and caregivers for the dropdown
         this.clients = await window.electronAPI.getAllClients();
         this.caregivers = await window.electronAPI.getAllCaregivers();
         this.renderClientOptions();
         this.renderCaregiverOptions();
       } catch (error) {
         console.error('Error loading data for schedule editor:', error);
         this.showError('Failed to load clients and caregivers. Please try again.');
       }
     }
     
     render() {
       // Create form for editing schedule
       this.container.innerHTML = '';
       this.container.classList.add('schedule-editor');
       
       const form = document.createElement('form');
       form.className = 'schedule-form';
       
       // Create form fields
       form.innerHTML = `
         <div class="form-title">
           <h3>${this.scheduleData.id ? 'Edit Schedule' : 'New Schedule'}</h3>
         </div>
         
         <div class="form-group">
           <label for="client">Client</label>
           <select id="client" name="client_id" required>
             <option value="">Select Client</option>
             <!-- Client options will be added dynamically -->
           </select>
         </div>
         
         <div class="form-group">
           <label for="caregiver">Caregiver</label>
           <select id="caregiver" name="caregiver_id">
             <option value="">Unassigned</option>
             <!-- Caregiver options will be added dynamically -->
           </select>
         </div>
         
         <div class="form-group">
           <label for="date">Date</label>
           <input type="date" id="date" name="date" required value="${
             this.scheduleData.date ? new Date(this.scheduleData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
           }">
         </div>
         
         <div class="form-row">
           <div class="form-group">
             <label for="start_time">Start Time</label>
             <input type="time" id="start_time" name="start_time" required value="${
               this.scheduleData.start_time || '09:00'
             }">
           </div>
           
           <div class="form-group">
             <label for="end_time">End Time</label>
             <input type="time" id="end_time" name="end_time" required value="${
               this.scheduleData.end_time || '17:00'
             }">
           </div>
         </div>
         
         <div class="form-group">
           <label for="status">Status</label>
           <select id="status" name="status" required>
             <option value="pending" ${this.scheduleData.status === 'pending' ? 'selected' : ''}>Pending</option>
             <option value="confirmed" ${this.scheduleData.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
             <option value="completed" ${this.scheduleData.status === 'completed' ? 'selected' : ''}>Completed</option>
             <option value="cancelled" ${this.scheduleData.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
           </select>
         </div>
         
         <div class="form-group">
           <label for="notes">Notes</label>
           <textarea id="notes" name="notes" rows="3">${this.scheduleData.notes || ''}</textarea>
         </div>
         
         <div class="form-group recurring-section">
           <label>
             <input type="checkbox" id="recurring" name="recurring" ${this.scheduleData.recurring ? 'checked' : ''}>
             Recurring Schedule
           </label>
           
           <div class="recurring-options" style="display: ${this.scheduleData.recurring ? 'block' : 'none'}">
             <div class="form-group">
               <label for="recurrence_pattern">Recurrence Pattern</label>
               <select id="recurrence_pattern" name="recurrence_pattern">
                 <option value="daily" ${this.scheduleData.recurrence_pattern === 'daily' ? 'selected' : ''}>Daily</option>
                 <option value="weekly" ${this.scheduleData.recurrence_pattern === 'weekly' ? 'selected' : ''}>Weekly</option>
                 <option value="monthly" ${this.

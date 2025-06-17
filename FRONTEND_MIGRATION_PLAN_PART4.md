# Frontend Migration Plan - Part 4

## Stage 14: Enhance Renderer Process for Real-Time Updates

**Objective:** Improve the frontend application to handle real-time updates from Firebase and the schedule scanner.

**Implementation:**
1. Create a real-time update service in `app/services/real-time-updates.js`:
   ```javascript
   class RealTimeUpdateService {
     constructor() {
       this.listeners = {
         'opportunities': [],
         'schedules': [],
         'notifications': [],
         'clients': [],
         'caregivers': []
       };
       this.active = false;
     }
     
     initialize() {
       if (this.active) return;
       
       // Set up listeners for IPC events from main process
       window.electronAPI.onNewNotifications((notifications) => {
         this.notifyListeners('notifications', notifications);
       });
       
       window.electronAPI.onOpportunityUpdate((opportunity) => {
         this.notifyListeners('opportunities', [opportunity]);
       });
       
       window.electronAPI.onScheduleUpdate((schedule) => {
         this.notifyListeners('schedules', [schedule]);
       });
       
       window.electronAPI.onClientUpdate((client) => {
         this.notifyListeners('clients', [client]);
       });
       
       window.electronAPI.onCaregiverUpdate((caregiver) => {
         this.notifyListeners('caregivers', [caregiver]);
       });
       
       this.active = true;
       console.log('Real-time update service initialized');
     }
     
     addListener(type, callback) {
       if (!this.listeners[type]) {
         console.error(`Invalid listener type: ${type}`);
         return () => {}; // Return a no-op unsubscribe function
       }
       
       this.listeners[type].push(callback);
       console.log(`Added listener for ${type}, total listeners: ${this.listeners[type].length}`);
       
       // Return an unsubscribe function
       return () => {
         const index = this.listeners[type].indexOf(callback);
         if (index !== -1) {
           this.listeners[type].splice(index, 1);
           console.log(`Removed listener for ${type}, remaining listeners: ${this.listeners[type].length}`);
         }
       };
     }
     
     notifyListeners(type, data) {
       if (!this.listeners[type]) return;
       
       console.log(`Notifying ${this.listeners[type].length} listeners for ${type}`);
       this.listeners[type].forEach(callback => {
         try {
           callback(data);
         } catch (error) {
           console.error(`Error in ${type} listener:`, error);
         }
       });
     }
   }

   // Create a singleton instance
   const realTimeUpdateService = new RealTimeUpdateService();

   module.exports = realTimeUpdateService;
   ```

2. Update `preload.js` to add IPC event listeners:
   ```javascript
   // Add these to the electronAPI object in preload.js
   
   // Real-time update event listeners
   onNewNotifications: (callback) => {
     ipcRenderer.on('new-notifications', (event, notifications) => callback(notifications));
   },
   
   onOpportunityUpdate: (callback) => {
     ipcRenderer.on('opportunity-update', (event, opportunity) => callback(opportunity));
   },
   
   onScheduleUpdate: (callback) => {
     ipcRenderer.on('schedule-update', (event, schedule) => callback(schedule));
   },
   
   onClientUpdate: (callback) => {
     ipcRenderer.on('client-update', (event, client) => callback(client));
   },
   
   onCaregiverUpdate: (callback) => {
     ipcRenderer.on('caregiver-update', (event, caregiver) => callback(caregiver));
   }
   ```

3. Initialize the real-time update service in `app/renderer.js`:
   ```javascript
   // Add this to the existing renderer.js DOMContentLoaded handler
   const realTimeUpdateService = require('./services/real-time-updates');
   
   // Initialize after login
   function loginSuccess(user) {
     // Existing login success code...
     
     // Initialize real-time updates
     realTimeUpdateService.initialize();
     
     // Set up notification badge updates
     realTimeUpdateService.addListener('notifications', (notifications) => {
       updateNotificationBadge(notifications.length);
     });
     
     // Update opportunity badge
     realTimeUpdateService.addListener('opportunities', () => {
       loadOpportunityCount();
     });
     
     // Refresh current view if relevant data is updated
     realTimeUpdateService.addListener('schedules', () => {
       if (currentView === 'schedule') {
         initializeCalendarView();
       }
     });
     
     realTimeUpdateService.addListener('clients', () => {
       if (currentView === 'clients') {
         loadClients();
       }
     });
     
     realTimeUpdateService.addListener('caregivers', () => {
       if (currentView === 'caregivers') {
         loadCaregivers();
       }
     });
   }
   
   // Add a notification badge to the UI
   function updateNotificationBadge(count) {
     let badge = document.querySelector('.notification-badge');
     
     if (!badge) {
       const navTabs = document.querySelector('.nav-tabs');
       badge = document.createElement('div');
       badge.className = 'notification-badge';
       navTabs.appendChild(badge);
     }
     
     if (count > 0) {
       badge.textContent = count > 99 ? '99+' : count;
       badge.style.display = 'block';
     } else {
       badge.style.display = 'none';
     }
   }
   
   // Load opportunity count
   async function loadOpportunityCount() {
     try {
       const opportunities = await window.electronAPI.getOpportunities('pending');
       
       // Update badge on the opportunity tab if we have one
       const opportunityTab = document.querySelector('.tab-button[data-view="opportunities"]');
       if (opportunityTab) {
         const badge = opportunityTab.querySelector('.badge') || document.createElement('span');
         badge.className = 'badge';
         
         if (opportunities.length > 0) {
           badge.textContent = opportunities.length;
           badge.style.display = 'inline-block';
         } else {
           badge.style.display = 'none';
         }
         
         opportunityTab.appendChild(badge);
       }
     } catch (error) {
       console.error('Error loading opportunity count:', error);
     }
   }
   ```

**Potential Issues:**
1. **Event Handling Overhead:** Too many event listeners could impact performance.
   - **Workaround:** Implement debouncing and throttling for frequent events.

2. **Memory Leaks:** Improper cleanup of event listeners could cause memory leaks.
   - **Workaround:** Ensure all listeners are removed when components are unmounted or views change.

3. **Race Conditions:** Real-time updates might conflict with user edits.
   - **Workaround:** Implement optimistic UI updates with conflict resolution strategies.

## Stage 15: Implement Advanced Schedule Analysis Tools

**Objective:** Create tools for analyzing scheduling patterns and optimizing resource allocation.

**Implementation:**
1. Create a schedule analysis service in `services/schedule-analysis.js`:
   ```javascript
   const { firebaseService } = require('./firebase');
   
   class ScheduleAnalysisService {
     constructor() {
       this.cachedResults = {};
       this.cacheLifetime = 30 * 60 * 1000; // 30 minutes
     }
     
     async analyzeUtilization(startDate, endDate) {
       const cacheKey = `utilization_${startDate}_${endDate}`;
       
       // Check cache first
       if (this.cachedResults[cacheKey] && 
           Date.now() - this.cachedResults[cacheKey].timestamp < this.cacheLifetime) {
         return this.cachedResults[cacheKey].data;
       }
       
       try {
         // Get all schedules for the date range
         const schedules = await firebaseService.getSchedulesInDateRange(startDate, endDate);
         
         // Get all caregivers
         const caregivers = await firebaseService.getAllCaregivers();
         
         // Calculate utilization by caregiver
         const utilizationByCaregiver = {};
         
         caregivers.forEach(caregiver => {
           utilizationByCaregiver[caregiver.id] = {
             caregiver,
             totalHours: 0,
             scheduleCount: 0,
             utilization: 0,
             schedules: []
           };
         });
         
         // Process each schedule
         schedules.forEach(schedule => {
           if (!schedule.caregiver_id) return; // Skip unassigned schedules
           
           const caregiverData = utilizationByCaregiver[schedule.caregiver_id];
           if (!caregiverData) return; // Skip if caregiver not found
           
           // Calculate hours for this schedule
           const hours = this.calculateScheduleHours(schedule);
           
           caregiverData.totalHours += hours;
           caregiverData.scheduleCount++;
           caregiverData.schedules.push(schedule);
         });
         
         // Calculate utilization percentages
         // Assume 40 hours per week is 100% utilization
         const dayRange = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
         const weekRange = dayRange / 7;
         const fullTimeHours = weekRange * 40;
         
         Object.values(utilizationByCaregiver).forEach(data => {
           data.utilization = Math.min(100, (data.totalHours / fullTimeHours) * 100);
         });
         
         // Sort by utilization (lowest first)
         const sortedResults = Object.values(utilizationByCaregiver).sort((a, b) => a.utilization - b.utilization);
         
         // Store in cache
         this.cachedResults[cacheKey] = {
           timestamp: Date.now(),
           data: sortedResults
         };
         
         return sortedResults;
       } catch (error) {
         console.error('Error analyzing utilization:', error);
         throw error;
       }
     }
     
     async analyzeClientCoverage(startDate, endDate) {
       const cacheKey = `client_coverage_${startDate}_${endDate}`;
       
       // Check cache first
       if (this.cachedResults[cacheKey] && 
           Date.now() - this.cachedResults[cacheKey].timestamp < this.cacheLifetime) {
         return this.cachedResults[cacheKey].data;
       }
       
       try {
         // Get all schedules for the date range
         const schedules = await firebaseService.getSchedulesInDateRange(startDate, endDate);
         
         // Get all clients
         const clients = await firebaseService.getAllClients();
         
         // Calculate coverage by client
         const coverageByClient = {};
         
         clients.forEach(client => {
           coverageByClient[client.id] = {
             client,
             totalHours: 0,
             coveredHours: 0,
             coverage: 0,
             schedules: []
           };
         });
         
         // Process each schedule
         schedules.forEach(schedule => {
           if (!schedule.client_id) return; // Skip invalid schedules
           
           const clientData = coverageByClient[schedule.client_id];
           if (!clientData) return; // Skip if client not found
           
           // Calculate hours for this schedule
           const hours = this.calculateScheduleHours(schedule);
           
           clientData.totalHours += hours;
           
           if (schedule.caregiver_id) {
             clientData.coveredHours += hours;
           }
           
           clientData.schedules.push(schedule);
         });
         
         // Calculate coverage percentages
         Object.values(coverageByClient).forEach(data => {
           data.coverage = data.totalHours > 0 ? (data.coveredHours / data.totalHours) * 100 : 0;
         });
         
         // Sort by coverage (lowest first)
         const sortedResults = Object.values(coverageByClient).sort((a, b) => a.coverage - b.coverage);
         
         // Store in cache
         this.cachedResults[cacheKey] = {
           timestamp: Date.now(),
           data: sortedResults
         };
         
         return sortedResults;
       } catch (error) {
         console.error('Error analyzing client coverage:', error);
         throw error;
       }
     }
     
     calculateScheduleHours(schedule) {
       if (!schedule.start_time || !schedule.end_time) return 0;
       
       const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
       const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
       
       const startMinutes = startHour * 60 + startMinute;
       const endMinutes = endHour * 60 + endMinute;
       
       return (endMinutes - startMinutes) / 60;
     }
     
     clearCache() {
       this.cachedResults = {};
     }
   }
   
   module.exports = new ScheduleAnalysisService();
   ```

2. Create an analysis dashboard component in `app/components/analysis-dashboard.js`:
   ```javascript
   class AnalysisDashboard {
     constructor(containerElement, options = {}) {
       this.container = containerElement;
       this.options = {
         onCaregiverSelect: options.onCaregiverSelect || (() => {}),
         onClientSelect: options.onClientSelect || (() => {}),
         ...options
       };
       
       this.startDate = options.startDate || new Date();
       this.endDate = options.endDate || new Date();
       this.endDate.setDate(this.endDate.getDate() + 30); // Default to 30 days ahead
       
       this.render();
     }
     
     async initialize() {
       await this.loadData();
     }
     
     async loadData() {
       try {
         this.showLoading(true);
         
         // Format dates for API
         const startDateStr = this.startDate.toISOString().split('T')[0];
         const endDateStr = this.endDate.toISOString().split('T')[0];
         
         // Load utilization data
         const utilizationData = await window.electronAPI.analyzeUtilization(startDateStr, endDateStr);
         
         // Load client coverage data
         const coverageData = await window.electronAPI.analyzeClientCoverage(startDateStr, endDateStr);
         
         // Render the charts
         this.renderUtilizationChart(utilizationData);
         this.renderCoverageChart(coverageData);
         
         // Render the tables
         this.renderUtilizationTable(utilizationData);
         this.renderCoverageTable(coverageData);
         
         // Update insights
         this.generateInsights(utilizationData, coverageData);
       } catch (error) {
         console.error('Error loading analysis data:', error);
         this.showError('Failed to load analysis data: ' + error.message);
       } finally {
         this.showLoading(false);
       }
     }
     
     render() {
       // Create basic structure
       this.container.innerHTML = '';
       this.container.classList.add('analysis-dashboard');
       
       // Create header with date range selector
       const header = document.createElement('div');
       header.className = 'dashboard-header';
       header.innerHTML = `
         <h3>Schedule Analysis</h3>
         <div class="date-range-selector">
           <label>Date Range:</label>
           <input type="date" class="start-date" value="${this.startDate.toISOString().split('T')[0]}">
           <span>to</span>
           <input type="date" class="end-date" value="${this.endDate.toISOString().split('T')[0]}">
           <button class="update-btn">Update</button>
         </div>
       `;
       this.container.appendChild(header);
       
       // Create loading indicator
       const loadingIndicator = document.createElement('div');
       loadingIndicator.className = 'loading-indicator';
       loadingIndicator.textContent = 'Loading analysis...';
       loadingIndicator.style.display = 'none';
       this.container.appendChild(loadingIndicator);
       
       // Create error message area
       const errorMessage = document.createElement('div');
       errorMessage.className = 'error-message';
       errorMessage.style.display = 'none';
       this.container.appendChild(errorMessage);
       
       // Create insights section
       const insightsSection = document.createElement('div');
       insightsSection.className = 'insights-section';
       insightsSection.innerHTML = `
         <h4>Key Insights</h4>
         <div class="insights-content">
           <p>Loading insights...</p>
         </div>
       `;
       this.container.appendChild(insightsSection);
       
       // Create chart containers
       const chartsContainer = document.createElement('div');
       chartsContainer.className = 'charts-container';
       chartsContainer.innerHTML = `
         <div class="chart-section">
           <h4>Caregiver Utilization</h4>
           <div class="utilization-chart"></div>
         </div>
         <div class="chart-section">
           <h4>Client Coverage</h4>
           <div class="coverage-chart"></div>
         </div>
       `;
       this.container.appendChild(chartsContainer);
       
       // Create table containers
       const tablesContainer = document.createElement('div');
       tablesContainer.className = 'tables-container';
       tablesContainer.innerHTML = `
         <div class="table-section">
           <h4>Caregiver Utilization Details</h4>
           <div class="utilization-table"></div>
         </div>
         <div class="table-section">
           <h4>Client Coverage Details</h4>
           <div class="coverage-table"></div>
         </div>
       `;
       this.container.appendChild(tablesContainer);
       
       // Setup event listeners
       this.setupEventListeners();
       
       // Initialize data
       this.initialize();
     }
     
     setupEventListeners() {
       // Date range update handler
       const updateBtn = this.container.querySelector('.update-btn');
       updateBtn.addEventListener('click', () => {
         const startDateInput = this.container.querySelector('.start-date');
         const endDateInput = this.container.querySelector('.end-date');
         
         this.startDate = new Date(startDateInput.value);
         this.endDate = new Date(endDateInput.value);
         
         this.loadData();
       });
     }
     
     renderUtilizationChart(utilizationData) {
       const chartContainer = this.container.querySelector('.utilization-chart');
       chartContainer.innerHTML = '';
       
       // Create a simple bar chart using div elements
       const chart = document.createElement('div');
       chart.className = 'bar-chart';
       
       // Get top 10 (or fewer) caregivers
       const topCaregivers = utilizationData.slice(0, 10);
       
       topCaregivers.forEach(data => {
         const bar = document.createElement('div');
         bar.className = 'bar-container';
         
         const nameLabel = document.createElement('div');
         nameLabel.className = 'bar-label';
         nameLabel.textContent = data.caregiver.name;
         
         const barWrapper = document.createElement('div');
         barWrapper.className = 'bar-wrapper';
         
         const barFill = document.createElement('div');
         barFill.className = 'bar-fill';
         barFill.style.width = `${data.utilization}%`;
         // Color based on utilization
         if (data.utilization < 50) {
           barFill.classList.add('low');
         } else if (data.utilization < 80) {
           barFill.classList.add('medium');
         } else {
           barFill.classList.add('high');
         }
         
         const valueLabel = document.createElement('div');
         valueLabel.className = 'bar-value';
         valueLabel.textContent = `${Math.round(data.utilization)}%`;
         
         barWrapper.appendChild(barFill);
         barWrapper.appendChild(valueLabel);
         
         bar.appendChild(nameLabel);
         bar.appendChild(barWrapper);
         
         chart.appendChild(bar);
       });
       
       chartContainer.appendChild(chart);
     }
     
     renderCoverageChart(coverageData) {
       const chartContainer = this.container.querySelector('.coverage-chart');
       chartContainer.innerHTML = '';
       
       // Create a simple bar chart using div elements
       const chart = document.createElement('div');
       chart.className = 'bar-chart';
       
       // Get top 10 (or fewer) clients
       const topClients = coverageData.slice(0, 10);
       
       topClients.forEach(data => {
         const bar = document.createElement('div');
         bar.className = 'bar-container';
         
         const nameLabel = document.createElement('div');
         nameLabel.className = 'bar-label';
         nameLabel.textContent = data.client.name;
         
         const barWrapper = document.createElement('div');
         barWrapper.className = 'bar-wrapper';
         
         const barFill = document.createElement('div');
         barFill.className = 'bar-fill';
         barFill.style.width = `${data.coverage}%`;
         // Color based on coverage
         if (data.coverage < 70) {
           barFill.classList.add('low');
         } else if (data.coverage < 90) {
           barFill.classList.add('medium');
         } else {
           barFill.classList.add('high');
         }
         
         const valueLabel = document.createElement('div');
         valueLabel.className = 'bar-value';
         valueLabel.textContent = `${Math.round(data.coverage)}%`;
         
         barWrapper.appendChild(barFill);
         barWrapper.appendChild(valueLabel);
         
         bar.appendChild(nameLabel);
         bar.appendChild(barWrapper);
         
         chart.appendChild(bar);
       });
       
       chartContainer.appendChild(chart);
     }
     
     renderUtilizationTable(utilizationData) {
       const tableContainer = this.container.querySelector('.utilization-table');
       tableContainer.innerHTML = '';
       
       if (utilizationData.length === 0) {
         tableContainer.textContent = 'No utilization data available for this date range.';
         return;
       }
       
       const table = document.createElement('table');
       table.className = 'data-table';
       
       // Create header
       const thead = document.createElement('thead');
       thead.innerHTML = `
         <tr>
           <th>Caregiver</th>
           <th>Schedules</th>
           <th>Total Hours</th>
           <th>Utilization</th>
           <th>Actions</th>
         </tr>
       `;
       table.appendChild(thead);
       
       // Create body
       const tbody = document.createElement('tbody');
       
       utilizationData.forEach(data => {
         const row = document.createElement('tr');
         
         // Add class based on utilization
         if (data.utilization < 50) {
           row.classList.add('low-utilization');
         } else if (data.utilization > 90) {
           row.classList.add('high-utilization');
         }
         
         row.innerHTML = `
           <td>${data.caregiver.name}</td>
           <td>${data.scheduleCount}</td>
           <td>${data.totalHours.toFixed(1)}</td>
           <td>${data.utilization.toFixed(1)}%</td>
           <td>
             <button class="view-btn" data-id="${data.caregiver.id}">View</button>
           </td>
         `;
         
         tbody.appendChild(row);
       });
       
       table.appendChild(tbody);
       tableContainer.appendChild(table);
       
       // Add event listeners for buttons
       tableContainer.querySelectorAll('.view-btn').forEach(button => {
         button.addEventListener('click', () => {
           const caregiverId = button.dataset.id;
           const caregiver = utilizationData.find(d => d.caregiver.id === caregiverId);
           if (caregiver) {
             this.options.onCaregiverSelect(caregiver);
           }
         });
       });
     }
     
     renderCoverageTable(coverageData) {
       const tableContainer = this.container.querySelector('.coverage-table');
       tableContainer.innerHTML = '';
       
       if (coverageData.length === 0) {
         tableContainer.textContent = 'No coverage data available for this date range.';
         return;
       }
       
       const table = document.createElement('table');
       table.className = 'data-table';
       
       // Create header
       const thead = document.createElement('thead');
       thead.innerHTML = `
         <tr>
           <th>Client</th>
           <th>Total Hours</th>
           <th>Covered Hours</th>
           <th>Coverage</th>
           <th>Actions</th>
         </tr>
       `;
       table.appendChild(thead);
       
       // Create body
       const tbody = document.createElement('tbody');
       
       coverageData.forEach(data => {
         const row = document.createElement('tr');
         
         // Add class based on coverage
         if (data.coverage < 70) {
           row.classList.add('low-coverage');
         } else if (data.coverage > 95) {
           row.classList.add('high-coverage');
         }
         
         row.innerHTML = `
           <td>${data.client.name}</td>
           <td>${data.totalHours.toFixed(1)}</td>
           <td>${data.coveredHours.toFixed(1)}</td>
           <td>${data.coverage.toFixed(1)}%</td>
           <td>
             <button class="view-btn" data-id="${data.client.id}">View</button>
           </td>
         `;
         
         tbody.appendChild(row);
       });
       
       table.appendChild(tbody);
       tableContainer.appendChild(table);
       
       // Add event listeners for buttons
       tableContainer.querySelectorAll('.view-btn').forEach(button => {
         button.addEventListener('click', () => {
           const clientId = button.dataset.id;
           const client = coverageData.find(d => d.client.id === clientId);
           if (client) {
             this.options.onClientSelect(client);
           }
         });
       });
     }
     
     generateInsights(utilizationData, coverageData) {
       const insightsContainer = this.container.querySelector('.insights-content');
       insightsContainer.innerHTML = '';
       
       const insights = [];
       
       // Underutilized caregivers
       const underutilizedCaregivers = utilizationData.filter(d => d.utilization < 50);
       if (underutilizedCaregivers.length > 0) {
         insights.push(`
           <div class="insight">
             <h5>Underutilized Caregivers</h5>
             <p>Found ${underutilizedCaregivers.length} caregivers with less than 50% utilization.</p>
             <p>Consider assigning more clients to these caregivers:</p>
             <ul>
               ${underutilizedCaregivers.slice(0, 3).map(d => `
                 <li>${d.caregiver.name} (${d.utilization.toFixed(1)}%)</li>
               `).join('')}
               ${underutilizedCaregivers.length > 3 ? `<li>...and ${underutilizedCaregivers.length - 3} more</li>` : ''}
             </ul>
           </div>
         `);
       }
       
       // Overutilized caregivers
       const overutilizedCaregivers = utilizationData.filter(d => d.utilization > 90);
       if (overutilizedCaregivers.length > 0) {
         insights.push(`
           <div class="insight">
             <h5>Overutilized Caregivers</h5>
             <p>Found ${overutilizedCaregivers.length} caregivers with more than 90% utilization.</p>
             <p>Consider reducing workload for these caregivers:</p>
             <ul>
               ${overutilizedCaregivers.slice(0, 3).map(d => `
                 <li>${d.caregiver.name} (${d.utilization.toFixed(1)}%)</li>
               `).join('')}
               ${overutilizedCaregivers.length > 3 ? `<li>...and ${overutilizedCaregivers.length - 3} more</li>` : ''}
             </ul>
           </div>
         `);
       }
       
       // Uncovered clients
       const uncoveredClients = coverageData.filter(d => d.coverage < 70 && d.totalHours > 0);
       if (uncoveredClients.length > 0) {
         insights.push(`
           <div class="insight">
             <h5>Clients Needing Coverage</h5>
             <p>Found ${uncoveredClients.length} clients with less than 70% coverage.</p>
             <p>Priority clients to assign caregivers:</p>
             <ul>
               ${uncoveredClients.slice(0, 3).map(d => `
                 <li>${d.client.name} (${d.coverage.toFixed(1)}% covered)</li>
               `).join('')}
               ${uncoveredClients.length > 3 ? `<li>...and ${uncoveredClients.length - 3} more</li>` : ''}
             </ul>
           </div>
         `);
       }
       
       // Overall insights
       const avgUtilization = utilizationData.reduce((sum, d) => sum + d.utilization, 0) / 
                             (utilizationData.length || 1);
       
       const avgCoverage = coverageData.reduce((sum, d) => sum + (d.totalHours > 0 ? d.coverage : 0), 0) / 
                           (coverageData.filter(d => d.totalHours > 0).length || 1);
       
       insights.push(`
         <div class="insight">
           <h5>Overall Statistics</h5>
           <p>Average caregiver utilization: ${avgUtilization.toFixed(1)}%</p>

/**
 * Calendar Component
 * Renders the main calendar view and handles user interactions
 * A key part of the circular integration model (C=2πr) on the frontend
 */

const CalendarHelpers = require('./calendar-helpers');
const realTimeUpdatesService = require('../services/real-time-updates');

class Calendar {
  constructor(elementId, options = {}) {
    this.container = document.getElementById(elementId);
    if (!this.container) {
      throw new Error(`Element with ID ${elementId} not found`);
    }
    
    this.currentDate = new Date();
    this.events = [];
    this.subscriptionId = null;
    this.options = options; // Store clientId or caregiverId
    
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    console.log('Initializing Calendar with options:', this.options);
    
    // Subscribe to schedule updates
    this.subscriptionId = realTimeUpdatesService.subscribe('schedule', (schedules) => {
      this.handleScheduleUpdate(schedules);
    });
    
    // Initial render
    this.render();
    
    // Fetch schedules
    this.fetchSchedules();
  }

/**
 * Calendar Component
 * Displays and manages the calendar view
 * Integrates with the agentic system following the circular integration model (C=2πr)
 */
  handleScheduleUpdate(schedules) {
    if (!Array.isArray(schedules)) {
      schedules = [schedules];
    }
    
    console.log('Received schedule update:', schedules);
    
    // Update the local list of events
    schedules.forEach(schedule => {
      const existingIndex = this.events.findIndex(e => e.id === schedule.id);
      
      if (existingIndex >= 0) {
        // Update existing event
        this.events[existingIndex] = schedule;
      } else {
        // Add new event
        this.events.push(schedule);
      }
    });
    
    // Re-render the component
    this.render();
  }

  /**
   * Fetch schedules from the backend based on options
   */
  async fetchSchedules() {
    try {
      let schedules = [];
      
      // Get schedules based on the context (client, caregiver, or all)
      if (this.options.clientId) {
        console.log(`Fetching schedules for client ${this.options.clientId}`);
        schedules = await window.electronAPI.getSchedulesByClientId(
          this.options.clientId,
          this.getFirstDayOfMonth(),
          this.getLastDayOfMonth()
        );
      } else if (this.options.caregiverId) {
        console.log(`Fetching schedules for caregiver ${this.options.caregiverId}`);
        schedules = await window.electronAPI.getSchedulesByCaregiverId(
          this.options.caregiverId,
          this.getFirstDayOfMonth(),
          this.getLastDayOfMonth()
        );
      } else {
        // Fallback to all schedules if no specific ID provided
        schedules = await window.electronAPI.getSchedulesInDateRange(
          this.getFirstDayOfMonth(),
          this.getLastDayOfMonth()
        );
      }
      
      if (schedules && schedules.length > 0) {
        this.events = schedules;
        this.render();
      } else {
        console.log('No schedules found for the given criteria');
        this.events = [];
        this.render();
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return;
    
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the calendar header
    const header = this.createHeader();
    this.container.appendChild(header);
    
    // Create the calendar grid
    const grid = this.createGrid();
    this.container.appendChild(grid);
  }

  /**
   * Create the calendar header
   * @returns {HTMLElement} The header element
   */
  createHeader() {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    
    const prevButton = document.createElement('button');
    prevButton.textContent = '<';
    prevButton.addEventListener('click', () => this.changeMonth(-1));
    header.appendChild(prevButton);
    
    // Add context to the header
    let headerTitle = `${CalendarHelpers.getMonthName(this.currentDate.getMonth())} ${this.currentDate.getFullYear()}`;
    if (this.options.clientId && this.options.clientName) {
      headerTitle = `${this.options.clientName}'s Schedule - ${headerTitle}`;
    } else if (this.options.caregiverId && this.options.caregiverName) {
      headerTitle = `${this.options.caregiverName}'s Schedule - ${headerTitle}`;
    }
    
    const monthYear = document.createElement('h2');
    monthYear.textContent = headerTitle;
    header.appendChild(monthYear);
    
    const nextButton = document.createElement('button');
    nextButton.textContent = '>';
    nextButton.addEventListener('click', () => this.changeMonth(1));
    header.appendChild(nextButton);
    
    return header;
  }

  /**
   * Create the calendar grid
   * @returns {HTMLElement} The grid element
   */
  createGrid() {
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    
    // Add day names
    const dayNames = CalendarHelpers.getDayNames();
    dayNames.forEach(dayName => {
      const dayNameCell = document.createElement('div');
      dayNameCell.className = 'day-name';
      dayNameCell.textContent = dayName;
      grid.appendChild(dayNameCell);
    });
    
    // Add days
    const days = CalendarHelpers.generateMonthDays(
      this.currentDate.getMonth(),
      this.currentDate.getFullYear()
    );
    
    const groupedEvents = CalendarHelpers.groupEventsByDay(this.events);
    
    days.forEach(day => {
      const dayCell = this.createDayCell(day, groupedEvents);
      grid.appendChild(dayCell);
    });
    
    return grid;
  }

  /**
   * Create a cell for a day
   * @param {Object} day - The day object
   * @param {Map} groupedEvents - The events grouped by day
   * @returns {HTMLElement} The day cell element
   */
  createDayCell(day, groupedEvents) {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell';
    
    if (!day.isCurrentMonth) {
      dayCell.classList.add('not-current-month');
    }
    
    if (day.date) {
      const dateStr = CalendarHelpers.formatDate(day.date);
      
      const dayNumber = document.createElement('span');
      dayNumber.className = 'day-number';
      dayNumber.textContent = day.date.getDate();
      dayCell.appendChild(dayNumber);
      
      // Add events for the day
      if (groupedEvents.has(dateStr)) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events-container';
        
        groupedEvents.get(dateStr).forEach(event => {
          const eventElement = this.createEventElement(event);
          eventsContainer.appendChild(eventElement);
        });
        
        dayCell.appendChild(eventsContainer);
      }
      
      // Add click listener to open day view
      dayCell.addEventListener('click', () => this.openDayView(day.date));
    }
    
    return dayCell;
  }

  /**
   * Create an element for an event
   * @param {Object} event - The event data
   * @returns {HTMLElement} The event element
   */
  createEventElement(event) {
    const eventElement = document.createElement('div');
    eventElement.className = 'event';
    
    // Customize event display based on context
    if (this.options.clientId) {
      // In client view, highlight the caregiver
      eventElement.textContent = `${event.start_time} - ${event.caregiver_name || 'Unassigned'}`;
      eventElement.title = `Time: ${event.start_time} - ${event.end_time}\nCaregiver: ${event.caregiver_name || 'Not yet assigned'}`;
      
      // Add CSS class for unassigned caregivers
      if (!event.caregiver_name) {
        eventElement.classList.add('unassigned');
      }
    } else if (this.options.caregiverId) {
      // In caregiver view, highlight the client
      eventElement.textContent = `${event.start_time} - ${event.client_name}`;
      eventElement.title = `Time: ${event.start_time} - ${event.end_time}\nClient: ${event.client_name}`;
    } else {
      // Default view shows both
      eventElement.textContent = `${event.start_time} - ${event.client_name}`;
      eventElement.title = `Client: ${event.client_name}\nCaregiver: ${event.caregiver_name || 'Unassigned'}\nTime: ${event.start_time} - ${event.end_time}`;
    }
    
    return eventElement;
  }

  /**
   * Change the current month
   * @param {number} delta - The change in months (-1 for prev, 1 for next)
   */
  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.render();
    this.fetchSchedules();
  }

  /**
   * Open a detailed view for a specific day
   * @param {Date} date - The date to open
   */
  openDayView(date) {
    console.log('Opening day view for:', date);
    
    // This would typically open a modal or a separate view
    // For now, we'll just log it
    const dateStr = CalendarHelpers.formatDate(date);
    const events = this.events.filter(e => e.date === dateStr);
    
    alert(`Events for ${dateStr}:\n\n${events.map(e => 
      `${e.start_time} - ${e.end_time}: ${e.client_name} with ${e.caregiver_name}`
    ).join('\n')}`);
  }

  /**
   * Get the first day of the current month as a string
   * @returns {string} The date string (YYYY-MM-DD)
   */
  getFirstDayOfMonth() {
    const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    return CalendarHelpers.formatDate(date);
  }

  /**
   * Get the last day of the current month as a string
   * @returns {string} The date string (YYYY-MM-DD)
   */
  getLastDayOfMonth() {
    const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
    return CalendarHelpers.formatDate(date);
  }

  /**
   * Clean up the component
   */
  destroy() {
    console.log('Destroying Calendar');
    
    // Unsubscribe from updates
    if (this.subscriptionId) {
      realTimeUpdatesService.unsubscribe('schedule', this.subscriptionId);
      this.subscriptionId = null;
    }
    
    // Clear the container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

module.exports = Calendar;

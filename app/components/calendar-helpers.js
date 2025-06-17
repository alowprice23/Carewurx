/**
 * Calendar Helpers
 * Provides utility functions for the calendar component
 */

class CalendarHelpers {
  /**
   * Generate the days for a given month and year
   * @param {number} month - The month (0-11)
   * @param {number} year - The year
   * @returns {Array<Object>} A list of day objects
   */
  static generateMonthDays(month, year) {
    const days = [];
    const date = new Date(year, month, 1);
    const firstDay = date.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Add blank days for the start of the month
    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: null,
        isCurrentMonth: false
      });
    }
    
    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Add blank days for the end of the month
    const remaining = 42 - days.length; // 6 weeks * 7 days
    for (let i = 0; i < remaining; i++) {
      days.push({
        date: null,
        isCurrentMonth: false
      });
    }
    
    return days;
  }

  /**
   * Format a date object into a string (YYYY-MM-DD)
   * @param {Date} date - The date to format
   * @returns {string} The formatted date string
   */
  static formatDate(date) {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Get the name of a month
   * @param {number} month - The month (0-11)
   * @returns {string} The month name
   */
  static getMonthName(month) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month];
  }

  /**
   * Get the names of the days of the week
   * @returns {Array<string>} A list of day names
   */
  static getDayNames() {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }

  /**
   * Check if two dates are the same day
   * @param {Date} date1 - The first date
   * @param {Date} date2 - The second date
   * @returns {boolean} Whether the dates are the same day
   */
  static isSameDay(date1, date2) {
    if (!date1 || !date2) return false;
    
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Group events by day
   * @param {Array<Object>} events - The events to group
   * @returns {Map<string, Array<Object>>} A map of events grouped by date string
   */
  static groupEventsByDay(events) {
    const groupedEvents = new Map();
    
    if (!events) return groupedEvents;
    
    events.forEach(event => {
      const dateStr = event.date;
      if (!groupedEvents.has(dateStr)) {
        groupedEvents.set(dateStr, []);
      }
      groupedEvents.get(dateStr).push(event);
    });
    
    return groupedEvents;
  }
}

module.exports = CalendarHelpers;

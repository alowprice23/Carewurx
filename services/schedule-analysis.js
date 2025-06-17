/**
 * Schedule Analysis Service
 * Provides detailed analysis of scheduling data
 */

const { firebaseService } = require('./firebase');
const distanceCalculator = require('../utils/distance-calculator');

class ScheduleAnalysisService {
  /**
   * Get a summary of scheduling analytics for a given period
   * @param {string} startDate - The start date of the period (YYYY-MM-DD)
   * @param {string} endDate - The end date of the period (YYYY-MM-DD)
   * @returns {Promise<Object>} An object with scheduling analytics
   */
  async getAnalyticsSummary(startDate, endDate) {
    console.log(`Getting analytics summary from ${startDate} to ${endDate}`);
    
    try {
      const schedules = await firebaseService.getSchedulesInDateRange(startDate, endDate);
      if (!schedules || schedules.length === 0) {
        return {
          totalSchedules: 0,
          assignedSchedules: 0,
          unassignedSchedules: 0,
          utilizationRate: 0,
          travelEfficiency: 0,
          conflictRate: 0
        };
      }
      
      const assignedSchedules = schedules.filter(s => s.caregiver_id);
      const unassignedSchedules = schedules.length - assignedSchedules.length;
      
      const utilizationRate = await this.calculateUtilizationRate(assignedSchedules);
      const travelEfficiency = await this.calculateTravelEfficiency(assignedSchedules);
      const conflictRate = await this.calculateConflictRate(assignedSchedules);
      
      return {
        totalSchedules: schedules.length,
        assignedSchedules: assignedSchedules.length,
        unassignedSchedules,
        utilizationRate,
        travelEfficiency,
        conflictRate
      };
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      throw error;
    }
  }

  /**
   * Calculate the caregiver utilization rate
   * @param {Array} schedules - A list of assigned schedules
   * @returns {Promise<number>} The utilization rate as a percentage
   */
  async calculateUtilizationRate(schedules) {
    if (schedules.length === 0) return 0;
    
    const totalMinutes = schedules.reduce((sum, s) => {
      const start = new Date(`1970-01-01T${s.start_time}Z`);
      const end = new Date(`1970-01-01T${s.end_time}Z`);
      return sum + (end - start) / 60000;
    }, 0);
    
    const uniqueCaregivers = [...new Set(schedules.map(s => s.caregiver_id))];
    
    // Assuming 8 hours of availability per day
    const totalAvailableMinutes = uniqueCaregivers.length * 8 * 60 * this.getWorkingDays(schedules);
    
    return totalAvailableMinutes > 0 ? (totalMinutes / totalAvailableMinutes) * 100 : 0;
  }

  /**
   * Calculate the travel efficiency
   * @param {Array} schedules - A list of assigned schedules
   * @returns {Promise<number>} The travel efficiency as a percentage
   */
  async calculateTravelEfficiency(schedules) {
    if (schedules.length === 0) return 100;
    
    let totalTravelTime = 0;
    let totalWorkTime = 0;
    
    const schedulesByCaregiverAndDate = this.groupSchedules(schedules);
    
    for (const group of Object.values(schedulesByCaregiverAndDate)) {
      group.sort((a, b) => a.start_time.localeCompare(b.start_time));
      
      for (let i = 0; i < group.length - 1; i++) {
        const current = group[i];
        const next = group[i + 1];
        
        const travelTime = this.timeToMinutes(next.start_time) - this.timeToMinutes(current.end_time);
        if (travelTime > 0) {
          totalTravelTime += travelTime;
        }
      }
      
      totalWorkTime += group.reduce((sum, s) => {
        return sum + (this.timeToMinutes(s.end_time) - this.timeToMinutes(s.start_time));
      }, 0);
    }
    
    const totalTime = totalWorkTime + totalTravelTime;
    return totalTime > 0 ? (totalWorkTime / totalTime) * 100 : 100;
  }

  /**
   * Calculate the schedule conflict rate
   * @param {Array} schedules - A list of assigned schedules
   * @returns {Promise<number>} The conflict rate as a percentage
   */
  async calculateConflictRate(schedules) {
    if (schedules.length === 0) return 0;
    
    let conflictCount = 0;
    const schedulesByCaregiverAndDate = this.groupSchedules(schedules);
    
    for (const group of Object.values(schedulesByCaregiverAndDate)) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (this.timesOverlap(group[i].start_time, group[i].end_time, group[j].start_time, group[j].end_time)) {
            conflictCount++;
          }
        }
      }
    }
    
    return (conflictCount / schedules.length) * 100;
  }

  /**
   * Group schedules by caregiver and date
   * @param {Array} schedules - The schedules to group
   * @returns {Object} The grouped schedules
   */
  groupSchedules(schedules) {
    const grouped = {};
    schedules.forEach(schedule => {
      const key = `${schedule.caregiver_id}-${schedule.date}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(schedule);
    });
    return grouped;
  }

  /**
   * Get the number of working days in a list of schedules
   * @param {Array} schedules - The schedules to analyze
   * @returns {number} The number of working days
   */
  getWorkingDays(schedules) {
    const uniqueDates = new Set(schedules.map(s => s.date));
    return uniqueDates.size;
  }

  /**
   * Helper function to check if two time ranges overlap
   * @param {string} start1 - First range start time (HH:MM)
   * @param {string} end1 - First range end time (HH:MM)
   * @param {string} start2 - Second range start time (HH:MM)
   * @param {string} end2 - Second range end time (HH:MM)
   * @returns {boolean} Whether the time ranges overlap
   */
  timesOverlap(start1, end1, start2, end2) {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);
    
    return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
  }

  /**
   * Helper function to convert a time string (HH:MM) to minutes from midnight
   * @param {string} timeString - The time string to convert
   * @returns {number} The number of minutes from midnight
   */
  timeToMinutes(timeString) {
    if (!timeString || !timeString.includes(':')) {
      return 0;
    }
    
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

module.exports = new ScheduleAnalysisService();

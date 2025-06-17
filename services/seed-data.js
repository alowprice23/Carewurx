/**
 * Seed Data Service
 * Populates the database with initial data for development and testing
 */

const { firebaseService } = require('./firebase');

class SeedDataService {
  constructor() {
    this.clients = [
      { id: 'client-1', name: 'John Doe', location: { latitude: 40.7128, longitude: -74.0060 }, required_skills: ['cpr', 'first-aid'], preferences: { preferred_caregivers: ['caregiver-1'] } },
      { id: 'client-2', name: 'Jane Smith', location: { latitude: 40.7580, longitude: -73.9855 }, required_skills: ['dementia-care'], preferences: {} }
    ];
    
    this.caregivers = [
      { id: 'caregiver-1', name: 'Alice Johnson', location: { latitude: 40.7306, longitude: -73.9352 }, skills: ['cpr', 'first-aid', 'dementia-care'] },
      { id: 'caregiver-2', name: 'Bob Williams', location: { latitude: 40.7831, longitude: -73.9712 }, skills: ['cpr'] }
    ];
    
    this.schedules = [
      {
        id: 'schedule-1',
        client_id: 'client-1',
        caregiver_id: 'caregiver-1',
        date: '2024-07-20',
        start_time: '09:00',
        end_time: '11:00',
        status: 'confirmed'
      },
      {
        id: 'schedule-2',
        client_id: 'client-2',
        caregiver_id: 'caregiver-2',
        date: '2024-07-20',
        start_time: '14:00',
        end_time: '16:00',
        status: 'confirmed'
      }
    ];
  }

  /**
   * Seed the database with initial data
   */
  async seedDatabase() {
    console.log('Seeding database...');
    
    try {
      await firebaseService.initialize();

      // Seed clients
      for (const client of this.clients) {
        await firebaseService.addClient(client);
      }
      
      // Seed caregivers
      for (const caregiver of this.caregivers) {
        await firebaseService.addCaregiver(caregiver);
      }
      
      // Seed schedules
      for (const schedule of this.schedules) {
        await firebaseService.addSchedule(schedule);
      }
      
      console.log('Database seeded successfully');
    } catch (error) {
      console.error('Error seeding database:', error);
    }
  }
}

module.exports = new SeedDataService();

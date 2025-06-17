/**
 * Firebase Functions
 * Entry point for all cloud functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const scheduleAnalysis = require('../services/schedule-analysis');

/**
 * A scheduled function that runs every hour to perform analysis
 */
exports.hourlyAnalysis = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  console.log('Running hourly analysis...');
  
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const summary = await scheduleAnalysis.getAnalyticsSummary(
      thirtyDaysAgo.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );
    
    // Save the summary to the database
    await admin.firestore().collection('analytics').doc('summary').set(summary);
    
    console.log('Hourly analysis completed successfully');
  } catch (error) {
    console.error('Error during hourly analysis:', error);
  }
});

/**
 * A database trigger that runs when a new schedule is created
 */
exports.onScheduleCreate = functions.firestore
  .document('schedules/{scheduleId}')
  .onCreate(async (snap, context) => {
    const newSchedule = snap.data();
    console.log('New schedule created:', newSchedule);
    
    // Create a notification for the new schedule
    const notification = {
      title: 'New Schedule Created',
      message: `A new schedule has been created for ${newSchedule.client_name} on ${newSchedule.date}.`,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    await admin.firestore().collection('notifications').add(notification);
  });

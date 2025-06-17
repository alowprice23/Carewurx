import React from 'react';
import ReactDOM from 'react-dom';
// Import SchedulingApp instead of the main App
import SchedulingApp from './schedulingApp';

/**
 * Main entry point for the frontend application
 * Using the SchedulingApp for the scheduling system
 */
ReactDOM.render(
  <React.StrictMode>
    <SchedulingApp />
  </React.StrictMode>,
  document.getElementById('root')
);

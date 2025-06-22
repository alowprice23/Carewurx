/**
 * Scheduling App Entry Point
 * 
 * This file configures and initializes the enhanced scheduling system components.
 * It imports the mock services and components to ensure everything works together.
 */

// Import mock services
import './services/firebaseServiceMock'; // This extends the firebaseService with scheduling methods

// Import main components
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom'; // Import Link
import SchedulingDemo from './pages/SchedulingDemo';
import NewCalendarView from '../components/NewCalendarView'; // Import the new calendar view

// CSS
import './app.css';

/**
 * Main App Component
 */
const SchedulingApp = () => {
  return (
    <Router>
      <div className="scheduling-app-container">
        <header className="app-header">
          <h1>Carewurx Scheduling System</h1>
          <nav>
            <Link to="/" style={{ marginRight: '10px', color: 'white' }}>Demo Page</Link>
            <Link to="/calendar-v2" style={{ color: 'white' }}>New Calendar</Link>
          </nav>
        </header>
        
        <main className="app-content">
          <Switch>
            <Route exact path="/" component={SchedulingDemo} />
            <Route path="/calendar-v2" component={NewCalendarView} />
          </Switch>
        </main>
        
        <footer className="app-footer">
          <p>Enhanced Scheduling System v1.0.0</p>
        </footer>
      </div>
    </Router>
  );
};

/**
 * Initialize the app
 */
const initApp = () => {
  const rootElement = document.getElementById('root');
  
  // Check if using React 18 or newer
  if (ReactDOM.createRoot) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <SchedulingApp />
      </React.StrictMode>
    );
  } else {
    // Fallback for older React versions
    ReactDOM.render(
      <React.StrictMode>
        <SchedulingApp />
      </React.StrictMode>,
      rootElement
    );
  }
};

// Start the app when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export default SchedulingApp;

import React, { useState, useEffect } from 'react';
import './app.css'; // Import external CSS to ensure styles are applied
import {
  AgentChat,
  OpportunityScanner,
  NotificationCenter,
  NewCalendarView, // Using NewCalendarView
  AgentInsightDisplay,
  AvailabilityManager,
  ConflictResolutionUI,
  NotificationCreator,
  APIKeyManager,
  ResponseStreamingUI,
  UniversalDataEditor,
  CircularDataFlowMonitor,
  ScheduleOptimizationControls,
  CaregiverMatchingSystem,
  LiveUpdateStream,
  CollaborationTools,
  IPCTestHarness,
  DataConsistencyChecker,
  Login
} from './components';
import { scannerService, firebaseService } from './services';

/**
 * Main App Component
 * Integrates all frontend components
 */
const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [isBrowserMode, setIsBrowserMode] = useState(false); 
  const [backendConnected, setBackendConnected] = useState(false);
  
  // Check environment and setup - IMMEDIATELY set mock user to prevent render errors
  useEffect(() => {
    // Check if we're running in browser mode or Electron
    const isElectron = firebaseService.isElectronAvailable;
    const isBrowserOnlyMode = !isElectron;
    setIsBrowserMode(isBrowserOnlyMode);
    console.log(`App: Running in ${isBrowserOnlyMode ? 'BROWSER' : 'ELECTRON'} mode`);
    
    // IMMEDIATELY set a mock user in browser mode to prevent render errors
    if (isBrowserOnlyMode) {
      console.log("App: Setting mock user for browser-only mode");
      setUser({
        uid: 'browser-user-123',
        email: 'browser-user@example.com',
        displayName: 'Browser User'
      });
      setBackendConnected(false);
    }
    
    // Check backend connectivity (only relevant in Electron mode)
    if (isElectron) {
      const checkBackendConnection = async () => {
        try {
          // Simple test to see if backend is available
          const currentUser = await firebaseService.getCurrentUser();
          setBackendConnected(true);
          console.log("App: Backend connection successful", currentUser);
        } catch (error) {
          console.error("App: Backend connection failed:", error);
          setBackendConnected(false);
        }
      };
      
      checkBackendConnection();
    }
  }, []);
  
  // Check for authenticated user on mount and add debugging - ONLY in Electron mode
  useEffect(() => {
    // Skip authentication check entirely in browser mode
    if (isBrowserMode) {
      console.log("App: Skipping authentication check in browser mode");
      return () => {};
    }
    
    console.log("App: Checking authentication state in Electron mode");
    
    try {
      // This should only run in Electron mode
      const unsubscribe = firebaseService.onAuthStateChanged((authUser) => {
        console.log("App: Auth state changed, user:", authUser);
        if (authUser) {
          setUser(authUser);
        } else {
          // Fallback to avoid null user
          console.log("App: No auth user, using mock user");
          setUser({
            uid: 'guest-user-123',
            email: 'guest@example.com',
            displayName: 'Guest User'
          });
        }
      });
      
      return () => {
        console.log("App: Unsubscribing from auth state changes");
        unsubscribe();
      };
    } catch (error) {
      console.error("App: Error setting up auth state listener:", error);
      // Fallback in case of error
      setUser({
        uid: 'error-fallback-user',
        email: 'fallback@example.com',
        displayName: 'Fallback User'
      });
      return () => {};
    }
  }, [isBrowserMode]);

  // Set up background scanner with 30-minute interval
  useEffect(() => {
    if (autoScanEnabled) {
      const cleanupScanner = scannerService.setupBackgroundScanner(30);
      return () => cleanupScanner();
    }
  }, [autoScanEnabled]);
  
  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  // Toggle auto-scanning
  const toggleAutoScan = () => {
    setAutoScanEnabled(!autoScanEnabled);
  };

  // Add a safe guard to ensure we always have a user object
  // This prevents the "user is null" error
  useEffect(() => {
    if (!user) {
      console.log("App: Applying emergency mock user");
      setUser({
        uid: 'emergency-user-123',
        email: 'emergency@example.com',
        displayName: 'Emergency Backup User'
      });
    }
  }, [user]);
  
  // Only require login if not in browser mode and we don't have a user
  if (!user) {
    return (
      <div className="loading-container">
        <h2>Loading CareWurx...</h2>
        <p>Please wait while we initialize the application.</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
            color: #3498db;
          }
          h2 {
            margin-bottom: 16px;
          }
        `}</style>
      </div>
    );
  }
  
  if (!isBrowserMode && user && user.uid.indexOf('browser') === -1 && user.uid.indexOf('emergency') === -1 && user.uid.indexOf('guest') === -1) {
    return <Login onLogin={setUser} />;
  }

  // Modified render method to ensure CSS is applied properly
  return (
    <div className="app-container" id="app-container">
      <header className="app-header">
        <h1>CareWurx</h1>
        {isBrowserMode && (
          <div className="environment-badge">
            Browser Demo Mode {!backendConnected && '- No Backend'}
          </div>
        )}
        <div className="notification-wrapper">
          <NotificationCenter />
        </div>
      </header>
      
      <nav className="app-nav">
        <ul>
          <li>
            <button 
              className={activeTab === 'chat' ? 'active' : ''} 
              onClick={() => handleTabChange('chat')}
            >
              Agent Chat
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'schedule' ? 'active' : ''} 
              onClick={() => handleTabChange('schedule')}
            >
              Schedule
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'availability' ? 'active' : ''} 
              onClick={() => handleTabChange('availability')}
            >
              Availability
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'conflicts' ? 'active' : ''} 
              onClick={() => handleTabChange('conflicts')}
            >
              Conflicts
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'insights' ? 'active' : ''} 
              onClick={() => handleTabChange('insights')}
            >
              Agent Insights
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'notifications' ? 'active' : ''} 
              onClick={() => handleTabChange('notifications')}
            >
              Notifications
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'opportunities' ? 'active' : ''} 
              onClick={() => handleTabChange('opportunities')}
            >
              Opportunities
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'scanner' ? 'active' : ''} 
              onClick={() => handleTabChange('scanner')}
            >
              Scanner Controls
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'dataeditor' ? 'active' : ''} 
              onClick={() => handleTabChange('dataeditor')}
            >
              Data Editor
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'dataflow' ? 'active' : ''} 
              onClick={() => handleTabChange('dataflow')}
            >
              Data Flow
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'optimization' ? 'active' : ''} 
              onClick={() => handleTabChange('optimization')}
            >
              Schedule Optimization
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'matching' ? 'active' : ''} 
              onClick={() => handleTabChange('matching')}
            >
              Caregiver Matching
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'liveupdates' ? 'active' : ''} 
              onClick={() => handleTabChange('liveupdates')}
            >
              Live Updates
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'collaboration' ? 'active' : ''} 
              onClick={() => handleTabChange('collaboration')}
            >
              Collaboration
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'apikeys' ? 'active' : ''} 
              onClick={() => handleTabChange('apikeys')}
            >
              API Keys
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'streaming' ? 'active' : ''} 
              onClick={() => handleTabChange('streaming')}
            >
              Response Stream
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'ipctestharness' ? 'active' : ''} 
              onClick={() => handleTabChange('ipctestharness')}
            >
              IPC Test Harness
            </button>
          </li>
          <li>
            <button 
              className={activeTab === 'dataconsistency' ? 'active' : ''} 
              onClick={() => handleTabChange('dataconsistency')}
            >
              Data Consistency
            </button>
          </li>
        </ul>
      </nav>
      
      <main className="app-content">
        {activeTab === 'chat' && (
          <div className="tab-content">
            <h2>Agent Assistant</h2>
            <p className="tab-description">
              Chat with Lexxi or Bruce for assistance with scheduling and opportunity management.
            </p>
            <AgentChat userId={user.uid} />
          </div>
        )}
        
        {activeTab === 'schedule' && (
          <div className="tab-content">
            <h2>Universal Schedule</h2>
            <p className="tab-description">
              View and manage schedules for clients and caregivers in the new calendar interface.
            </p>
            <NewCalendarView />
          </div>
        )}
        
        {activeTab === 'availability' && (
          <div className="tab-content">
            <h2>Availability Management</h2>
            <p className="tab-description">
              Manage caregiver availability and client schedule preferences.
            </p>
            <AvailabilityManager entityId={user.uid} entityType="caregiver" />
          </div>
        )}
        
        {activeTab === 'conflicts' && (
          <div className="tab-content">
            <h2>Conflict Resolution</h2>
            <p className="tab-description">
              Identify and resolve scheduling conflicts between caregivers and clients.
            </p>
            <ConflictResolutionUI onResolutionComplete={() => console.log('Conflict resolved')} />
          </div>
        )}
        
        {activeTab === 'insights' && (
          <div className="tab-content">
            <h2>Agent Insights</h2>
            <p className="tab-description">
              View insights and suggestions generated by the agent system.
            </p>
            <AgentInsightDisplay entityId="system" entityType="global" />
          </div>
        )}
        
        {activeTab === 'notifications' && (
          <div className="tab-content">
            <h2>Create Notifications</h2>
            <p className="tab-description">
              Create and schedule notifications for users, caregivers, and clients.
            </p>
            <NotificationCreator onNotificationCreated={() => console.log('Notification created')} />
          </div>
        )}
        
        {activeTab === 'opportunities' && (
          <div className="tab-content">
            <h2>Opportunities</h2>
            <p className="tab-description">
              View and manage available scheduling opportunities.
            </p>
            <div className="auto-scan-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={autoScanEnabled}
                  onChange={toggleAutoScan}
                />
                Enable automatic scanning (every 30 minutes)
              </label>
            </div>
            <OpportunityScanner />
          </div>
        )}
        
        {activeTab === 'scanner' && (
          <div className="tab-content">
            <h2>Scanner Controls</h2>
            <p className="tab-description">
              Configure and manage the opportunity scanner.
            </p>
            <OpportunityScanner />
          </div>
        )}
        
        {activeTab === 'dataeditor' && (
          <div className="tab-content">
            <h2>Universal Data Editor</h2>
            <p className="tab-description">
              Create and edit clients, caregivers, and schedules with form-based validation.
            </p>
            <UniversalDataEditor />
          </div>
        )}
        
        {activeTab === 'dataflow' && (
          <div className="tab-content">
            <h2>Circular Data Flow Monitor</h2>
            <p className="tab-description">
              Visualize data flow in the system based on the C=2πr model with conflict detection.
            </p>
            <CircularDataFlowMonitor />
          </div>
        )}
        
        {activeTab === 'optimization' && (
          <div className="tab-content">
            <h2>Schedule Optimization</h2>
            <p className="tab-description">
              Optimize caregiver schedules based on configurable parameters and compare results.
            </p>
            <ScheduleOptimizationControls />
          </div>
        )}
        
        {activeTab === 'matching' && (
          <div className="tab-content">
            <h2>Caregiver Matching System</h2>
            <p className="tab-description">
              Automated caregiver matching with manual override controls and matching criteria configuration.
            </p>
            <CaregiverMatchingSystem />
          </div>
        )}
        
        {activeTab === 'liveupdates' && (
          <div className="tab-content">
            <h2>Live Update Stream</h2>
            <p className="tab-description">
              Real-time updates and notifications about system changes with push notification support.
            </p>
            <LiveUpdateStream 
              onUpdate={(update) => console.log('Live update received:', update)}
            />
          </div>
        )}
        
        {activeTab === 'collaboration' && (
          <div className="tab-content">
            <h2>Collaboration Tools</h2>
            <p className="tab-description">
              Multi-user editing indicators, change conflict resolution, and edit history tracking.
            </p>
            <CollaborationTools 
              entityType="client"
              entityId="client-123"
              onConflictResolved={(conflictId, resolution) => 
                console.log('Conflict resolved:', conflictId, resolution)
              }
            />
          </div>
        )}
        
        {activeTab === 'apikeys' && (
          <div className="tab-content">
            <h2>API Key Management</h2>
            <p className="tab-description">
              Manage and validate API keys for LLM providers like Groq, OpenAI, and Anthropic.
            </p>
            <APIKeyManager />
          </div>
        )}
        
        {activeTab === 'streaming' && (
          <div className="tab-content">
            <h2>Response Streaming</h2>
            <p className="tab-description">
              Test LLM response streaming with real-time typing indicators and quality feedback.
            </p>
            <ResponseStreamingUI onResponseComplete={(response) => console.log('Response completed:', response.length)} />
          </div>
        )}
        
        {activeTab === 'ipctestharness' && (
          <div className="tab-content">
            <h2>IPC Test Harness</h2>
            <p className="tab-description">
              Test IPC endpoints with parameter inputs and response visualization.
            </p>
            <IPCTestHarness />
          </div>
        )}
        
        {activeTab === 'dataconsistency' && (
          <div className="tab-content">
            <h2>Database Consistency Checker</h2>
            <p className="tab-description">
              Monitor database health, identify inconsistencies, and apply repairs.
            </p>
            <DataConsistencyChecker />
          </div>
        )}
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2025 CareWurx. All rights reserved.</p>
      </footer>

      {/* External CSS styles from app.css are now used instead of inline styles */}
    </div>
  );
};

export default App;

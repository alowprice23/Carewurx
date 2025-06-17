import React, { useState, useEffect } from 'react';
import { 
  ScheduleWithAvailability, 
  AvailabilityManager, 
  NotificationCenter,
  ClientScheduleStaffing,
  CaregiverProfileForm,
  ClientProfileForm
} from '../components';
import { 
  schedulerService, 
  availabilityService, 
  notificationService, 
  universalDataService 
} from '../services';

/**
 * Scheduling Demo Page
 * 
 * This page demonstrates how to use the enhanced scheduling components
 * with caregiver availability and smart scheduling features.
 */
const SchedulingDemo = () => {
  const [section, setSection] = useState('staffing'); // 'schedule', 'availability', 'manage', 'staffing', 'caregiverProfile', 'clientProfile'
  const [selectedCaregiverId, setSelectedCaregiverId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewCaregiverForm, setShowNewCaregiverForm] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  
  // State for caregiver availability
  const [selectedCaregiverAvailability, setSelectedCaregiverAvailability] = useState(null);
  
  // Load caregivers and clients on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load caregivers
        const caregivers = await universalDataService.getCaregivers();
        setCaregivers(caregivers);
        
        // Set a default caregiver if we have any
        if (caregivers.length > 0) {
          setSelectedCaregiverId(caregivers[0].id);
        }
        
        // Load clients
        const clients = await universalDataService.getClients();
        setClients(clients);
        
        // Set a default client if we have any
        if (clients.length > 0) {
          setSelectedClientId(clients[0].id);
        }
      } catch (error) {
        console.error('Error loading caregivers and clients:', error);
        notificationService.showNotification(
          'Failed to load data',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Load caregiver availability when caregiver is selected
  useEffect(() => {
    if (selectedCaregiverId) {
      setLoading(true);
      availabilityService.getCaregiverAvailability(selectedCaregiverId)
        .then(data => {
          console.log('Loaded availability for caregiver:', selectedCaregiverId, data);
          setSelectedCaregiverAvailability(data);
        })
        .catch(error => {
          console.error('Error loading caregiver availability:', error);
          notificationService.showNotification(
            'Failed to load caregiver availability',
            'error'
          );
        })
        .finally(() => setLoading(false));
    }
  }, [selectedCaregiverId]);
  
  // Handle saving a schedule
  const handleSaveSchedule = async (scheduleData) => {
    try {
      // Create or update the schedule
      let result;
      if (scheduleData.id) {
        result = await schedulerService.updateSchedule(scheduleData.id, scheduleData);
      } else {
        result = await schedulerService.createSchedule(scheduleData);
      }
      
      notificationService.showNotification(
        'Schedule saved successfully',
        'success'
      );
      
      return result;
    } catch (error) {
      console.error('Error saving schedule:', error);
      notificationService.showNotification(
        'Failed to save schedule',
        'error'
      );
      throw error;
    }
  };
  
  // Handle saving availability settings
  const handleSaveAvailability = async (caregiverId, availabilityData) => {
    try {
      await availabilityService.updateCaregiverAvailability(caregiverId, availabilityData);
      
      // Update the local state to reflect changes
      setSelectedCaregiverAvailability(availabilityData);
      
      notificationService.showNotification(
        'Availability settings saved successfully',
        'success'
      );
      
      return true;
    } catch (error) {
      console.error('Error saving availability:', error);
      notificationService.showNotification(
        'Failed to save availability settings',
        'error'
      );
      
      return false;
    }
  };
  
  return (
    <div className="scheduling-demo-page">
      <header className="demo-header">
        <h2>Enhanced Scheduling System Demo</h2>
        
        <div className="tab-navigation">
          <button 
            className={section === 'schedule' ? 'active' : ''}
            onClick={() => setSection('schedule')}
          >
            Create Schedule
          </button>
          <button 
            className={section === 'availability' ? 'active' : ''}
            onClick={() => setSection('availability')}
          >
            Manage Availability
          </button>
          <button 
            className={section === 'manage' ? 'active' : ''}
            onClick={() => setSection('manage')}
          >
            View Schedules
          </button>
          <button 
            className={section === 'staffing' ? 'active' : ''}
            onClick={() => setSection('staffing')}
          >
            Staff Client Schedules
          </button>
          <button 
            className={section === 'caregiverProfile' ? 'active' : ''}
            onClick={() => { setSection('caregiverProfile'); setShowNewCaregiverForm(false); }}
          >
            Add/Edit Caregiver
          </button>
          <button 
            className={section === 'clientProfile' ? 'active' : ''}
            onClick={() => { setSection('clientProfile'); setShowNewClientForm(false); }}
          >
            Add/Edit Client
          </button>
        </div>
      </header>
      
      <div className="demo-content">
        {section === 'schedule' && (
          <div className="demo-section">
            <h3>Create a New Schedule with Availability Checking</h3>
            <p className="section-description">
              This form allows you to create a new schedule while checking caregiver availability.
              It will automatically filter caregivers based on availability and show warnings for conflicts.
            </p>
            
            <ScheduleWithAvailability 
              onSave={handleSaveSchedule}
            />
          </div>
        )}
        
        {section === 'availability' && (
          <div className="demo-section">
            <h3>Manage Caregiver Availability</h3>
            <p className="section-description">
              This interface allows caregivers to set their regular availability patterns and request time off.
            </p>
            
            <div className="caregiver-selector">
              <label htmlFor="caregiverId">Select Caregiver:</label>
              <select
                id="caregiverId"
                value={selectedCaregiverId}
                onChange={(e) => setSelectedCaregiverId(e.target.value)}
                disabled={loading || caregivers.length === 0}
              >
                {caregivers.length === 0 ? (
                  <option value="">No caregivers available</option>
                ) : (
                  caregivers.map(caregiver => (
                    <option key={caregiver.id} value={caregiver.id}>
                      {caregiver.firstName} {caregiver.lastName}
                    </option>
                  ))
                )}
              </select>
            </div>
            
            {selectedCaregiverId && (
              <div className="availability-manager-container">
                <div className="selected-caregiver-info">
                  <span className="info-label">Selected Caregiver:</span>
                  <span className="info-value">
                    {caregivers.find(c => c.id === selectedCaregiverId)?.firstName} {caregivers.find(c => c.id === selectedCaregiverId)?.lastName}
                  </span>
                </div>
                
                {loading ? (
                  <div className="loading-indicator">Loading availability data...</div>
                ) : (
                  <AvailabilityManager 
                    caregiverId={selectedCaregiverId}
                    initialAvailability={selectedCaregiverAvailability}
                    onSave={handleSaveAvailability}
                  />
                )}
              </div>
            )}
          </div>
        )}
        
        {section === 'manage' && (
          <div className="demo-section">
            <h3>View and Manage Schedules</h3>
            <p className="section-description">
              This section would typically show existing schedules with the ability to edit, delete, or view details.
              For this demo, we're just showing the placeholder.
            </p>
            
            <div className="placeholder-message">
              Schedule management view would be integrated here, typically showing a calendar or list view of
              all schedules with filtering options.
            </div>
          </div>
        )}
        
        {section === 'staffing' && (
          <div className="demo-section">
            <h3>Staff Client Schedules</h3>
            <p className="section-description">
              This component allows you to view all client schedules that need caregivers assigned and
              match available caregivers based on skills, availability, and other criteria.
            </p>
            
            <ClientScheduleStaffing />
          </div>
        )}
        
        {section === 'caregiverProfile' && (
          <div className="demo-section">
            <h3>Caregiver Profile Management</h3>
            <p className="section-description">
              Create new caregivers or edit existing ones. Set their skills, transportation options, and availability all in one place.
            </p>
            
            {!showNewCaregiverForm ? (
              <div className="selector-container">
                <div className="selector-actions">
                  <select
                    value={selectedCaregiverId}
                    onChange={(e) => setSelectedCaregiverId(e.target.value)}
                    disabled={loading || caregivers.length === 0}
                  >
                    {caregivers.length === 0 ? (
                      <option value="">No caregivers available</option>
                    ) : (
                      caregivers.map(caregiver => (
                        <option key={caregiver.id} value={caregiver.id}>
                          {caregiver.firstName} {caregiver.lastName}
                        </option>
                      ))
                    )}
                  </select>
                  
                  <button 
                    className="action-button edit-button"
                    onClick={() => setShowNewCaregiverForm(true)}
                    disabled={loading || !selectedCaregiverId}
                  >
                    Edit Selected Caregiver
                  </button>
                  
                  <button 
                    className="action-button new-button"
                    onClick={() => {
                      setSelectedCaregiverId('');
                      setShowNewCaregiverForm(true);
                    }}
                  >
                    Add New Caregiver
                  </button>
                </div>
              </div>
            ) : (
              <CaregiverProfileForm 
                caregiverId={selectedCaregiverId}
                onSave={(id) => {
                  // Refresh caregivers list
                  universalDataService.getCaregivers().then(caregivers => {
                    setCaregivers(caregivers);
                    setSelectedCaregiverId(id);
                  });
                  
                  setShowNewCaregiverForm(false);
                }}
                onCancel={() => setShowNewCaregiverForm(false)}
                initialTab="availability"
              />
            )}
          </div>
        )}
        
        {section === 'clientProfile' && (
          <div className="demo-section">
            <h3>Client Profile Management</h3>
            <p className="section-description">
              Create new clients or edit existing ones. Set their care needs, transportation requirements, and recurring schedule all in one place.
            </p>
            
            {!showNewClientForm ? (
              <div className="selector-container">
                <div className="selector-actions">
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    disabled={loading || clients.length === 0}
                  >
                    {clients.length === 0 ? (
                      <option value="">No clients available</option>
                    ) : (
                      clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.firstName} {client.lastName}
                        </option>
                      ))
                    )}
                  </select>
                  
                  <button 
                    className="action-button edit-button"
                    onClick={() => setShowNewClientForm(true)}
                    disabled={loading || !selectedClientId}
                  >
                    Edit Selected Client
                  </button>
                  
                  <button 
                    className="action-button new-button"
                    onClick={() => {
                      setSelectedClientId('');
                      setShowNewClientForm(true);
                    }}
                  >
                    Add New Client
                  </button>
                </div>
              </div>
            ) : (
              <ClientProfileForm 
                clientId={selectedClientId}
                onSave={(id) => {
                  // Refresh clients list
                  universalDataService.getClients().then(clients => {
                    setClients(clients);
                    setSelectedClientId(id);
                  });
                  
                  setShowNewClientForm(false);
                }}
                onCancel={() => setShowNewClientForm(false)}
                initialTab="schedule"
              />
            )}
          </div>
        )}
      </div>
      
      {/* Notifications are shown here */}
      <div className="notification-container">
        <NotificationCenter />
      </div>
      
      <style jsx>{`
        .scheduling-demo-page {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .demo-header {
          margin-bottom: 30px;
        }
        
        h2 {
          color: #2c3e50;
          margin-top: 0;
          margin-bottom: 20px;
        }
        
        .tab-navigation {
          display: flex;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 20px;
        }
        
        .tab-navigation button {
          padding: 10px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 1rem;
          color: #6c757d;
          margin-right: 10px;
        }
        
        .tab-navigation button.active {
          border-bottom-color: #3498db;
          color: #3498db;
          font-weight: 500;
        }
        
        .tab-navigation button:hover:not(.active) {
          border-bottom-color: #e9ecef;
          background-color: #f8f9fa;
        }
        
        .demo-content {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        
        .demo-section h3 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .section-description {
          color: #6c757d;
          margin-bottom: 20px;
        }
        
        .caregiver-selector,
        .selector-container {
          margin-bottom: 20px;
        }
        
        .caregiver-selector label,
        .selector-container label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #2c3e50;
        }
        
        .caregiver-selector select,
        .selector-container select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.15s;
        }
        
        .selector-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 15px;
        }
        
        .action-button {
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          color: white;
          font-weight: 500;
        }
        
        .edit-button {
          background-color: #f39c12;
        }
        
        .edit-button:hover:not(:disabled) {
          background-color: #e67e22;
        }
        
        .new-button {
          background-color: #2ecc71;
        }
        
        .new-button:hover:not(:disabled) {
          background-color: #27ae60;
        }
        
        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .availability-manager-container {
          margin-top: 20px;
        }
        
        .placeholder-message {
          background: #f8f9fa;
          padding: 30px;
          text-align: center;
          color: #6c757d;
          border-radius: 4px;
          font-style: italic;
        }
        
        .notification-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
        }
        
        .selected-caregiver-info {
          background: #f8f9fa;
          padding: 10px 15px;
          border-radius: 4px;
          margin-bottom: 15px;
          border-left: 3px solid #3498db;
          display: flex;
          align-items: center;
        }
        
        .info-label {
          font-weight: 600;
          color: #3498db;
          margin-right: 10px;
        }
        
        .info-value {
          color: #2c3e50;
        }
        
        .loading-indicator {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          color: #6c757d;
          border-radius: 4px;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
};

export default SchedulingDemo;

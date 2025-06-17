import React, { useState, useEffect } from 'react';
import { 
  schedulerService, 
  availabilityService, 
  notificationService, 
  universalDataService 
} from '../services';
import AvailabilityManager from './AvailabilityManager';

/**
 * Schedule With Availability Component
 * 
 * This component enhances the scheduling interface by incorporating caregiver
 * availability information, conflict detection, and smart caregiver selection.
 */
const ScheduleWithAvailability = ({ initialScheduleData = {}, onSave, onCancel }) => {
  // State for schedule form
  const [scheduleData, setScheduleData] = useState({
    clientId: initialScheduleData.clientId || '',
    caregiverId: initialScheduleData.caregiverId || '',
    date: initialScheduleData.date || new Date().toISOString().split('T')[0],
    startTime: initialScheduleData.startTime || '09:00',
    endTime: initialScheduleData.endTime || '17:00',
    status: initialScheduleData.status || 'Pending',
    notes: initialScheduleData.notes || '',
    ...initialScheduleData
  });
  
  // State for entities
  const [clients, setClients] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [availableCaregivers, setAvailableCaregivers] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);
  const [showAvailableSlots, setShowAvailableSlots] = useState(false);
  const [nextAvailableSlots, setNextAvailableSlots] = useState([]);
  
  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load clients and caregivers
        const [clientsData, caregiversData] = await Promise.all([
          universalDataService.getClients(),
          universalDataService.getCaregivers()
        ]);
        
        setClients(clientsData);
        setCaregivers(caregiversData);
        
        // If we have a date and times, load available caregivers
        if (scheduleData.date && scheduleData.startTime && scheduleData.endTime) {
          const availableCaregivers = await availabilityService.getAvailableCaregivers(
            scheduleData.date,
            scheduleData.startTime,
            scheduleData.endTime
          );
          setAvailableCaregivers(availableCaregivers);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        notificationService.showNotification(
          'Failed to load schedule data',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Check for conflicts when schedule details change
  useEffect(() => {
    const checkConflicts = async () => {
      if (!scheduleData.caregiverId || !scheduleData.date || !scheduleData.startTime || !scheduleData.endTime) {
        setConflicts([]);
        return;
      }
      
      setLoading(true);
      try {
        // Check for availability conflict
        const hasConflict = await availabilityService.checkScheduleConflict(
          scheduleData.caregiverId,
          scheduleData.date,
          scheduleData.startTime,
          scheduleData.endTime
        );
        
        if (hasConflict) {
          setConflicts(['The selected caregiver is not available at this time']);
        } else {
          setConflicts([]);
        }
      } catch (error) {
        console.error('Error checking conflicts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkConflicts();
  }, [scheduleData.caregiverId, scheduleData.date, scheduleData.startTime, scheduleData.endTime]);
  
  // Load available caregivers when date or time changes
  useEffect(() => {
    const loadAvailableCaregivers = async () => {
      if (!scheduleData.date || !scheduleData.startTime || !scheduleData.endTime) {
        return;
      }
      
      setLoading(true);
      try {
        const availableCaregivers = await availabilityService.getAvailableCaregivers(
          scheduleData.date,
          scheduleData.startTime,
          scheduleData.endTime
        );
        setAvailableCaregivers(availableCaregivers);
      } catch (error) {
        console.error('Error loading available caregivers:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAvailableCaregivers();
  }, [scheduleData.date, scheduleData.startTime, scheduleData.endTime]);
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setScheduleData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle date or time changes
  const handleDateTimeChange = (e) => {
    const { name, value } = e.target;
    setScheduleData(prev => ({ ...prev, [name]: value }));
    
    // If caregiver is selected, check for conflicts
    if (scheduleData.caregiverId) {
      // This will trigger the useEffect that checks for conflicts
    }
  };
  
  // Handle caregiver selection
  const handleCaregiverChange = (e) => {
    const caregiverId = e.target.value;
    setScheduleData(prev => ({ ...prev, caregiverId }));
    
    // Clear next available slots when caregiver changes
    setNextAvailableSlots([]);
    setShowAvailableSlots(false);
  };
  
  // Show caregiver availability manager
  const handleShowAvailability = () => {
    if (!scheduleData.caregiverId) {
      notificationService.showNotification(
        'Please select a caregiver first',
        'warning'
      );
      return;
    }
    
    setShowAvailabilityManager(true);
  };
  
  // Show caregiver's next available slots
  const handleShowNextAvailable = async () => {
    if (!scheduleData.caregiverId) {
      notificationService.showNotification(
        'Please select a caregiver first',
        'warning'
      );
      return;
    }
    
    setLoading(true);
    try {
      const slots = await availabilityService.getNextAvailableSlots(
        scheduleData.caregiverId,
        7, // Days to look ahead
        2  // Minimum duration in hours
      );
      
      setNextAvailableSlots(slots);
      setShowAvailableSlots(true);
    } catch (error) {
      console.error('Error loading next available slots:', error);
      notificationService.showNotification(
        'Failed to load available slots',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Use a selected available slot
  const handleUseSlot = (slot) => {
    setScheduleData(prev => ({
      ...prev,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime
    }));
    
    setShowAvailableSlots(false);
  };
  
  // Save availability settings
  const handleSaveAvailability = async (caregiverId, availabilityData) => {
    try {
      await availabilityService.updateCaregiverAvailability(caregiverId, availabilityData);
      setShowAvailabilityManager(false);
      
      // Refresh available caregivers
      if (scheduleData.date && scheduleData.startTime && scheduleData.endTime) {
        const availableCaregivers = await availabilityService.getAvailableCaregivers(
          scheduleData.date,
          scheduleData.startTime,
          scheduleData.endTime
        );
        setAvailableCaregivers(availableCaregivers);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving availability:', error);
      return false;
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for required fields
    if (!scheduleData.clientId || !scheduleData.caregiverId || !scheduleData.date || 
        !scheduleData.startTime || !scheduleData.endTime) {
      notificationService.showNotification(
        'Please fill all required fields',
        'warning'
      );
      return;
    }
    
    // Warn about conflicts but allow overriding
    if (conflicts.length > 0) {
      const proceed = window.confirm(
        'There are scheduling conflicts. Do you want to proceed anyway?\n\n' +
        conflicts.join('\n')
      );
      
      if (!proceed) {
        return;
      }
    }
    
    setLoading(true);
    try {
      // Call the onSave callback with schedule data
      if (onSave) {
        await onSave(scheduleData);
      }
      
      notificationService.showNotification(
        'Schedule saved successfully',
        'success'
      );
    } catch (error) {
      console.error('Error saving schedule:', error);
      notificationService.showNotification(
        'Failed to save schedule',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="schedule-with-availability">
      <h3>Schedule Appointment</h3>
      
      {/* Schedule Form */}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="clientId">Client <span className="required">*</span></label>
            <select
              id="clientId"
              name="clientId"
              value={scheduleData.clientId}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="caregiverId">
              Caregiver <span className="required">*</span>
              <button 
                type="button" 
                className="action-link"
                onClick={handleShowAvailability}
                title="Manage caregiver availability"
              >
                Manage Availability
              </button>
            </label>
            <select
              id="caregiverId"
              name="caregiverId"
              value={scheduleData.caregiverId}
              onChange={handleCaregiverChange}
              required
            >
              <option value="">Select Caregiver</option>
              
              {/* Show available caregivers first */}
              {availableCaregivers.length > 0 && (
                <optgroup label="Available Caregivers">
                  {availableCaregivers.map(caregiver => (
                    <option key={caregiver.id} value={caregiver.id}>
                      {caregiver.firstName} {caregiver.lastName} ✓
                    </option>
                  ))}
                </optgroup>
              )}
              
              {/* Show all caregivers */}
              <optgroup label="All Caregivers">
                {caregivers
                  .filter(caregiver => !availableCaregivers.some(ac => ac.id === caregiver.id))
                  .map(caregiver => (
                    <option key={caregiver.id} value={caregiver.id}>
                      {caregiver.firstName} {caregiver.lastName}
                    </option>
                  ))
                }
              </optgroup>
            </select>
            
            {scheduleData.caregiverId && (
              <button 
                type="button" 
                className="action-link available-slots-link"
                onClick={handleShowNextAvailable}
              >
                Show next available slots
              </button>
            )}
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">Date <span className="required">*</span></label>
            <input
              type="date"
              id="date"
              name="date"
              value={scheduleData.date}
              onChange={handleDateTimeChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="startTime">Start Time <span className="required">*</span></label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              value={scheduleData.startTime}
              onChange={handleDateTimeChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endTime">End Time <span className="required">*</span></label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              value={scheduleData.endTime}
              onChange={handleDateTimeChange}
              required
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={scheduleData.status}
              onChange={handleInputChange}
            >
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={scheduleData.notes}
            onChange={handleInputChange}
            rows={4}
          ></textarea>
        </div>
        
        {/* Conflict Warnings */}
        {conflicts.length > 0 && (
          <div className="conflicts-warning">
            <h4>Scheduling Conflicts:</h4>
            <ul>
              {conflicts.map((conflict, index) => (
                <li key={index}>{conflict}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Schedule'}
          </button>
          
          {onCancel && (
            <button
              type="button"
              className="cancel-button"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      
      {/* Available Slots Panel */}
      {showAvailableSlots && (
        <div className="available-slots-panel">
          <div className="panel-header">
            <h4>Next Available Slots</h4>
            <button 
              className="close-button"
              onClick={() => setShowAvailableSlots(false)}
            >
              ×
            </button>
          </div>
          
          <div className="panel-body">
            {nextAvailableSlots.length === 0 ? (
              <p className="no-slots-message">
                No available slots found in the next 7 days.
              </p>
            ) : (
              <ul className="slots-list">
                {nextAvailableSlots.map((slot, index) => (
                  <li key={index} className="slot-item">
                    <div className="slot-info">
                      <div className="slot-date">{formatDate(slot.date)}</div>
                      <div className="slot-time">
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </div>
                      <div className="slot-duration">
                        {slot.duration.toFixed(1)} hours
                      </div>
                    </div>
                    <button 
                      className="use-slot-button"
                      onClick={() => handleUseSlot(slot)}
                    >
                      Use This Slot
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      
      {/* Availability Manager Modal */}
      {showAvailabilityManager && (
        <div className="availability-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Manage Caregiver Availability</h3>
              <button 
                className="close-button"
                onClick={() => setShowAvailabilityManager(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <AvailabilityManager 
                caregiverId={scheduleData.caregiverId}
                onSave={handleSaveAvailability}
              />
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .schedule-with-availability {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
          position: relative;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #2c3e50;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        @media (min-width: 768px) {
          .form-row {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }
        
        .form-group {
          margin-bottom: 15px;
          position: relative;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #2c3e50;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .required {
          color: #e74c3c;
          margin-left: 4px;
        }
        
        input, select, textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.15s;
        }
        
        input:focus, select:focus, textarea:focus {
          border-color: #3498db;
          outline: none;
        }
        
        .action-link {
          background: none;
          border: none;
          color: #3498db;
          cursor: pointer;
          font-size: 0.8rem;
          text-decoration: underline;
          padding: 0;
        }
        
        .action-link:hover {
          color: #2980b9;
        }
        
        .available-slots-link {
          display: block;
          margin-top: 5px;
          text-align: right;
        }
        
        .conflicts-warning {
          background-color: #fff3cd;
          color: #856404;
          padding: 10px 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .conflicts-warning h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #856404;
        }
        
        .conflicts-warning ul {
          margin: 0;
          padding-left: 20px;
        }
        
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        .submit-button {
          padding: 10px 20px;
          background: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .submit-button:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .submit-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .cancel-button {
          padding: 10px 20px;
          background: #f8f9fa;
          color: #6c757d;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .cancel-button:hover:not(:disabled) {
          background: #e9ecef;
        }
        
        .availability-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal-content {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
        }
        
        .modal-header {
          padding: 15px 20px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .modal-header h3 {
          margin: 0;
        }
        
        .modal-body {
          padding: 20px;
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
        }
        
        .close-button:hover {
          background: #f8f9fa;
          color: #343a40;
        }
        
        .available-slots-panel {
          margin-top: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .panel-header {
          background: #e9ecef;
          padding: 10px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .panel-header h4 {
          margin: 0;
          color: #495057;
        }
        
        .panel-body {
          padding: 15px;
        }
        
        .no-slots-message {
          color: #6c757d;
          text-align: center;
          font-style: italic;
          margin: 20px 0;
        }
        
        .slots-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .slot-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 15px;
          background: white;
          border-radius: 4px;
          margin-bottom: 10px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .slot-date {
          font-weight: 600;
          color: #3498db;
        }
        
        .slot-time {
          margin-top: 4px;
        }
        
        .slot-duration {
          color: #6c757d;
          font-size: 0.9rem;
          margin-top: 4px;
        }
        
        .use-slot-button {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .use-slot-button:hover {
          background: #2980b9;
        }
      `}</style>
    </div>
  );
};

// Helper functions for formatting
const formatDate = (dateString) => {
  const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const formatTime = (timeString) => {
  const [hours, minutes] = timeString.split(':');
  const date = new Date();
  date.setHours(parseInt(hours, 10));
  date.setMinutes(parseInt(minutes, 10));
  
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default ScheduleWithAvailability;

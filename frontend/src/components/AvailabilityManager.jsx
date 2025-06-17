import React, { useState, useEffect } from 'react';
import { notificationService } from '../services';

/**
 * Availability Manager Component
 * 
 * This component allows caregivers to manage their regular availability patterns
 * and request time off. It provides a weekly calendar view for setting regular
 * patterns and a separate interface for time-off requests.
 */
const AvailabilityManager = ({ caregiverId, initialAvailability = null, onSave }) => {
  // Days of week for display
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // State for regular schedule
  const [regularSchedule, setRegularSchedule] = useState([]);
  
  // State for time off
  const [timeOff, setTimeOff] = useState([]);
  
  // State for form controls
  const [showAddScheduleForm, setShowAddScheduleForm] = useState(false);
  const [showAddTimeOffForm, setShowAddTimeOffForm] = useState(false);
  
  // New schedule entry form state
  const [newScheduleEntry, setNewScheduleEntry] = useState({
    dayOfWeek: 1, // Monday default
    startTime: '09:00',
    endTime: '17:00',
    recurrenceType: 'Weekly'
  });
  
  // New time off entry form state
  const [newTimeOffEntry, setNewTimeOffEntry] = useState({
    startDate: new Date().toISOString().split('T')[0], // Today in YYYY-MM-DD format
    endDate: new Date().toISOString().split('T')[0],   // Today in YYYY-MM-DD format
    reason: 'Personal',
    status: 'Pending'
  });
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Initialize component with existing availability data
  useEffect(() => {
    if (initialAvailability) {
      setRegularSchedule(initialAvailability.regularSchedule || []);
      setTimeOff(initialAvailability.timeOff || []);
    }
  }, [initialAvailability]);
  
  // Handle input change for new schedule entry
  const handleScheduleInputChange = (e) => {
    const { name, value } = e.target;
    setNewScheduleEntry(prev => ({
      ...prev,
      [name]: name === 'dayOfWeek' ? parseInt(value, 10) : value
    }));
  };
  
  // Handle input change for new time off entry
  const handleTimeOffInputChange = (e) => {
    const { name, value } = e.target;
    setNewTimeOffEntry(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Add a new schedule entry
  const handleAddScheduleEntry = (e) => {
    e.preventDefault();
    
    // Validate times
    if (newScheduleEntry.startTime >= newScheduleEntry.endTime) {
      setError('End time must be after start time');
      return;
    }
    
    // Check for overlapping schedules on the same day
    const hasOverlap = regularSchedule.some(entry => 
      entry.dayOfWeek === newScheduleEntry.dayOfWeek &&
      ((newScheduleEntry.startTime < entry.endTime && newScheduleEntry.endTime > entry.startTime))
    );
    
    if (hasOverlap) {
      setError('This schedule overlaps with an existing schedule on the same day');
      return;
    }
    
    setRegularSchedule(prev => [...prev, { ...newScheduleEntry }]);
    
    // Reset form
    setNewScheduleEntry({
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      recurrenceType: 'Weekly'
    });
    
    setShowAddScheduleForm(false);
    setError(null);
  };
  
  // Add a new time off entry
  const handleAddTimeOffEntry = (e) => {
    e.preventDefault();
    
    // Validate dates
    if (newTimeOffEntry.startDate > newTimeOffEntry.endDate) {
      setError('End date must be on or after start date');
      return;
    }
    
    setTimeOff(prev => [...prev, { ...newTimeOffEntry }]);
    
    // Reset form
    setNewTimeOffEntry({
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: 'Personal',
      status: 'Pending'
    });
    
    setShowAddTimeOffForm(false);
    setError(null);
  };
  
  // Remove a schedule entry
  const handleRemoveScheduleEntry = (index) => {
    setRegularSchedule(prev => prev.filter((_, i) => i !== index));
  };
  
  // Remove a time off entry
  const handleRemoveTimeOffEntry = (index) => {
    setTimeOff(prev => prev.filter((_, i) => i !== index));
  };
  
  // Save all availability settings
  const handleSaveAvailability = async () => {
    if (!caregiverId) {
      setError('Caregiver ID is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      // Prepare availability data
      const availabilityData = {
        regularSchedule,
        timeOff
      };
      
      // Call the onSave callback with the availability data
      if (onSave) {
        await onSave(caregiverId, availabilityData);
      }
      
      setSaveSuccess(true);
      notificationService.showNotification(
        'Availability settings saved successfully',
        'success'
      );
    } catch (error) {
      console.error('Error saving availability settings:', error);
      setError('Failed to save availability settings. Please try again.');
      
      notificationService.showNotification(
        'Failed to save availability settings',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format time for display
  const formatTime = (timeString) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timeString;
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };
  
  return (
    <div className="availability-manager">
      <h3>Availability Manager</h3>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {saveSuccess && (
        <div className="success-message">
          Availability settings saved successfully!
        </div>
      )}
      
      <div className="availability-sections">
        {/* Regular Schedule Section */}
        <div className="availability-section">
          <h4>Regular Weekly Schedule</h4>
          
          {regularSchedule.length === 0 ? (
            <div className="empty-state">
              No regular schedule set. Click 'Add Schedule' to set your weekly availability.
            </div>
          ) : (
            <div className="schedule-list">
              {regularSchedule.map((schedule, index) => (
                <div key={index} className="schedule-entry">
                  <div className="schedule-details">
                    <div className="day-of-week">{DAYS_OF_WEEK[schedule.dayOfWeek]}</div>
                    <div className="time-range">
                      {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                    </div>
                    <div className="recurrence-type">{schedule.recurrenceType}</div>
                  </div>
                  <button 
                    className="remove-button"
                    onClick={() => handleRemoveScheduleEntry(index)}
                    title="Remove schedule"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {showAddScheduleForm ? (
            <form className="add-schedule-form" onSubmit={handleAddScheduleEntry}>
              <h5>Add New Schedule</h5>
              
              <div className="form-group">
                <label htmlFor="dayOfWeek">Day of Week</label>
                <select 
                  id="dayOfWeek"
                  name="dayOfWeek"
                  value={newScheduleEntry.dayOfWeek}
                  onChange={handleScheduleInputChange}
                  required
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startTime">Start Time</label>
                  <input 
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={newScheduleEntry.startTime}
                    onChange={handleScheduleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="endTime">End Time</label>
                  <input 
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={newScheduleEntry.endTime}
                    onChange={handleScheduleInputChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="recurrenceType">Recurrence</label>
                <select
                  id="recurrenceType"
                  name="recurrenceType"
                  value={newScheduleEntry.recurrenceType}
                  onChange={handleScheduleInputChange}
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Biweekly">Biweekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="submit-button">
                  Add Schedule
                </button>
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowAddScheduleForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button 
              className="add-button"
              onClick={() => setShowAddScheduleForm(true)}
            >
              <span className="icon">+</span>
              Add Schedule
            </button>
          )}
        </div>
        
        {/* Time Off Section */}
        <div className="availability-section">
          <h4>Time Off</h4>
          
          {timeOff.length === 0 ? (
            <div className="empty-state">
              No time off scheduled. Click 'Request Time Off' to add time off.
            </div>
          ) : (
            <div className="time-off-list">
              {timeOff.map((entry, index) => (
                <div key={index} className="time-off-entry">
                  <div className="time-off-details">
                    <div className="date-range">
                      {formatDate(entry.startDate)} - {formatDate(entry.endDate)}
                    </div>
                    <div className="reason">{entry.reason}</div>
                    <div className={`status status-${entry.status.toLowerCase()}`}>
                      {entry.status}
                    </div>
                  </div>
                  <button 
                    className="remove-button"
                    onClick={() => handleRemoveTimeOffEntry(index)}
                    title="Remove time off"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {showAddTimeOffForm ? (
            <form className="add-time-off-form" onSubmit={handleAddTimeOffEntry}>
              <h5>Request Time Off</h5>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startDate">Start Date</label>
                  <input 
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={newTimeOffEntry.startDate}
                    onChange={handleTimeOffInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="endDate">End Date</label>
                  <input 
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={newTimeOffEntry.endDate}
                    onChange={handleTimeOffInputChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="reason">Reason</label>
                <select
                  id="reason"
                  name="reason"
                  value={newTimeOffEntry.reason}
                  onChange={handleTimeOffInputChange}
                >
                  <option value="Personal">Personal</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Sick">Sick</option>
                  <option value="Family">Family</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="submit-button">
                  Request Time Off
                </button>
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowAddTimeOffForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button 
              className="add-button"
              onClick={() => setShowAddTimeOffForm(true)}
            >
              <span className="icon">+</span>
              Request Time Off
            </button>
          )}
        </div>
      </div>
      
      <div className="availability-actions">
        <button 
          className="save-button"
          onClick={handleSaveAvailability}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Availability Settings'}
        </button>
      </div>
      
      <style jsx>{`
        .availability-manager {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #2c3e50;
        }
        
        h4 {
          color: #3498db;
          border-bottom: 1px solid #e9ecef;
          padding-bottom: 10px;
          margin-top: 0;
        }
        
        h5 {
          margin-top: 0;
          color: #2c3e50;
        }
        
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .success-message {
          background-color: #d4edda;
          color: #155724;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .availability-sections {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        @media (min-width: 768px) {
          .availability-sections {
            grid-template-columns: 1fr 1fr;
          }
        }
        
        .availability-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          min-height: 300px;
          display: flex;
          flex-direction: column;
        }
        
        .empty-state {
          color: #6c757d;
          font-style: italic;
          text-align: center;
          padding: 20px;
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .schedule-list,
        .time-off-list {
          margin-bottom: 15px;
          flex-grow: 1;
        }
        
        .schedule-entry,
        .time-off-entry {
          background: white;
          border-left: 3px solid #3498db;
          border-radius: 4px;
          padding: 10px 15px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .day-of-week {
          font-weight: 600;
          color: #3498db;
        }
        
        .time-range {
          margin-top: 4px;
        }
        
        .recurrence-type {
          font-size: 0.85rem;
          color: #6c757d;
          margin-top: 4px;
        }
        
        .date-range {
          font-weight: 600;
        }
        
        .reason {
          margin-top: 4px;
        }
        
        .status {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 0.8rem;
          margin-top: 4px;
        }
        
        .status-pending {
          background-color: #fef9e7;
          color: #f39c12;
        }
        
        .status-approved {
          background-color: #eafaf1;
          color: #2ecc71;
        }
        
        .status-denied {
          background-color: #fdedec;
          color: #e74c3c;
        }
        
        .remove-button {
          background: none;
          border: none;
          color: #6c757d;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }
        
        .remove-button:hover {
          background-color: #f8f9fa;
          color: #e74c3c;
        }
        
        .add-button {
          background: #e9ecef;
          border: none;
          border-radius: 4px;
          padding: 10px;
          color: #495057;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          margin-top: auto;
        }
        
        .add-button:hover {
          background: #dee2e6;
        }
        
        .icon {
          margin-right: 5px;
          font-weight: bold;
        }
        
        .add-schedule-form,
        .add-time-off-form {
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-top: auto;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #495057;
        }
        
        input,
        select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          transition: border-color 0.15s;
        }
        
        input:focus,
        select:focus {
          border-color: #3498db;
          outline: none;
        }
        
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        .submit-button {
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .submit-button:hover {
          background: #2980b9;
        }
        
        .cancel-button {
          padding: 8px 16px;
          background: #e9ecef;
          color: #495057;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .cancel-button:hover {
          background: #dee2e6;
        }
        
        .availability-actions {
          margin-top: 20px;
          display: flex;
          justify-content: flex-end;
        }
        
        .save-button {
          padding: 10px 20px;
          background: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .save-button:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .save-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default AvailabilityManager;

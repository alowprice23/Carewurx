import React, { useState, useEffect } from 'react';
import { 
  notificationService,
  universalDataService,
  universalScheduleService
} from '../services';
// No direct firebaseService.db needed anymore

/**
 * Client Profile Form - Simplified
 * 
 * Allows creating and editing client profiles with integrated
 * schedule requirements and care needs.
 */
const ClientProfileForm = ({ clientId, onSave, onCancel, initialTab = 'basic' }) => {
  // Basic profile state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    careNeeds: [],
    transportation: {
      onBusLine: false,
      requiresDriverCaregiver: false,
      mobilityEquipment: []
    }
  });
  
  // Schedule requirements state
  const [scheduleData, setScheduleData] = useState({
    serviceHours: {
      hoursPerWeek: 0,
      preferredDays: [],
      preferredTimeRanges: []
    },
    recurringSchedules: [],
    singleDateSchedules: []
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNewClient, setIsNewClient] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Constants
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const CARE_NEEDS = [
    { id: 'mobility', label: 'Mobility Assistance' },
    { id: 'medication', label: 'Medication Management' },
    { id: 'bathing', label: 'Bathing Assistance' },
    { id: 'meals', label: 'Meal Preparation' },
    { id: 'companionship', label: 'Companionship' },
    { id: 'housekeeping', label: 'Light Housekeeping' }
  ];
  const RECURRENCE_TYPES = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'biweekly', label: 'Every 2 Weeks' },
    { id: 'monthly', label: 'Monthly' }
  ];

  // Load client data if editing existing client
  useEffect(() => {
    if (!clientId) {
      setIsNewClient(true);
      return;
    }
    
    const loadClientData = async () => {
      setLoading(true);
      setIsNewClient(false);
      setError(null); // Clear previous errors
      
      try {
        // Load basic profile
        const clientData = await universalDataService.getClient(clientId);
        if (clientData) {
          setProfileData({
            firstName: clientData.firstName || '',
            lastName: clientData.lastName || '',
            email: clientData.email || '',
            phone: clientData.phone || '',
            address: clientData.address || '',
            careNeeds: clientData.careNeeds || [],
            transportation: clientData.transportation || {
              onBusLine: false,
              requiresDriverCaregiver: false,
              mobilityEquipment: []
            }
          });
          
          if (clientData.serviceHours) {
            setScheduleData(prev => ({
              ...prev,
              serviceHours: clientData.serviceHours
            }));
          }
        } else {
          setError(`Client with ID ${clientId} not found.`);
          notificationService.showNotification(`Client with ID ${clientId} not found.`, 'error');
          // Potentially call onCancel or redirect if client not found
          return;
        }
        
        // Load all schedules for the client
        const allSchedules = await universalScheduleService.getSchedules({ clientId, includeDetails: true });
        
        const recurringSchedules = [];
        const singleDateSchedules = [];

        allSchedules.forEach(schedule => {
          // Assuming schedule objects from universalScheduleService have an `id` property
          // and match the fields expected by the form state.
          // Timestamps might need conversion if they are Firestore Timestamps.
          // For now, assuming they are ISO strings or directly usable.
          const commonScheduleData = {
            id: schedule.id,
            startTime: schedule.startTime, // Ensure format matches (e.g., "HH:mm")
            endTime: schedule.endTime,   // Ensure format matches
            careNeeds: schedule.careNeeds || [],
            notes: schedule.notes || ''
          };

          if (schedule.isRecurring) {
            recurringSchedules.push({
              ...commonScheduleData,
              dayOfWeek: schedule.dayOfWeek, // Or recurringPattern.dayOfWeek
              recurrenceType: schedule.recurrenceType || schedule.recurringPattern?.type || 'weekly',
              recurrenceInterval: schedule.recurrenceInterval || schedule.recurringPattern?.interval || 1,
              startDate: schedule.startDate || schedule.recurringPattern?.startDate || new Date().toISOString().split('T')[0]
            });
          } else {
            singleDateSchedules.push({
              ...commonScheduleData,
              date: schedule.date // Ensure format matches (e.g., "YYYY-MM-DD")
            });
          }
        });
        
        setScheduleData(prev => ({
          ...prev,
          recurringSchedules,
          singleDateSchedules
        }));

      } catch (err) {
        console.error('Error loading client data via service:', err);
        setError('Failed to load client data. Please try again.');
        notificationService.showNotification('Failed to load client data.', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadClientData();
  }, [clientId]);
  
  // Handle basic profile field changes
  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('transportation.')) {
      const transportField = name.split('.')[1];
      setProfileData(prev => ({
        ...prev,
        transportation: {
          ...prev.transportation,
          [transportField]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };
  
  // Handle care need selection
  const handleCareNeedToggle = (needId) => {
    setProfileData(prev => {
      const currentNeeds = prev.careNeeds || [];
      
      if (currentNeeds.some(need => typeof need === 'object' ? need.type === needId : need === needId)) {
        return {
          ...prev,
          careNeeds: currentNeeds.filter(need => typeof need === 'object' ? need.type !== needId : need !== needId)
        };
      } else {
        const need = CARE_NEEDS.find(n => n.id === needId);
        return {
          ...prev,
          careNeeds: [...currentNeeds, { 
            type: needId, 
            description: need?.label || needId,
            priority: 3
          }]
        };
      }
    });
  };
  
  // Handle preferred days selection
  const handlePreferredDayToggle = (day) => {
    setScheduleData(prev => {
      const currentDays = prev.serviceHours.preferredDays || [];
      
      if (currentDays.includes(day)) {
        return {
          ...prev,
          serviceHours: {
            ...prev.serviceHours,
            preferredDays: currentDays.filter(d => d !== day)
          }
        };
      } else {
        return {
          ...prev,
          serviceHours: {
            ...prev.serviceHours,
            preferredDays: [...currentDays, day].sort()
          }
        };
      }
    });
  };
  
  // Handle adding a recurring schedule
  const handleAddRecurringSchedule = () => {
    const today = new Date().toISOString().split('T')[0];
    
    setScheduleData(prev => ({
      ...prev,
      recurringSchedules: [
        ...prev.recurringSchedules,
        {
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '12:00',
          careNeeds: profileData.careNeeds.map(need => typeof need === 'object' ? need.type : need),
          notes: '',
          recurrenceType: 'weekly',
          recurrenceInterval: 1,
          startDate: today
        }
      ]
    }));
  };
  
  // Handle adding a single date schedule
  const handleAddSingleDateSchedule = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    setScheduleData(prev => ({
      ...prev,
      singleDateSchedules: [
        ...prev.singleDateSchedules,
        {
          date: tomorrowStr,
          startTime: '09:00',
          endTime: '12:00',
          careNeeds: profileData.careNeeds.map(need => typeof need === 'object' ? need.type : need),
          notes: ''
        }
      ]
    }));
  };
  
  // Handle removing a recurring schedule
  const handleRemoveRecurringSchedule = (index) => {
    setScheduleData(prev => ({
      ...prev,
      recurringSchedules: prev.recurringSchedules.filter((_, i) => i !== index)
    }));
  };
  
  // Handle removing a single date schedule
  const handleRemoveSingleDateSchedule = (index) => {
    setScheduleData(prev => ({
      ...prev,
      singleDateSchedules: prev.singleDateSchedules.filter((_, i) => i !== index)
    }));
  };
  
  // Handle recurring schedule field changes
  const handleRecurringScheduleChange = (index, field, value) => {
    setScheduleData(prev => {
      const updatedSchedules = [...prev.recurringSchedules];
      
      if (field === 'dayOfWeek' || field === 'recurrenceInterval') {
        updatedSchedules[index] = {
          ...updatedSchedules[index],
          [field]: parseInt(value, 10)
        };
      } else {
        updatedSchedules[index] = {
          ...updatedSchedules[index],
          [field]: value
        };
      }
      
      return {
        ...prev,
        recurringSchedules: updatedSchedules
      };
    });
  };
  
  // Handle single date schedule field changes
  const handleSingleDateScheduleChange = (index, field, value) => {
    setScheduleData(prev => {
      const updatedSchedules = [...prev.singleDateSchedules];
      
      updatedSchedules[index] = {
        ...updatedSchedules[index],
        [field]: value
      };
      
      return {
        ...prev,
        singleDateSchedules: updatedSchedules
      };
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Clear previous errors

    try {
      let currentClientId = clientId;
      
      // 1. Save basic profile data
      const clientPayload = {
        ...profileData, // Contains firstName, lastName, email, phone, address, careNeeds, transportation
        serviceHours: scheduleData.serviceHours, // Add serviceHours here
        // serviceStatus, createdAt, updatedAt will be handled by the service or backend
      };

      if (isNewClient) {
        const createdClient = await universalDataService.createClient(clientPayload);
        if (!createdClient || !createdClient.id) {
          throw new Error('Failed to create client or received no ID.');
        }
        currentClientId = createdClient.id;
        notificationService.showNotification('Client created successfully!', 'success');
      } else {
        await universalDataService.updateClient(currentClientId, clientPayload);
        notificationService.showNotification('Client updated successfully!', 'success');
      }

      // 2. Sync Schedules
      if (!currentClientId) {
        // This should ideally not happen if create/update client was successful and an ID was obtained.
        throw new Error("Client ID is missing, cannot process schedules.");
      }

      const existingSchedules = await universalScheduleService.getSchedules({ clientId: currentClientId, includeDetails: true });
      const existingRecurring = existingSchedules.filter(s => s.isRecurring);
      const existingSingle = existingSchedules.filter(s => !s.isRecurring);

      const formRecurringSchedules = scheduleData.recurringSchedules || [];
      const formSingleDateSchedules = scheduleData.singleDateSchedules || [];

      // Helper to compare schedules (excluding id, clientId, and timestamps)
      // This is a simplified comparison; more robust might be needed for deeply nested objects if any.
      const schedulesAreEqual = (formSched, existingSched) => {
        const fieldsToCompare = ['dayOfWeek', 'startTime', 'endTime', 'notes', 'recurrenceType', 'recurrenceInterval', 'startDate', 'date', 'isRecurring'];
        // Add careNeeds comparison if it's an array of complex objects that need deep compare
        for (const field of fieldsToCompare) {
          if (formSched[field] !== existingSched[field]) return false;
        }
        // Simple careNeeds comparison (assumes array of strings or simple values)
        if (JSON.stringify(formSched.careNeeds?.sort()) !== JSON.stringify(existingSched.careNeeds?.sort())) return false;
        return true;
      };
      
      // --- Process Recurring Schedules ---
      // Deletions: existing recurring not in form's recurring
      for (const existing of existingRecurring) {
        if (!formRecurringSchedules.find(formSched => formSched.id === existing.id)) {
          await universalScheduleService.deleteSchedule(existing.id);
        }
      }
      // Updates & Creations
      for (const formSched of formRecurringSchedules) {
        const payload = { ...formSched, clientId: currentClientId, isRecurring: true };
        delete payload.id; // Remove ID for create/update payload where ID is path param

        if (formSched.id) { // Potential Update
          const existingMatch = existingRecurring.find(s => s.id === formSched.id);
          if (existingMatch && !schedulesAreEqual(formSched, existingMatch)) { // Check if changed
             // Ensure only relevant fields are sent for update; services should handle this
            await universalScheduleService.updateSchedule(formSched.id, payload);
          }
        } else { // Creation
          await universalScheduleService.createSchedule(payload);
        }
      }

      // --- Process Single-Date Schedules ---
      // Deletions
      for (const existing of existingSingle) {
        if (!formSingleDateSchedules.find(formSched => formSched.id === existing.id)) {
          await universalScheduleService.deleteSchedule(existing.id);
        }
      }
      // Updates & Creations
      for (const formSched of formSingleDateSchedules) {
        const payload = { ...formSched, clientId: currentClientId, isRecurring: false };
        delete payload.id;

        if (formSched.id) { // Potential Update
          const existingMatch = existingSingle.find(s => s.id === formSched.id);
          if (existingMatch && !schedulesAreEqual(formSched, existingMatch)) { // Check if changed
            await universalScheduleService.updateSchedule(formSched.id, payload);
          }
        } else { // Creation
          await universalScheduleService.createSchedule(payload);
        }
      }
      
      // General success message was already shown for client profile.
      // Could add a specific "Schedules updated" if needed, but might be too noisy.
      // notificationService.showNotification(
      //   `Client schedules ${isNewClient ? 'created' : 'updated'} successfully`,
      //   'success'
      // ); // This might be redundant if previous notification is sufficient
      
      if (onSave) {
        onSave(currentClientId); // Pass the client ID (new or existing)
      }
    } catch (err) {
      console.error('Error saving client and schedules via service:', err);
      setError(`Failed to ${isNewClient ? 'create' : 'update'} client: ${err.message}`);
      notificationService.showNotification(
        `Failed to ${isNewClient ? 'create' : 'update'} client: ${err.message}`,
        'error' // Corrected notification type
      );
      // Removed onSave(id) from catch block and the duplicate catch block
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="client-profile-form">
      <h2>{isNewClient ? 'Add New Client' : 'Edit Client Profile'}</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-tabs">
        <button 
          className={activeTab === 'basic' ? 'active' : ''}
          onClick={() => setActiveTab('basic')}
        >
          Basic Information
        </button>
        <button 
          className={activeTab === 'care' ? 'active' : ''}
          onClick={() => setActiveTab('care')}
        >
          Care Needs
        </button>
        <button 
          className={activeTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule Requirements
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Basic Information Tab */}
        {activeTab === 'basic' && (
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstNameInput">First Name</label>
                <input
                  id="firstNameInput"
                  type="text"
                  name="firstName"
                  value={profileData.firstName || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastNameInput">Last Name</label>
                <input
                  id="lastNameInput"
                  type="text"
                  name="lastName"
                  value={profileData.lastName || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="emailInput">Email</label>
                <input
                  id="emailInput"
                  type="email"
                  name="email"
                  value={profileData.email || ''}
                  onChange={handleProfileChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phoneInput">Phone</label>
                <input
                  id="phoneInput"
                  type="tel"
                  name="phone"
                  value={profileData.phone || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="addressInput">Address</label>
              <textarea
                id="addressInput"
                name="address"
                value={profileData.address || ''}
                onChange={handleProfileChange}
                rows={3}
              />
            </div>
            
            <h3>Transportation</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="onBusLineCheckbox">
                  <input
                    id="onBusLineCheckbox"
                    type="checkbox"
                    name="transportation.onBusLine"
                    checked={profileData.transportation?.onBusLine || false}
                    onChange={handleProfileChange}
                  />
                  On Bus Line
                </label>
              </div>
              
              <div className="form-group">
                <label htmlFor="requiresDriverCaregiverCheckbox">
                  <input
                    id="requiresDriverCaregiverCheckbox"
                    type="checkbox"
                    name="transportation.requiresDriverCaregiver"
                    checked={profileData.transportation?.requiresDriverCaregiver || false}
                    onChange={handleProfileChange}
                  />
                  Requires Caregiver with Car
                </label>
              </div>
            </div>
          </div>
        )}
        
        {/* Care Needs Tab */}
        {activeTab === 'care' && (
          <div className="form-section">
            <h3>Client Care Needs</h3>
            <p>Select all care needs that apply to this client.</p>
            
            <div className="care-needs-container">
              {CARE_NEEDS.map(need => (
                <div key={need.id} className="care-need-checkbox">
                  <label htmlFor={`careNeed-${need.id}`}>
                    <input
                      id={`careNeed-${need.id}`}
                      type="checkbox"
                      checked={profileData.careNeeds?.some(clientNeed => 
                        typeof clientNeed === 'object' 
                          ? clientNeed.type === need.id 
                          : clientNeed === need.id
                      ) || false}
                      onChange={() => handleCareNeedToggle(need.id)}
                    />
                    {need.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Schedule Requirements Tab */}
        {activeTab === 'schedule' && (
          <div className="form-section">
            <h3>Service Hours</h3>
            
            <div className="form-group">
              <label htmlFor="hoursPerWeekInput">Hours Per Week</label>
              <input
                id="hoursPerWeekInput"
                type="number"
                name="hoursPerWeek"
                min="0"
                max="168"
                value={scheduleData.serviceHours?.hoursPerWeek || 0}
                onChange={(e) => setScheduleData(prev => ({
                  ...prev,
                  serviceHours: {
                    ...prev.serviceHours,
                    hoursPerWeek: parseInt(e.target.value, 10)
                  }
                }))}
              />
            </div>
            
            <h4>Preferred Days</h4>
            <div className="days-container">
              {DAYS_OF_WEEK.map((day, dayIndex) => ( // Use dayIndex to avoid conflict with map index if used elsewhere
                <div key={dayIndex} className="day-checkbox">
                  <label htmlFor={`preferredDay-${dayIndex}`}>
                    <input
                      id={`preferredDay-${dayIndex}`}
                      type="checkbox"
                      checked={scheduleData.serviceHours?.preferredDays?.includes(dayIndex) || false}
                      onChange={() => handlePreferredDayToggle(dayIndex)}
                    />
                    {day}
                  </label>
                </div>
              ))}
            </div>
            
            <h3>Recurring Schedules</h3>
            
            {scheduleData.recurringSchedules.map((schedule, index) => (
              <div key={index} className="schedule-entry">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor={`recurringDayOfWeek-${index}`}>Day of Week</label>
                    <select
                      id={`recurringDayOfWeek-${index}`}
                      value={schedule.dayOfWeek}
                      onChange={(e) => handleRecurringScheduleChange(index, 'dayOfWeek', e.target.value)}
                    >
                      {DAYS_OF_WEEK.map((day, i) => (
                        <option key={i} value={i}>{day}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`recurringStartTime-${index}`}>Start Time</label>
                    <input
                      id={`recurringStartTime-${index}`}
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => handleRecurringScheduleChange(index, 'startTime', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`recurringEndTime-${index}`}>End Time</label>
                    <input
                      id={`recurringEndTime-${index}`}
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => handleRecurringScheduleChange(index, 'endTime', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`recurringRecurrenceType-${index}`}>Recurrence</label>
                    <select
                      id={`recurringRecurrenceType-${index}`}
                      value={schedule.recurrenceType || 'weekly'}
                      onChange={(e) => handleRecurringScheduleChange(index, 'recurrenceType', e.target.value)}
                    >
                      {RECURRENCE_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`recurringStartDate-${index}`}>Start Date</label>
                    <input
                      id={`recurringStartDate-${index}`}
                      type="date"
                      value={schedule.startDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleRecurringScheduleChange(index, 'startDate', e.target.value)}
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleRemoveRecurringSchedule(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={handleAddRecurringSchedule}
            >
              Add Recurring Schedule
            </button>
            
            <h3>Single Date Schedules</h3>
            
            {scheduleData.singleDateSchedules.map((schedule, index) => (
              <div key={index} className="schedule-entry">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor={`singleDateDate-${index}`}>Date</label>
                    <input
                      id={`singleDateDate-${index}`}
                      type="date"
                      value={schedule.date}
                      onChange={(e) => handleSingleDateScheduleChange(index, 'date', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`singleDateStartTime-${index}`}>Start Time</label>
                    <input
                      id={`singleDateStartTime-${index}`}
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => handleSingleDateScheduleChange(index, 'startTime', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`singleDateEndTime-${index}`}>End Time</label>
                    <input
                      id={`singleDateEndTime-${index}`}
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => handleSingleDateScheduleChange(index, 'endTime', e.target.value)}
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleRemoveSingleDateSchedule(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={handleAddSingleDateSchedule}
            >
              Add Single Date Schedule
            </button>
          </div>
        )}
        
        <div className="form-actions">
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
          
          <button
            type="submit"
            className="save-button"
            disabled={loading}
          >
            {loading ? 'Saving...' : isNewClient ? 'Create Client' : 'Update Client'}
          </button>
        </div>
      </form>
      
      <style jsx>{`
        .client-profile-form {
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .form-tabs {
          display: flex;
          border-bottom: 1px solid #e9ecef;
          margin-bottom: 20px;
        }
        
        .form-tabs button {
          padding: 10px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
        }
        
        .form-tabs button.active {
          border-bottom-color: #3498db;
          color: #3498db;
        }
        
        .form-section {
          margin-bottom: 20px;
        }
        
        .form-row {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .form-group {
          flex: 1;
          min-width: 200px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
        }
        
        input, select, textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .days-container, .care-needs-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .schedule-entry {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        button {
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
          margin-bottom: 10px;
        }
        
        button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        
        .save-button {
          background: #2ecc71;
        }
        
        .save-button:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .cancel-button {
          background: #95a5a6;
        }
        
        .cancel-button:hover:not(:disabled) {
          background: #7f8c8d;
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ClientProfileForm;

import React, { useState, useEffect } from 'react';
import { 
  firebaseService,
  notificationService 
} from '../services';

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
      
      try {
        // Load basic profile
        const clientDoc = await firebaseService.db.collection('clients').doc(clientId).get();
        if (clientDoc.exists) {
          const data = clientDoc.data();
          setProfileData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
            careNeeds: data.careNeeds || [],
            transportation: data.transportation || {
              onBusLine: false,
              requiresDriverCaregiver: false,
              mobilityEquipment: []
            }
          });
          
          if (data.serviceHours) {
            setScheduleData(prev => ({
              ...prev,
              serviceHours: data.serviceHours
            }));
          }
        }
        
        // Load recurring schedules
        const recurringSchedulesSnapshot = await firebaseService.db.collection('schedules')
          .where('client_id', '==', clientId)
          .where('isRecurring', '==', true)
          .get();
          
        const recurringSchedules = recurringSchedulesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            dayOfWeek: data.dayOfWeek,
            startTime: data.startTime,
            endTime: data.endTime,
            careNeeds: data.careNeeds || [],
            notes: data.notes || '',
            recurrenceType: data.recurrenceType || 'weekly',
            recurrenceInterval: data.recurrenceInterval || 1,
            startDate: data.startDate || new Date().toISOString().split('T')[0]
          };
        });
        
        // Load single date schedules
        const singleDateSchedulesSnapshot = await firebaseService.db.collection('schedules')
          .where('client_id', '==', clientId)
          .where('isRecurring', '==', false)
          .get();
        
        const singleDateSchedules = singleDateSchedulesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            careNeeds: data.careNeeds || [],
            notes: data.notes || ''
          };
        });
        
        setScheduleData(prev => ({
          ...prev,
          recurringSchedules,
          singleDateSchedules
        }));
      } catch (err) {
        console.error('Error loading client data:', err);
        setError('Failed to load client data');
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
    
    try {
      let id = clientId;
      
      // 1. Save basic profile data
      if (isNewClient) {
        // Create new client
        const newDocRef = await firebaseService.db.collection('clients').add({
          ...profileData,
          serviceHours: scheduleData.serviceHours,
          serviceStatus: 'Active',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        id = newDocRef.id;
      } else {
        // Update existing client
        await firebaseService.db.collection('clients')
          .doc(id)
          .update({
            ...profileData,
            serviceHours: scheduleData.serviceHours,
            updatedAt: new Date()
          });
      }
      
      // 2. Save schedules using batch operation
      const batch = firebaseService.db.batch();
      
      // Handle existing schedules if not a new client
      if (!isNewClient) {
        // Get and delete existing recurring schedules
        const existingRecurringSnapshot = await firebaseService.db.collection('schedules')
          .where('client_id', '==', id)
          .where('isRecurring', '==', true)
          .get();
        
        existingRecurringSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Get and delete existing single date schedules
        const existingSingleDateSnapshot = await firebaseService.db.collection('schedules')
          .where('client_id', '==', id)
          .where('isRecurring', '==', false)
          .get();
        
        existingSingleDateSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }
      
      // Create new recurring schedules
      for (const schedule of scheduleData.recurringSchedules) {
        const newScheduleRef = firebaseService.db.collection('schedules').doc();
        
        batch.set(newScheduleRef, {
          client_id: id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          careNeeds: schedule.careNeeds,
          notes: schedule.notes,
          isRecurring: true,
          recurrenceType: schedule.recurrenceType || 'weekly',
          recurrenceInterval: schedule.recurrenceInterval || 1,
          startDate: schedule.startDate || new Date().toISOString().split('T')[0],
          status: 'Needs Assignment',
          caregiver_id: '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Create new single date schedules
      for (const schedule of scheduleData.singleDateSchedules) {
        const newScheduleRef = firebaseService.db.collection('schedules').doc();
        
        batch.set(newScheduleRef, {
          client_id: id,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          careNeeds: schedule.careNeeds,
          notes: schedule.notes,
          isRecurring: false,
          status: 'Needs Assignment',
          caregiver_id: '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      await batch.commit();
      
      notificationService.showNotification(
        `Client ${isNewClient ? 'created' : 'updated'} successfully`,
        'success'
      );
      
      if (onSave) {
        onSave(id);
      }
    } catch (err) {
      console.error('Error saving client:', err);
      setError(`Failed to ${isNewClient ? 'create' : 'update'} client`);
      notificationService.showNotification(
        `Failed to ${isNewClient ? 'create' : 'update'} client`,
        'error'
      );
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
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={profileData.firstName || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
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
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email || ''}
                  onChange={handleProfileChange}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={profileData.phone || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Address</label>
              <textarea
                name="address"
                value={profileData.address || ''}
                onChange={handleProfileChange}
                rows={3}
              />
            </div>
            
            <h3>Transportation</h3>
            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="transportation.onBusLine"
                    checked={profileData.transportation?.onBusLine || false}
                    onChange={handleProfileChange}
                  />
                  On Bus Line
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
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
                  <label>
                    <input
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
              <label>Hours Per Week</label>
              <input
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
              {DAYS_OF_WEEK.map((day, index) => (
                <div key={index} className="day-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={scheduleData.serviceHours?.preferredDays?.includes(index) || false}
                      onChange={() => handlePreferredDayToggle(index)}
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
                    <label>Day of Week</label>
                    <select
                      value={schedule.dayOfWeek}
                      onChange={(e) => handleRecurringScheduleChange(index, 'dayOfWeek', e.target.value)}
                    >
                      {DAYS_OF_WEEK.map((day, i) => (
                        <option key={i} value={i}>{day}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => handleRecurringScheduleChange(index, 'startTime', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>End Time</label>
                    <input
                      type="time"
                      value={schedule.endTime}
                      onChange={(e) => handleRecurringScheduleChange(index, 'endTime', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Recurrence</label>
                    <select
                      value={schedule.recurrenceType || 'weekly'}
                      onChange={(e) => handleRecurringScheduleChange(index, 'recurrenceType', e.target.value)}
                    >
                      {RECURRENCE_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
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
                    <label>Date</label>
                    <input
                      type="date"
                      value={schedule.date}
                      onChange={(e) => handleSingleDateScheduleChange(index, 'date', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={schedule.startTime}
                      onChange={(e) => handleSingleDateScheduleChange(index, 'startTime', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>End Time</label>
                    <input
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

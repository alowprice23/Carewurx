import React, { useState, useEffect } from 'react';
import { 
  firebaseService,
  notificationService 
} from '../services';

/**
 * Caregiver Profile Form
 * 
 * This component allows creating and editing caregiver profiles
 * with integrated availability management.
 */
const CaregiverProfileForm = ({ caregiverId, onSave, onCancel, initialTab = 'basic' }) => {
  // Basic profile state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    skills: [],
    transportation: {
      hasCar: false,
      hasLicense: false,
      usesPublicTransport: false,
      travelRadius: 10
    },
    // Placeholder for self-improvement data - loaded from caregiverDoc.data()
    // inferredSkills: [],
    // performanceMetrics: {},
    // feedbackSummary: '',
    // preferenceNotes: '',
    // certifications: [], // Could be part of basic info or a separate section
    // trainingCompleted: [], // Could be part of skills or separate
  });
  
  // Availability state
  const [availabilityData, setAvailabilityData] = useState({
    regularSchedule: [],
    timeOff: []
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNewCaregiver, setIsNewCaregiver] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab); // 'basic', 'skills', 'availability'
  
  // Skill options
  const SKILL_OPTIONS = [
    { id: 'mobility', label: 'Mobility Assistance' },
    { id: 'medication', label: 'Medication Management' },
    { id: 'bathing', label: 'Bathing Assistance' },
    { id: 'meals', label: 'Meal Preparation' },
    { id: 'companionship', label: 'Companionship' },
    { id: 'housekeeping', label: 'Light Housekeeping' },
    { id: 'transportation', label: 'Transportation' },
    { id: 'memory', label: 'Memory Care' },
    { id: 'transfer', label: 'Transfer Assistance' }
  ];
  
  // Load caregiver data if editing existing caregiver
  useEffect(() => {
    const loadCaregiverData = async () => {
      if (!caregiverId) {
        setIsNewCaregiver(true);
        return;
      }
      
      setLoading(true);
      setIsNewCaregiver(false);
      
      try {
        // Load basic profile data
        const caregiverDoc = await firebaseService.db.collection('caregivers')
          .doc(caregiverId)
          .get();
          
        if (caregiverDoc.exists) {
          setProfileData(caregiverDoc.data());
        } else {
          setError('Caregiver not found');
        }
        
        // Load availability data
        const availabilityDoc = await firebaseService.db.collection('caregiver_availability')
          .doc(caregiverId)
          .get();
          
        if (availabilityDoc.exists) {
          const data = availabilityDoc.data();
          
          // Process time off dates (convert Timestamps to strings)
          const timeOff = (data.timeOff || []).map(item => ({
            ...item,
            startDate: item.startDate?.toDate?.() 
              ? item.startDate.toDate().toISOString().split('T')[0]
              : item.startDate,
            endDate: item.endDate?.toDate?.() 
              ? item.endDate.toDate().toISOString().split('T')[0]
              : item.endDate
          }));
          
          setAvailabilityData({
            regularSchedule: data.regularSchedule || [],
            timeOff
          });
        }
      } catch (err) {
        console.error('Error loading caregiver data:', err);
        setError('Failed to load caregiver data');
        notificationService.showNotification(
          'Failed to load caregiver data',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };
    
    loadCaregiverData();
  }, [caregiverId]);
  
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
  
  // Handle skill selection
  const handleSkillToggle = (skillId) => {
    setProfileData(prev => {
      const currentSkills = prev.skills || [];
      
      if (currentSkills.includes(skillId)) {
        // Remove skill
        return {
          ...prev,
          skills: currentSkills.filter(id => id !== skillId)
        };
      } else {
        // Add skill
        return {
          ...prev,
          skills: [...currentSkills, skillId]
        };
      }
    });
  };
  
  // Handle adding a regular schedule entry
  const handleAddScheduleEntry = () => {
    setAvailabilityData(prev => ({
      ...prev,
      regularSchedule: [
        ...prev.regularSchedule,
        {
          dayOfWeek: 1, // Default to Monday
          startTime: '09:00',
          endTime: '17:00',
          recurrenceType: 'Weekly'
        }
      ]
    }));
  };
  
  // Handle removing a regular schedule entry
  const handleRemoveScheduleEntry = (index) => {
    setAvailabilityData(prev => ({
      ...prev,
      regularSchedule: prev.regularSchedule.filter((_, i) => i !== index)
    }));
  };
  
  // Handle schedule entry changes
  const handleScheduleEntryChange = (index, field, value) => {
    setAvailabilityData(prev => {
      const updatedSchedule = [...prev.regularSchedule];
      updatedSchedule[index] = {
        ...updatedSchedule[index],
        [field]: field === 'dayOfWeek' ? parseInt(value, 10) : value
      };
      
      return {
        ...prev,
        regularSchedule: updatedSchedule
      };
    });
  };
  
  // Handle adding time off
  const handleAddTimeOff = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    setAvailabilityData(prev => ({
      ...prev,
      timeOff: [
        ...prev.timeOff,
        {
          startDate: today,
          endDate: nextWeek.toISOString().split('T')[0],
          reason: 'Time Off',
          status: 'Pending'
        }
      ]
    }));
  };
  
  // Handle removing time off
  const handleRemoveTimeOff = (index) => {
    setAvailabilityData(prev => ({
      ...prev,
      timeOff: prev.timeOff.filter((_, i) => i !== index)
    }));
  };
  
  // Handle time off changes
  const handleTimeOffChange = (index, field, value) => {
    setAvailabilityData(prev => {
      const updatedTimeOff = [...prev.timeOff];
      updatedTimeOff[index] = {
        ...updatedTimeOff[index],
        [field]: value
      };
      
      return {
        ...prev,
        timeOff: updatedTimeOff
      };
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let id = caregiverId;
      
      // 1. Save basic profile data
      if (isNewCaregiver) {
        // Create new caregiver
        const newDocRef = await firebaseService.db.collection('caregivers').add({
          ...profileData,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'Active'
        });
        
        id = newDocRef.id;
      } else {
        // Update existing caregiver
        await firebaseService.db.collection('caregivers')
          .doc(id)
          .update({
            ...profileData,
            updatedAt: new Date()
          });
      }
      
      // 2. Save availability data
      await firebaseService.db.collection('caregiver_availability')
        .doc(id)
        .set({
          caregiverId: id,
          regularSchedule: availabilityData.regularSchedule,
          timeOff: availabilityData.timeOff.map(item => ({
            ...item,
            startDate: new Date(item.startDate),
            endDate: new Date(item.endDate)
          })),
          lastUpdated: new Date()
        }, { merge: true });
      
      notificationService.showNotification(
        `Caregiver ${isNewCaregiver ? 'created' : 'updated'} successfully`,
        'success'
      );
      
      // Call the onSave callback with the caregiver ID
      if (onSave) {
        onSave(id);
      }
    } catch (err) {
      console.error('Error saving caregiver:', err);
      setError(`Failed to ${isNewCaregiver ? 'create' : 'update'} caregiver`);
      notificationService.showNotification(
        `Failed to ${isNewCaregiver ? 'create' : 'update'} caregiver`,
        'error'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Get day name for display
  const getDayName = (dayNumber) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  };
  
  return (
    <div className="caregiver-profile-form">
      <h2>{isNewCaregiver ? 'Add New Caregiver' : 'Edit Caregiver Profile'}</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="form-tabs">
        <button 
          className={activeTab === 'basic' ? 'active' : ''}
          onClick={() => setActiveTab('basic')}
        >
          Basic Information
        </button>
        <button 
          className={activeTab === 'skills' ? 'active' : ''}
          onClick={() => setActiveTab('skills')}
        >
          Skills & Transportation
        </button>
        <button 
          className={activeTab === 'availability' ? 'active' : ''}
          onClick={() => setActiveTab('availability')}
        >
          Availability
        </button>
        {/*
        <button
          className={activeTab === 'insights' ? 'active' : ''}
          onClick={() => setActiveTab('insights')}
        >
          Insights & Development
        </button>
        */}
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Basic Information Tab */}
        {activeTab === 'basic' && (
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={profileData.firstName || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={profileData.lastName || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={profileData.phone || ''}
                  onChange={handleProfileChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="address">Address</label>
              <textarea
                id="address"
                name="address"
                value={profileData.address || ''}
                onChange={handleProfileChange}
                rows={3}
                required
              />
            </div>
          </div>
        )}
        
        {/* Skills & Transportation Tab */}
        {activeTab === 'skills' && (
          <div className="form-section">
            <h3>Caregiver Skills</h3>
            <div className="skills-container">
              {SKILL_OPTIONS.map(skill => (
                <div key={skill.id} className="skill-checkbox">
                  <input
                    type="checkbox"
                    id={`skill-${skill.id}`}
                    checked={profileData.skills?.includes(skill.id) || false}
                    onChange={() => handleSkillToggle(skill.id)}
                  />
                  <label htmlFor={`skill-${skill.id}`}>{skill.label}</label>
                </div>
              ))}
            </div>
            
            <h3>Transportation</h3>
            <div className="form-row">
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="hasCar"
                  name="transportation.hasCar"
                  checked={profileData.transportation?.hasCar || false}
                  onChange={handleProfileChange}
                />
                <label htmlFor="hasCar">Has Car</label>
              </div>
              
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="hasLicense"
                  name="transportation.hasLicense"
                  checked={profileData.transportation?.hasLicense || false}
                  onChange={handleProfileChange}
                />
                <label htmlFor="hasLicense">Has Driver's License</label>
              </div>
              
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="usesPublicTransport"
                  name="transportation.usesPublicTransport"
                  checked={profileData.transportation?.usesPublicTransport || false}
                  onChange={handleProfileChange}
                />
                <label htmlFor="usesPublicTransport">Uses Public Transport</label>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="travelRadius">Travel Radius (miles/km)</label>
              <input
                type="number"
                id="travelRadius"
                name="transportation.travelRadius"
                value={profileData.transportation?.travelRadius || 10}
                min="0"
                onChange={handleProfileChange}
              />
            </div>
          </div>
        )}
        
        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <div className="form-section">
            <h3>Regular Weekly Schedule</h3>
            <p className="section-description">
              Set the caregiver's regular weekly availability. This helps match them with appropriate client schedules.
            </p>
            
            {availabilityData.regularSchedule.length === 0 ? (
              <div className="empty-schedule-message">
                No regular schedule set. Add availability using the button below.
              </div>
            ) : (
              <div className="schedule-entries">
                {availabilityData.regularSchedule.map((entry, index) => (
                  <div key={index} className="schedule-entry">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor={`day-${index}`}>Day</label>
                        <select
                          id={`day-${index}`}
                          value={entry.dayOfWeek}
                          onChange={(e) => handleScheduleEntryChange(index, 'dayOfWeek', e.target.value)}
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor={`start-${index}`}>Start Time</label>
                        <input
                          type="time"
                          id={`start-${index}`}
                          value={entry.startTime}
                          onChange={(e) => handleScheduleEntryChange(index, 'startTime', e.target.value)}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor={`end-${index}`}>End Time</label>
                        <input
                          type="time"
                          id={`end-${index}`}
                          value={entry.endTime}
                          onChange={(e) => handleScheduleEntryChange(index, 'endTime', e.target.value)}
                        />
                      </div>
                      
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => handleRemoveScheduleEntry(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              type="button"
              className="add-button"
              onClick={handleAddScheduleEntry}
            >
              Add Availability
            </button>
            
            <h3>Time Off</h3>
            <p className="section-description">
              Add any planned time off or unavailability periods.
            </p>
            
            {availabilityData.timeOff.length === 0 ? (
              <div className="empty-schedule-message">
                No time off set. Add time off using the button below.
              </div>
            ) : (
              <div className="time-off-entries">
                {availabilityData.timeOff.map((entry, index) => (
                  <div key={index} className="time-off-entry">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor={`startDate-${index}`}>Start Date</label>
                        <input
                          type="date"
                          id={`startDate-${index}`}
                          value={entry.startDate}
                          onChange={(e) => handleTimeOffChange(index, 'startDate', e.target.value)}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor={`endDate-${index}`}>End Date</label>
                        <input
                          type="date"
                          id={`endDate-${index}`}
                          value={entry.endDate}
                          onChange={(e) => handleTimeOffChange(index, 'endDate', e.target.value)}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor={`reason-${index}`}>Reason</label>
                        <input
                          type="text"
                          id={`reason-${index}`}
                          value={entry.reason}
                          onChange={(e) => handleTimeOffChange(index, 'reason', e.target.value)}
                        />
                      </div>
                      
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => handleRemoveTimeOff(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              type="button"
              className="add-button"
              onClick={handleAddTimeOff}
            >
              Add Time Off
            </button>
          </div>
        )}

        {/* Placeholder for Insights & Development Tab */}
        {/*
        activeTab === 'insights' && (
          <div className="form-section">
            <h3>Learned Insights & Development Goals</h3>
            <p className="section-description">
              This section displays insights learned by the system and helps track development.
            </p>

            <div className="form-group">
              <label>Inferred Skills (Read-only)</label>
              <p>{profileData.inferredSkills?.join(', ') || 'None yet'}</p>
            </div>

            <div className="form-group">
              <label>Performance Metrics (Read-only)</label>
              <pre>{JSON.stringify(profileData.performanceMetrics, null, 2) || 'None available'}</pre>
            </div>

            <div className="form-group">
              <label>Feedback Summary (Read-only)</label>
              <p>{profileData.feedbackSummary || 'No feedback summary available.'}</p>
            </div>

            <div className="form-group">
              <label htmlFor="preferenceNotes">Caregiver Preference Notes (Editable)</label>
              <textarea
                id="preferenceNotes"
                name="preferenceNotes"
                value={profileData.preferenceNotes || ''}
                onChange={handleProfileChange}
                rows={4}
                placeholder="Notes on specific preferences, e.g., client types, work environment, etc."
              />
            </div>

            <div className="form-group">
              <label>Certifications (Read-only, managed elsewhere or placeholder)</label>
              <ul>
                {profileData.certifications?.map(cert => <li key={cert.id}>{cert.name} - Expires: {cert.expiryDate}</li>) || <li>No certifications listed.</li>}
              </ul>
            </div>

            <div className="form-group">
              <label>Training Completed (Read-only, managed elsewhere or placeholder)</label>
              <ul>
                {profileData.trainingCompleted?.map(training => <li key={training.id}>{training.name} - Completed: {training.completionDate}</li>) || <li>No training listed.</li>}
              </ul>
            </div>

          </div>
        )
        */}
        
        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="save-button"
            disabled={loading}
          >
            {loading ? 'Saving...' : isNewCaregiver ? 'Create Caregiver' : 'Update Caregiver'}
          </button>
        </div>
      </form>
      
      <style jsx>{`
        .caregiver-profile-form {
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #2c3e50;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        
        h3 {
          color: #3498db;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        
        .section-description {
          color: #7f8c8d;
          margin-bottom: 15px;
          font-size: 0.9rem;
        }
        
        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
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
          font-size: 1rem;
          color: #6c757d;
          margin-right: 10px;
        }
        
        .form-tabs button.active {
          border-bottom-color: #3498db;
          color: #3498db;
          font-weight: 500;
        }
        
        .form-tabs button:hover:not(.active) {
          border-bottom-color: #e9ecef;
          background-color: #f8f9fa;
        }
        
        .form-section {
          margin-bottom: 20px;
        }
        
        .form-row {
          display: flex;
          flex-wrap: wrap;
          margin: 0 -10px 15px;
        }
        
        .form-group {
          flex: 1;
          min-width: 200px;
          padding: 0 10px;
          margin-bottom: 15px;
        }
        
        .form-group.checkbox-group {
          display: flex;
          align-items: center;
          min-width: 150px;
        }
        
        .form-group.checkbox-group input {
          margin-right: 8px;
          width: auto;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #2c3e50;
        }
        
        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="number"],
        input[type="date"],
        input[type="time"],
        select,
        textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.15s;
        }
        
        input:focus,
        select:focus,
        textarea:focus {
          border-color: #3498db;
          outline: none;
        }
        
        .skills-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .skill-checkbox {
          display: flex;
          align-items: center;
        }
        
        .skill-checkbox input {
          margin-right: 8px;
        }
        
        .empty-schedule-message {
          background: #f8f9fa;
          padding: 15px;
          text-align: center;
          color: #6c757d;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .schedule-entry,
        .time-off-entry {
          background: #f8f9fa;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 15px;
          border-left: 3px solid #3498db;
        }
        
        .add-button {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 15px;
          cursor: pointer;
          margin-bottom: 20px;
        }
        
        .add-button:hover {
          background: #2980b9;
        }
        
        .remove-button {
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 15px;
          cursor: pointer;
          white-space: nowrap;
          align-self: flex-end;
          margin-top: 24px;
        }
        
        .remove-button:hover {
          background: #c0392b;
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 30px;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
        
        .cancel-button {
          background: #95a5a6;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          cursor: pointer;
          margin-right: 10px;
        }
        
        .cancel-button:hover:not(:disabled) {
          background: #7f8c8d;
        }
        
        .save-button {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          cursor: pointer;
        }
        
        .save-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default CaregiverProfileForm;

import React, { useState, useEffect } from 'react';
import { 
  notificationService,
  universalDataService,
  availabilityService
} from '../services';
import AvailabilityManager from './AvailabilityManager'; // Import AvailabilityManager

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
    }
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
        setProfileData({ // Reset profile data for new caregiver
            firstName: '', lastName: '', email: '', phone: '', address: '', skills: [],
            transportation: { hasCar: false, hasLicense: false, usesPublicTransport: false, travelRadius: 10 }
        });
        setAvailabilityData({ regularSchedule: [], timeOff: [] }); // Reset availability
        return;
      }
      
      setLoading(true);
      setIsNewCaregiver(false);
      setError(null);
      
      try {
        // Load basic profile data
        const profile = await universalDataService.getCaregiver(caregiverId);
          
        if (profile) {
          // Ensure transportation is an object, even if undefined in fetched data
          profile.transportation = profile.transportation || { hasCar: false, hasLicense: false, usesPublicTransport: false, travelRadius: 10 };
          setProfileData(profile);
        } else {
          setError('Caregiver not found');
          notificationService.showNotification('Caregiver not found', 'error');
          return; // Stop further loading if caregiver not found
        }
        
        // Load availability data
        const availability = await availabilityService.getCaregiverAvailability(caregiverId);
          
        if (availability) {
          // Assuming availabilityService already processes Timestamps to strings if needed
          // or that AvailabilityManager can handle them.
          // For consistency with previous logic, ensure dates are strings.
          const processedTimeOff = (availability.timeOff || []).map(item => ({
            ...item,
            startDate: typeof item.startDate === 'string' ? item.startDate : item.startDate?.toDate?.().toISOString().split('T')[0] || '',
            endDate: typeof item.endDate === 'string' ? item.endDate : item.endDate?.toDate?.().toISOString().split('T')[0] || '',
          }));
          setAvailabilityData({
            regularSchedule: availability.regularSchedule || [],
            timeOff: processedTimeOff
          });
        } else {
          // No availability record found, initialize with empty state
          setAvailabilityData({ regularSchedule: [], timeOff: [] });
        }
      } catch (err) {
        console.error('Error loading caregiver data via service:', err);
        setError('Failed to load caregiver data. Please try again.');
        notificationService.showNotification(
          'Failed to load caregiver data: ' + err.message,
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
  
  
  // Callback for AvailabilityManager to update parent state
  const handleAvailabilityChangeInForm = (newAvailability) => {
    setAvailabilityData(newAvailability);
  };

  // Removed direct availability manipulation functions:
  // handleAddScheduleEntry, handleRemoveScheduleEntry, handleScheduleEntryChange,
  // handleAddTimeOff, handleRemoveTimeOff, handleTimeOffChange
  // These are now managed by AvailabilityManager.
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let currentCaregiverId = caregiverId;
      
      // 1. Save basic profile data
      // Ensure profileData includes any necessary defaults or transformations before saving
      const profileToSave = { ...profileData };
      // Remove fields that should not be directly written if services don't expect them (e.g. id if it's part of URL)
      // delete profileToSave.id; // Example, if 'id' is not part of caregiver document fields

      if (isNewCaregiver) {
        const createdCaregiver = await universalDataService.createCaregiver(profileToSave);
        if (!createdCaregiver || !createdCaregiver.id) {
          throw new Error('Failed to create caregiver or received no ID.');
        }
        currentCaregiverId = createdCaregiver.id;
        notificationService.showNotification('Caregiver created successfully!', 'success');
      } else {
        if (!currentCaregiverId) throw new Error("Caregiver ID is missing for update.");
        await universalDataService.updateCaregiver(currentCaregiverId, profileToSave);
        notificationService.showNotification('Caregiver updated successfully!', 'success');
      }
      
      // 2. Save availability data
      if (!currentCaregiverId) {
        throw new Error("Caregiver ID is missing, cannot save availability.");
      }
      
      // The availabilityData state is already up-to-date via onAvailabilityChange from AvailabilityManager
      // The availabilityService is expected to handle date string to Timestamp conversion if needed.
      await availabilityService.updateCaregiverAvailability(currentCaregiverId, availabilityData);
      
      // No separate notification for availability save unless desired for more granular feedback.
      // The main profile save notification usually suffices.

      if (onSave) {
        onSave(currentCaregiverId); // Pass the caregiver ID (new or existing)
      }
    } catch (err) {
      console.error('Error saving caregiver profile or availability:', err);
      setError(`Failed to ${isNewCaregiver ? 'create' : 'update'} caregiver: ${err.message}`);
      notificationService.showNotification(
        `Failed to ${isNewCaregiver ? 'create' : 'update'} caregiver: ${err.message}`,
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
          <AvailabilityManager
            initialAvailability={availabilityData}
            onAvailabilityChange={handleAvailabilityChangeInForm}
            // caregiverId might still be useful for AvailabilityManager if it needs to display it,
            // but it's not strictly necessary for its new role as a controlled component.
            // For now, we assume it's not needed by the refactored AvailabilityManager for data ops.
            // caregiverId={caregiverId || (isNewCaregiver ? 'new' : '')} // Pass if needed
          />
        )}
        
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

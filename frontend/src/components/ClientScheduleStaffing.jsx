import React, { useState, useEffect } from 'react';
import { 
  availabilityService,
  notificationService,
  firebaseService,
  universalDataService
} from '../services';

/**
 * Client Schedule Staffing Component
 * 
 * This component focuses on staffing existing client schedules with available caregivers.
 * It allows you to view client schedules that need caregivers assigned and match
 * available caregivers based on skills, availability, and other criteria.
 */
const ClientScheduleStaffing = () => {
  // State for client schedules
  const [clientSchedules, setClientSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  
  // State for available caregivers
  const [availableCaregivers, setAvailableCaregivers] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [filterCriteria, setFilterCriteria] = useState({
    onlyAvailable: true,
    minSkillMatch: 70,
    requiresCar: false,
    showAssigned: false
  });
  
  // Fetch client schedules that need staffing
  useEffect(() => {
    const fetchClientSchedules = async () => {
      setLoading(true);
      try {
        // Get schedules from Firestore
        let schedulesQuery = firebaseService.db.collection('schedules');
        
        // Filter only unassigned schedules if not showing assigned
        if (!filterCriteria.showAssigned) {
          schedulesQuery = schedulesQuery.where('status', '==', 'Needs Assignment');
        }
        
        const schedulesSnapshot = await schedulesQuery.get();
        
        // Process schedules
        const schedules = [];
        for (const doc of schedulesSnapshot.docs) {
          const scheduleData = doc.data();
          
          try {
            // Get client details for each schedule
            const clientData = await universalDataService.getClient(scheduleData.client_id);
            
            if (clientData) {
              // Handle both recurring and single-date schedules
              let formattedDate;
              if (scheduleData.isRecurring) {
                // For recurring schedules, generate next occurrence date based on recurrence pattern
                const dayOfWeek = scheduleData.dayOfWeek;
                const startDate = new Date(scheduleData.startDate);
                const today = new Date();
                
                // Find the next occurrence of this day of week
                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + (7 + dayOfWeek - today.getDay()) % 7);
                
                // Ensure it's not before the start date
                if (nextDate < startDate) {
                  nextDate.setDate(nextDate.getDate() + 7);
                }
                
                formattedDate = nextDate.toISOString().split('T')[0];
              } else {
                // For single-date schedules, use the exact date
                formattedDate = scheduleData.date;
              }
              
              // Add to schedules list
              schedules.push({
                id: doc.id,
                ...scheduleData,
                date: formattedDate,
                client: {
                  id: clientData.id,
                  name: `${clientData.firstName} ${clientData.lastName}`,
                  careNeeds: Array.isArray(clientData.careNeeds) 
                    ? clientData.careNeeds.map(cn => typeof cn === 'object' ? cn.type : cn)
                    : [],
                  address: clientData.address || ''
                },
                recurring: scheduleData.isRecurring,
                // Add recurrence info for display if it's a recurring schedule
                recurrenceInfo: scheduleData.isRecurring 
                  ? `${scheduleData.recurrenceType || 'Weekly'} (${DAYS_OF_WEEK[scheduleData.dayOfWeek]})`
                  : 'One-time'
              });
            }
          } catch (clientErr) {
            console.warn(`Could not get client ${scheduleData.client_id}:`, clientErr);
          }
        }
        
        // Sort by date (nearest first)
        schedules.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        setClientSchedules(schedules);
      } catch (err) {
        console.error('Error fetching client schedules:', err);
        setError('Failed to load client schedules. Please try again.');
        notificationService.showNotification(
          'Failed to load client schedules',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };
    
    fetchClientSchedules();
  }, [filterCriteria.showAssigned]);
  
  // Find available caregivers when a schedule is selected
  useEffect(() => {
    const findAvailableCaregivers = async () => {
      if (!selectedSchedule) return;
      
      setLoading(true);
      try {
        // Get caregivers available for this time slot
        const caregivers = await availabilityService.getAvailableCaregivers(
          selectedSchedule.date,
          selectedSchedule.startTime,
          selectedSchedule.endTime,
          {
            requiresCar: filterCriteria.requiresCar
          }
        );
        
        // Calculate match scores for each caregiver
        const scores = {};
        for (const caregiver of caregivers) {
          // Get caregiver skills
          let skillScore = 0;
          if (caregiver.skills && selectedSchedule.client.careNeeds) {
            const matchingSkills = selectedSchedule.client.careNeeds.filter(
              need => caregiver.skills.includes(need)
            );
            skillScore = selectedSchedule.client.careNeeds.length > 0 
              ? (matchingSkills.length / selectedSchedule.client.careNeeds.length) * 100
              : 100;
          }
          
          // Calculate overall score
          scores[caregiver.id] = {
            skillScore,
            overallScore: skillScore // Could add more factors here
          };
        }
        
        // Filter caregivers by minimum skill match if needed
        const filteredCaregivers = filterCriteria.minSkillMatch > 0
          ? caregivers.filter(c => scores[c.id].skillScore >= filterCriteria.minSkillMatch)
          : caregivers;
        
        setAvailableCaregivers(filteredCaregivers);
        setMatchScores(scores);
      } catch (err) {
        console.error('Error finding available caregivers:', err);
        setError('Failed to find available caregivers. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    findAvailableCaregivers();
  }, [selectedSchedule, filterCriteria]);
  
  // Handle schedule selection
  const handleScheduleSelect = (schedule) => {
    setSelectedSchedule(schedule);
    setError(null);
    setSuccessMessage(null);
  };
  
  // Handle caregiver assignment
  const handleAssignCaregiver = async (caregiverId) => {
    if (!selectedSchedule || !caregiverId) return;
    
    setLoading(true);
    try {
      // Update the schedule with the assigned caregiver
      await firebaseService.db.collection('schedules')
        .doc(selectedSchedule.id)
        .update({
          caregiver_id: caregiverId,
          status: 'Assigned',
          updated_at: new Date()
        });
      
      // Show success message
      setSuccessMessage(`Caregiver successfully assigned to client schedule`);
      notificationService.showNotification(
        'Caregiver assigned successfully',
        'success'
      );
      
      // Update local state to reflect changes
      if (!filterCriteria.showAssigned) {
        setClientSchedules(prevSchedules => 
          prevSchedules.filter(schedule => schedule.id !== selectedSchedule.id)
        );
        setSelectedSchedule(null);
      } else {
        // If showing assigned schedules, just update the status
        setClientSchedules(prevSchedules => 
          prevSchedules.map(schedule => 
            schedule.id === selectedSchedule.id
              ? { ...schedule, status: 'Assigned', caregiver_id: caregiverId }
              : schedule
          )
        );
        setSelectedSchedule(prev => ({ ...prev, status: 'Assigned', caregiver_id: caregiverId }));
      }
    } catch (err) {
      console.error('Error assigning caregiver:', err);
      setError('Failed to assign caregiver. Please try again.');
      notificationService.showNotification(
        'Failed to assign caregiver',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilterCriteria(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value)
    }));
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    // Re-trigger the useEffect that fetches schedules
    setClientSchedules([]);
    setSelectedSchedule(null);
    setFilterCriteria(prev => ({ ...prev })); // Trigger update by creating a new object
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Constants
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return (
    <div className="client-schedule-staffing">
      <h2>Staff Client Schedules</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      
      <div className="control-bar">
        <div className="filter-group">
          <label>
            <input 
              type="checkbox"
              name="showAssigned"
              checked={filterCriteria.showAssigned}
              onChange={handleFilterChange}
            />
            Show assigned schedules
          </label>
        </div>
        
        <button 
          className="refresh-button"
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh Schedules
        </button>
      </div>
      
      <div className="staffing-container">
        {/* Client Schedules Panel */}
        <div className="schedules-panel">
          <h3>Client Schedules {!filterCriteria.showAssigned && 'Needing Caregivers'}</h3>
          
          {loading && clientSchedules.length === 0 ? (
            <div className="loading-indicator">
              Loading client schedules...
            </div>
          ) : clientSchedules.length === 0 ? (
            <div className="empty-state">
              No client schedules {!filterCriteria.showAssigned && 'requiring staffing'} at this time.
            </div>
          ) : (
            <div className="schedule-list">
              {clientSchedules.map(schedule => (
                <div 
                  key={schedule.id} 
                  className={`schedule-item ${selectedSchedule?.id === schedule.id ? 'selected' : ''} ${schedule.status === 'Assigned' ? 'assigned' : ''}`}
                  onClick={() => handleScheduleSelect(schedule)}
                >
                  <div className="schedule-client">
                    {schedule.client.name}
                    {schedule.status === 'Assigned' && (
                      <span className="assigned-badge">Assigned</span>
                    )}
                  </div>
                  <div className="schedule-datetime">
                    <div className="schedule-date">{formatDate(schedule.date)}</div>
                    <div className="schedule-time">
                      {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                    </div>
                  </div>
                  <div className="schedule-details">
                    <div className="recurrence-type">
                      {schedule.recurring ? 'Recurring' : 'One-time'}: {schedule.recurrenceInfo}
                    </div>
                    <div className="schedule-care-needs">
                      {schedule.client.careNeeds && schedule.client.careNeeds.length > 0 ? (
                        <div className="care-needs-list">
                          {schedule.client.careNeeds.map((need, idx) => (
                            <span key={`${need}-${idx}`} className="care-need-tag">
                              {need}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="no-care-needs">No specific care needs</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Caregiver Matching Panel */}
        <div className="caregivers-panel">
          <h3>Available Caregivers</h3>
          
          {!selectedSchedule ? (
            <div className="empty-state">
              Select a client schedule to view available caregivers.
            </div>
          ) : (
            <>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>
                    <input 
                      type="checkbox"
                      name="onlyAvailable"
                      checked={filterCriteria.onlyAvailable}
                      onChange={handleFilterChange}
                    />
                    Show only available caregivers
                  </label>
                </div>
                
                <div className="filter-group">
                  <label>
                    <input 
                      type="checkbox"
                      name="requiresCar"
                      checked={filterCriteria.requiresCar}
                      onChange={handleFilterChange}
                    />
                    Requires car
                  </label>
                </div>
                
                <div className="filter-group">
                  <label>
                    Minimum skill match:
                    <select 
                      name="minSkillMatch"
                      value={filterCriteria.minSkillMatch}
                      onChange={handleFilterChange}
                    >
                      <option value="0">Any match</option>
                      <option value="50">50% match</option>
                      <option value="70">70% match</option>
                      <option value="100">100% match</option>
                    </select>
                  </label>
                </div>
              </div>
              
              {loading ? (
                <div className="loading-indicator">
                  Finding available caregivers...
                </div>
              ) : availableCaregivers.length === 0 ? (
                <div className="empty-state">
                  No caregivers available for this schedule.
                </div>
              ) : (
                <div className="caregiver-list">
                  {availableCaregivers
                    .sort((a, b) => matchScores[b.id]?.overallScore - matchScores[a.id]?.overallScore)
                    .map(caregiver => (
                      <div key={caregiver.id} className="caregiver-item">
                        <div className="caregiver-info">
                          <div className="caregiver-name">
                            {caregiver.firstName} {caregiver.lastName}
                          </div>
                          <div className="caregiver-skills">
                            {caregiver.skills && caregiver.skills.map(skill => (
                              <span 
                                key={skill} 
                                className={`skill-tag ${
                                  selectedSchedule.client.careNeeds?.includes(skill) 
                                    ? 'matching-skill' 
                                    : ''
                                }`}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                          <div className="match-score">
                            Match Score: {Math.round(matchScores[caregiver.id]?.overallScore || 0)}%
                          </div>
                        </div>
                        <button 
                          className="assign-button"
                          onClick={() => handleAssignCaregiver(caregiver.id)}
                          disabled={loading || selectedSchedule.status === 'Assigned'}
                        >
                          {selectedSchedule.status === 'Assigned' ? 'Already Assigned' : 'Assign'}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .client-schedule-staffing {
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
          margin-top: 0;
          margin-bottom: 15px;
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
        
        .control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
          padding: 10px 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .refresh-button {
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .refresh-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .refresh-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .staffing-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        @media (min-width: 992px) {
          .staffing-container {
            grid-template-columns: 1fr 1fr;
          }
        }
        
        .schedules-panel,
        .caregivers-panel {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          min-height: 400px;
          display: flex;
          flex-direction: column;
        }
        
        .loading-indicator,
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #6c757d;
          font-style: italic;
          text-align: center;
          background: white;
          border-radius: 4px;
        }
        
        .schedule-list {
          margin-bottom: 15px;
          overflow-y: auto;
          max-height: 500px;
        }
        
        .schedule-item {
          background: white;
          border-left: 3px solid #ddd;
          border-radius: 4px;
          padding: 12px 15px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .schedule-item:hover {
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          border-left-color: #3498db;
        }
        
        .schedule-item.selected {
          border-left-color: #3498db;
          background-color: #ebf5fb;
        }
        
        .schedule-item.assigned {
          border-left-color: #2ecc71;
        }
        
        .schedule-client {
          font-weight: 600;
          font-size: 1.1rem;
          color: #2c3e50;
          margin-bottom: 5px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .assigned-badge {
          background: #2ecc71;
          color: white;
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: normal;
        }
        
        .schedule-datetime {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        
        .schedule-date {
          color: #3498db;
          font-weight: 500;
        }
        
        .schedule-time {
          color: #6c757d;
        }
        
        .recurrence-type {
          font-style: italic;
          color: #6c757d;
          font-size: 0.9rem;
          margin-bottom: 5px;
        }
        
        .care-needs-list {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 5px;
        }
        
        .care-need-tag {
          background: #e1f5fe;
          color: #0288d1;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.8rem;
        }
        
        .no-care-needs {
          color: #6c757d;
          font-style: italic;
          font-size: 0.9rem;
        }
        
        .filter-controls {
          background: white;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 15px;
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .filter-group {
          margin-bottom: 5px;
        }
        
        .filter-group label {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #495057;
        }
        
        .filter-group select {
          margin-left: 5px;
          padding: 3px 8px;
          border: 1px solid #ced4da;
          border-radius: 4px;
        }
        
        .caregiver-list {
          margin-bottom: 15px;
          overflow-y: auto;
          max-height: 500px;
        }
        
        .caregiver-item {
          background: white;
          border-radius: 4px;
          padding: 12px 15px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .caregiver-name {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 5px;
        }
        
        .caregiver-skills {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 5px;
        }
        
        .skill-tag {
          background: #f1f1f1;
          color: #6c757d;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.8rem;
        }
        
        .matching-skill {
          background: #e1f5fe;
          color: #0288d1;
        }
        
        .match-score {
          font-weight: 500;
          color: #2ecc71;
        }
        
        .assign-button {
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        
        .assign-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .assign-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ClientScheduleStaffing;

import React, { useState, useEffect, useCallback } from 'react';
import { universalScheduleService } from '../services';

/**
 * Universal Schedule View Component
 * Provides a unified view of schedules for clients and caregivers
 */
const UniversalScheduleView = () => {
  const [schedules, setSchedules] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setDate(new Date().getDate() + 7))
  });
  const [view, setView] = useState('month'); // 'day', 'week', 'month'
  const [displayMode, setDisplayMode] = useState('combined'); // 'combined', 'client', 'caregiver'
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [draggedSchedule, setDraggedSchedule] = useState(null);

  // Fetch schedules for the current date range
  const fetchSchedules = useCallback(async (isMountedChecker) => { // Pass isMounted checker
    if (!isMountedChecker()) return; // Check before setting loading
    setLoading(true);
    try {
      const options = {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        include: ['clients', 'caregivers']
      };
      
      const result = await universalScheduleService.getSchedules(options);
      if (!isMountedChecker()) return; // Check after await
      setSchedules(result);
      
      // Check for conflicts
      // Ensure result is an array before mapping
      const conflictPromises = Array.isArray(result) ? result.map(schedule =>
        universalScheduleService.findConflicts(schedule.id)
      ) : [];
      
      const conflictResults = await Promise.all(conflictPromises);
      if (!isMountedChecker()) return; // Check after await
      const allConflicts = conflictResults.flat().filter(conflict => conflict);
      
      setConflicts(allConflicts);
    } catch (error) {
      if (!isMountedChecker()) return; // Check in catch
      console.error('Error fetching schedules:', error);
    } finally {
      if (!isMountedChecker()) return; // Check in finally
      setLoading(false);
    }
  }, [dateRange]); // Removed universalScheduleService from dependencies as it's stable

  // Initialize component
  useEffect(() => {
    let isMounted = true;
    const isMountedChecker = () => isMounted;

    fetchSchedules(isMountedChecker); // Pass the checker

    return () => {
      isMounted = false; // Cleanup function
    };
  }, [fetchSchedules]);

  // Handle date range change
  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };

  // Handle view change (day, week, month)
  const handleViewChange = (newView) => {
    setView(newView);
  };

  // Handle display mode change
  const handleDisplayModeChange = (mode) => {
    setDisplayMode(mode);
  };

  // Handle schedule selection
  const handleScheduleSelect = (schedule) => {
    setSelectedSchedule(schedule);
  };

  // Handle schedule creation
  const handleCreateSchedule = async (scheduleData) => {
    try {
      await universalScheduleService.createSchedule(scheduleData);
      fetchSchedules();
    } catch (error) {
      console.error('Error creating schedule:', error);
    }
  };

  // Handle schedule update
  const handleUpdateSchedule = async (scheduleId, changes) => {
    try {
      await universalScheduleService.updateSchedule(scheduleId, changes);
      fetchSchedules();
      
      if (selectedSchedule?.id === scheduleId) {
        const updatedSchedule = await universalScheduleService.getScheduleWithDetails(scheduleId);
        setSelectedSchedule(updatedSchedule);
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  // Handle schedule deletion
  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await universalScheduleService.deleteSchedule(scheduleId);
      fetchSchedules();
      
      if (selectedSchedule?.id === scheduleId) {
        setSelectedSchedule(null);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  // Handle drag start for rescheduling
  const handleDragStart = (schedule) => {
    setDraggedSchedule(schedule);
  };

  // Handle drag end (drop) for rescheduling
  const handleDrop = (date, time) => {
    if (!draggedSchedule) return;
    
    const changes = {
      date: date.toISOString().split('T')[0],
      startTime: time
    };
    
    handleUpdateSchedule(draggedSchedule.id, changes);
    setDraggedSchedule(null);
  };

  // Get time slots for the grid
  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour}:00`);
      slots.push(`${hour}:30`);
    }
    return slots;
  };

  // Get dates for the grid based on view
  const getDates = () => {
    const dates = [];
    const startDate = new Date(dateRange.startDate);
    
    let daysToShow = 1;
    if (view === 'week') daysToShow = 7;
    if (view === 'month') daysToShow = 30;
    
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Check if a schedule has conflicts
  const hasConflict = (scheduleId) => {
    return conflicts.some(conflict => 
      conflict.scheduleId === scheduleId || 
      conflict.conflictingScheduleId === scheduleId
    );
  };

  // Filter schedules based on display mode
  const filteredSchedules = schedules.filter(schedule => {
    if (displayMode === 'combined') return true;
    if (displayMode === 'client' && schedule.clientId) return true;
    if (displayMode === 'caregiver' && schedule.caregiverId) return true;
    return false;
  });

  // Render schedule card
  const renderScheduleCard = (schedule) => {
    const isConflicted = hasConflict(schedule.id);
    const isSelected = selectedSchedule?.id === schedule.id;
    const isDragging = draggedSchedule?.id === schedule.id;
    
    return (
      <div
        key={schedule.id}
        className={`schedule-card ${isConflicted ? 'conflict' : ''} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
        onClick={() => handleScheduleSelect(schedule)}
        draggable
        onDragStart={() => handleDragStart(schedule)}
      >
        <div className="schedule-time">{schedule.startTime} - {schedule.endTime}</div>
        <div className="schedule-title">{schedule.title || 'Untitled Schedule'}</div>
        <div className="schedule-client">{schedule.client?.name || 'No Client'}</div>
        <div className="schedule-caregiver">{schedule.caregiver?.name || 'Unassigned'}</div>
      </div>
    );
  };

  // Render schedule cell in the grid
  const renderScheduleCell = (date, timeSlot) => {
    const matchingSchedules = filteredSchedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      return (
        scheduleDate.getDate() === date.getDate() &&
        scheduleDate.getMonth() === date.getMonth() &&
        scheduleDate.getFullYear() === date.getFullYear() &&
        schedule.startTime === timeSlot
      );
    });
    
    return (
      <div 
        className="schedule-cell"
        onDragOver={e => e.preventDefault()}
        onDrop={() => handleDrop(date, timeSlot)}
      >
        {matchingSchedules.map(schedule => renderScheduleCard(schedule))}
      </div>
    );
  };

  return (
    <div className="universal-schedule-view">
      <div className="schedule-controls">
        <div className="view-controls">
          <button 
            className={`view-button ${view === 'day' ? 'active' : ''}`}
            onClick={() => handleViewChange('day')}
          >
            Day
          </button>
          <button 
            className={`view-button ${view === 'week' ? 'active' : ''}`}
            onClick={() => handleViewChange('week')}
          >
            Week
          </button>
          <button 
            className={`view-button ${view === 'month' ? 'active' : ''}`}
            onClick={() => handleViewChange('month')}
          >
            Month
          </button>
        </div>
        
        <div className="date-navigation">
          <button 
            onClick={() => {
              const newStart = new Date(dateRange.startDate);
              const newEnd = new Date(dateRange.endDate);
              
              if (view === 'day') {
                newStart.setDate(newStart.getDate() - 1);
                newEnd.setDate(newEnd.getDate() - 1);
              } else if (view === 'week') {
                newStart.setDate(newStart.getDate() - 7);
                newEnd.setDate(newEnd.getDate() - 7);
              } else if (view === 'month') {
                newStart.setMonth(newStart.getMonth() - 1);
                newEnd.setMonth(newEnd.getMonth() - 1);
              }
              
              handleDateRangeChange({ startDate: newStart, endDate: newEnd });
            }}
          >
            &lt; Previous
          </button>
          
          <span className="current-range">
            {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
          </span>
          
          <button 
            onClick={() => {
              const newStart = new Date(dateRange.startDate);
              const newEnd = new Date(dateRange.endDate);
              
              if (view === 'day') {
                newStart.setDate(newStart.getDate() + 1);
                newEnd.setDate(newEnd.getDate() + 1);
              } else if (view === 'week') {
                newStart.setDate(newStart.getDate() + 7);
                newEnd.setDate(newEnd.getDate() + 7);
              } else if (view === 'month') {
                newStart.setMonth(newStart.getMonth() + 1);
                newEnd.setMonth(newEnd.getMonth() + 1);
              }
              
              handleDateRangeChange({ startDate: newStart, endDate: newEnd });
            }}
          >
            Next &gt;
          </button>
        </div>
        
        <div className="display-controls">
          <button 
            className={`display-button ${displayMode === 'combined' ? 'active' : ''}`}
            onClick={() => handleDisplayModeChange('combined')}
          >
            All Schedules
          </button>
          <button 
            className={`display-button ${displayMode === 'client' ? 'active' : ''}`}
            onClick={() => handleDisplayModeChange('client')}
          >
            Client Only
          </button>
          <button 
            className={`display-button ${displayMode === 'caregiver' ? 'active' : ''}`}
            onClick={() => handleDisplayModeChange('caregiver')}
          >
            Caregiver Only
          </button>
        </div>
        
        <button 
          className="new-schedule-button"
          onClick={() => {
            const newSchedule = {
              date: new Date().toISOString().split('T')[0],
              startTime: '09:00',
              endTime: '10:00',
              title: 'New Schedule'
            };
            handleCreateSchedule(newSchedule);
          }}
        >
          + New Schedule
        </button>
      </div>
      
      <div className="schedule-grid">
        {loading ? (
          <div className="loading">Loading schedules...</div>
        ) : (
          <>
            <div className="time-slots-column">
              <div className="grid-header"></div>
              {getTimeSlots().map((timeSlot, index) => (
                <div key={index} className="time-slot">{timeSlot}</div>
              ))}
            </div>
            
            <div className="date-columns">
              {getDates().map((date, dateIndex) => (
                <div key={dateIndex} className="date-column">
                  <div className="grid-header">{formatDate(date)}</div>
                  {getTimeSlots().map((timeSlot, timeIndex) => (
                    <div key={timeIndex} className="time-cell">
                      {renderScheduleCell(date, timeSlot)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {selectedSchedule && (
        <div className="schedule-details">
          <h3>Schedule Details</h3>
          <div className="schedule-info">
            <p><strong>Title:</strong> {selectedSchedule.title || 'Untitled Schedule'}</p>
            <p><strong>Date:</strong> {new Date(selectedSchedule.date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> {selectedSchedule.startTime} - {selectedSchedule.endTime}</p>
            <p><strong>Client:</strong> {selectedSchedule.client?.name || 'No Client'}</p>
            <p><strong>Caregiver:</strong> {selectedSchedule.caregiver?.name || 'Unassigned'}</p>
            
            {hasConflict(selectedSchedule.id) && (
              <div className="conflict-warning">
                ⚠️ This schedule has conflicts. Please resolve before continuing.
              </div>
            )}
          </div>
          
          <div className="schedule-actions">
            <button
              onClick={() => {
                const updatedSchedule = { ...selectedSchedule };
                updatedSchedule.title = prompt('Enter new title:', updatedSchedule.title);
                if (updatedSchedule.title) {
                  handleUpdateSchedule(selectedSchedule.id, { title: updatedSchedule.title });
                }
              }}
            >
              Edit
            </button>
            <button
              className="delete-button"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this schedule?')) {
                  handleDeleteSchedule(selectedSchedule.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .universal-schedule-view {
          display: flex;
          flex-direction: column;
          height: 700px;
          min-height: 700px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 100%;
        }
        
        .schedule-controls {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
          background: #f8f9fa;
          gap: 15px;
          min-height: 80px;
        }
        
        .view-controls, .display-controls {
          display: flex;
          gap: 5px;
        }
        
        .view-button, .display-button {
          padding: 10px 16px;
          margin: 0 2px;
          border: 1px solid #dee2e6;
          background: white;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          font-weight: 500;
          min-width: 80px;
          color: #495057;
        }
        
        .view-button:hover, .display-button:hover {
          background: #e9ecef;
          border-color: #ced4da;
        }
        
        .view-button.active, .display-button.active {
          background: #3498db;
          color: white;
          border-color: #3498db;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .date-navigation {
          display: flex;
          align-items: center;
          background: white;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          padding: 8px;
        }
        
        .date-navigation button {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          cursor: pointer;
          padding: 8px 12px;
          margin: 0 5px;
          border-radius: 4px;
          font-weight: 500;
          color: #495057;
          white-space: nowrap;
        }
        
        .date-navigation button:hover {
          background: #e9ecef;
          border-color: #ced4da;
        }
        
        .current-range {
          font-weight: 500;
          padding: 0 15px;
          color: #212529;
          white-space: nowrap;
        }
        
        .new-schedule-button {
          padding: 10px 16px;
          background: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          white-space: nowrap;
        }
        
        .new-schedule-button:hover {
          background: #27ae60;
          transform: translateY(-1px);
          box-shadow: 0 3px 6px rgba(0,0,0,0.15);
        }
        
        .schedule-grid {
          display: flex;
          flex: 1;
          overflow: auto;
          height: calc(100% - 160px); /* Account for controls + details */
        }
        
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6c757d;
        }
        
        .time-slots-column {
          display: flex;
          flex-direction: column;
          min-width: 100px;
          border-right: 1px solid #e9ecef;
          background: #f8f9fa;
          flex-shrink: 0;
        }
        
        .date-columns {
          display: flex;
          flex: 1;
          overflow-x: auto;
          width: calc(100% - 100px);
        }
        
        .date-column {
          display: flex;
          flex-direction: column;
          min-width: 250px;
          border-right: 1px solid #e9ecef;
        }

        /* When in day view, make the column wider */
        .date-column:only-child {
          width: 100%;
        }
        
        .grid-header {
          height: 60px;
          padding: 10px;
          font-weight: 600;
          background: #f8f9fa;
          border-bottom: 2px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .time-slot {
          height: 70px;
          padding: 8px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          color: #495057;
          font-weight: 500;
        }
        
        .time-cell {
          height: 70px;
          border-bottom: 1px solid #e9ecef;
          position: relative;
          background: white;
        }
        
        .time-cell:hover {
          background: #f8f9fa;
        }
        
        .schedule-cell {
          width: 100%;
          height: 100%;
          padding: 2px;
        }
        
        .schedule-card {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          padding: 5px;
          border-radius: 3px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .schedule-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        .schedule-card.conflict {
          background: #ffebee;
          border-left-color: #f44336;
        }
        
        .schedule-card.selected {
          background: #e8f5e9;
          border-left-color: #4caf50;
          box-shadow: 0 0 0 2px #4caf50;
        }
        
        .schedule-card.dragging {
          opacity: 0.5;
        }
        
        .schedule-time {
          font-weight: 500;
          margin-bottom: 2px;
        }
        
        .schedule-title {
          font-weight: 500;
          margin-bottom: 2px;
        }
        
        .schedule-client, .schedule-caregiver {
          color: #6c757d;
          font-size: 0.7rem;
        }
        
        .schedule-details {
          padding: 20px;
          border-top: 1px solid #e9ecef;
          background: #f8f9fa;
          max-height: 250px;
          overflow-y: auto;
        }
        
        .schedule-details h3 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
          border-bottom: 2px solid #e9ecef;
          padding-bottom: 10px;
        }
        
        .schedule-info {
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
        }
        
        .schedule-info p {
          margin: 5px 0;
        }
        
        .conflict-warning {
          margin-top: 10px;
          padding: 8px;
          background: #fff3cd;
          border: 1px solid #ffeeba;
          border-radius: 4px;
          color: #856404;
        }
        
        .schedule-actions {
          display: flex;
          gap: 10px;
        }
        
        .schedule-actions button {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          background: #3498db;
          color: white;
        }
        
        .schedule-actions .delete-button {
          background: #e74c3c;
        }
      `}</style>
    </div>
  );
};

export default UniversalScheduleView;

import React, { useState, useEffect, useCallback } from 'react';
import { universalScheduleService, universalDataService } from '../services';
import UnassignedCaregiversPanel from './UnassignedCaregiversPanel';

/**
 * New Calendar View Component
 * Provides an enhanced, filterable calendar view for schedules.
 */
const NewCalendarView = () => {
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

  const [clientsList, setClientsList] = useState([]);
  const [caregiversList, setCaregiversList] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [selectedCaregiverIds, setSelectedCaregiverIds] = useState([]);

  // Fetch initial data for filters
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [clients, caregivers] = await Promise.all([
          universalDataService.getClients(),
          universalDataService.getCaregivers()
        ]);
        setClientsList(clients || []);
        setCaregiversList(caregivers || []);
      } catch (error) {
        console.error('Error loading client/caregiver lists for filters:', error);
        // Optionally set an error state to display to the user
      }
    };
    loadFilterData();
  }, []);

  // Fetch schedules for the current date range and filters
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      let fetchedSchedules = [];

      // TODO: Enhance backend to support filtering by multiple client/caregiver IDs directly in getSchedules options
      // For now, fetch all schedules in range and then filter client-side if IDs are selected,
      // or fetch specifically if only one ID is selected (though this might be less efficient than one broad fetch then filter).
      // The most straightforward initial approach is to fetch all and filter client-side.

      const options = {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        include: ['client', 'caregiver'] // Ensure singular form if that's what the backend expects for include
      };

      let allSchedulesInRange = await universalScheduleService.getSchedules(options);

      if (selectedClientIds.length > 0 || selectedCaregiverIds.length > 0) {
        fetchedSchedules = allSchedulesInRange.filter(schedule => {
          const clientMatch = selectedClientIds.length === 0 || (schedule.clientId && selectedClientIds.includes(schedule.clientId));
          const caregiverMatch = selectedCaregiverIds.length === 0 || (schedule.caregiverId && selectedCaregiverIds.includes(schedule.caregiverId));
          return clientMatch && caregiverMatch;
        });
      } else {
        fetchedSchedules = allSchedulesInRange;
      }

      setSchedules(fetchedSchedules);

      // Check for conflicts on the fetched schedules
      if (fetchedSchedules.length > 0) {
        const conflictPromises = fetchedSchedules.map(schedule =>
          universalScheduleService.findConflicts(schedule.id)
        );
        const conflictResults = await Promise.all(conflictPromises);
        const allConflicts = conflictResults.flat().filter(conflict => conflict);
        setConflicts(allConflicts);
      } else {
        setConflicts([]);
      }

    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSchedules([]); // Clear schedules on error
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedClientIds, selectedCaregiverIds]); // Add filter states to dependency array

  // Initialize component and fetch schedules when filters change
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]); // fetchSchedules itself is memoized with its dependencies

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

  const handleClientFilterChange = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    setSelectedClientIds(selectedOptions);
  };

  const handleCaregiverFilterChange = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    setSelectedCaregiverIds(selectedOptions);
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

  // Memoized values for rendering
  const memoizedDates = React.useMemo(() => getDates(), [dateRange, view]);
  const memoizedTimeSlots = React.useMemo(() => getTimeSlots(), []);

  // Prepare data for rendering based on displayMode
  const getRenderData = () => {
    if (displayMode === 'client' || displayMode === 'caregiver') {
      const entitiesToList = displayMode === 'client'
        ? (selectedClientIds.length > 0 ? clientsList.filter(c => selectedClientIds.includes(c.id)) : clientsList)
        : (selectedCaregiverIds.length > 0 ? caregiversList.filter(cg => selectedCaregiverIds.includes(cg.id)) : caregiversList);

      return entitiesToList.map(entity => {
        const entitySchedules = schedules.filter(schedule =>
          displayMode === 'client' ? schedule.clientId === entity.id : schedule.caregiverId === entity.id
        );
        // Further filter by selectedCaregiverIds if in 'client' mode and vice-versa, if needed for cross-filtering
        // For now, primary entity lane filtering is done above.
        return {
          id: entity.id,
          name: entity.firstName ? `${entity.firstName} ${entity.lastName}` : entity.name || entity.id,
          schedules: entitySchedules
        };
      }).filter(lane => lane.schedules.length > 0 || (displayMode === 'client' && selectedClientIds.includes(lane.id)) || (displayMode === 'caregiver' && selectedCaregiverIds.includes(lane.id))); // Keep lane if entity selected or has schedules
    }
    // For 'combined' mode, or as a fallback for now
    return [{ id: 'combined', name: 'Combined View', schedules: schedules }];
  };

  const renderData = React.useMemo(() => getRenderData(), [displayMode, schedules, clientsList, caregiversList, selectedClientIds, selectedCaregiverIds]);

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
  const renderScheduleCell = (date, timeSlot, schedulesForCell) => {
    const matchingSchedules = schedulesForCell.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      // Date and time matching logic remains the same
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
        onDrop={() => handleDrop(date, timeSlot)} // Drag and drop might need context of the lane in future
      >
        {matchingSchedules.map(schedule => renderScheduleCard(schedule))}
      </div>
    );
  };

  const renderGridContent = () => {
    if (displayMode === 'combined') {
      // Original combined view rendering
      return (
        <div className="date-columns">
          {memoizedDates.map((date, dateIndex) => (
            <div key={dateIndex} className="date-column">
              <div className="grid-header">{formatDate(date)}</div>
              {memoizedTimeSlots.map((timeSlot, timeIndex) => (
                <div key={timeIndex} className="time-cell">
                  {renderScheduleCell(date, timeSlot, renderData.length > 0 ? renderData[0].schedules : [])}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    } else if (displayMode === 'client' || displayMode === 'caregiver') {
      // Lane-based view
      return (
        <div className="lanes-container">
          {renderData.map(lane => (
            <div key={lane.id} className="lane">
              <div className="lane-header">{lane.name}</div>
              <div className="lane-grid">
                <div className="time-slots-column lane-time-slots">
                  {/* Optional: Render time slots per lane if styling demands, or rely on main time slots column */}
                  {/* For simplicity, main time slots column is kept, and this one can be for alignment or empty */}
                </div>
                <div className="date-columns">
                  {memoizedDates.map((date, dateIndex) => (
                    <div key={dateIndex} className="date-column">
                      {/* No date header per column within lane, main date header is above all lanes */}
                      {memoizedTimeSlots.map((timeSlot, timeIndex) => (
                        <div key={timeIndex} className="time-cell">
                          {renderScheduleCell(date, timeSlot, lane.schedules)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
           {renderData.length === 0 && <div className="no-data-message">No {displayMode}s match the current filters or have schedules in this period.</div>}
        </div>
      );
    }
    return null;
  };


  return (
    <div className="new-calendar-view">
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

        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="client-filter">Filter Clients:</label>
            <select
              id="client-filter"
              multiple
              value={selectedClientIds}
              onChange={handleClientFilterChange}
              className="filter-select"
            >
              {clientsList.map(client => (
                <option key={client.id} value={client.id}>
                  {client.firstName ? `${client.firstName} ${client.lastName}` : client.name || client.id}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="caregiver-filter">Filter Caregivers:</label>
            <select
              id="caregiver-filter"
              multiple
              value={selectedCaregiverIds}
              onChange={handleCaregiverFilterChange}
              className="filter-select"
            >
              {caregiversList.map(caregiver => (
                <option key={caregiver.id} value={caregiver.id}>
                  {caregiver.firstName ? `${caregiver.firstName} ${caregiver.lastName}` : caregiver.name || caregiver.id}
                </option>
              ))}
            </select>
          </div>
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
      <div className="calendar-view-body"> {/* New wrapper */}
        <div className="schedule-grid">
          {loading ? (
            <div className="loading">Loading schedules...</div>
        ) : (
          <div className="schedule-grid-body"> {/* New wrapper for layout */}
            <div className="time-slots-column">
              <div className="grid-header">&nbsp; {/* Empty header for alignment */} </div>
              {memoizedTimeSlots.map((timeSlot, index) => (
                <div key={index} className="time-slot">{timeSlot}</div>
              ))}
            </div>
            <div className="main-grid-content">
              {(displayMode === 'client' || displayMode === 'caregiver') && (
                <div className="date-headers-row">
                  {memoizedDates.map((date, dateIndex) => (
                    <div key={dateIndex} className="grid-header date-header">
                      {formatDate(date)}
                    </div>
                  ))}
                </div>
              )}
              {renderGridContent()}
            </div>
          </div>
        )}
        </div> {/* End of schedule-grid */}
        <UnassignedCaregiversPanel />
      </div> {/* End of calendar-view-body */}

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
        .new-calendar-view {
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

        .calendar-view-body {
          display: flex;
          flex: 1; /* Take remaining vertical space */
          overflow: hidden; /* Prevent body from causing overall scroll */
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

        .filter-controls {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
        }

        .filter-group label {
          font-size: 0.85rem;
          margin-bottom: 4px;
          color: #495057;
        }

        .filter-select {
          min-width: 150px;
          padding: 5px;
          border-radius: 4px;
          border: 1px solid #ced4da;
          height: 60px; /* To show a few options */
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
          flex-direction: column;
          flex: 1; /* Takes up remaining space from .calendar-view-body */
          overflow: hidden;
          border-right: 1px solid #e0e0e0; /* Optional: separator line */
        }

        /* Styling for the panel itself if needed from parent, though it has its own */
        .unassigned-caregivers-panel {
           min-width: 280px; /* Or desired width */
           width: 25%; /* Example percentage width */
           max-width: 350px;
           /* The panel already has overflow-y: auto from its own styles */
        }

        .schedule-grid-body {
          display: flex;
          flex: 1;
          overflow: auto; /* This part will scroll */
          height: calc(100% - 160px - 0px); /* Adjust if date-headers-row has fixed height */
        }

        .main-grid-content {
          flex: 1;
          display: flex;
          flex-direction: column; /* Stack date headers and lanes/date-columns */
          overflow-x: auto;
        }

        .date-headers-row {
          display: flex;
          position: sticky;
          top: 0;
          background: #f8f9fa; /* Match grid-header */
          z-index: 11; /* Above lane content but below main controls if they scroll */
        }

        .date-headers-row .date-header {
          min-width: 250px; /* Should match .date-column min-width */
          /* flex: 1; Remove flex:1 if using min-width primarily */
          border-right: 1px solid #e9ecef;
        }
        .date-headers-row .date-header:last-child {
          border-right: none;
        }


        .lanes-container {
          flex: 1;
          /* overflow-y: auto; If individual lanes don't scroll, this can scroll all lanes */
        }

        .lane {
          border-bottom: 2px solid #dee2e6; /* Separator for lanes */
        }
        .lane:last-child {
          border-bottom: none;
        }

        .lane-header {
          padding: 10px;
          font-weight: 600;
          background: #e9ecef; /* Slightly different from date headers */
          border-bottom: 1px solid #ced4da;
          position: sticky; /* If lanes scroll, their headers can stick */
          top: 0; /* Adjust if date-headers-row is also sticky */
          z-index: 10;
        }

        .lane-grid {
          display: flex; /* Aligns time-slots-column (if used per lane) and date-columns */
        }

        .lane-time-slots {
          /* Styles if we want a time slot column per lane, for now it's mainly for structure */
          /* background: #f8f9fa; */ /* Example */
        }

        .no-data-message {
          padding: 20px;
          text-align: center;
          color: #6c757d;
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

export default NewCalendarView;

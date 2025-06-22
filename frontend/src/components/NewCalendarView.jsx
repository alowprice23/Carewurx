import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { universalScheduleService, universalDataService } from '../services'; // Import services
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';

const NewCalendarView = () => {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(''); // Empty string for 'All Clients'
  const [loading, setLoading] = useState({ schedules: true, clients: true });
  const [error, setError] = useState(null);

  const fetchClients = useCallback(async () => {
    setLoading(prev => ({ ...prev, clients: true }));
    try {
      const clientData = await universalDataService.getClients();
      setClients(clientData || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load clients.');
      setClients([]);
    } finally {
      setLoading(prev => ({ ...prev, clients: false }));
    }
  }, []);

  const fetchAndTransformSchedules = useCallback(async () => {
    setLoading(prev => ({ ...prev, schedules: true }));
    setError(null);
    try {
      const today = new Date();
      // For simplicity in this iteration, we'll fetch for a wider range if "All Clients"
      // or refine the date range logic later (e.g., based on FullCalendar's visible range).
      // For now, let's use current month for both cases, but be aware this might need adjustment.
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      let rawSchedules = [];
      if (selectedClientId) {
        // Fetch schedules for the specific client
        rawSchedules = await universalScheduleService.getClientSchedules(
          selectedClientId,
          startDate.toISOString(),
          endDate.toISOString()
        );
      } else {
        // Fetch all schedules for the date range
        const options = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          include: ['clients', 'caregivers']
        };
        rawSchedules = await universalScheduleService.getSchedules(options);
      }

      const transformedEvents = (rawSchedules || []).map(schedule => {
        // Combine date and time. Ensure date is correctly parsed.
        // FullCalendar expects ISO8601 strings or Date objects.
        const startDateTime = `${schedule.date}T${schedule.startTime}`;
        const endDateTime = schedule.endTime ? `${schedule.date}T${schedule.endTime}` : null;

        let eventTitle = schedule.title || 'Scheduled Shift';
        if (schedule.client && schedule.client.name) {
          eventTitle = `${schedule.client.name} - ${eventTitle}`;
        }
        if (schedule.caregiver && schedule.caregiver.name) {
          eventTitle = `${eventTitle} (w/ ${schedule.caregiver.name})`;
        }

        return {
          id: schedule.id, // Important for event manipulation
          title: eventTitle,
          start: startDateTime,
          end: endDateTime,
          allDay: !schedule.startTime, // Example: if no startTime, consider it allDay
          // extendedProps can hold original schedule data if needed
          extendedProps: {
            originalSchedule: schedule
          }
        };
      });

      setEvents(transformedEvents);
    } catch (err) {
      console.error('Error fetching or transforming schedules:', err);
      setError(prevError => prevError ? `${prevError} And failed to load schedule data.` : 'Failed to load schedule data.');
      setEvents([]); // Clear events on error
    } finally {
      setLoading(prev => ({ ...prev, schedules: false }));
    }
  }, [selectedClientId]); // Add selectedClientId as a dependency

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    // This effect now specifically handles fetching schedules when
    // selectedClientId changes or on initial mount (via fetchAndTransformSchedules dependency).
    fetchAndTransformSchedules();
  }, [fetchAndTransformSchedules, selectedClientId]); // Ensure re-fetch when client filter changes

  // Memoized filtered events - this might become redundant if server filtering is perfect,
  // but good for ensuring consistency or further client-side tweaks if needed.
  // For now, with server-side filtering for specific clients, 'events' state itself will be filtered.
  // If 'All Clients' is selected, 'events' contains all, and no further client-side filtering on clientId is needed here.
  const displayEvents = useMemo(() => {
    // If selectedClientId is empty, events are already all events for the range.
    // If selectedClientId is present, events are already filtered by the server for that client.
    // So, directly use 'events' state here.
    return events;
  }, [events]);

  if (loading.schedules || loading.clients) {
    let loadingMessage = "Loading...";
    if (loading.schedules && loading.clients) {
      loadingMessage = "Loading calendar, schedules, and clients...";
    } else if (loading.schedules) {
      loadingMessage = "Loading calendar and schedules...";
    } else if (loading.clients) {
      loadingMessage = "Loading clients...";
    }
    return <div className="calendar-loading">{loadingMessage}</div>;
  }

  if (error) {
    return <div className="calendar-error">Error: {error}</div>;
  }

  return (
    <div className="new-calendar-view" style={{ padding: '20px' }}>
      <div className="calendar-controls">
        <label htmlFor="client-filter">Filter by Client: </label>
        <select
          id="client-filter"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name || `Client ID: ${client.id}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ height: '80vh', marginTop: '10px' }}> {/* Ensure calendar takes up significant height */}
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        }}
        events={displayEvents} // Use the events (now directly filtered or all)
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        // Example event handlers (can be expanded)
        dateClick={(info) => {
          console.log('Date clicked: ', info.dateStr);
          // Potentially open a modal to create a new event on this date
        }}
        eventClick={(info) => {
          console.log('Event clicked: ', info.event);
          // Potentially open a modal to view/edit event details
          // Access original data: info.event.extendedProps.originalSchedule
          alert(`Event: ${info.event.title}\nStart: ${info.event.startStr}\nOriginal Data: ${JSON.stringify(info.event.extendedProps.originalSchedule, null, 2)}`);
        }}
        // Add more FullCalendar props as needed
      />
      </div>
      <style jsx global>{`
        .calendar-loading, .calendar-error {
          padding: 20px;
          text-align: center;
          font-size: 1.2em;
        }
        .calendar-controls {
          margin-bottom: 15px;
          padding: 10px;
          background-color: #f8f9fa;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .calendar-controls label {
          font-weight: bold;
        }
        .calendar-controls select {
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid #ced4da;
          min-width: 200px;
        }
        /* Basic styling for FullCalendar - can be expanded or moved to a CSS file */
        .fc { /* Target FullCalendar's main class */
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
        .fc .fc-toolbar-title {
          font-size: 1.5em;
        }
        .fc .fc-button {
          background-color: #3498db;
          border-color: #3498db;
          color: white;
        }
        .fc .fc-button:hover {
          background-color: #2980b9;
        }
        .fc .fc-event {
          border-radius: 4px;
          padding: 3px 5px;
          cursor: pointer;
        }
        .new-calendar-view {
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
};

export default NewCalendarView;

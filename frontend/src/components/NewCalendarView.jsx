import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { universalScheduleService } from '../services'; // Import the service
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';

const NewCalendarView = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAndTransformSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Define a date range for fetching schedules, e.g., current month
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const options = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        include: ['clients', 'caregivers'] // Assuming service supports this
      };

      const rawSchedules = await universalScheduleService.getSchedules(options);

      const transformedEvents = rawSchedules.map(schedule => {
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
      setError('Failed to load schedule data. Please try again.');
      setEvents([]); // Clear events on error
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies, will be called manually or by other triggers

  useEffect(() => {
    fetchAndTransformSchedules();
  }, [fetchAndTransformSchedules]);

  if (loading) {
    return <div className="calendar-loading">Loading calendar and schedules...</div>;
  }

  if (error) {
    return <div className="calendar-error">Error: {error}</div>;
  }

  return (
    <div className="new-calendar-view" style={{ height: '80vh', padding: '20px' }}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        }}
        events={events} // Use fetched and transformed events
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
      <style jsx global>{`
        .calendar-loading, .calendar-error {
          padding: 20px;
          text-align: center;
          font-size: 1.2em;
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

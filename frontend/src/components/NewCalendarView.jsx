import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction'; // for selectable dates, event clicking
import firebaseService from '../services/firebaseService'; // Assuming firebaseServiceMock is active

const NewCalendarView = () => {
  const [allSchedules, setAllSchedules] = useState([]); // Store all fetched schedules
  const [calendarEvents, setCalendarEvents] = useState([]); // Events to display on calendar
  const [clients, setClients] = useState([]); // For the filter dropdown
  const [selectedClientId, setSelectedClientId] = useState(''); // Currently selected client for filtering
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial data (schedules, clients, caregivers)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Clients for dropdown and names
        const clientSnapshot = await firebaseService.db.collection('clients').get();
        const clientsList = [];
        const clientsDataMap = {};
        clientSnapshot.docs.forEach(doc => {
          const clientDocData = doc.data();
          clientsList.push({ id: doc.id, name: `${clientDocData.firstName} ${clientDocData.lastName}` });
          clientsDataMap[doc.id] = clientDocData;
        });
        setClients(clientsList);

        // Fetch Caregivers for names
        const caregiverSnapshot = await firebaseService.db.collection('caregivers').get();
        const caregiversDataMap = {};
        caregiverSnapshot.docs.forEach(doc => caregiversDataMap[doc.id] = doc.data());

        // Fetch all Schedules
        const scheduleSnapshot = await firebaseService.db.collection('schedules').get();
        if (scheduleSnapshot.empty) {
          console.log('No schedules found.');
          setAllSchedules([]);
          setCalendarEvents([]);
          setLoading(false);
          return;
        }

        const fetchedSchedules = scheduleSnapshot.docs.map(doc => {
          const schedule = doc.data();
          const client = clientsDataMap[schedule.client_id];
          const caregiver = caregiversDataMap[schedule.caregiver_id];
          const title = `Client: ${client ? client.firstName : 'Unknown'} / CG: ${caregiver ? caregiver.firstName : 'Unknown'}`;

          return {
            id: doc.id,
            title: title,
            start: `${schedule.date}T${schedule.startTime}`,
            end: `${schedule.date}T${schedule.endTime}`,
            allDay: false,
            extendedProps: { ...schedule }
          };
        });
        setAllSchedules(fetchedSchedules);
        setCalendarEvents(fetchedSchedules); // Initially display all schedules

      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError("Failed to load initial data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Effect to filter schedules when selectedClientId changes
  useEffect(() => {
    if (!selectedClientId) {
      setCalendarEvents(allSchedules); // Show all if no client is selected
    } else {
      const filtered = allSchedules.filter(event => event.extendedProps.client_id === selectedClientId);
      setCalendarEvents(filtered);
    }
  }, [selectedClientId, allSchedules]);

  const handleClientFilterChange = (e) => {
    setSelectedClientId(e.target.value);
  };

  const handleDateClick = (arg) => {
    console.log('Date clicked: ', arg.dateStr);
    alert('Clicked on: ' + arg.dateStr);
  };

  const handleEventClick = (clickInfo) => {
    console.log('Event clicked: ', clickInfo.event);
    const details = clickInfo.event.extendedProps;
    alert(
      `Event: ${clickInfo.event.title}\n` +
      `Start: ${clickInfo.event.startStr}\n` +
      (clickInfo.event.endStr ? `End: ${clickInfo.event.endStr}\n` : 'No end time\n') +
      `Status: ${details.status || 'N/A'}\n` +
      `Client ID: ${details.client_id}\n` +
      `Caregiver ID: ${details.caregiver_id}`
    );
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading schedules...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div className="calendar-container" style={{ padding: '20px' }}>
      <style jsx global>{`
        /* Basic FullCalendar theming adjustments - can be expanded */
        .fc .fc-toolbar-title {
          font-size: 1.5em;
        }
        .fc-event {
          cursor: pointer;
        }
        .fc-daygrid-day-number {
            cursor: pointer;
        }
        .client-filter-select {
          margin-bottom: 15px;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ccc;
          min-width: 200px;
        }
      `}</style>
      <h2>New Schedule Calendar V2</h2>

      <div>
        <label htmlFor="client-filter" style={{ marginRight: '10px' }}>Filter by Client:</label>
        <select
          id="client-filter"
          className="client-filter-select"
          value={selectedClientId}
          onChange={handleClientFilterChange}
        >
          <option value="">All Clients</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,dayGridDay'
        }}
        events={calendarEvents} // Use fetched and formatted events
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        editable={true} // Allows dragging and resizing events (basic interaction)
        selectable={true} // Allows selecting dates/times
        selectMirror={true}
        dayMaxEvents={true} // When too many events, shows "+more" link
        weekends={true} // Show weekends
        // eventContent={renderEventContent} // Optional: Custom event rendering
      />
    </div>
  );
};

// Optional: Custom event rendering function
// function renderEventContent(eventInfo) {
//   return (
//     <>
//       <b>{eventInfo.timeText}</b>
//       <i>{eventInfo.event.title}</i>
//     </>
//   );
// }

export default NewCalendarView;

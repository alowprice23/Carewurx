import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Import services
import { getSchedulesForCalendar, getAllClientsList } from '../services/firebase';

// Import the new panel
import UnassignedCaregiversPanel from './UnassignedCaregiversPanel';

const localizer = momentLocalizer(moment);

const NewCalendarView = () => {
  const [allEvents, setAllEvents] = useState([]); // Store all fetched events
  const [filteredEvents, setFilteredEvents] = useState([]); // Events to display after filtering
  const [allEvents, setAllEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [viewMode, setViewMode] = useState('month'); // Default calendar view: 'month', 'week', 'day', 'agenda'
  const [resourceViewMode, setResourceViewMode] = useState('overall'); // 'overall', 'client', 'caregiver'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch clients for the filter dropdown and resource views
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const clientList = await getAllClientsList();
        setClients(clientList);
      } catch (err) {
        console.error("Error fetching clients:", err);
        // setError(err.message || 'Failed to load clients for filtering.'); // Optionally set error for client list
      }
    };
    fetchClients();
  }, []);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedEvents = await getSchedulesForCalendar(); // Fetches all for now
      setAllEvents(fetchedEvents);
      setError(null);
    } catch (err) {
      console.error("Error fetching schedules:", err);
      setError(err.message || 'Failed to load schedules.');
      setAllEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Filter events when allEvents or selectedClientId changes
  useEffect(() => {
    if (!selectedClientId) {
      setFilteredEvents(allEvents); // No filter selected, show all
    } else {
      setFilteredEvents(
        allEvents.filter(event => event.clientId === selectedClientId)
      );
    }
  }, [allEvents, selectedClientId]);

  const handleNavigate = (newDate) => {
    setCurrentDate(newDate);
    // Currently fetchSchedules fetches all, so no need to refetch on navigate
    // If getSchedulesForCalendar supported date ranges, we would call it here.
  };

  const handleClientFilterChange = (event) => {
    setSelectedClientId(event.target.value);
  };

  const handleResourceViewModeChange = (event) => {
    setResourceViewMode(event.target.value);
    // When switching to a resource view, 'month' might not be ideal.
    // Switch to 'day' or 'week' if a resource view is selected.
    if (event.target.value === 'client' || event.target.value === 'caregiver') {
      if (viewMode === 'month' || viewMode === 'agenda') setViewMode('day');
    }
  };

  const handleViewChange = (newView) => {
    setViewMode(newView);
  };

  const clientResources = clients.map(client => ({
    resourceId: client.id,
    resourceTitle: client.name,
  }));

  // TODO: Add caregiverResources when that view is implemented
  // const caregiverResources = caregivers.map(cg => ({ resourceId: cg.id, resourceTitle: cg.name }));

  const getResources = () => {
    if (resourceViewMode === 'client') {
      return clientResources;
    }
    // if (resourceViewMode === 'caregiver') {
    //   return caregiverResources;
    // }
    return null; // No resources for 'overall' view
  };

  const getResourceAccessor = () => {
    if (resourceViewMode === 'client') {
      return (event) => event.clientId; // Event should have a clientId property
    }
    // if (resourceViewMode === 'caregiver') {
    //   return (event) => event.resourceId; // Assuming event.resourceId is caregiverId
    // }
    return 'resourceId'; // Default or for 'overall' if it were to use resources
  };


  const handleSelectSlot = ({ start, end, resourceId }) => {
    // Placeholder for handling slot selection (e.g., creating a new event)
    const title = window.prompt('New Event name');
    if (title) {
      const newEvent = {
        start,
        end,
        title,
        // id: could be generated or come from backend after save
      };
      // setEvents(prevEvents => [...prevEvents, newEvent]); // Add optimistically or after save
      console.log("Selected slot, would create event:", newEvent);
      alert(`Selected slot: ${start.toLocaleString()} to ${end.toLocaleString()}\nEvent: ${title}`);
    }
  };

  const handleSelectEvent = (event) => {
    // Placeholder for handling event click (e.g., showing details in a modal)
    alert(
      `Event: ${event.title}\n` +
      `Client: ${event.clientName || event.clientId || 'N/A'}\n` +
      `Caregiver: ${event.caregiverName || event.resourceId || 'N/A'}\n` +
      `Status: ${event.status || 'N/A'}\n` +
      `Starts: ${event.start.toLocaleString()}\n` +
      `Ends: ${event.end.toLocaleString()}`
    );
    console.log("Selected event:", event);
  };

  if (error) {
    return <div style={{ color: 'red', padding: '20px' }}>Error loading calendar: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', height: 'calc(100vh - 100px)' /* Adjust height as needed */ }}>
      <h2>New Calendar View</h2>
      <div style={{ marginBottom: '10px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div>
          <label htmlFor="clientFilter" style={{ marginRight: '5px' }}>Filter by Client:</label>
          <select id="clientFilter" value={selectedClientId} onChange={handleClientFilterChange}>
            <option value="">All Clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="resourceViewMode" style={{ marginRight: '5px' }}>View Mode:</label>
          <select id="resourceViewMode" value={resourceViewMode} onChange={handleResourceViewModeChange}>
            <option value="overall">Overall</option>
            <option value="client">By Client</option>
            {/* <option value="caregiver">By Caregiver</option> */} {/* Add when caregiver data is ready */}
          </select>
        </div>
      </div>
      {loading && <p>Loading schedules...</p>}
      {!loading && !error && (
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          view={viewMode} // Controlled view
          views={resourceViewMode !== 'overall' ? ['day', 'week'] : ['month', 'week', 'day', 'agenda']} // Limit views for resource mode
          date={currentDate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          resources={getResources()}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          resourceAccessor={getResourceAccessor()}
          // Default to 'day' view if a resource mode is selected and current view is month/agenda
          defaultView={resourceViewMode !== 'overall' && (viewMode === 'month' || viewMode === 'agenda') ? 'day' : viewMode}
          // eventPropGetter={(event, start, end, isSelected) => {
          //   let newStyle = {
          //     backgroundColor: "lightgrey",
          //     color: 'black',
          //     borderRadius: "0px",
          //     border: "none"
          //   };
          //   if (event.status === 'confirmed') { newStyle.backgroundColor = "lightgreen"; }
          //   if (event.status === 'pending') { newStyle.backgroundColor = "lightyellow"; }
          //   return { style: newStyle };
          // }}
        />
      )}
      <UnassignedCaregiversPanel />
    </div>
  );
};

export default NewCalendarView;

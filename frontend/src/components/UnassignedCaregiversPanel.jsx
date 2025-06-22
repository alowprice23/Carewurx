import React, { useState, useEffect, useCallback } from 'react';
import { getAllCaregiversList, getSchedulesForCalendar } from '../services/firebase';

const UnassignedCaregiversPanel = () => {
  const [unassignedCaregivers, setUnassignedCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const findUnassignedCaregivers = useCallback(async () => {
    setLoading(true);
    try {
      const caregivers = await getAllCaregiversList();

      // Define the upcoming period for checking schedules (e.g., next 7 days)
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Fetch schedules within this period.
      // Note: getSchedulesForCalendar currently fetches ALL schedules.
      // For performance, this should be adapted to fetch only within the date range
      // and potentially only for active caregivers if the backend supports it.
      // For now, we'll filter client-side after fetching all.
      const allSchedules = await getSchedulesForCalendar();

      const upcomingSchedules = allSchedules.filter(schedule => {
        const scheduleStartDate = schedule.start; // react-big-calendar events have Date objects
        return scheduleStartDate >= today && scheduleStartDate <= nextWeek;
      });

      // Calculate scheduled hours for each caregiver in the upcoming period
      const caregiverHours = {};
      upcomingSchedules.forEach(schedule => {
        if (schedule.resourceId) { // resourceId is used for caregiverId in calendar events
          const duration = (schedule.end.getTime() - schedule.start.getTime()) / (1000 * 60 * 60); // hours
          caregiverHours[schedule.resourceId] = (caregiverHours[schedule.resourceId] || 0) + duration;
        }
      });

      const thresholdHours = 5; // Caregivers with less than these hours are "underutilized"
      const processedCaregivers = caregivers
        .filter(cg => cg.isActive) // Consider only active caregivers
        .map(cg => ({
          ...cg,
          scheduledHours: caregiverHours[cg.id] || 0,
        }))
        .filter(cg => cg.scheduledHours < thresholdHours)
        .sort((a, b) => a.scheduledHours - b.scheduledHours); // Show those with least hours first

      setUnassignedCaregivers(processedCaregivers);
      setError(null);
    } catch (err) {
      console.error("Error finding unassigned caregivers:", err);
      setError(err.message || "Failed to load unassigned caregivers.");
      setUnassignedCaregivers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    findUnassignedCaregivers();
  }, [findUnassignedCaregivers]);

  if (loading) {
    return <p>Loading unassigned caregivers...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
  }

  return (
    <div style={{ border: '1px solid #eee', padding: '15px', margin: '20px 0' }}>
      <h4>Newly Onboarded / Underutilized Caregivers</h4>
      {unassignedCaregivers.length === 0 ? (
        <p>No caregivers currently fit this criteria.</p>
      ) : (
        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
          {unassignedCaregivers.map(cg => (
            <li key={cg.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #f0f0f0' }}>
              <strong>{cg.name}</strong> (Scheduled: {cg.scheduledHours}hrs)
              <div>Skills: {cg.skills.join(', ')}</div>
              <div>Availability: {cg.availability}</div>
              {/* TODO: Add "View Profile" and "Find Matches" buttons */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UnassignedCaregiversPanel;

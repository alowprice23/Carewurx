import React, { useState, useEffect } from 'react';
import { universalDataService, universalScheduleService } from '../services';

const UnassignedCaregiversPanel = () => {
  const [unassignedCaregivers, setUnassignedCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUnassignedCaregivers = async () => {
      setLoading(true);
      setError(null);
      try {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const [allCaregivers, allSchedules] = await Promise.all([
          universalDataService.getCaregivers(),
          universalScheduleService.getSchedules({
            startDate: today.toISOString(),
            endDate: nextWeek.toISOString(),
            // No need to include client/caregiver details in schedules for this purpose
          })
        ]);

        if (!allCaregivers || !allSchedules) {
          console.warn('Caregivers or schedules data is undefined.');
          setUnassignedCaregivers([]);
          setLoading(false);
          return;
        }

        const scheduleCounts = allSchedules.reduce((acc, schedule) => {
          if (schedule.caregiverId) {
            acc[schedule.caregiverId] = (acc[schedule.caregiverId] || 0) + 1;
          }
          return acc;
        }, {});

        // Define "unassigned" as having 0 schedules in the next week.
        // This threshold can be adjusted (e.g., < MIN_HOURS_THRESHOLD).
        const filteredCaregivers = allCaregivers.filter(cg => {
          // Assuming caregivers have an 'isActive' or similar status field. If not, all are considered.
          // For now, let's assume all fetched caregivers are potentially assignable.
          const isActive = cg.isActive !== undefined ? cg.isActive : true; // Default to true if no status
          return isActive && (scheduleCounts[cg.id] || 0) === 0;
        });

        setUnassignedCaregivers(filteredCaregivers);
      } catch (err) {
        console.error('Error fetching unassigned caregivers:', err);
        setError('Failed to load unassigned caregivers.');
      } finally {
        setLoading(false);
      }
    };

    fetchUnassignedCaregivers();
  }, []);

  if (loading) {
    return <div className="panel-loading">Loading unassigned caregivers...</div>;
  }

  if (error) {
    return <div className="panel-error">{error}</div>;
  }

  return (
    <div className="unassigned-caregivers-panel">
      <h4>Available Caregivers (Next 7 Days)</h4>
      {unassignedCaregivers.length === 0 ? (
        <p>No caregivers currently unassigned for the next 7 days.</p>
      ) : (
        <ul>
          {unassignedCaregivers.map(cg => (
            <li key={cg.id} className="caregiver-item">
              <div className="caregiver-info">
                <strong>{cg.firstName ? `${cg.firstName} ${cg.lastName}` : cg.name || 'N/A'}</strong>
                {/* Placeholder for skills and availability - assuming these fields might exist */}
                {cg.skills && <p className="skills">Skills: {cg.skills.join(', ')}</p>}
                {cg.availabilitySummary && <p className="availability">Availability: {cg.availabilitySummary}</p>}
              </div>
              <div className="caregiver-actions">
                <button onClick={() => console.log('View profile for', cg.id)}>View Profile</button>
                <button onClick={() => console.log('Find matches for', cg.id)}>Find Matches</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <style jsx>{`
        .unassigned-caregivers-panel {
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background-color: #f9f9f9;
          max-height: 400px; /* Or adjust as needed */
          overflow-y: auto;
        }
        .unassigned-caregivers-panel h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #333;
        }
        .panel-loading, .panel-error {
          padding: 10px;
          color: #555;
        }
        ul {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        .caregiver-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .caregiver-item:last-child {
          border-bottom: none;
        }
        .caregiver-info strong {
          display: block;
          margin-bottom: 4px;
        }
        .caregiver-info .skills, .caregiver-info .availability {
          font-size: 0.85em;
          color: #555;
          margin: 2px 0;
        }
        .caregiver-actions button {
          margin-left: 8px;
          padding: 5px 10px;
          font-size: 0.9em;
          cursor: pointer;
          border: 1px solid #ccc;
          background-color: #fff;
          border-radius: 4px;
        }
        .caregiver-actions button:hover {
          background-color: #f0f0f0;
        }
      `}</style>
    </div>
  );
};

export default UnassignedCaregiversPanel;

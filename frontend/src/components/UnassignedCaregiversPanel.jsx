import React, { useState, useEffect } from 'react';
import firebaseService from '../services/firebaseService'; // Assuming firebaseServiceMock is active

const UnassignedCaregiversPanel = () => {
  const [unassignedCaregivers, setUnassignedCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUnassignedCaregivers = async () => {
      try {
        setLoading(true);
        setError(null);

        const caregiversSnapshot = await firebaseService.db.collection('caregivers').get();
        const schedulesSnapshot = await firebaseService.db.collection('schedules').get();

        const allCaregivers = [];
        caregiversSnapshot.docs.forEach(doc => {
          allCaregivers.push({ id: doc.id, ...doc.data() });
        });

        const scheduledCaregiverIds = new Set();
        schedulesSnapshot.docs.forEach(doc => {
          const schedule = doc.data();
          if (schedule.caregiver_id) {
            scheduledCaregiverIds.add(schedule.caregiver_id);
          }
        });

        // Simple logic: caregivers not in any schedule
        // This can be refined later to include "under-utilized" based on hours
        const filteredCaregivers = allCaregivers.filter(cg => !scheduledCaregiverIds.has(cg.id));

        // Format for display
        const formattedCaregivers = filteredCaregivers.map(cg => ({
          id: cg.id,
          name: `${cg.firstName || ''} ${cg.lastName || ''}`.trim() || 'N/A',
          skills: cg.skills && cg.skills.length > 0 ? cg.skills : ['Not specified'],
          // Mock availability and contact for now, as they are not in MOCK_CAREGIVERS structure
          availability: cg.availabilitySummary || 'Availability not detailed',
          contact: cg.email || cg.phone || 'Contact not available',
        }));

        setUnassignedCaregivers(formattedCaregivers);

      } catch (err) {
        console.error("Error fetching unassigned caregivers:", err);
        setError("Failed to load caregiver data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchUnassignedCaregivers();
  }, []);


  if (loading) {
    return (
      <div className="panel-container loading-state">
        <style jsx>{`
          .panel-container { padding: 15px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 20px; }
          h4 { color: #333; margin-top: 0; }
          .loading-text { color: #555; font-style: italic; }
        `}</style>
        <h4>Unassigned & Under-Utilized Caregivers</h4>
        <p className="loading-text">Loading caregivers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-container error-state">
         <style jsx>{`
          .panel-container { padding: 15px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 20px; }
          h4 { color: #333; margin-top: 0; }
          .error-text { color: red; }
        `}</style>
        <h4>Unassigned & Under-Utilized Caregivers</h4>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (unassignedCaregivers.length === 0) {
    return (
      <div className="panel-container empty-state">
        <style jsx>{`
          .panel-container { padding: 15px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 20px; }
          h4 { color: #333; margin-top: 0; }
          p { color: #555; }
        `}</style>
        <h4>Unassigned & Under-Utilized Caregivers</h4>
        <p>No caregivers currently meet the criteria for this list.</p>
      </div>
    );
  }

  return (
    <div className="panel-container">
      <style jsx>{`
        .panel-container {
          padding: 15px;
          background-color: #f0f4f8; /* Light blue-grey background */
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-top: 20px;
        }
        h4 {
          color: #2c3e50; /* Darker blue for heading */
          margin-top: 0;
          border-bottom: 2px solid #3498db; /* Blue accent line */
          padding-bottom: 10px;
        }
        .caregivers-list {
          list-style: none;
          padding: 0;
        }
        .caregiver-item {
          background-color: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .caregiver-name {
          font-size: 1.1em;
          font-weight: bold;
          color: #3498db; /* Blue for name */
          margin-bottom: 8px;
        }
        .detail-item {
          font-size: 0.9em;
          color: #555;
          margin-bottom: 4px;
        }
        .detail-label {
          font-weight: bold;
          color: #333;
        }
        .actions {
          margin-top: 10px;
        }
        .action-button {
          background-color: #3498db; /* Blue button */
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
          margin-right: 10px;
          transition: background-color 0.2s;
        }
        .action-button:hover {
          background-color: #2980b9; /* Darker blue on hover */
        }
        .secondary-action {
          background-color: #95a5a6; /* Grey for secondary */
        }
        .secondary-action:hover {
          background-color: #7f8c8d; /* Darker grey */
        }
      `}</style>
      <h4>Unassigned & Under-Utilized Caregivers</h4>
      <ul className="caregivers-list">
        {unassignedCaregivers.map(cg => (
          <li key={cg.id} className="caregiver-item">
            <div className="caregiver-name">{cg.name}</div>
            <div className="detail-item">
              <span className="detail-label">Skills:</span> {cg.skills.join(', ')}
            </div>
            <div className="detail-item">
              <span className="detail-label">Availability:</span> {cg.availability}
            </div>
            <div className="detail-item">
              <span className="detail-label">Contact:</span> {cg.contact}
            </div>
            <div className="actions">
              <button
                className="action-button"
                onClick={() => console.log('View profile for:', cg.id)}
              >
                View Profile
              </button>
              <button
                className="action-button secondary-action"
                onClick={() => console.log('Find matches for:', cg.id)}
              >
                Find Potential Matches
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UnassignedCaregiversPanel;

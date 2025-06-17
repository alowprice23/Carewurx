import React, { useState, useEffect } from 'react';
import { schedulerService, notificationService } from '../services';

/**
 * Caregiver Matching System Component
 * Provides interface for automated caregiver matching with manual override controls
 * and matching criteria configuration.
 */
const CaregiverMatchingSystem = () => {
  // State for matching system
  const [matchingStatus, setMatchingStatus] = useState('idle'); // 'idle', 'running', 'completed', 'failed'
  const [matchingResults, setMatchingResults] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('matching'); // 'matching', 'criteria', 'history'
  const [errorMessage, setErrorMessage] = useState(null);
  const [matchingHistory, setMatchingHistory] = useState([]);
  
  // State for matching criteria
  const [matchingCriteria, setMatchingCriteria] = useState({
    distanceWeight: 3,
    specialtyWeight: 4,
    clientPreferenceWeight: 5,
    caregiverPreferenceWeight: 3,
    experienceWeight: 2,
    availabilityWeight: 5,
    considerLanguage: true,
    considerGender: false,
    considerPastMatches: true,
    maxDistance: 30,
    minCompatibilityScore: 70
  });
  
  // State for manual overrides
  const [overrideMode, setOverrideMode] = useState(false);
  const [manualMatches, setManualMatches] = useState([]);
  const [availableCaregivers, setAvailableCaregivers] = useState([]);
  const [, setAvailableClients] = useState([]);
  
  // Load initial data on component mount
  useEffect(() => {
    fetchMatchingHistory();
    fetchAvailableEntities();
  }, []);
  
  // Fetch matching history
  const fetchMatchingHistory = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const history = await schedulerService.getMatchingHistory();
      setMatchingHistory(history);
    } catch (error) {
      console.error('Error fetching matching history:', error);
      setErrorMessage('Failed to load matching history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch available caregivers and clients
  const fetchAvailableEntities = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const [caregivers, clients] = await Promise.all([
        schedulerService.getAvailableCaregivers(),
        schedulerService.getUnassignedClients()
      ]);
      
      setAvailableCaregivers(caregivers);
      setAvailableClients(clients);
    } catch (error) {
      console.error('Error fetching available entities:', error);
      setErrorMessage('Failed to load caregivers and clients. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run the automated matching process
  const runAutomatedMatching = async () => {
    setMatchingStatus('running');
    setErrorMessage(null);
    setIsLoading(true);
    
    try {
      const results = await schedulerService.runAutomatedMatching({
        criteria: matchingCriteria
      });
      
      setMatchingResults(results);
      setMatchingStatus('completed');
      
      notificationService.showNotification({
        type: 'success',
        title: 'Matching Complete',
        message: `Generated ${results.length} potential matches.`
      });
      
      // Refresh history after matching
      fetchMatchingHistory();
    } catch (error) {
      console.error('Error running automated matching:', error);
      setErrorMessage('Failed to run automated matching. Please try again.');
      setMatchingStatus('failed');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Matching Error',
        message: 'Failed to complete automated matching process.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Apply the current matching results
  const applyMatches = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      await schedulerService.applyMatches({
        matches: overrideMode ? manualMatches : matchingResults
      });
      
      notificationService.showNotification({
        type: 'success',
        title: 'Matches Applied',
        message: 'Caregiver matches have been successfully applied.'
      });
      
      // Reset state after applying
      setMatchingResults([]);
      setManualMatches([]);
      setMatchingStatus('idle');
      setOverrideMode(false);
      
      // Refresh data
      fetchMatchingHistory();
      fetchAvailableEntities();
    } catch (error) {
      console.error('Error applying matches:', error);
      setErrorMessage('Failed to apply matches. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Application Error',
        message: 'Failed to apply caregiver matches.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Save current matching criteria as default
  const saveMatchingCriteria = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      await schedulerService.saveMatchingCriteria(matchingCriteria);
      
      notificationService.showNotification({
        type: 'success',
        title: 'Criteria Saved',
        message: 'Matching criteria have been saved as default.'
      });
    } catch (error) {
      console.error('Error saving matching criteria:', error);
      setErrorMessage('Failed to save matching criteria. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Save Error',
        message: 'Failed to save matching criteria.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset matching criteria to system defaults
  const resetMatchingCriteria = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const defaultCriteria = await schedulerService.getDefaultMatchingCriteria();
      setMatchingCriteria(defaultCriteria);
      
      notificationService.showNotification({
        type: 'info',
        title: 'Criteria Reset',
        message: 'Matching criteria have been reset to system defaults.'
      });
    } catch (error) {
      console.error('Error resetting matching criteria:', error);
      setErrorMessage('Failed to reset matching criteria. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Reset Error',
        message: 'Failed to reset matching criteria.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle criteria change
  const handleCriteriaChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setMatchingCriteria(prevCriteria => ({
      ...prevCriteria,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? Number(value) : value
    }));
  };
  
  // Toggle between automated and manual matching
  const toggleOverrideMode = () => {
    if (!overrideMode && matchingStatus === 'completed') {
      // When switching to override mode, initialize manual matches with current results
      setManualMatches([...matchingResults]);
    }
    
    setOverrideMode(!overrideMode);
  };
  
  // Handle manual match selection
  const handleManualMatch = (clientId, caregiverId) => {
    // Remove any existing matches for this client
    const filteredMatches = manualMatches.filter(match => match.clientId !== clientId);
    
    // Add the new match
    const newMatches = [
      ...filteredMatches,
      {
        clientId,
        caregiverId,
        score: 'Manual',
        matchDate: new Date().toISOString()
      }
    ];
    
    setManualMatches(newMatches);
  };
  
  // Remove a match (both automated and manual)
  const removeMatch = (clientId) => {
    if (overrideMode) {
      setManualMatches(manualMatches.filter(match => match.clientId !== clientId));
    } else {
      setMatchingResults(matchingResults.filter(match => match.clientId !== clientId));
    }
  };
  
  // View details of a specific match
  const viewMatchDetails = (match) => {
    setSelectedMatch(match);
  };
  
  // Close match details
  const closeMatchDetails = () => {
    setSelectedMatch(null);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Calculate match quality color
  const getMatchQualityColor = (score) => {
    if (score === 'Manual') return '#3498db'; // Blue for manual matches
    
    const numericScore = Number(score);
    if (numericScore >= 90) return '#2ecc71'; // Excellent match (green)
    if (numericScore >= 80) return '#27ae60'; // Very good match (dark green)
    if (numericScore >= 70) return '#f39c12'; // Good match (orange)
    if (numericScore >= 60) return '#f1c40f'; // Fair match (yellow)
    return '#e74c3c'; // Poor match (red)
  };
  
  // Render a criteria section
  const renderCriteriaSection = (title, children) => (
    <div className="criteria-section">
      <h4>{title}</h4>
      <div className="criteria-grid">
        {children}
      </div>
    </div>
  );
  
  return (
    <div className="caregiver-matching-system">
      <div className="matching-tabs">
        <button
          className={activeTab === 'matching' ? 'active' : ''}
          onClick={() => setActiveTab('matching')}
        >
          Matching Dashboard
        </button>
        <button
          className={activeTab === 'criteria' ? 'active' : ''}
          onClick={() => setActiveTab('criteria')}
        >
          Matching Criteria
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Matching History
        </button>
      </div>
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
      
      {/* Matching Dashboard Tab */}
      {activeTab === 'matching' && (
        <div className="matching-dashboard">
          <div className="matching-controls">
            <div className="status-section">
              <h3>Matching Status</h3>
              <div className={`status-indicator ${matchingStatus}`}>
                {matchingStatus === 'idle' && 'Ready to Start Matching'}
                {matchingStatus === 'running' && 'Matching In Progress...'}
                {matchingStatus === 'completed' && 'Matching Completed'}
                {matchingStatus === 'failed' && 'Matching Failed'}
              </div>
              
              {matchingStatus === 'idle' && (
                <div className="matching-actions">
                  <button 
                    className="primary-button"
                    onClick={runAutomatedMatching}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Starting...' : 'Start Automated Matching'}
                  </button>
                  <p className="help-text">
                    Start the automated matching process using current criteria.
                  </p>
                </div>
              )}
              
              {matchingStatus === 'completed' && (
                <div className="matching-actions">
                  <div className="action-row">
                    <button 
                      className="primary-button"
                      onClick={applyMatches}
                      disabled={isLoading || (overrideMode && manualMatches.length === 0)}
                    >
                      {isLoading ? 'Applying...' : 'Apply Matches'}
                    </button>
                    <button 
                      className="secondary-button"
                      onClick={() => {
                        setMatchingResults([]);
                        setManualMatches([]);
                        setMatchingStatus('idle');
                        setOverrideMode(false);
                      }}
                    >
                      Discard & Start Over
                    </button>
                  </div>
                  <div className="override-toggle">
                    <label>
                      <input
                        type="checkbox"
                        checked={overrideMode}
                        onChange={toggleOverrideMode}
                      />
                      Manual Override Mode
                    </label>
                    <p className="help-text">
                      Override automated matches with manual selections.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {matchingStatus === 'completed' && (
              <div className="results-section">
                <h3>Matching Results</h3>
                {overrideMode ? (
                  <div className="override-controls">
                    <p className="override-message">
                      Manual override mode is active. Select caregivers for each client below.
                    </p>
                  </div>
                ) : (
                  <div className="results-summary">
                    <div className="summary-item">
                      <span className="label">Total Matches:</span>
                      <span className="value">{matchingResults.length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Excellent Matches:</span>
                      <span className="value">{matchingResults.filter(match => Number(match.score) >= 90).length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Average Score:</span>
                      <span className="value">
                        {matchingResults.length > 0
                          ? Math.round(matchingResults.reduce((sum, match) => sum + Number(match.score), 0) / matchingResults.length)
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="matches-list">
                  {(overrideMode ? manualMatches : matchingResults).length === 0 ? (
                    <p className="empty-list">No matches available.</p>
                  ) : (
                    (overrideMode ? manualMatches : matchingResults).map(match => (
                      <div key={match.clientId} className="match-item">
                        <div className="match-info">
                          <div className="match-client">
                            <strong>Client:</strong> {match.clientName}
                          </div>
                          <div className="match-caregiver">
                            <strong>Caregiver:</strong> {match.caregiverName}
                          </div>
                          <div 
                            className="match-score" 
                            style={{ color: getMatchQualityColor(match.score) }}
                          >
                            <strong>Score:</strong> {match.score}
                          </div>
                        </div>
                        
                        <div className="match-actions">
                          {overrideMode ? (
                            <select
                              value={match.caregiverId}
                              onChange={(e) => handleManualMatch(match.clientId, e.target.value)}
                              className="caregiver-select"
                            >
                              <option value="">Select Caregiver</option>
                              {availableCaregivers.map(caregiver => (
                                <option 
                                  key={caregiver.id} 
                                  value={caregiver.id}
                                >
                                  {caregiver.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button 
                              className="view-button"
                              onClick={() => viewMatchDetails(match)}
                            >
                              View Details
                            </button>
                          )}
                          
                          <button 
                            className="remove-button"
                            onClick={() => removeMatch(match.clientId)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {selectedMatch && (
            <div className="match-details-overlay">
              <div className="match-details-modal">
                <div className="modal-header">
                  <h3>Match Details</h3>
                  <button 
                    className="close-button"
                    onClick={closeMatchDetails}
                  >
                    &times;
                  </button>
                </div>
                
                <div className="modal-body">
                  <div className="match-score-section">
                    <h4>Match Score</h4>
                    <div 
                      className="big-score"
                      style={{ color: getMatchQualityColor(selectedMatch.score) }}
                    >
                      {selectedMatch.score}
                    </div>
                    <div className="match-quality">
                      {Number(selectedMatch.score) >= 90 && 'Excellent Match'}
                      {Number(selectedMatch.score) >= 80 && Number(selectedMatch.score) < 90 && 'Very Good Match'}
                      {Number(selectedMatch.score) >= 70 && Number(selectedMatch.score) < 80 && 'Good Match'}
                      {Number(selectedMatch.score) >= 60 && Number(selectedMatch.score) < 70 && 'Fair Match'}
                      {Number(selectedMatch.score) < 60 && 'Poor Match'}
                    </div>
                  </div>
                  
                  <div className="entities-section">
                    <div className="entity-details client">
                      <h4>Client</h4>
                      <p><strong>Name:</strong> {selectedMatch.clientName}</p>
                      <p><strong>Address:</strong> {selectedMatch.clientAddress}</p>
                      <p><strong>Care Needs:</strong> {selectedMatch.clientCareNeeds}</p>
                      <p><strong>Preferences:</strong> {selectedMatch.clientPreferences}</p>
                    </div>
                    
                    <div className="entity-details caregiver">
                      <h4>Caregiver</h4>
                      <p><strong>Name:</strong> {selectedMatch.caregiverName}</p>
                      <p><strong>Specialties:</strong> {selectedMatch.caregiverSpecialties}</p>
                      <p><strong>Experience:</strong> {selectedMatch.caregiverExperience} years</p>
                      <p><strong>Distance:</strong> {selectedMatch.distance} miles</p>
                    </div>
                  </div>
                  
                  <div className="factors-section">
                    <h4>Matching Factors</h4>
                    <div className="factors-grid">
                      {selectedMatch.factors.map(factor => (
                        <div key={factor.name} className="factor-item">
                          <div className="factor-name">{factor.name}</div>
                          <div 
                            className="factor-score"
                            style={{ 
                              color: factor.score >= 4 ? '#2ecc71' : 
                                    factor.score >= 3 ? '#f39c12' : 
                                    '#e74c3c' 
                            }}
                          >
                            {factor.score}/5
                          </div>
                          <div className="factor-weight">
                            Weight: {factor.weight}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="modal-footer">
                  {overrideMode ? (
                    <button 
                      className="primary-button"
                      onClick={() => {
                        handleManualMatch(selectedMatch.clientId, selectedMatch.caregiverId);
                        closeMatchDetails();
                      }}
                    >
                      Use This Match
                    </button>
                  ) : (
                    <button 
                      className="primary-button"
                      onClick={() => {
                        setOverrideMode(true);
                        closeMatchDetails();
                      }}
                    >
                      Switch to Override Mode
                    </button>
                  )}
                  <button 
                    className="secondary-button"
                    onClick={closeMatchDetails}
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Matching Criteria Tab */}
      {activeTab === 'criteria' && (
        <div className="matching-criteria">
          <h3>Configure Matching Criteria</h3>
          <p className="criteria-description">
            Adjust the weights and settings used by the automated matching algorithm.
            Higher weights indicate greater importance in the matching process.
          </p>
          
          <div className="criteria-form">
            {renderCriteriaSection('Weight Factors', (
              <>
                <div className="criteria-field">
                  <label htmlFor="distanceWeight">Distance Weight:</label>
                  <input 
                    type="range"
                    id="distanceWeight"
                    name="distanceWeight"
                    min="1"
                    max="5"
                    value={matchingCriteria.distanceWeight}
                    onChange={handleCriteriaChange}
                  />
                  <span className="weight-value">{matchingCriteria.distanceWeight}</span>
                </div>
                
                <div className="criteria-field">
                  <label htmlFor="specialtyWeight">Specialty Match Weight:</label>
                  <input 
                    type="range"
                    id="specialtyWeight"
                    name="specialtyWeight"
                    min="1"
                    max="5"
                    value={matchingCriteria.specialtyWeight}
                    onChange={handleCriteriaChange}
                  />
                  <span className="weight-value">{matchingCriteria.specialtyWeight}</span>
                </div>
                
                <div className="criteria-field">
                  <label htmlFor="clientPreferenceWeight">Client Preference Weight:</label>
                  <input 
                    type="range"
                    id="clientPreferenceWeight"
                    name="clientPreferenceWeight"
                    min="1"
                    max="5"
                    value={matchingCriteria.clientPreferenceWeight}
                    onChange={handleCriteriaChange}
                  />
                  <span className="weight-value">{matchingCriteria.clientPreferenceWeight}</span>
                </div>
                
                <div className="criteria-field">
                  <label htmlFor="caregiverPreferenceWeight">Caregiver Preference Weight:</label>
                  <input 
                    type="range"
                    id="caregiverPreferenceWeight"
                    name="caregiverPreferenceWeight"
                    min="1"
                    max="5"
                    value={matchingCriteria.caregiverPreferenceWeight}
                    onChange={handleCriteriaChange}
                  />
                  <span className="weight-value">{matchingCriteria.caregiverPreferenceWeight}</span>
                </div>
                
                <div className="criteria-field">
                  <label htmlFor="experienceWeight">Experience Weight:</label>
                  <input 
                    type="range"
                    id="experienceWeight"
                    name="experienceWeight"
                    min="1"
                    max="5"
                    value={matchingCriteria.experienceWeight}
                    onChange={handleCriteriaChange}
                  />
                  <span className="weight-value">{matchingCriteria.experienceWeight}</span>
                </div>
                
                <div className="criteria-field">
                  <label htmlFor="availabilityWeight">Availability Weight:</label>
                  <input 
                    type="range"
                    id="availabilityWeight"
                    name="availabilityWeight"
                    min="1"
                    max="5"
                    value={matchingCriteria.availabilityWeight}
                    onChange={handleCriteriaChange}
                  />
                  <span className="weight-value">{matchingCriteria.availabilityWeight}</span>
                </div>
              </>
            ))}
            
            {renderCriteriaSection('Consideration Factors', (
              <>
                <div className="criteria-field checkbox-field">
                  <label>
                    <input 
                      type="checkbox"
                      name="considerLanguage"
                      checked={matchingCriteria.considerLanguage}
                      onChange={handleCriteriaChange}
                    />
                    Consider Language Match
                  </label>
                </div>
                
                <div className="criteria-field checkbox-field">
                  <label>
                    <input 
                      type="checkbox"
                      name="considerGender"
                      checked={matchingCriteria.considerGender}
                      onChange={handleCriteriaChange}
                    />
                    Consider Gender Preference
                  </label>
                </div>
                
                <div className="criteria-field checkbox-field">
                  <label>
                    <input 
                      type="checkbox"
                      name="considerPastMatches"
                      checked={matchingCriteria.considerPastMatches}
                      onChange={handleCriteriaChange}
                    />
                    Consider Past Matching History
                  </label>
                </div>
              </>
            ))}
            
            {renderCriteriaSection('Thresholds', (
              <>
                <div className="criteria-field">
                  <label htmlFor="maxDistance">Maximum Distance (miles):</label>
                  <input 
                    type="number"
                    id="maxDistance"
                    name="maxDistance"
                    min="1"
                    max="100"
                    value={matchingCriteria.maxDistance}
                    onChange={handleCriteriaChange}
                  />
                </div>
                
                <div className="criteria-field">
                  <label htmlFor="minCompatibilityScore">Minimum Compatibility Score:</label>
                  <input 
                    type="number"
                    id="minCompatibilityScore"
                    name="minCompatibilityScore"
                    min="0"
                    max="100"
                    value={matchingCriteria.minCompatibilityScore}
                    onChange={handleCriteriaChange}
                  />
                </div>
              </>
            ))}
            
            <div className="criteria-actions">
              <button 
                className="primary-button"
                onClick={saveMatchingCriteria}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save as Default'}
              </button>
              <button 
                className="secondary-button"
                onClick={resetMatchingCriteria}
                disabled={isLoading}
              >
                Reset to System Defaults
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Matching History Tab */}
      {activeTab === 'history' && (
        <div className="matching-history">
          <h3>Matching History</h3>
          
          {isLoading ? (
            <div className="loading">Loading matching history...</div>
          ) : matchingHistory.length === 0 ? (
            <div className="empty-history">
              <p>No matching history available.</p>
              <p>Run your first matching process to see results here.</p>
              <button 
                className="primary-button"
                onClick={() => setActiveTab('matching')}
              >
                Go to Matching Dashboard
              </button>
            </div>
          ) : (
            <div className="history-list">
              <div className="history-headers">
                <div className="header-date">Date</div>
                <div className="header-matches">Matches</div>
                <div className="header-avg-score">Avg. Score</div>
                <div className="header-status">Status</div>
                <div className="header-actions">Actions</div>
              </div>
              
              {matchingHistory.map(item => (
                <div key={item.id} className="history-item">
                  <div className="history-date">
                    {formatDate(item.timestamp)}
                  </div>
                  <div className="history-matches">
                    {item.matchCount} matches
                  </div>
                  <div 
                    className="history-avg-score"
                    style={{ color: getMatchQualityColor(item.averageScore) }}
                  >
                    {item.averageScore}
                  </div>
                  <div className="history-status">
                    <span className={`status-badge ${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="history-actions">
                    <button 
                      className="view-button"
                      onClick={() => {
                        // View historical matches
                        schedulerService.getHistoricalMatches(item.id)
                          .then(matches => {
                            setMatchingResults(matches);
                            setMatchingStatus('completed');
                            setActiveTab('matching');
                          })
                          .catch(error => {
                            console.error('Error fetching historical matches:', error);
                            setErrorMessage('Failed to load historical matches.');
                          });
                      }}
                    >
                      View
                    </button>
                    
                    {item.status === 'Applied' && (
                      <button 
                        className="revert-button"
                        onClick={() => {
                          // Revert applied matches
                          if (window.confirm('Are you sure you want to revert these matches? This will remove the caregiver assignments.')) {
                            schedulerService.revertMatches(item.id)
                              .then(() => {
                                notificationService.showNotification({
                                  type: 'success',
                                  title: 'Matches Reverted',
                                  message: 'Caregiver matches have been successfully reverted.'
                                });
                                fetchMatchingHistory();
                              })
                              .catch(error => {
                                console.error('Error reverting matches:', error);
                                setErrorMessage('Failed to revert matches. Please try again.');
                              });
                          }
                        }}
                      >
                        Revert
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .caregiver-matching-system {
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .matching-tabs {
          display: flex;
          margin-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .matching-tabs button {
          padding: 10px 20px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 16px;
          color: #666;
          cursor: pointer;
          margin-right: 10px;
        }

        .matching-tabs button.active {
          border-bottom-color: #3498db;
          color: #3498db;
          font-weight: 500;
        }

        .matching-tabs button:hover:not(.active) {
          border-bottom-color: #e0e0e0;
          background-color: #f8f9fa;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        /* Matching Dashboard Tab */
        .matching-dashboard {
          display: flex;
          flex-direction: column;
        }

        .matching-controls {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .status-section {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
        }

        .status-section h3 {
          margin-top: 0;
          margin-bottom: 15px;
        }

        .status-indicator {
          padding: 10px;
          border-radius: 4px;
          text-align: center;
          font-weight: 500;
          margin-bottom: 15px;
        }

        .status-indicator.idle {
          background-color: #e9ecef;
          color: #495057;
        }

        .status-indicator.running {
          background-color: #cce5ff;
          color: #004085;
        }

        .status-indicator.completed {
          background-color: #d4edda;
          color: #155724;
        }

        .status-indicator.failed {
          background-color: #f8d7da;
          color: #721c24;
        }

        .matching-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .action-row {
          display: flex;
          gap: 10px;
        }

        .primary-button {
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .primary-button:hover:not(:disabled) {
          background-color: #2980b9;
        }

        .primary-button:disabled {
          background-color: #a0cfee;
          cursor: not-allowed;
        }

        .secondary-button {
          background-color: #e9ecef;
          color: #495057;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .secondary-button:hover:not(:disabled) {
          background-color: #dee2e6;
        }

        .secondary-button:disabled {
          background-color: #f8f9fa;
          color: #adb5bd;
          cursor: not-allowed;
        }

        .help-text {
          font-size: 14px;
          color: #6c757d;
          margin: 5px 0;
        }

        .override-toggle {
          margin-top: 10px;
        }

        .override-toggle label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .override-toggle input {
          margin-right: 8px;
        }

        .results-section {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
        }

        .results-section h3 {
          margin-top: 0;
          margin-bottom: 15px;
        }

        .results-summary {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          padding: 10px;
          background: white;
          border-radius: 4px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .summary-item .label {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 5px;
        }

        .summary-item .value {
          font-size: 18px;
          font-weight: 500;
        }

        .override-message {
          padding: 10px;
          background: #cce5ff;
          color: #004085;
          border-radius: 4px;
          margin-bottom: 15px;
        }

        .matches-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 400px;
          overflow-y: auto;
        }

        .match-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: white;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .match-info {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .match-actions {
          display: flex;
          gap: 10px;
        }

        .view-button {
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
        }

        .view-button:hover {
          background-color: #5a6268;
        }

        .remove-button {
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
        }

        .remove-button:hover {
          background-color: #c82333;
        }

        .caregiver-select {
          padding: 6px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          min-width: 150px;
        }

        .empty-list {
          text-align: center;
          padding: 20px;
          color: #6c757d;
          font-style: italic;
        }

        /* Match Details Modal */
        .match-details-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .match-details-modal {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .modal-header h3 {
          margin: 0;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          color: #6c757d;
          cursor: pointer;
        }

        .close-button:hover {
          color: #343a40;
        }

        .modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .match-score-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .big-score {
          font-size: 48px;
          font-weight: 700;
        }

        .match-quality {
          font-size: 18px;
          font-weight: 500;
        }

        .entities-section {
          display: flex;
          gap: 20px;
        }

        .entity-details {
          flex: 1;
          padding: 15px;
          border-radius: 6px;
        }

        .entity-details.client {
          background: #e1f5fe;
        }

        .entity-details.caregiver {
          background: #e8f5e9;
        }

        .entity-details h4 {
          margin-top: 0;
          margin-bottom: 10px;
        }

        .entity-details p {
          margin: 5px 0;
        }

        .factors-section {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .factors-section h4 {
          margin-top: 0;
          margin-bottom: 15px;
        }

        .factors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
        }

        .factor-item {
          background: white;
          padding: 10px;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .factor-name {
          font-weight: 500;
          margin-bottom: 5px;
        }

        .factor-score {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .factor-weight {
          font-size: 14px;
          color: #6c757d;
        }

        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        /* Matching Criteria Tab */
        .matching-criteria {
          display: flex;
          flex-direction: column;
        }

        .criteria-description {
          margin-bottom: 20px;
          color: #6c757d;
        }

        .criteria-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .criteria-section {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
        }

        .criteria-section h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #343a40;
        }

        .criteria-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
        }

        .criteria-field {
          margin-bottom: 10px;
        }

        .criteria-field label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        .criteria-field.checkbox-field label {
          display: flex;
          align-items: center;
          font-weight: normal;
        }

        .criteria-field.checkbox-field input {
          margin-right: 8px;
        }

        .criteria-field input[type="range"] {
          width: calc(100% - 40px);
          margin-right: 10px;
        }

        .weight-value {
          display: inline-block;
          width: 25px;
          text-align: center;
          font-weight: 500;
        }

        .criteria-field input[type="number"] {
          width: 80px;
          padding: 8px;
          border: 1px solid #ced4da;
          border-radius: 4px;
        }

        .criteria-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        /* Matching History Tab */
        .matching-history {
          display: flex;
          flex-direction: column;
        }

        .matching-history h3 {
          margin-top: 0;
          margin-bottom: 20px;
        }

        .empty-history {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 6px;
          color: #6c757d;
        }

        .empty-history p {
          margin: 5px 0;
        }

        .empty-history button {
          margin-top: 15px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
        }

        .history-headers {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
          gap: 10px;
          padding: 10px 15px;
          background: #e9ecef;
          border-radius: 4px 4px 0 0;
          font-weight: 500;
          color: #495057;
        }

        .history-item {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
          gap: 10px;
          padding: 15px;
          background: white;
          border-bottom: 1px solid #e9ecef;
          align-items: center;
        }

        .history-item:last-child {
          border-bottom: none;
          border-radius: 0 0 4px 4px;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-badge.pending {
          background-color: #fff3cd;
          color: #856404;
        }

        .status-badge.applied {
          background-color: #d4edda;
          color: #155724;
        }

        .status-badge.discarded {
          background-color: #f8d7da;
          color: #721c24;
        }

        .revert-button {
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          cursor: pointer;
        }

        .revert-button:hover {
          background-color: #c82333;
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};

export default CaregiverMatchingSystem;

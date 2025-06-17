import React, { useState, useEffect, useCallback } from 'react';
import { schedulerService, notificationService } from '../services';

/**
 * Schedule Optimization Controls Component
 * Provides UI for triggering schedule optimization with configurable parameters
 * and viewing results comparison.
 */
const ScheduleOptimizationControls = () => {
  // Optimization parameters
  const [optimizationParams, setOptimizationParams] = useState({
    timeframe: '7d',
    optimizationType: 'balanced',
    priorityFactor: 'distance',
    maxShiftsPerDay: 2,
    allowWeekends: true,
    minBreakHours: 10,
    considerTraffic: true,
    maxTravelDistance: 30,
    enforceSpecialties: true,
    weightClientPreference: 3,
    weightCaregiverPreference: 3,
    applyAutomatically: false
  });
  
  // Results state
  const [currentSchedule, setCurrentSchedule] = useState([]);
  const [optimizedSchedule, setOptimizedSchedule] = useState([]);
  const [optimizationMetrics, setOptimizationMetrics] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('side-by-side'); // 'side-by-side', 'diff', 'metrics'
  
  // UI state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('parameters'); // 'parameters', 'results', 'history'
  const [optimizationHistory, setOptimizationHistory] = useState([]);
  const [expandedHistoryItem, setExpandedHistoryItem] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Parameter presets
  const PARAMETER_PRESETS = {
    balanced: {
      name: 'Balanced',
      description: 'Equal weight to client and caregiver preferences',
      values: {
        optimizationType: 'balanced',
        priorityFactor: 'both',
        weightClientPreference: 3,
        weightCaregiverPreference: 3,
        maxTravelDistance: 30
      }
    },
    clientFocused: {
      name: 'Client-Focused',
      description: 'Prioritize client preferences and needs',
      values: {
        optimizationType: 'client-focused',
        priorityFactor: 'preferences',
        weightClientPreference: 5,
        weightCaregiverPreference: 2,
        maxTravelDistance: 40
      }
    },
    caregiverFocused: {
      name: 'Caregiver-Focused',
      description: 'Prioritize caregiver availability and workload',
      values: {
        optimizationType: 'caregiver-focused',
        priorityFactor: 'workload',
        weightClientPreference: 2,
        weightCaregiverPreference: 5,
        maxTravelDistance: 20
      }
    },
    efficiencyFocused: {
      name: 'Efficiency-Focused',
      description: 'Minimize travel time and maximize appointments per day',
      values: {
        optimizationType: 'efficiency-focused',
        priorityFactor: 'distance',
        weightClientPreference: 2,
        weightCaregiverPreference: 2,
        maxTravelDistance: 15,
        maxShiftsPerDay: 3,
        minBreakHours: 8
      }
    }
  };
  
  // Calculate start date based on timeframe
  const getStartDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  };
  
  // Calculate end date based on timeframe
  const getEndDate = () => {
    const today = new Date();
    let endDate = new Date(today);
    
    switch (optimizationParams.timeframe) {
      case '1d':
        endDate.setDate(today.getDate() + 1);
        break;
      case '3d':
        endDate.setDate(today.getDate() + 3);
        break;
      case '7d':
        endDate.setDate(today.getDate() + 7);
        break;
      case '14d':
        endDate.setDate(today.getDate() + 14);
        break;
      case '30d':
        endDate.setDate(today.getDate() + 30);
        break;
      default:
        endDate.setDate(today.getDate() + 7);
    }
    
    return endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // Fetch the current schedule
  const fetchCurrentSchedule = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const schedule = await schedulerService.getSchedulesInRange({
        startDate: getStartDate(),
        endDate: getEndDate(),
        includeDetails: true
      });
      
      setCurrentSchedule(schedule);
    } catch (error) {
      console.error('Error fetching current schedule:', error);
      setErrorMessage('Failed to load current schedule. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Schedule Loading Error',
        message: 'Failed to load current schedule data.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch optimization history
  const fetchOptimizationHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const history = await schedulerService.getOptimizationHistory();
      setOptimizationHistory(history);
    } catch (error) {
      console.error('Error fetching optimization history:', error);
      setErrorMessage('Failed to load optimization history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load current schedule and optimization history on component mount
  useEffect(() => {
    fetchCurrentSchedule();
    fetchOptimizationHistory();
  }, [fetchCurrentSchedule, fetchOptimizationHistory]);
  
  // Run schedule optimization
  const runOptimization = async () => {
    setIsOptimizing(true);
    setErrorMessage(null);
    setOptimizedSchedule([]);
    setOptimizationMetrics(null);
    
    try {
      const optimizationResult = await schedulerService.optimizeSchedule({
        startDate: getStartDate(),
        endDate: getEndDate(),
        parameters: optimizationParams,
        applyChanges: optimizationParams.applyAutomatically
      });
      
      setOptimizedSchedule(optimizationResult.optimizedSchedule);
      setOptimizationMetrics(optimizationResult.metrics);
      setActiveTab('results');
      
      notificationService.showNotification({
        type: 'success',
        title: 'Optimization Complete',
        message: `Schedule optimization completed with ${optimizationResult.metrics.improvementPercentage}% improvement.`
      });
      
      // Refresh history after optimization
      fetchOptimizationHistory();
    } catch (error) {
      console.error('Error running schedule optimization:', error);
      setErrorMessage('Failed to run optimization. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Optimization Error',
        message: 'Failed to complete schedule optimization.'
      });
    } finally {
      setIsOptimizing(false);
    }
  };
  
  // Apply the optimized schedule
  const applyOptimizedSchedule = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      await schedulerService.applyOptimizedSchedule({
        optimizationId: optimizationMetrics.optimizationId
      });
      
      setCurrentSchedule(optimizedSchedule);
      
      notificationService.showNotification({
        type: 'success',
        title: 'Schedule Updated',
        message: 'Optimized schedule has been applied successfully.'
      });
      
      // Refresh history after applying changes
      fetchOptimizationHistory();
    } catch (error) {
      console.error('Error applying optimized schedule:', error);
      setErrorMessage('Failed to apply optimized schedule. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Schedule Update Error',
        message: 'Failed to apply optimized schedule.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Apply a preset
  const applyPreset = (presetKey) => {
    const preset = PARAMETER_PRESETS[presetKey];
    if (preset) {
      setOptimizationParams(prevParams => ({
        ...prevParams,
        ...preset.values
      }));
    }
  };
  
  // Handle parameter change
  const handleParamChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setOptimizationParams(prevParams => ({
      ...prevParams,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // View a historical optimization
  const viewHistoricalOptimization = async (optimizationId) => {
    setIsLoading(true);
    setErrorMessage(null);
    setExpandedHistoryItem(optimizationId);
    
    try {
      const optimizationDetails = await schedulerService.getOptimizationDetails(optimizationId);
      
      setOptimizedSchedule(optimizationDetails.optimizedSchedule);
      setOptimizationMetrics(optimizationDetails.metrics);
      setOptimizationParams(optimizationDetails.parameters);
      
      setActiveTab('results');
    } catch (error) {
      console.error('Error fetching optimization details:', error);
      setErrorMessage('Failed to load optimization details. Please try again.');
      
      notificationService.showNotification({
        type: 'error',
        title: 'Data Loading Error',
        message: 'Failed to load optimization details.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Calculate improvement color based on percentage
  const getImprovementColor = (percentage) => {
    if (percentage >= 10) return '#2ecc71'; // Significant improvement (green)
    if (percentage >= 5) return '#27ae60'; // Good improvement (darker green)
    if (percentage >= 2) return '#f39c12'; // Modest improvement (orange)
    if (percentage >= 0) return '#f1c40f'; // Minimal improvement (yellow)
    return '#e74c3c'; // Negative impact (red)
  };
  
  // Get optimization type display name
  const getOptimizationTypeDisplay = (type) => {
    const typeMap = {
      'balanced': 'Balanced',
      'client-focused': 'Client-Focused',
      'caregiver-focused': 'Caregiver-Focused',
      'efficiency-focused': 'Efficiency-Focused'
    };
    
    return typeMap[type] || type;
  };
  
  // Get parameter section based on type
  const renderParameterSection = (sectionTitle, children) => (
    <div className="parameter-section">
      <h4>{sectionTitle}</h4>
      <div className="parameter-grid">
        {children}
      </div>
    </div>
  );
  
  return (
    <div className="schedule-optimization-controls">
      <div className="tab-navigation">
        <button
          className={activeTab === 'parameters' ? 'active' : ''}
          onClick={() => setActiveTab('parameters')}
        >
          Optimization Parameters
        </button>
        <button
          className={activeTab === 'results' ? 'active' : ''}
          onClick={() => setActiveTab('results')}
          disabled={!optimizedSchedule.length}
        >
          Optimization Results
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Optimization History
        </button>
      </div>
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
      
      {activeTab === 'parameters' && (
        <div className="parameters-tab">
          <div className="presets-section">
            <h3>Optimization Presets</h3>
            <div className="preset-buttons">
              {Object.entries(PARAMETER_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className={optimizationParams.optimizationType === preset.values.optimizationType ? 'active' : ''}
                  onClick={() => applyPreset(key)}
                >
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-description">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="parameters-form">
            <h3>Optimization Parameters</h3>
            
            {renderParameterSection('Schedule Range', (
              <>
                <div className="parameter-field">
                  <label htmlFor="timeframe">Time Range:</label>
                  <select 
                    id="timeframe"
                    name="timeframe"
                    value={optimizationParams.timeframe}
                    onChange={handleParamChange}
                  >
                    <option value="1d">1 Day</option>
                    <option value="3d">3 Days</option>
                    <option value="7d">7 Days</option>
                    <option value="14d">14 Days</option>
                    <option value="30d">30 Days</option>
                  </select>
                </div>
                
                <div className="parameter-field">
                  <label htmlFor="optimizationType">Optimization Strategy:</label>
                  <select 
                    id="optimizationType"
                    name="optimizationType"
                    value={optimizationParams.optimizationType}
                    onChange={handleParamChange}
                  >
                    <option value="balanced">Balanced</option>
                    <option value="client-focused">Client-Focused</option>
                    <option value="caregiver-focused">Caregiver-Focused</option>
                    <option value="efficiency-focused">Efficiency-Focused</option>
                  </select>
                </div>
                
                <div className="parameter-field">
                  <label htmlFor="priorityFactor">Priority Factor:</label>
                  <select 
                    id="priorityFactor"
                    name="priorityFactor"
                    value={optimizationParams.priorityFactor}
                    onChange={handleParamChange}
                  >
                    <option value="distance">Minimize Travel Distance</option>
                    <option value="preferences">Match Preferences</option>
                    <option value="workload">Balance Workload</option>
                    <option value="both">All Factors</option>
                  </select>
                </div>
              </>
            ))}
            
            {renderParameterSection('Caregiver Constraints', (
              <>
                <div className="parameter-field">
                  <label htmlFor="maxShiftsPerDay">Max Shifts Per Day:</label>
                  <input 
                    type="number"
                    id="maxShiftsPerDay"
                    name="maxShiftsPerDay"
                    min="1"
                    max="5"
                    value={optimizationParams.maxShiftsPerDay}
                    onChange={handleParamChange}
                  />
                </div>
                
                <div className="parameter-field">
                  <label htmlFor="minBreakHours">Min Break Between Shifts (hours):</label>
                  <input 
                    type="number"
                    id="minBreakHours"
                    name="minBreakHours"
                    min="1"
                    max="24"
                    value={optimizationParams.minBreakHours}
                    onChange={handleParamChange}
                  />
                </div>
                
                <div className="parameter-field checkbox-field">
                  <label>
                    <input 
                      type="checkbox"
                      name="allowWeekends"
                      checked={optimizationParams.allowWeekends}
                      onChange={handleParamChange}
                    />
                    Allow Weekend Scheduling
                  </label>
                </div>
                
                <div className="parameter-field checkbox-field">
                  <label>
                    <input 
                      type="checkbox"
                      name="enforceSpecialties"
                      checked={optimizationParams.enforceSpecialties}
                      onChange={handleParamChange}
                    />
                    Enforce Caregiver Specialties
                  </label>
                </div>
              </>
            ))}
            
            {renderParameterSection('Travel & Distance', (
              <>
                <div className="parameter-field">
                  <label htmlFor="maxTravelDistance">Max Travel Distance (miles):</label>
                  <input 
                    type="number"
                    id="maxTravelDistance"
                    name="maxTravelDistance"
                    min="5"
                    max="100"
                    value={optimizationParams.maxTravelDistance}
                    onChange={handleParamChange}
                  />
                </div>
                
                <div className="parameter-field checkbox-field">
                  <label>
                    <input 
                      type="checkbox"
                      name="considerTraffic"
                      checked={optimizationParams.considerTraffic}
                      onChange={handleParamChange}
                    />
                    Consider Traffic Patterns
                  </label>
                </div>
              </>
            ))}
            
            {renderParameterSection('Preference Weights', (
              <>
                <div className="parameter-field">
                  <label htmlFor="weightClientPreference">Client Preference Weight:</label>
                  <select
                    id="weightClientPreference"
                    name="weightClientPreference"
                    value={optimizationParams.weightClientPreference}
                    onChange={handleParamChange}
                  >
                    <option value="1">1 - Low</option>
                    <option value="2">2 - Below Average</option>
                    <option value="3">3 - Average</option>
                    <option value="4">4 - Above Average</option>
                    <option value="5">5 - High</option>
                  </select>
                </div>
                
                <div className="parameter-field">
                  <label htmlFor="weightCaregiverPreference">Caregiver Preference Weight:</label>
                  <select
                    id="weightCaregiverPreference"
                    name="weightCaregiverPreference"
                    value={optimizationParams.weightCaregiverPreference}
                    onChange={handleParamChange}
                  >
                    <option value="1">1 - Low</option>
                    <option value="2">2 - Below Average</option>
                    <option value="3">3 - Average</option>
                    <option value="4">4 - Above Average</option>
                    <option value="5">5 - High</option>
                  </select>
                </div>
              </>
            ))}
            
            {renderParameterSection('Application', (
              <div className="parameter-field checkbox-field">
                <label>
                  <input 
                    type="checkbox"
                    name="applyAutomatically"
                    checked={optimizationParams.applyAutomatically}
                    onChange={handleParamChange}
                  />
                  Apply Optimized Schedule Automatically
                </label>
                <p className="field-description">
                  If checked, the optimized schedule will be applied immediately.
                  Otherwise, you'll be able to review and apply it manually.
                </p>
              </div>
            ))}
            
            <div className="optimization-actions">
              <button 
                className="run-optimization-button"
                onClick={runOptimization}
                disabled={isOptimizing || isLoading}
              >
                {isOptimizing ? 'Optimizing...' : 'Run Optimization'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'results' && (
        <div className="results-tab">
          {!optimizedSchedule.length ? (
            <div className="no-results">
              <p>No optimization results available. Run an optimization first.</p>
              <button onClick={() => setActiveTab('parameters')}>Configure Optimization</button>
            </div>
          ) : (
            <>
              <div className="results-header">
                <h3>Optimization Results</h3>
                <div className="view-controls">
                  <label>View Mode:</label>
                  <select
                    value={comparisonMode}
                    onChange={(e) => setComparisonMode(e.target.value)}
                  >
                    <option value="side-by-side">Side by Side</option>
                    <option value="diff">Differences Only</option>
                    <option value="metrics">Metrics Summary</option>
                  </select>
                </div>
              </div>
              
              {comparisonMode === 'metrics' && optimizationMetrics && (
                <div className="metrics-summary">
                  <div className="metrics-header">
                    <h4>Optimization Summary</h4>
                    <div className="optimization-info">
                      <span>
                        <strong>Strategy:</strong> {getOptimizationTypeDisplay(optimizationParams.optimizationType)}
                      </span>
                      <span>
                        <strong>Date:</strong> {formatDate(optimizationMetrics.timestamp)}
                      </span>
                      <span>
                        <strong>Range:</strong> {optimizationMetrics.scheduleDays} days
                      </span>
                    </div>
                  </div>
                  
                  <div className="metrics-grid">
                    <div className="metric-card improvement">
                      <h5>Overall Improvement</h5>
                      <div className="metric-value" style={{ color: getImprovementColor(optimizationMetrics.improvementPercentage) }}>
                        {optimizationMetrics.improvementPercentage}%
                      </div>
                      <div className="metric-description">
                        Overall schedule efficiency improvement
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <h5>Travel Distance</h5>
                      <div className="metric-comparison">
                        <div className="before">
                          <span className="label">Before</span>
                          <span className="value">{optimizationMetrics.travelDistance.before} mi</span>
                        </div>
                        <div className="after">
                          <span className="label">After</span>
                          <span className="value">{optimizationMetrics.travelDistance.after} mi</span>
                        </div>
                      </div>
                      <div className="metric-improvement" style={{ color: getImprovementColor(optimizationMetrics.travelDistance.improvementPercentage) }}>
                        {optimizationMetrics.travelDistance.change > 0 ? '+' : ''}{optimizationMetrics.travelDistance.change} mi ({optimizationMetrics.travelDistance.improvementPercentage}%)
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <h5>Client Satisfaction</h5>
                      <div className="metric-comparison">
                        <div className="before">
                          <span className="label">Before</span>
                          <span className="value">{optimizationMetrics.clientSatisfaction.before}%</span>
                        </div>
                        <div className="after">
                          <span className="label">After</span>
                          <span className="value">{optimizationMetrics.clientSatisfaction.after}%</span>
                        </div>
                      </div>
                      <div className="metric-improvement" style={{ color: getImprovementColor(optimizationMetrics.clientSatisfaction.improvementPercentage) }}>
                        {optimizationMetrics.clientSatisfaction.change > 0 ? '+' : ''}{optimizationMetrics.clientSatisfaction.change}% ({optimizationMetrics.clientSatisfaction.improvementPercentage}%)
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <h5>Caregiver Workload</h5>
                      <div className="metric-comparison">
                        <div className="before">
                          <span className="label">Before</span>
                          <span className="value">{optimizationMetrics.caregiverWorkload.before}</span>
                        </div>
                        <div className="after">
                          <span className="label">After</span>
                          <span className="value">{optimizationMetrics.caregiverWorkload.after}</span>
                        </div>
                      </div>
                      <div className="metric-improvement" style={{ color: getImprovementColor(optimizationMetrics.caregiverWorkload.improvementPercentage) }}>
                        {optimizationMetrics.caregiverWorkload.change > 0 ? '+' : ''}{optimizationMetrics.caregiverWorkload.change} ({optimizationMetrics.caregiverWorkload.improvementPercentage}%)
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <h5>Schedule Conflicts</h5>
                      <div className="metric-comparison">
                        <div className="before">
                          <span className="label">Before</span>
                          <span className="value">{optimizationMetrics.scheduleConflicts.before}</span>
                        </div>
                        <div className="after">
                          <span className="label">After</span>
                          <span className="value">{optimizationMetrics.scheduleConflicts.after}</span>
                        </div>
                      </div>
                      <div className="metric-improvement" style={{ color: getImprovementColor(optimizationMetrics.scheduleConflicts.improvementPercentage) }}>
                        {optimizationMetrics.scheduleConflicts.change > 0 ? '+' : ''}{optimizationMetrics.scheduleConflicts.change} ({optimizationMetrics.scheduleConflicts.improvementPercentage}%)
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <h5>Specialty Matching</h5>
                      <div className="metric-comparison">
                        <div className="before">
                          <span className="label">Before</span>
                          <span className="value">{optimizationMetrics.specialtyMatching.before}%</span>
                        </div>
                        <div className="after">
                          <span className="label">After</span>
                          <span className="value">{optimizationMetrics.specialtyMatching.after}%</span>
                        </div>
                      </div>
                      <div className="metric-improvement" style={{ color: getImprovementColor(optimizationMetrics.specialtyMatching.improvementPercentage) }}>
                        {optimizationMetrics.specialtyMatching.change > 0 ? '+' : ''}{optimizationMetrics.specialtyMatching.change}% ({optimizationMetrics.specialtyMatching.improvementPercentage}%)
                      </div>
                    </div>
                  </div>
                  
                  <div className="metrics-summary-details">
                    <h5>Changes Summary</h5>
                    <div className="changes-summary">
                      <div className="change-item">
                        <span className="change-label">Appointments Reassigned:</span>
                        <span className="change-value">{optimizationMetrics.changedAppointments}</span>
                      </div>
                      <div className="change-item">
                        <span className="change-label">Caregivers Affected:</span>
                        <span className="change-value">{optimizationMetrics.affectedCaregivers}</span>
                      </div>
                      <div className="change-item">
                        <span className="change-label">Clients Affected:</span>
                        <span className="change-value">{optimizationMetrics.affectedClients}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {comparisonMode !== 'metrics' && (
                <div className={`schedule-comparison ${comparisonMode}`}>
                  <div className="current-schedule">
                    <h4>Current Schedule</h4>
                    {currentSchedule.length === 0 ? (
                      <div className="empty-schedule">No current schedule data available.</div>
                    ) : (
                      <div className="schedule-list">
                        {currentSchedule.map(appointment => (
                          <div 
                            key={appointment.id} 
                            className={`schedule-item ${
                              comparisonMode === 'diff' && 
                              !optimizedSchedule.some(opt => 
                                opt.id === appointment.id && 
                                (opt.caregiverId !== appointment.caregiverId || 
                                opt.startTime !== appointment.startTime || 
                                opt.endTime !== appointment.endTime)
                              ) ? 'hidden' : ''
                            }`}
                          >
                            <div className="appointment-date">
                              {new Date(appointment.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="appointment-time">
                              {appointment.startTime} - {appointment.endTime}
                            </div>
                            <div className="appointment-client">
                              <strong>Client:</strong> {appointment.clientName}
                            </div>
                            <div className="appointment-caregiver">
                              <strong>Caregiver:</strong> {appointment.caregiverName}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="optimized-schedule">
                    <h4>Optimized Schedule</h4>
                    {optimizedSchedule.length === 0 ? (
                      <div className="empty-schedule">No optimized schedule data available.</div>
                    ) : (
                      <div className="schedule-list">
                        {optimizedSchedule.map(appointment => {
                          // Find matching appointment in current schedule to check for changes
                          const currentAppointment = currentSchedule.find(curr => curr.id === appointment.id);
                          const isChanged = currentAppointment && (
                            currentAppointment.caregiverId !== appointment.caregiverId ||
                            currentAppointment.startTime !== appointment.startTime ||
                            currentAppointment.endTime !== appointment.endTime
                          );
                          
                          return (
                            <div 
                              key={appointment.id} 
                              className={`schedule-item ${isChanged ? 'changed' : ''} ${
                                comparisonMode === 'diff' && !isChanged ? 'hidden' : ''
                              }`}
                            >
                              <div className="appointment-date">
                                {new Date(appointment.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="appointment-time">
                                {appointment.startTime} - {appointment.endTime}
                              </div>
                              <div className="appointment-client">
                                <strong>Client:</strong> {appointment.clientName}
                              </div>
                              <div className="appointment-caregiver">
                                <strong>Caregiver:</strong> {appointment.caregiverName}
                                {isChanged && currentAppointment && (
                                  <span className="previous-value">
                                    (was: {currentAppointment.caregiverName})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {!optimizationParams.applyAutomatically && optimizedSchedule.length > 0 && (
                <div className="apply-actions">
                  <button 
                    className="apply-button"
                    onClick={applyOptimizedSchedule}
                    disabled={isLoading}
                  >
                    Apply Optimized Schedule
                  </button>
                  <button 
                    className="discard-button"
                    onClick={() => {
                      setOptimizedSchedule([]);
                      setOptimizationMetrics(null);
                      setActiveTab('parameters');
                    }}
                  >
                    Discard
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {activeTab === 'history' && (
        <div className="history-tab">
          <h3>Optimization History</h3>
          
          {isLoading ? (
            <div className="loading">Loading optimization history...</div>
          ) : optimizationHistory.length === 0 ? (
            <div className="empty-history">
              <p>No optimization history available.</p>
              <p>Run your first optimization to see results here.</p>
              <button onClick={() => setActiveTab('parameters')}>Run Optimization</button>
            </div>
          ) : (
            <div className="history-list">
              {optimizationHistory.map(item => (
                <div key={item.id} className={`history-item ${expandedHistoryItem === item.id ? 'expanded' : ''}`}>
                  <div className="history-item-header" onClick={() => setExpandedHistoryItem(expandedHistoryItem === item.id ? null : item.id)}>
                    <div className="history-item-title">
                      <h4>{getOptimizationTypeDisplay(item.optimizationType)} Optimization</h4>
                      <span className="history-date">{formatDate(item.timestamp)}</span>
                    </div>
                    <div className="history-item-metrics">
                      <span className="improvement-badge" style={{ backgroundColor: getImprovementColor(item.improvementPercentage) }}>
                        {item.improvementPercentage}% Improvement
                      </span>
                      <span className="affected-count">
                        {item.affectedAppointments} appointments changed
                      </span>
                      <span className="expand-icon">{expandedHistoryItem === item.id ? '▼' : '▶'}</span>
                    </div>
                  </div>
                  
                  {expandedHistoryItem === item.id && (
                    <div className="history-item-details">
                      <div className="history-item-parameters">
                        <h5>Optimization Parameters</h5>
                        <div className="parameter-list">
                          <div className="parameter-item">
                            <span className="parameter-label">Strategy:</span>
                            <span className="parameter-value">{getOptimizationTypeDisplay(item.optimizationType)}</span>
                          </div>
                          <div className="parameter-item">
                            <span className="parameter-label">Priority Factor:</span>
                            <span className="parameter-value">{item.priorityFactor}</span>
                          </div>
                          <div className="parameter-item">
                            <span className="parameter-label">Time Range:</span>
                            <span className="parameter-value">{item.timeframe} ({item.scheduleDays} days)</span>
                          </div>
                          <div className="parameter-item">
                            <span className="parameter-label">Max Travel Distance:</span>
                            <span className="parameter-value">{item.maxTravelDistance} mi</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="history-item-metrics-detail">
                        <h5>Results Summary</h5>
                        <div className="metrics-grid">
                          <div className="metric-summary-item">
                            <span className="metric-label">Travel Distance:</span>
                            <span className="metric-diff" style={{ color: getImprovementColor(item.travelDistanceImprovement) }}>
                              {item.travelDistanceChange > 0 ? '+' : ''}{item.travelDistanceChange} mi ({item.travelDistanceImprovement}%)
                            </span>
                          </div>
                          <div className="metric-summary-item">
                            <span className="metric-label">Client Satisfaction:</span>
                            <span className="metric-diff" style={{ color: getImprovementColor(item.clientSatisfactionImprovement) }}>
                              {item.clientSatisfactionChange > 0 ? '+' : ''}{item.clientSatisfactionChange}% ({item.clientSatisfactionImprovement}%)
                            </span>
                          </div>
                          <div className="metric-summary-item">
                            <span className="metric-label">Caregiver Workload:</span>
                            <span className="metric-diff" style={{ color: getImprovementColor(item.workloadImprovement) }}>
                              {item.workloadChange > 0 ? '+' : ''}{item.workloadChange} ({item.workloadImprovement}%)
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="history-item-actions">
                        <button onClick={() => viewHistoricalOptimization(item.id)}>View Details</button>
                        {!item.applied && (
                          <button 
                            className="apply-button"
                            onClick={() => {
                              viewHistoricalOptimization(item.id).then(() => {
                                applyOptimizedSchedule();
                              });
                            }}
                          >
                            Apply This Optimization
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .schedule-optimization-controls {
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .tab-navigation {
          display: flex;
          margin-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .tab-navigation button {
          padding: 10px 20px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 16px;
          color: #666;
          cursor: pointer;
          margin-right: 10px;
        }

        .tab-navigation button.active {
          border-bottom-color: #3498db;
          color: #3498db;
          font-weight: 500;
        }

        .tab-navigation button:hover:not(.active) {
          border-bottom-color: #e0e0e0;
          background-color: #f8f9fa;
        }

        .tab-navigation button:disabled {
          color: #ccc;
          cursor: not-allowed;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        /* Parameters Tab */
        .presets-section {
          margin-bottom: 20px;
        }

        .preset-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .preset-buttons button {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 15px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }

        .preset-buttons button.active {
          border-color: #3498db;
          background-color: #ebf7ff;
        }

        .preset-buttons button:hover:not(.active) {
          background-color: #e9ecef;
        }

        .preset-name {
          font-weight: 500;
          margin-bottom: 5px;
          font-size: 16px;
        }

        .preset-description {
          font-size: 14px;
          color: #6c757d;
        }

        .parameters-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .parameter-section {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .parameter-section h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #343a40;
          font-size: 16px;
        }

        .parameter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 15px;
        }

        .parameter-field {
          margin-bottom: 10px;
        }

        .parameter-field label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          font-size: 14px;
        }

        .parameter-field select,
        .parameter-field input[type="number"] {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .parameter-field.checkbox-field label {
          display: flex;
          align-items: center;
          font-weight: normal;
        }

        .parameter-field.checkbox-field input[type="checkbox"] {
          margin-right: 8px;
        }

        .field-description {
          font-size: 12px;
          color: #6c757d;
          margin-top: 5px;
          margin-left: 20px;
        }

        .optimization-actions {
          margin-top: 20px;
          display: flex;
          justify-content: center;
        }

        .run-optimization-button {
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .run-optimization-button:hover:not(:disabled) {
          background-color: #2980b9;
        }

        .run-optimization-button:disabled {
          background-color: #a0cfee;
          cursor: not-allowed;
        }

        /* Results Tab */
        .results-tab {
          display: flex;
          flex-direction: column;
        }

        .no-results {
          text-align: center;
          padding: 40px;
          color: #6c757d;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .no-results button {
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          margin-top: 15px;
          cursor: pointer;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .view-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .view-controls select {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .schedule-comparison {
          display: flex;
          gap: 20px;
        }

        .schedule-comparison.side-by-side {
          flex-direction: row;
        }

        .schedule-comparison.diff {
          flex-direction: row;
        }

        .current-schedule,
        .optimized-schedule {
          flex: 1;
          overflow: auto;
          max-height: 500px;
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
        }

        .current-schedule h4,
        .optimized-schedule h4 {
          margin-top: 0;
          position: sticky;
          top: 0;
          background: #f8f9fa;
          padding: 5px 0;
          z-index: 1;
          border-bottom: 1px solid #e0e0e0;
        }

        .schedule-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .schedule-item {
          background: white;
          border-radius: 4px;
          padding: 12px;
          border-left: 3px solid #6c757d;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .schedule-item.changed {
          border-left-color: #f39c12;
          background-color: #fff9e6;
        }

        .schedule-item.hidden {
          display: none;
        }

        .appointment-date {
          font-weight: 500;
          margin-bottom: 5px;
        }

        .appointment-time {
          color: #6c757d;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .previous-value {
          margin-left: 5px;
          color: #e74c3c;
          font-size: 13px;
          text-decoration: line-through;
        }

        .empty-schedule {
          text-align: center;
          padding: 20px;
          color: #6c757d;
          font-style: italic;
        }

        .apply-actions {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-top: 20px;
        }

        .apply-button {
          background-color: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          font-weight: 500;
          cursor: pointer;
        }

        .apply-button:hover:not(:disabled) {
          background-color: #27ae60;
        }

        .discard-button {
          background-color: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          font-weight: 500;
          cursor: pointer;
        }

        .discard-button:hover {
          background-color: #c0392b;
        }

        /* Metrics Summary */
        .metrics-summary {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 20px;
        }

        .metrics-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .metrics-header h4 {
          margin: 0;
        }

        .optimization-info {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          font-size: 14px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .metric-card {
          background: white;
          border-radius: 6px;
          padding: 15px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .metric-card.improvement {
          grid-column: 1 / -1;
          text-align: center;
        }

        .metric-card h5 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #343a40;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .metric-description {
          font-size: 14px;
          color: #6c757d;
        }

        .metric-comparison {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .before, .after {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .label {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 3px;
        }

        .value {
          font-weight: 500;
        }

        .metric-improvement {
          text-align: center;
          font-weight: 500;
          padding: 5px;
          border-radius: 4px;
          background: #f1f3f5;
        }

        .metrics-summary-details {
          background: white;
          border-radius: 6px;
          padding: 15px;
          margin-top: 15px;
        }

        .metrics-summary-details h5 {
          margin-top: 0;
          margin-bottom: 15px;
        }

        .changes-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }

        .change-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .change-label {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 5px;
        }

        .change-value {
          font-size: 18px;
          font-weight: 500;
        }

        /* History Tab */
        .history-tab {
          overflow: auto;
          max-height: 600px;
        }

        .empty-history {
          text-align: center;
          padding: 40px;
          color: #6c757d;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .empty-history button {
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          margin-top: 15px;
          cursor: pointer;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .history-item {
          background: white;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .history-item-header {
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .history-item-header:hover {
          background-color: #f8f9fa;
        }

        .history-item.expanded .history-item-header {
          border-bottom: 1px solid #e0e0e0;
        }

        .history-item-title {
          display: flex;
          flex-direction: column;
        }

        .history-item-title h4 {
          margin: 0;
          font-size: 16px;
        }

        .history-date {
          font-size: 14px;
          color: #6c757d;
        }

        .history-item-metrics {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .improvement-badge {
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .affected-count {
          font-size: 14px;
          color: #6c757d;
        }

        .expand-icon {
          font-size: 12px;
          color: #6c757d;
        }

        .history-item-details {
          padding: 15px;
          background: #f8f9fa;
        }

        .history-item-parameters,
        .history-item-metrics-detail {
          margin-bottom: 15px;
        }

        .history-item-parameters h5,
        .history-item-metrics-detail h5 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 15px;
        }

        .parameter-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }

        .parameter-item {
          display: flex;
          flex-direction: column;
        }

        .parameter-label {
          font-size: 13px;
          color: #6c757d;
        }

        .parameter-value {
          font-weight: 500;
        }

        .metric-summary-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .metric-label {
          font-weight: 500;
        }

        .metric-diff {
          font-weight: 500;
        }

        .history-item-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }

        .history-item-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .history-item-actions button:first-child {
          background-color: #e9ecef;
          color: #343a40;
        }

        .history-item-actions button:first-child:hover {
          background-color: #dee2e6;
        }

        .history-item-actions .apply-button {
          background-color: #2ecc71;
          color: white;
        }

        .history-item-actions .apply-button:hover {
          background-color: #27ae60;
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

export default ScheduleOptimizationControls;

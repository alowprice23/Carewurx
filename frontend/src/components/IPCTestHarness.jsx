import React, { useState, useEffect, useRef } from 'react';
import { notificationService } from '../services';

/**
 * IPC Test Harness Component
 * Provides an interface for testing IPC endpoints with parameter inputs and response visualization
 */
const IPCTestHarness = () => {
  // State for endpoint and parameters
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [parameters, setParameters] = useState({});
  const [parameterTemplates, setParameterTemplates] = useState({});
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [responseHistory, setResponseHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('request'); // 'request', 'response', 'history'
  const [showRawJson, setShowRawJson] = useState(false);
  
  // Ref for response visualizer
  const visualizerRef = useRef(null);
  
  // Load available endpoints on component mount
  useEffect(() => {
    loadEndpoints();
  }, []);
  
  // Load available endpoints from the backend
  const loadEndpoints = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Simulate API call to get endpoints - in a real implementation, this would be an actual API call
      // to the Electron backend that would return all available IPC endpoints
      setTimeout(() => {
        const mockEndpoints = [
          { 
            name: 'getSchedules', 
            description: 'Get schedules for a specific date range',
            parameters: {
              startDate: { type: 'date', required: true, description: 'Start date for schedule range' },
              endDate: { type: 'date', required: true, description: 'End date for schedule range' },
              caregiverId: { type: 'string', required: false, description: 'Filter by caregiver ID' },
              clientId: { type: 'string', required: false, description: 'Filter by client ID' }
            }
          },
          { 
            name: 'createSchedule', 
            description: 'Create a new schedule entry',
            parameters: {
              clientId: { type: 'string', required: true, description: 'Client ID' },
              caregiverId: { type: 'string', required: true, description: 'Caregiver ID' },
              startTime: { type: 'datetime', required: true, description: 'Start time of appointment' },
              endTime: { type: 'datetime', required: true, description: 'End time of appointment' },
              notes: { type: 'string', required: false, description: 'Additional notes' }
            }
          },
          { 
            name: 'getClients', 
            description: 'Get all clients or a specific client',
            parameters: {
              clientId: { type: 'string', required: false, description: 'Specific client ID (optional)' },
              includeInactive: { type: 'boolean', required: false, description: 'Include inactive clients' }
            }
          },
          { 
            name: 'getCaregivers', 
            description: 'Get all caregivers or a specific caregiver',
            parameters: {
              caregiverId: { type: 'string', required: false, description: 'Specific caregiver ID (optional)' },
              includeInactive: { type: 'boolean', required: false, description: 'Include inactive caregivers' }
            }
          },
          { 
            name: 'runOpportunityScan', 
            description: 'Run the opportunity scanner manually',
            parameters: {
              startDate: { type: 'date', required: false, description: 'Start date for scan (defaults to today)' },
              endDate: { type: 'date', required: false, description: 'End date for scan (defaults to 7 days from start)' },
              includeAssigned: { type: 'boolean', required: false, description: 'Include already assigned times' }
            }
          },
          { 
            name: 'runAgentQuery', 
            description: 'Run a direct query to the agent system',
            parameters: {
              agentName: { type: 'string', required: true, description: 'Agent name (lexxi or bruce)' },
              query: { type: 'string', required: true, description: 'Query text' },
              contextEntities: { type: 'array', required: false, description: 'Context entity IDs' }
            }
          },
          { 
            name: 'getDatabaseStats', 
            description: 'Get database statistics',
            parameters: {
              includeDetailedCounts: { type: 'boolean', required: false, description: 'Include detailed entity counts' }
            }
          },
          { 
            name: 'validateDatabaseIntegrity', 
            description: 'Validate database integrity and relationships',
            parameters: {
              repairMode: { type: 'boolean', required: false, description: 'Attempt to repair inconsistencies' },
              entityTypes: { type: 'array', required: false, description: 'Entity types to validate' }
            }
          },
          { 
            name: 'testGroqApi', 
            description: 'Test Groq API connection and functionality',
            parameters: {
              apiKey: { type: 'string', required: false, description: 'Groq API key (uses stored key if not provided)' },
              testMessage: { type: 'string', required: false, description: 'Test message to send' }
            }
          },
          { 
            name: 'getSystemStatus', 
            description: 'Get system status information',
            parameters: {
              includeProcessStats: { type: 'boolean', required: false, description: 'Include process statistics' },
              includeMemoryUsage: { type: 'boolean', required: false, description: 'Include memory usage details' }
            }
          }
        ];
        
        // Set endpoints and create parameter templates
        const templates = {};
        mockEndpoints.forEach(endpoint => {
          templates[endpoint.name] = {};
          Object.keys(endpoint.parameters).forEach(paramName => {
            const param = endpoint.parameters[paramName];
            // Set default values based on type
            switch (param.type) {
              case 'string':
                templates[endpoint.name][paramName] = '';
                break;
              case 'boolean':
                templates[endpoint.name][paramName] = false;
                break;
              case 'date':
                templates[endpoint.name][paramName] = new Date().toISOString().split('T')[0];
                break;
              case 'datetime':
                templates[endpoint.name][paramName] = new Date().toISOString().slice(0, 16);
                break;
              case 'array':
                templates[endpoint.name][paramName] = [];
                break;
              default:
                templates[endpoint.name][paramName] = '';
            }
          });
        });
        
        setEndpoints(mockEndpoints);
        setParameterTemplates(templates);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error loading endpoints:', error);
      setError('Failed to load IPC endpoints. Please try again.');
      setIsLoading(false);
    }
  };
  
  // Handle endpoint selection
  const handleEndpointSelect = (endpointName) => {
    setSelectedEndpoint(endpointName);
    setParameters(parameterTemplates[endpointName] || {});
    setResponse(null);
    setError(null);
  };
  
  // Handle parameter change
  const handleParameterChange = (paramName, value) => {
    setParameters(prevParams => ({
      ...prevParams,
      [paramName]: value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Find selected endpoint
    const endpoint = endpoints.find(ep => ep.name === selectedEndpoint);
    if (!endpoint) {
      setError('Please select an endpoint to test');
      return;
    }
    
    // Validate required parameters
    const missingParams = [];
    Object.entries(endpoint.parameters).forEach(([paramName, paramConfig]) => {
      if (paramConfig.required && 
          (parameters[paramName] === undefined || 
           parameters[paramName] === null || 
           parameters[paramName] === '')) {
        missingParams.push(paramName);
      }
    });
    
    if (missingParams.length > 0) {
      setError(`Missing required parameters: ${missingParams.join(', ')}`);
      return;
    }
    
    // Execute IPC call
    executeIPCCall(selectedEndpoint, parameters);
  };
  
  // Execute IPC call
  const executeIPCCall = async (endpoint, params) => {
    try {
      setIsLoading(true);
      setError(null);
      setResponse(null);
      
      // Here, in a real implementation, you would actually make the IPC call to the Electron backend
      // For now, we'll simulate a response after a delay
      const timestamp = new Date().toISOString();
      
      setTimeout(() => {
        // Generate mock response based on endpoint
        let mockResponse;
        
        switch (endpoint) {
          case 'getSchedules':
            mockResponse = {
              success: true,
              data: [
                { id: 'sched-1', clientId: 'client-1', caregiverId: 'caregiver-1', startTime: '2025-06-15T09:00:00Z', endTime: '2025-06-15T11:00:00Z' },
                { id: 'sched-2', clientId: 'client-2', caregiverId: 'caregiver-2', startTime: '2025-06-16T14:00:00Z', endTime: '2025-06-16T16:00:00Z' }
              ],
              count: 2
            };
            break;
          case 'getClients':
            mockResponse = {
              success: true,
              data: [
                { id: 'client-1', name: 'John Doe', email: 'john@example.com', phone: '555-1234' },
                { id: 'client-2', name: 'Jane Smith', email: 'jane@example.com', phone: '555-5678' }
              ],
              count: 2
            };
            break;
          case 'getCaregivers':
            mockResponse = {
              success: true,
              data: [
                { id: 'caregiver-1', name: 'Amy Johnson', email: 'amy@example.com', phone: '555-9012' },
                { id: 'caregiver-2', name: 'Bob Williams', email: 'bob@example.com', phone: '555-3456' }
              ],
              count: 2
            };
            break;
          case 'runOpportunityScan':
            mockResponse = {
              success: true,
              data: {
                opportunitiesFound: 5,
                scanDuration: 1.23,
                dateRange: { start: params.startDate || new Date().toISOString().split('T')[0], end: params.endDate || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0] }
              }
            };
            break;
          case 'runAgentQuery':
            mockResponse = {
              success: true,
              data: {
                response: `This is a simulated response from ${params.agentName} for the query: "${params.query}"`,
                responseTime: 2.34,
                tokenCount: 156
              }
            };
            break;
          case 'getDatabaseStats':
            mockResponse = {
              success: true,
              data: {
                totalEntities: 1245,
                clients: 87,
                caregivers: 32,
                schedules: 1126,
                lastBackupTimestamp: '2025-06-13T18:30:00Z',
                databaseSize: '42.5 MB'
              }
            };
            break;
          case 'validateDatabaseIntegrity':
            mockResponse = {
              success: true,
              data: {
                valid: true,
                issuesFound: 0,
                issuesFixed: 0,
                validationTime: 3.45,
                details: []
              }
            };
            break;
          case 'testGroqApi':
            mockResponse = {
              success: true,
              data: {
                connected: true,
                model: 'llama3-8b-8192',
                responseTime: 1.23,
                sampleResponse: params.testMessage ? `Echo: ${params.testMessage}` : 'Connection successful'
              }
            };
            break;
          case 'getSystemStatus':
            mockResponse = {
              success: true,
              data: {
                status: 'running',
                uptime: '3 days, 7 hours, 45 minutes',
                version: '2.1.3',
                nodeVersion: '18.15.0',
                electronVersion: '23.2.0',
                platform: 'win32',
                memoryUsage: params.includeMemoryUsage ? { total: '16 GB', used: '4.2 GB', free: '11.8 GB' } : undefined,
                processStats: params.includeProcessStats ? { cpu: '3.2%', memory: '256 MB' } : undefined
              }
            };
            break;
          case 'createSchedule':
            mockResponse = {
              success: true,
              data: {
                id: 'sched-' + Math.floor(Math.random() * 1000),
                clientId: params.clientId,
                caregiverId: params.caregiverId,
                startTime: params.startTime,
                endTime: params.endTime,
                notes: params.notes,
                createdAt: new Date().toISOString()
              }
            };
            break;
          default:
            mockResponse = {
              success: false,
              error: 'Unknown endpoint'
            };
        }
        
        // Add to response history
        const historyItem = {
          timestamp,
          endpoint,
          parameters: { ...params },
          response: mockResponse
        };
        
        setResponseHistory(prev => [historyItem, ...prev.slice(0, 9)]);
        setResponse(mockResponse);
        setIsLoading(false);
        
        // Show notification based on success/failure
        if (mockResponse.success) {
          notificationService.showNotification({
            type: 'success',
            title: 'IPC Call Successful',
            message: `Successfully executed ${endpoint}`
          });
        } else {
          notificationService.showNotification({
            type: 'error',
            title: 'IPC Call Failed',
            message: mockResponse.error || 'Unknown error occurred'
          });
        }
        
        // Switch to response tab
        setActiveTab('response');
      }, 1000);
    } catch (error) {
      console.error('Error executing IPC call:', error);
      setError('Failed to execute IPC call. Please check your parameters and try again.');
      setIsLoading(false);
      
      notificationService.showNotification({
        type: 'error',
        title: 'IPC Call Failed',
        message: error.message || 'Unknown error occurred'
      });
    }
  };
  
  // Handle viewing a history item
  const viewHistoryItem = (historyItem) => {
    setSelectedEndpoint(historyItem.endpoint);
    setParameters(historyItem.parameters);
    setResponse(historyItem.response);
    setActiveTab('response');
  };
  
  // Format JSON for display
  const formatJSON = (json) => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return String(json);
    }
  };
  
  // Get the currently selected endpoint object
  const selectedEndpointObj = endpoints.find(ep => ep.name === selectedEndpoint);
  
  // Get parameter input type based on parameter type
  const getInputType = (paramType) => {
    switch (paramType) {
      case 'date':
        return 'date';
      case 'datetime':
        return 'datetime-local';
      case 'boolean':
        return 'checkbox';
      default:
        return 'text';
    }
  };
  
  return (
    <div className="ipc-test-harness">
      <h3>IPC Test Harness</h3>
      
      {isLoading && endpoints.length === 0 ? (
        <div className="loading-indicator">Loading available endpoints...</div>
      ) : error && endpoints.length === 0 ? (
        <div className="error-message">
          {error}
          <button onClick={loadEndpoints}>Retry</button>
        </div>
      ) : (
        <>
          <div className="test-harness-tabs">
            <button 
              className={activeTab === 'request' ? 'active' : ''}
              onClick={() => setActiveTab('request')}
            >
              Request
            </button>
            <button 
              className={activeTab === 'response' ? 'active' : ''}
              onClick={() => setActiveTab('response')}
              disabled={!response}
            >
              Response
            </button>
            <button 
              className={activeTab === 'history' ? 'active' : ''}
              onClick={() => setActiveTab('history')}
              disabled={responseHistory.length === 0}
            >
              History
            </button>
          </div>
          
          {activeTab === 'request' && (
            <div className="request-tab">
              <div className="endpoint-selector">
                <label htmlFor="endpoint-select">Endpoint:</label>
                <select 
                  id="endpoint-select"
                  value={selectedEndpoint}
                  onChange={(e) => handleEndpointSelect(e.target.value)}
                >
                  <option value="">-- Select an endpoint --</option>
                  {endpoints.map(endpoint => (
                    <option key={endpoint.name} value={endpoint.name}>
                      {endpoint.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedEndpointObj && (
                <div className="endpoint-description">
                  {selectedEndpointObj.description}
                </div>
              )}
              
              {selectedEndpoint && (
                <form onSubmit={handleSubmit} className="parameters-form">
                  <h4>Parameters</h4>
                  
                  {Object.entries(selectedEndpointObj.parameters).map(([paramName, paramConfig]) => (
                    <div key={paramName} className="parameter-input">
                      <label htmlFor={`param-${paramName}`}>
                        {paramName}:
                        {paramConfig.required && <span className="required">*</span>}
                      </label>
                      
                      {paramConfig.type === 'boolean' ? (
                        <div className="checkbox-wrapper">
                          <input
                            id={`param-${paramName}`}
                            type="checkbox"
                            checked={!!parameters[paramName]}
                            onChange={(e) => handleParameterChange(paramName, e.target.checked)}
                          />
                          <span className="param-description">{paramConfig.description}</span>
                        </div>
                      ) : paramConfig.type === 'array' ? (
                        <div className="array-input-wrapper">
                          <input
                            id={`param-${paramName}`}
                            type="text"
                            value={Array.isArray(parameters[paramName]) ? parameters[paramName].join(', ') : ''}
                            onChange={(e) => handleParameterChange(
                              paramName, 
                              e.target.value.split(',').map(item => item.trim()).filter(Boolean)
                            )}
                            placeholder={`Comma-separated values (${paramConfig.description})`}
                          />
                          <span className="param-description">{paramConfig.description}</span>
                        </div>
                      ) : (
                        <div className="text-input-wrapper">
                          <input
                            id={`param-${paramName}`}
                            type={getInputType(paramConfig.type)}
                            value={parameters[paramName] || ''}
                            onChange={(e) => handleParameterChange(paramName, e.target.value)}
                            placeholder={paramConfig.description}
                          />
                          <span className="param-description">{paramConfig.description}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {error && (
                    <div className="error-message">{error}</div>
                  )}
                  
                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="execute-button"
                      disabled={isLoading || !selectedEndpoint}
                    >
                      {isLoading ? 'Executing...' : 'Execute IPC Call'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          
          {activeTab === 'response' && (
            <div className="response-tab">
              <div className="response-controls">
                <div className="response-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={showRawJson}
                      onChange={() => setShowRawJson(!showRawJson)}
                    />
                    Show Raw JSON
                  </label>
                </div>
                
                <div className="response-info">
                  <span className="endpoint-name">{selectedEndpoint}</span>
                  <span className={`status-indicator ${response?.success ? 'success' : 'error'}`}>
                    {response?.success ? 'Success' : 'Error'}
                  </span>
                </div>
              </div>
              
              {isLoading ? (
                <div className="loading-indicator">Executing IPC call...</div>
              ) : response ? (
                <div className="response-content">
                  {showRawJson ? (
                    <pre className="raw-json">
                      {formatJSON(response)}
                    </pre>
                  ) : (
                    <div className="visualized-response" ref={visualizerRef}>
                      {response.success ? (
                        <div className="success-response">
                          {typeof response.data === 'object' ? (
                            <div className="response-data">
                              {Array.isArray(response.data) ? (
                                <div className="array-response">
                                  <div className="array-header">
                                    <span>Array ({response.data.length} items)</span>
                                  </div>
                                  <div className="array-items">
                                    {response.data.map((item, index) => (
                                      <div key={index} className="array-item">
                                        <div className="item-header">Item {index + 1}</div>
                                        <div className="item-properties">
                                          {Object.entries(item).map(([key, value]) => (
                                            <div key={key} className="property">
                                              <span className="property-name">{key}:</span>
                                              <span className="property-value">
                                                {typeof value === 'object' ? formatJSON(value) : String(value)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="object-response">
                                  {Object.entries(response.data).map(([key, value]) => (
                                    <div key={key} className="property">
                                      <span className="property-name">{key}:</span>
                                      <span className="property-value">
                                        {typeof value === 'object' ? (
                                          <pre>{formatJSON(value)}</pre>
                                        ) : (
                                          String(value)
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="simple-response">
                              {String(response.data)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="error-response">
                          <div className="error-title">Error:</div>
                          <div className="error-message">{response.error}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-response">
                  <p>No response yet. Execute an IPC call to see results.</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="history-tab">
              <h4>Response History</h4>
              
              {responseHistory.length === 0 ? (
                <div className="no-history">
                  <p>No history yet. Execute IPC calls to see history.</p>
                </div>
              ) : (
                <div className="history-list">
                  {responseHistory.map((historyItem, index) => (
                    <div 
                      key={index} 
                      className={`history-item ${historyItem.response.success ? 'success' : 'error'}`}
                      onClick={() => viewHistoryItem(historyItem)}
                    >
                      <div className="history-item-header">
                        <span className="history-endpoint">{historyItem.endpoint}</span>
                        <span className="history-timestamp">
                          {new Date(historyItem.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="history-item-content">
                        <div className="history-params">
                          {Object.entries(historyItem.parameters).map(([key, value]) => (
                            <div key={key} className="history-param">
                              <span className="param-name">{key}:</span>
                              <span className="param-value">
                                {Array.isArray(value) ? value.join(', ') : 
                                 typeof value === 'object' ? JSON.stringify(value) : 
                                 String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="history-result">
                          <span className={`status-indicator ${historyItem.response.success ? 'success' : 'error'}`}>
                            {historyItem.response.success ? 'Success' : 'Error'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {responseHistory.length > 0 && (
                <div className="history-actions">
                  <button 
                    className="clear-history"
                    onClick={() => setResponseHistory([])}
                  >
                    Clear History
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      
      <style jsx>{`
        .ipc-test-harness {
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          height: 100%;
        }
        
        h3 {
          margin: 0;
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          color: #343a40;
        }
        
        .loading-indicator, .error-message {
          padding: 20px;
          text-align: center;
          color: #6c757d;
        }
        
        .error-message {
          color: #dc3545;
        }
        
        .error-message button {
          margin-left: 10px;
          padding: 5px 10px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .test-harness-tabs {
          display: flex;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .test-harness-tabs button {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 15px;
          color: #495057;
          border-bottom: 3px solid transparent;
        }
        
        .test-harness-tabs button.active {
          color: #3498db;
          border-bottom-color: #3498db;
          font-weight: 500;
        }
        
        .test-harness-tabs button:disabled {
          color: #adb5bd;
          cursor: not-allowed;
        }
        
        .endpoint-selector {
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .endpoint-selector label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #343a40;
        }
        
        .endpoint-selector select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          background-color: white;
          font-size: 16px;
        }
        
        .endpoint-description {
          padding: 0 20px 20px;
          border-bottom: 1px solid #e9ecef;
          color: #6c757d;
          font-style: italic;
        }
        
        .parameters-form {
          padding: 20px;
          overflow: auto;
          flex: 1;
        }
        
        .parameters-form h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #343a40;
        }
        
        .parameter-input {
          margin-bottom: 15px;
        }
        
        .parameter-input label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #343a40;
        }
        
        .parameter-input .required {
          color: #dc3545;
          margin-left: 3px;
        }
        
        .parameter-input input[type="text"],
        .parameter-input input[type="date"],
        .parameter-input input[type="datetime-local"] {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 15px;
        }
        
        .parameter-input .param-description {
          display: block;
          margin-top: 5px;
          font-size: 14px;
          color: #6c757d;
        }
        
        .checkbox-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .checkbox-wrapper input[type="checkbox"] {
          margin: 0;
        }
        
        .form-actions {
          margin-top: 20px;
          text-align: right;
        }
        
        .execute-button {
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
        }
        
        .execute-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .execute-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .response-tab, .history-tab {
          display: flex;
          flex-direction: column;
          padding: 20px;
          overflow: auto;
          flex: 1;
        }
        
        .response-controls {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
        }
        
        .response-toggle label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .response-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .endpoint-name {
          font-weight: 500;
          color: #343a40;
        }
        
        .status-indicator {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .status-indicator.success {
          background: #d4edda;
          color: #155724;
        }
        
        .status-indicator.error {
          background: #f8d7da;
          color: #721c24;
        }
        
        .response-content {
          flex: 1;
          background: #f8f9fa;
          border-radius: 6px;
          overflow: auto;
        }
        
        .raw-json {
          margin: 0;
          padding: 15px;
          font-family: monospace;
          font-size: 14px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        .visualized-response {
          padding: 15px;
        }
        
        .array-response, .object-response {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .array-header {
          font-weight: 500;
          color: #343a40;
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        
        .array-items {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .array-item {
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .item-header {
          padding: 8px 15px;
          background: #e9ecef;
          font-weight: 500;
          color: #343a40;
        }
        
        .item-properties {
          padding: 15px;
        }
        
        .property {
          margin-bottom: 8px;
          display: flex;
          align-items: flex-start;
        }
        
        .property:last-child {
          margin-bottom: 0;
        }
        
        .property-name {
          min-width: 120px;
          font-weight: 500;
          color: #343a40;
        }
        
        .property-value {
          flex: 1;
        }
        
        .property-value pre {
          margin: 0;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          font-family: monospace;
          font-size: 14px;
          overflow: auto;
        }
        
        .simple-response {
          padding: 15px;
          background: white;
          border-radius: 6px;
        }
        
        .error-response {
          padding: 15px;
          color: #721c24;
        }
        
        .error-response .error-title {
          font-weight: 500;
          margin-bottom: 5px;
        }
        
        .no-response, .no-history {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
          color: #6c757d;
          font-style: italic;
        }
        
        .history-tab h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #343a40;
        }
        
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .history-item {
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .history-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .history-item.success {
          border-left: 4px solid #28a745;
        }
        
        .history-item.error {
          border-left: 4px solid #dc3545;
        }
        
        .history-item-header {
          padding: 10px 15px;
          background: #f8f9fa;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e9ecef;
        }
        
        .history-endpoint {
          font-weight: 500;
          color: #343a40;
        }
        
        .history-timestamp {
          color: #6c757d;
          font-size: 14px;
        }
        
        .history-item-content {
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        
        .history-params {
          flex: 1;
          margin-right: 20px;
        }
        
        .history-param {
          margin-bottom: 5px;
          font-size: 14px;
        }
        
        .param-name {
          font-weight: 500;
          color: #343a40;
          margin-right: 5px;
        }
        
        .param-value {
          color: #6c757d;
          word-break: break-word;
        }
        
        .history-actions {
          text-align: center;
          margin-top: 10px;
        }
        
        .clear-history {
          padding: 8px 16px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .clear-history:hover {
          background: #c82333;
        }
      `}</style>
    </div>
  );
};

export default IPCTestHarness;

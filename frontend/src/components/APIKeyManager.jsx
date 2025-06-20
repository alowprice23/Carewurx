import React, { useState, useEffect } from 'react';
import { agentService } from '../services';

/**
 * API Key Manager Component
 * Handles secure API key management for LLM providers like Groq
 */
const APIKeyManager = () => {
  const [apiKeys, setApiKeys] = useState({
    groq: '',
    openai: '',
    anthropic: ''
  });
  const [activeProvider, setActiveProvider] = useState('groq');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [keyStatus, setKeyStatus] = useState({
    groq: { isSet: false, isValid: false, lastValidated: null },
    openai: { isSet: false, isValid: false, lastValidated: null },
    anthropic: { isSet: false, isValid: false, lastValidated: null }
  });
  const [usageStats, setUsageStats] = useState({
    groq: { requests: 0, tokens: 0, lastRequest: null },
    openai: { requests: 0, tokens: 0, lastRequest: null },
    anthropic: { requests: 0, tokens: 0, lastRequest: null }
  });

  // Load existing API keys and status on component mount
  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors

        const statuses = await agentService.getApiKeyStatuses();
        const usage = await agentService.getApiUsageStats();
        
        // DO NOT setApiKeys (input fields) from getApiKeyStatuses
        
        const defaultStatus = { isSet: false, isValid: false, lastValidated: null };
        setKeyStatus({
          groq: statuses?.groq || { ...defaultStatus },
          openai: statuses?.openai || { ...defaultStatus },
          anthropic: statuses?.anthropic || { ...defaultStatus }
        });
        
        setUsageStats(usage || {
          groq: { requests: 0, tokens: 0, lastRequest: null },
          openai: { requests: 0, tokens: 0, lastRequest: null },
          anthropic: { requests: 0, tokens: 0, lastRequest: null }
        });
        
        setError(null);
      } catch (err) {
        console.error('Error fetching API keys:', err);
        setError('Failed to load API keys. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchApiKeys();
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    const { value } = e.target;
    setApiKeys(prev => ({
      ...prev,
      [activeProvider]: value
    }));
    
    // Reset validation status when key changes, but preserve isSet
    setKeyStatus(prev => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider], // Keep previous status (like isSet)
        isValid: false,          // Only reset validation part
        lastValidated: null
      }
    }));
    
    setError(null);
    setSuccess(null);
  };

  // Save API key
  const handleSaveKey = async () => {
    if (!apiKeys[activeProvider]) {
      setError('Please enter an API key.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await agentService.saveApiKey(activeProvider, apiKeys[activeProvider]);
      
      const currentKey = apiKeys[activeProvider]; // Get key before clearing
      setSuccess(`${formatProviderName(activeProvider)} API key saved successfully.`);
      
      // Clear input field after successful save
      setApiKeys(prev => ({ ...prev, [activeProvider]: '' }));

      // Validate the key after saving (which will update isSet and isValid in keyStatus)
      await handleValidateKey(currentKey); // Pass the saved key for validation
    } catch (err) {
      console.error('Error saving API key:', err);
      setError(`Failed to save ${formatProviderName(activeProvider)} API key. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Validate API key
  const handleValidateKey = async () => {
    if (!apiKeys[activeProvider]) {
      setError('Please enter an API key to validate.');
      return;
    }
    
    try {
      setValidating(true);
      setError(null);
      setSuccess(null);
      
      const result = await agentService.validateApiKey(activeProvider, apiKeys[activeProvider]);
      
      // handleValidateKey should only update isValid and lastValidated.
      // isSet is updated by save/delete or initial load.
      // The result from validateApiKey service includes { isValid, message }
      setKeyStatus(prev => ({
        ...prev,
        [activeProvider]: {
          ...prev[activeProvider], // Keep isSet
          isValid: result.isValid,
          lastValidated: new Date().toISOString(),
        }
      }));
      
      if (result.isValid) {
        setSuccess(`${formatProviderName(activeProvider)} API key validated successfully.`);
      } else {
        setError(`${formatProviderName(activeProvider)} API key validation failed: ${result.message || 'Invalid key'}`);
      }
    } catch (err) {
      console.error('Error validating API key:', err);
      setError(`Failed to validate ${formatProviderName(activeProvider)} API key. Please try again.`);
      
      // If validation fails, only isValid and lastValidated are updated. isSet remains from load/save.
      setKeyStatus(prev => ({
        ...prev,
        [activeProvider]: {
          ...prev[activeProvider], // Keep isSet
          isValid: false,
          lastValidated: new Date().toISOString()
        }
      }));
    } finally {
      setValidating(false);
    }
  };

  // Delete API key
  const handleDeleteKey = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await agentService.deleteApiKey(activeProvider);
      
      setApiKeys(prev => ({
        ...prev,
        [activeProvider]: ''
      }));
      
      // After deleting, the key is no longer set nor valid.
      setKeyStatus(prev => ({
        ...prev,
        [activeProvider]: { isSet: false, isValid: false, lastValidated: null }
      }));
      
      setSuccess(`${formatProviderName(activeProvider)} API key removed successfully.`);
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError(`Failed to remove ${formatProviderName(activeProvider)} API key. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Refresh usage statistics
  const handleRefreshStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const usage = await agentService.getApiUsageStats();
      
      setUsageStats(usage || {
        groq: { requests: 0, tokens: 0, lastRequest: null },
        openai: { requests: 0, tokens: 0, lastRequest: null },
        anthropic: { requests: 0, tokens: 0, lastRequest: null }
      });
    } catch (err) {
      console.error('Error fetching API usage stats:', err);
      setError('Failed to fetch usage statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format provider name for display
  const formatProviderName = (provider) => {
    switch (provider) {
      case 'groq':
        return 'Groq';
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format numbers with commas
  const formatNumber = (number) => {
    return number?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
  };

  // Get status class
  const getStatusClass = (isValid) => {
    return isValid ? 'valid' : 'invalid';
  };

  return (
    <div className="api-key-manager">
      <h3>API Key Management</h3>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="provider-tabs">
        <button 
          className={`provider-tab ${activeProvider === 'groq' ? 'active' : ''}`}
          onClick={() => setActiveProvider('groq')}
        >
          Groq
          <span className={`status-indicator ${getStatusClass(keyStatus.groq.isValid)}`}></span>
        </button>
        <button 
          className={`provider-tab ${activeProvider === 'openai' ? 'active' : ''}`}
          onClick={() => setActiveProvider('openai')}
        >
          OpenAI
          <span className={`status-indicator ${getStatusClass(keyStatus.openai.isValid)}`}></span>
        </button>
        <button 
          className={`provider-tab ${activeProvider === 'anthropic' ? 'active' : ''}`}
          onClick={() => setActiveProvider('anthropic')}
        >
          Anthropic
          <span className={`status-indicator ${getStatusClass(keyStatus.anthropic.isValid)}`}></span>
        </button>
      </div>
      
      <div className="api-key-container">
        <div className="input-group">
          <label htmlFor="api-key">{formatProviderName(activeProvider)} API Key</label>
          <div className="key-input-wrapper">
            <input
              id="api-key"
              type={isKeyVisible ? 'text' : 'password'}
              value={apiKeys[activeProvider]}
              onChange={handleInputChange}
              placeholder={`Enter your ${formatProviderName(activeProvider)} API key`}
              disabled={loading}
            />
            <button 
              type="button" 
              className="toggle-visibility"
              onClick={() => setIsKeyVisible(!isKeyVisible)}
            >
              {isKeyVisible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        
        <div className="key-actions">
          <button 
            type="button" 
            className="save-button"
            onClick={handleSaveKey}
            disabled={loading || !apiKeys[activeProvider]}
          >
            Save Key
          </button>
          <button 
            type="button" 
            className="validate-button"
            onClick={handleValidateKey}
            disabled={validating || !apiKeys[activeProvider]}
          >
            {validating ? 'Validating...' : 'Validate Key'}
          </button>
          <button 
            type="button" 
            className="delete-button"
            onClick={handleDeleteKey}
            disabled={loading || !apiKeys[activeProvider]}
          >
            Remove Key
          </button>
        </div>
      </div>
      
      <div className="key-status">
        <h4>Key Status</h4>
        <div className="status-item">
          <span className="status-label">Status:</span>
          <span className={`status-value ${getStatusClass(keyStatus[activeProvider].isValid && keyStatus[activeProvider].isSet)}`}>
            {keyStatus[activeProvider].isSet
              ? (keyStatus[activeProvider].isValid ? 'Valid' : 'Set (Validation Failed or Pending)')
              : 'Not Set'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Last Validated:</span>
          <span className="status-value">
            {formatDate(keyStatus[activeProvider].lastValidated)}
          </span>
        </div>
      </div>
      
      <div className="usage-stats">
        <div className="stats-header">
          <h4>Usage Statistics</h4>
          <button 
            type="button" 
            className="refresh-button"
            onClick={handleRefreshStats}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        
        <div className="stats-grid">
          <div className="stats-item">
            <span className="stats-label">Total Requests:</span>
            <span className="stats-value">
              {formatNumber(usageStats[activeProvider].requests)}
            </span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Total Tokens:</span>
            <span className="stats-value">
              {formatNumber(usageStats[activeProvider].tokens)}
            </span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Last Request:</span>
            <span className="stats-value">
              {formatDate(usageStats[activeProvider].lastRequest)}
            </span>
          </div>
        </div>
      </div>
      
      <div className="api-help">
        <h4>Help</h4>
        <div className="help-content">
          <p>
            <strong>Where to get an API key:</strong>
          </p>
          <ul>
            <li>
              <strong>Groq:</strong> Visit <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer">console.groq.com</a> to create an account and get your API key.
            </li>
            <li>
              <strong>OpenAI:</strong> Visit <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer">platform.openai.com</a> to create an account and get your API key.
            </li>
            <li>
              <strong>Anthropic:</strong> Visit <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">console.anthropic.com</a> to create an account and get your API key.
            </li>
          </ul>
          <p>
            <strong>API Key Security:</strong> Your API key is stored securely on your local machine and is never shared with third parties. We recommend validating your key after saving to ensure it works correctly.
          </p>
        </div>
      </div>

      <style jsx>{`
        .api-key-manager {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #2c3e50;
        }
        
        .error-message, .success-message {
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .error-message {
          background: #f8d7da;
          color: #721c24;
        }
        
        .success-message {
          background: #d4edda;
          color: #155724;
        }
        
        .provider-tabs {
          display: flex;
          margin-bottom: 20px;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .provider-tab {
          flex: 1;
          padding: 10px;
          border: none;
          background: none;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .provider-tab.active {
          background: #3498db;
          color: white;
        }
        
        .provider-tab:not(.active):hover {
          background: #f8f9fa;
        }
        
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-left: 8px;
        }
        
        .status-indicator.valid {
          background-color: #2ecc71;
        }
        
        .status-indicator.invalid {
          background-color: #e74c3c;
        }
        
        .api-key-container {
          margin-bottom: 20px;
        }
        
        .input-group {
          margin-bottom: 15px;
        }
        
        .input-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .key-input-wrapper {
          display: flex;
        }
        
        .key-input-wrapper input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 4px 0 0 4px;
          font-size: 1rem;
          font-family: monospace;
        }
        
        .toggle-visibility {
          padding: 0 10px;
          background: #f8f9fa;
          border: 1px solid #ced4da;
          border-left: none;
          border-radius: 0 4px 4px 0;
          cursor: pointer;
        }
        
        .key-actions {
          display: flex;
          gap: 10px;
        }
        
        .save-button, .validate-button, .delete-button, .refresh-button {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .save-button {
          background: #3498db;
          color: white;
        }
        
        .save-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .validate-button {
          background: #2ecc71;
          color: white;
        }
        
        .validate-button:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .delete-button {
          background: #e74c3c;
          color: white;
        }
        
        .delete-button:hover:not(:disabled) {
          background: #c0392b;
        }
        
        .refresh-button {
          background: #f8f9fa;
          border: 1px solid #ced4da;
          color: #495057;
        }
        
        .refresh-button:hover:not(:disabled) {
          background: #e9ecef;
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .key-status {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .key-status h4, .usage-stats h4, .api-help h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .status-item {
          display: flex;
          margin-bottom: 8px;
        }
        
        .status-item:last-child {
          margin-bottom: 0;
        }
        
        .status-label, .stats-label {
          flex: 0 0 120px;
          font-weight: 500;
        }
        
        .status-value.valid {
          color: #2ecc71;
          font-weight: 500;
        }
        
        .status-value.invalid {
          color: #e74c3c;
          font-weight: 500;
        }
        
        .usage-stats {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }
        
        .stats-item {
          display: flex;
          flex-direction: column;
        }
        
        .stats-value {
          font-weight: 500;
        }
        
        .api-help {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .help-content p {
          margin-top: 0;
        }
        
        .help-content ul {
          padding-left: 20px;
        }
        
        .help-content a {
          color: #3498db;
          text-decoration: none;
        }
        
        .help-content a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default APIKeyManager;

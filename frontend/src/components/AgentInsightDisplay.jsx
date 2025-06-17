import React, { useState, useEffect } from 'react';
import { agentService } from '../services';

/**
 * Agent Insight Display Component
 * Shows agent-generated insights and suggestions
 */
const AgentInsightDisplay = ({ entityId, entityType }) => {
  const [insights, setInsights] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('insights'); // 'insights' or 'suggestions'

  // Fetch insights when entityId or entityType changes
  useEffect(() => {
    if (!entityId || !entityType) return;
    
    setLoading(true);
    setError(null);
    
    const fetchData = async () => {
      try {
        // Fetch insights
        if (entityType === 'schedule') {
          const insightData = await agentService.getInsights(entityId);
          setInsights(insightData);
        }
        
        // Fetch suggestions
        const suggestionData = await agentService.getSuggestions(entityId, entityType);
        setSuggestions(suggestionData);
      } catch (err) {
        console.error('Error fetching agent data:', err);
        setError('Failed to load agent insights. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [entityId, entityType]);

  // Handle suggestion acceptance
  const handleAcceptSuggestion = async (suggestionId) => {
    try {
      // In a real implementation, this would call an API endpoint
      // to apply the suggestion
      
      // For now, we'll just update the UI to show it was accepted
      setSuggestions(suggestions.map(suggestion => 
        suggestion.id === suggestionId 
          ? { ...suggestion, status: 'accepted' } 
          : suggestion
      ));
      
      // Show confirmation message
      setError(null);
    } catch (err) {
      console.error('Error accepting suggestion:', err);
      setError('Failed to accept suggestion. Please try again.');
    }
  };

  // Handle suggestion rejection
  const handleRejectSuggestion = async (suggestionId, reason = 'Not applicable') => {
    try {
      // In a real implementation, this would call an API endpoint
      // to reject the suggestion
      
      // For now, we'll just update the UI to show it was rejected
      setSuggestions(suggestions.map(suggestion => 
        suggestion.id === suggestionId 
          ? { ...suggestion, status: 'rejected', rejectionReason: reason } 
          : suggestion
      ));
      
      // Show confirmation message
      setError(null);
    } catch (err) {
      console.error('Error rejecting suggestion:', err);
      setError('Failed to reject suggestion. Please try again.');
    }
  };

  // Render insights section
  const renderInsights = () => {
    if (insights.length === 0) {
      return <div className="no-data">No insights available</div>;
    }
    
    return (
      <div className="insights-list">
        {insights.map((insight, index) => (
          <div key={index} className="insight-card">
            <div className="insight-header">
              <span className="insight-type">{insight.type}</span>
              <span className="insight-timestamp">{new Date(insight.timestamp).toLocaleString()}</span>
            </div>
            <div className="insight-content">{insight.content}</div>
            {insight.metrics && (
              <div className="insight-metrics">
                {Object.entries(insight.metrics).map(([key, value]) => (
                  <div key={key} className="metric">
                    <span className="metric-name">{key}:</span>
                    <span className="metric-value">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render suggestions section
  const renderSuggestions = () => {
    if (suggestions.length === 0) {
      return <div className="no-data">No suggestions available</div>;
    }
    
    return (
      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => (
          <div key={index} className={`suggestion-card ${suggestion.status || ''}`}>
            <div className="suggestion-header">
              <span className="suggestion-type">{suggestion.type}</span>
              <span className="suggestion-timestamp">{new Date(suggestion.timestamp).toLocaleString()}</span>
            </div>
            <div className="suggestion-content">{suggestion.content}</div>
            {suggestion.impact && (
              <div className="suggestion-impact">
                <span className="impact-label">Impact:</span>
                <span className={`impact-value ${suggestion.impact.toLowerCase()}`}>
                  {suggestion.impact}
                </span>
              </div>
            )}
            {!suggestion.status && (
              <div className="suggestion-actions">
                <button 
                  className="accept-button"
                  onClick={() => handleAcceptSuggestion(suggestion.id)}
                >
                  Accept
                </button>
                <button 
                  className="reject-button"
                  onClick={() => handleRejectSuggestion(suggestion.id)}
                >
                  Reject
                </button>
              </div>
            )}
            {suggestion.status === 'accepted' && (
              <div className="suggestion-status">
                <span className="status-label">Status:</span>
                <span className="status-value accepted">Accepted</span>
              </div>
            )}
            {suggestion.status === 'rejected' && (
              <div className="suggestion-status">
                <span className="status-label">Status:</span>
                <span className="status-value rejected">Rejected</span>
                {suggestion.rejectionReason && (
                  <span className="rejection-reason">Reason: {suggestion.rejectionReason}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="agent-insight-display">
      <div className="insight-tabs">
        <button 
          className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Insights
        </button>
        <button 
          className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          Suggestions
        </button>
      </div>
      
      <div className="insight-content">
        {loading ? (
          <div className="loading">Loading agent insights...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          activeTab === 'insights' ? renderInsights() : renderSuggestions()
        )}
      </div>

      <style jsx>{`
        .agent-insight-display {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .insight-tabs {
          display: flex;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .tab-button {
          padding: 12px 20px;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 1rem;
          font-weight: 500;
          color: #495057;
        }
        
        .tab-button.active {
          background: white;
          color: #3498db;
          border-bottom: 2px solid #3498db;
        }
        
        .insight-content {
          padding: 20px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .loading, .error, .no-data {
          padding: 20px;
          text-align: center;
          color: #6c757d;
        }
        
        .error {
          color: #dc3545;
        }
        
        .insight-card, .suggestion-card {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
          border-left: 4px solid #3498db;
        }
        
        .suggestion-card.accepted {
          border-left-color: #2ecc71;
        }
        
        .suggestion-card.rejected {
          border-left-color: #e74c3c;
          opacity: 0.8;
        }
        
        .insight-header, .suggestion-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 0.9rem;
          color: #6c757d;
        }
        
        .insight-type, .suggestion-type {
          font-weight: 500;
          color: #495057;
        }
        
        .insight-content, .suggestion-content {
          margin-bottom: 10px;
          line-height: 1.5;
        }
        
        .insight-metrics, .suggestion-impact {
          background: #f1f3f5;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
        }
        
        .metric {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
        }
        
        .impact-label, .status-label {
          font-weight: 500;
          margin-right: 5px;
        }
        
        .impact-value {
          font-weight: 500;
        }
        
        .impact-value.high {
          color: #e74c3c;
        }
        
        .impact-value.medium {
          color: #f39c12;
        }
        
        .impact-value.low {
          color: #2ecc71;
        }
        
        .suggestion-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        
        .accept-button, .reject-button {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        
        .accept-button {
          background: #2ecc71;
          color: white;
        }
        
        .accept-button:hover {
          background: #27ae60;
        }
        
        .reject-button {
          background: #e74c3c;
          color: white;
        }
        
        .reject-button:hover {
          background: #c0392b;
        }
        
        .suggestion-status {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .status-value {
          font-weight: 500;
        }
        
        .status-value.accepted {
          color: #2ecc71;
        }
        
        .status-value.rejected {
          color: #e74c3c;
        }
        
        .rejection-reason {
          display: block;
          margin-top: 5px;
          font-style: italic;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};

export default AgentInsightDisplay;

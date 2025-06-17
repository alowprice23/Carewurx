import React, { useState, useEffect, useRef } from 'react';
import { agentService } from '../services';

/**
 * Response Streaming UI Component
 * Displays real-time LLM responses with typing indicators and quality feedback
 */
const ResponseStreamingUI = ({ initialPrompt = '', onResponseComplete = () => {} }) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [response, setResponse] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(0); // chars per second
  const [quality, setQuality] = useState(null); // null, 'poor', 'average', 'good', 'excellent'
  const [feedback, setFeedback] = useState('');
  const [submittedFeedback, setSubmittedFeedback] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('llama3-70b-8192');
  const [validProviders, setValidProviders] = useState({
    groq: false,
    openai: false,
    anthropic: false
  });
  const [tokenInfo, setTokenInfo] = useState({
    promptTokens: 0,
    responseTokens: 0,
    totalTokens: 0
  });
  
  const responseRef = useRef(null);
  const abortControllerRef = useRef(null);
  const streamStartTimeRef = useRef(null);
  const charCountRef = useRef(0);
  
  // Available models by provider
  const models = {
    groq: [
      { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
      { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma-7b-it', name: 'Gemma 7B' }
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    anthropic: [
      { id: 'claude-3-opus', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
    ]
  };

  // Check which providers have valid API keys
  useEffect(() => {
    const checkProviders = async () => {
      try {
        const status = await agentService.getApiKeyStatus();
        setValidProviders({
          groq: status?.groq?.isValid || false,
          openai: status?.openai?.isValid || false,
          anthropic: status?.anthropic?.isValid || false
        });
        
        // Default to the first valid provider
        if (!status?.[provider]?.isValid) {
          if (status?.groq?.isValid) setProvider('groq');
          else if (status?.openai?.isValid) setProvider('openai');
          else if (status?.anthropic?.isValid) setProvider('anthropic');
        }
      } catch (err) {
        console.error('Error checking API key status:', err);
      }
    };
    
    checkProviders();
  }, [provider]);

  // Automatically scroll to the bottom of the response
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);
  
  // Update typing speed calculation
  useEffect(() => {
    if (streaming) {
      const intervalId = setInterval(() => {
        if (streamStartTimeRef.current) {
          const elapsedSeconds = (Date.now() - streamStartTimeRef.current) / 1000;
          if (elapsedSeconds > 0) {
            const speed = Math.round(charCountRef.current / elapsedSeconds);
            setTypingSpeed(speed);
          }
        }
      }, 500);
      
      return () => clearInterval(intervalId);
    }
  }, [streaming]);

  // Handle sending the prompt and receiving the streamed response
  const handleSendPrompt = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    
    if (!validProviders[provider]) {
      setError(`No valid API key for ${formatProviderName(provider)}. Please add a valid API key in the API Keys tab.`);
      return;
    }
    
    setStreaming(true);
    setResponse('');
    setError(null);
    setQuality(null);
    setFeedback('');
    setSubmittedFeedback(false);
    setTokenInfo({
      promptTokens: 0,
      responseTokens: 0,
      totalTokens: 0
    });
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    streamStartTimeRef.current = Date.now();
    charCountRef.current = 0;
    
    try {
      const onChunk = (chunk) => {
        setResponse(prev => {
          const newResponse = prev + chunk;
          charCountRef.current = newResponse.length;
          return newResponse;
        });
      };
      
      const result = await agentService.streamResponse({
        provider,
        model,
        prompt,
        onChunk,
        signal: abortControllerRef.current.signal
      });
      
      setTokenInfo({
        promptTokens: result.promptTokens || 0,
        responseTokens: result.responseTokens || 0,
        totalTokens: (result.promptTokens || 0) + (result.responseTokens || 0)
      });
      
      // Call the callback with the complete response
      onResponseComplete(result.fullResponse || response);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error streaming response:', err);
        setError(`Failed to stream response: ${err.message}`);
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Handle cancelling the stream
  const handleCancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreaming(false);
    }
  };

  // Handle feedback submission
  const handleSubmitFeedback = async () => {
    if (!quality) {
      setError('Please select a quality rating before submitting feedback.');
      return;
    }
    
    try {
      await agentService.submitResponseFeedback({
        provider,
        model,
        prompt,
        response,
        quality,
        feedback
      });
      
      setSubmittedFeedback(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(`Failed to submit feedback: ${err.message}`);
    }
  };

  // Format provider name for display
  const formatProviderName = (providerName) => {
    switch (providerName) {
      case 'groq':
        return 'Groq';
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      default:
        return providerName.charAt(0).toUpperCase() + providerName.slice(1);
    }
  };

  // Get model display name
  const getModelDisplayName = (modelId) => {
    const modelObj = models[provider]?.find(m => m.id === modelId);
    return modelObj ? modelObj.name : modelId;
  };

  return (
    <div className="response-streaming-ui">
      <h3>Response Streaming</h3>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="provider-model-selection">
        <div className="provider-selector">
          <label htmlFor="provider-select">Provider</label>
          <div className="select-wrapper">
            <select
              id="provider-select"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                // Set default model for the selected provider
                if (models[e.target.value]?.length > 0) {
                  setModel(models[e.target.value][0].id);
                }
              }}
              disabled={streaming}
            >
              <option value="groq" disabled={!validProviders.groq}>
                Groq {!validProviders.groq && '(No API Key)'}
              </option>
              <option value="openai" disabled={!validProviders.openai}>
                OpenAI {!validProviders.openai && '(No API Key)'}
              </option>
              <option value="anthropic" disabled={!validProviders.anthropic}>
                Anthropic {!validProviders.anthropic && '(No API Key)'}
              </option>
            </select>
          </div>
        </div>
        
        <div className="model-selector">
          <label htmlFor="model-select">Model</label>
          <div className="select-wrapper">
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={streaming || !models[provider] || models[provider].length === 0}
            >
              {models[provider]?.map(modelOption => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <div className="prompt-container">
        <label htmlFor="prompt-input">Prompt</label>
        <textarea
          id="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
          rows={5}
          disabled={streaming}
        />
      </div>
      
      <div className="action-buttons">
        <button
          className="send-button"
          onClick={handleSendPrompt}
          disabled={streaming || !prompt.trim() || !validProviders[provider]}
        >
          {streaming ? 'Streaming...' : 'Send Prompt'}
        </button>
        
        {streaming && (
          <button
            className="cancel-button"
            onClick={handleCancelStream}
          >
            Cancel Stream
          </button>
        )}
      </div>
      
      <div className="response-container">
        <div className="response-header">
          <h4>Response</h4>
          {streaming && (
            <div className="streaming-indicator">
              <div className="typing-animation">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="typing-speed">{typingSpeed} chars/sec</span>
            </div>
          )}
        </div>
        
        <div className="response-content" ref={responseRef}>
          {response ? (
            <div className="response-text">{response}</div>
          ) : (
            <div className="empty-response">
              Response will appear here...
            </div>
          )}
        </div>
        
        {tokenInfo.totalTokens > 0 && (
          <div className="token-info">
            <span>Prompt Tokens: {tokenInfo.promptTokens}</span>
            <span>Response Tokens: {tokenInfo.responseTokens}</span>
            <span>Total Tokens: {tokenInfo.totalTokens}</span>
          </div>
        )}
      </div>
      
      {response && !streaming && (
        <div className="feedback-section">
          <h4>Response Quality Feedback</h4>
          
          {submittedFeedback ? (
            <div className="feedback-submitted">
              Thank you for your feedback!
            </div>
          ) : (
            <>
              <div className="quality-selector">
                <span className="quality-label">Rate the response quality:</span>
                <div className="quality-options">
                  <label className={`quality-option ${quality === 'poor' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quality"
                      value="poor"
                      checked={quality === 'poor'}
                      onChange={() => setQuality('poor')}
                    />
                    <span>Poor</span>
                  </label>
                  <label className={`quality-option ${quality === 'average' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quality"
                      value="average"
                      checked={quality === 'average'}
                      onChange={() => setQuality('average')}
                    />
                    <span>Average</span>
                  </label>
                  <label className={`quality-option ${quality === 'good' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quality"
                      value="good"
                      checked={quality === 'good'}
                      onChange={() => setQuality('good')}
                    />
                    <span>Good</span>
                  </label>
                  <label className={`quality-option ${quality === 'excellent' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quality"
                      value="excellent"
                      checked={quality === 'excellent'}
                      onChange={() => setQuality('excellent')}
                    />
                    <span>Excellent</span>
                  </label>
                </div>
              </div>
              
              <div className="feedback-comments">
                <label htmlFor="feedback-input">Additional Comments (Optional):</label>
                <textarea
                  id="feedback-input"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share any specific feedback about this response..."
                  rows={3}
                />
              </div>
              
              <button
                className="submit-feedback-button"
                onClick={handleSubmitFeedback}
                disabled={!quality}
              >
                Submit Feedback
              </button>
            </>
          )}
        </div>
      )}
      
      <div className="provider-info">
        <div className="provider-details">
          <span className="provider-name">
            {formatProviderName(provider)} / {getModelDisplayName(model)}
          </span>
          {!validProviders[provider] && (
            <span className="missing-key-warning">
              No valid API key. Please add a key in the API Keys tab.
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        .response-streaming-ui {
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
        
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .provider-model-selection {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .provider-selector, .model-selector {
          flex: 1;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .select-wrapper {
          position: relative;
        }
        
        .select-wrapper::after {
          content: "▼";
          font-size: 0.8em;
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }
        
        select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          appearance: none;
          background: white;
          font-size: 1rem;
        }
        
        select:disabled {
          background: #e9ecef;
          cursor: not-allowed;
        }
        
        .prompt-container {
          margin-bottom: 15px;
        }
        
        textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem;
          resize: vertical;
          font-family: inherit;
        }
        
        .action-buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .send-button, .cancel-button, .submit-feedback-button {
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .send-button {
          background: #3498db;
          color: white;
        }
        
        .send-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .send-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .cancel-button {
          background: #e74c3c;
          color: white;
        }
        
        .cancel-button:hover {
          background: #c0392b;
        }
        
        .submit-feedback-button {
          background: #2ecc71;
          color: white;
        }
        
        .submit-feedback-button:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .submit-feedback-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .response-container {
          margin-bottom: 20px;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .response-header h4 {
          margin: 0;
          color: #2c3e50;
        }
        
        .streaming-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .typing-animation {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        
        .typing-animation span {
          display: inline-block;
          width: 4px;
          height: 4px;
          background-color: #3498db;
          border-radius: 50%;
          animation: typing-dot 1.4s infinite ease-in-out both;
        }
        
        .typing-animation span:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .typing-animation span:nth-child(2) {
          animation-delay: -0.16s;
        }
        
        @keyframes typing-dot {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
        
        .typing-speed {
          font-size: 0.85rem;
          color: #6c757d;
        }
        
        .response-content {
          padding: 15px;
          min-height: 200px;
          max-height: 400px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.5;
        }
        
        .empty-response {
          color: #6c757d;
          font-style: italic;
          text-align: center;
          margin-top: 60px;
        }
        
        .token-info {
          display: flex;
          justify-content: space-between;
          padding: 8px 15px;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
          font-size: 0.85rem;
          color: #6c757d;
        }
        
        .feedback-section {
          margin-bottom: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .feedback-section h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
        }
        
        .quality-selector {
          margin-bottom: 15px;
        }
        
        .quality-label {
          display: block;
          margin-bottom: 10px;
          font-weight: 500;
        }
        
        .quality-options {
          display: flex;
          gap: 10px;
        }
        
        .quality-option {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .quality-option.selected {
          border-color: #3498db;
          background: #ebf5fd;
        }
        
        .quality-option input {
          margin-right: 5px;
        }
        
        .feedback-comments {
          margin-bottom: 15px;
        }
        
        .feedback-submitted {
          text-align: center;
          padding: 15px;
          background: #d4edda;
          color: #155724;
          border-radius: 4px;
          font-weight: 500;
        }
        
        .provider-info {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
        }
        
        .provider-details {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .provider-name {
          color: #6c757d;
          font-size: 0.9rem;
        }
        
        .missing-key-warning {
          color: #e74c3c;
          font-size: 0.9rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default ResponseStreamingUI;

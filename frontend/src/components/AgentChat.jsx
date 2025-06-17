import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { agentService } from '../services';
import DOMPurify from 'dompurify'; // We'll need to install this package

/**
 * Agent Chat Component
 * Provides interface for chatting with Lexxi and Bruce agents
 */
const AgentChat = ({ userId }) => {
  const [selectedAgent, setSelectedAgent] = useState('Lexxi');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Error message handler
  const handleServiceError = useCallback((error, actionType) => {
    console.error(`Error ${actionType}:`, error);
    
    // Check if it's a backend connection issue
    let errorMessage = 'Sorry, I encountered an error processing your request.';
    if (error.message && error.message.includes('Electron API not available')) {
      errorMessage = 'Unable to connect to the backend service. Please check your application settings.';
    }
    
    setMessages(prev => [
      ...prev,
      {
        text: errorMessage,
        sender: 'system',
        timestamp: new Date(),
        isError: true
      }
    ]);
  }, []);

  // Start conversation with selected agent
  const startConversation = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Verify service availability
      if (!agentService) {
        throw new Error('Agent service is not available');
      }
      
      const result = await agentService.startConversation(
        userId,
        selectedAgent,
        'Hello, I need assistance'
      );
      
      // Validate response
      if (!result || !result.conversationId) {
        throw new Error('Invalid response from agent service');
      }
      
      setConversationId(result.conversationId);
      setMessages([
        {
          text: `Hello, I'm ${selectedAgent}. How can I assist you today?`,
          sender: selectedAgent,
          timestamp: new Date()
        }
      ]);
    } catch (error) {
      handleServiceError(error, 'starting conversation');
      setMessages([
        {
          text: 'Sorry, I was unable to connect. Please try again later.',
          sender: 'system',
          timestamp: new Date(),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedAgent, handleServiceError]);

  // Change the selected agent
  const handleAgentChange = (agent) => {
    setSelectedAgent(agent);
    setMessages([]);
    setConversationId(null);
    startConversation();
  };

  // Validate user input
  const validateInput = useCallback((text) => {
    // Check for blank or very short messages
    if (!text || text.trim().length < 2) {
      return false;
    }
    
    // Check for maximum length
    if (text.length > 500) {
      return false;
    }
    
    return true;
  }, []);

  // Send a message to the agent
  const handleSendMessage = async () => {
    // Validate input
    if (!validateInput(input) || isLoading) {
      if (input.length > 500) {
        alert('Your message is too long. Please limit to 500 characters.');
      }
      return;
    }

    // Sanitize user input for display
    const sanitizedInput = DOMPurify.sanitize(input);
    
    const userMessage = {
      text: sanitizedInput,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Verify service availability
      if (!agentService) {
        throw new Error('Agent service is not available');
      }
      
      let response;
      if (conversationId) {
        response = await agentService.getResponse(conversationId, sanitizedInput);
      } else {
        response = await agentService.processMessage(userId, sanitizedInput, { agent: selectedAgent });
      }

      // Validate and sanitize response
      if (!response) {
        throw new Error('Empty response from agent');
      }
      
      const sanitizedResponse = DOMPurify.sanitize(response);
      
      setMessages((prev) => [
        ...prev,
        {
          text: sanitizedResponse,
          sender: selectedAgent,
          timestamp: new Date()
        }
      ]);
    } catch (error) {
      handleServiceError(error, 'getting response');
    } finally {
      setIsLoading(false);
    }
  };

  // Start conversation when component mounts
  useEffect(() => {
    startConversation();
  }, [startConversation]);

  return (
    <div className="agent-chat">
      <div className="agent-selector">
        <button
          className={`agent-button ${selectedAgent === 'Lexxi' ? 'selected' : ''}`}
          onClick={() => handleAgentChange('Lexxi')}
        >
          Chat with Lexxi
        </button>
        <button
          className={`agent-button ${selectedAgent === 'Bruce' ? 'selected' : ''}`}
          onClick={() => handleAgentChange('Bruce')}
        >
          Chat with Bruce
        </button>
      </div>

      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${
              message.sender === 'user' 
                ? 'user-message' 
                : message.isError 
                  ? 'error-message' 
                  : 'agent-message'
            }`}
          >
            <div className="message-header">
              <span className="sender">{message.sender === 'user' ? 'You' : message.sender}</span>
              <span className="timestamp">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div 
              className="message-content"
              // Using dangerouslySetInnerHTML with sanitized content
              dangerouslySetInnerHTML={{ __html: message.text }}
            />
          </div>
        ))}
        {isLoading && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button onClick={handleSendMessage} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      <style jsx>{`
        .agent-chat {
          display: flex;
          flex-direction: column;
          height: 500px;
          border: 1px solid #ccc;
          border-radius: 8px;
          overflow: hidden;
        }

        .agent-selector {
          display: flex;
          background: #f5f5f5;
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }

        .agent-button {
          flex: 1;
          padding: 8px;
          border: none;
          background: none;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .agent-button.selected {
          background: #e0e0e0;
          border-radius: 4px;
          color: #2c3e50;
          font-weight: 600;
        }

        .messages-container {
          flex: 1;
          padding: 15px;
          overflow-y: auto;
          background: #f9f9f9;
        }

        .message {
          margin-bottom: 15px;
          max-width: 80%;
          padding: 10px 15px;
          border-radius: 8px;
          position: relative;
        }

        .user-message {
          background: #dcf8c6;
          margin-left: auto;
        }

        .agent-message {
          background: #fff;
          border: 1px solid #e0e0e0;
          margin-right: auto;
        }
        
        .error-message {
          background: #ffebee;
          border: 1px solid #ffcdd2;
          margin-right: auto;
          color: #c62828;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 0.8rem;
          color: #666;
        }

        .sender {
          font-weight: 600;
        }

        .timestamp {
          font-size: 0.7rem;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
        }

        .typing-indicator span {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-right: 5px;
          background: #666;
          border-radius: 50%;
          animation: typing 1.4s infinite both;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
        }

        .input-area {
          display: flex;
          padding: 10px;
          border-top: 1px solid #ddd;
          background: #fff;
        }

        input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-right: 10px;
        }

        button {
          padding: 10px 15px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }

        button:hover {
          background: #2980b9;
        }

        button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default AgentChat;

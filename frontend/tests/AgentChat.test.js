import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgentChat } from '../src/components';
import { agentService } from '../src/services';

// Mock the agent service
jest.mock('../src/services', () => ({
  agentService: {
    startConversation: jest.fn(),
    getResponse: jest.fn(),
    processMessage: jest.fn()
  }
}));

describe('AgentChat Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    agentService.startConversation.mockResolvedValue({
      conversationId: 'test-conversation-id'
    });
    
    agentService.getResponse.mockResolvedValue('This is a test response from the agent.');
    agentService.processMessage.mockResolvedValue('This is a test response from the agent.');
  });

  test('renders the component correctly', async () => {
    render(<AgentChat userId="test-user" />);
    
    // Check for initial elements
    expect(screen.getByText(/Chat with Lexxi/i)).toBeInTheDocument();
    expect(screen.getByText(/Chat with Bruce/i)).toBeInTheDocument();
    
    // Wait for initial conversation to start
    await waitFor(() => {
      expect(agentService.startConversation).toHaveBeenCalledWith(
        'test-user',
        'Lexxi',
        'Hello, I need assistance'
      );
    });
  });

  test('allows switching between agents', async () => {
    render(<AgentChat userId="test-user" />);
    
    // Wait for initial conversation
    await waitFor(() => {
      expect(agentService.startConversation).toHaveBeenCalled();
    });
    
    // Switch to Bruce
    fireEvent.click(screen.getByText(/Chat with Bruce/i));
    
    // Check that a new conversation is started with Bruce
    await waitFor(() => {
      expect(agentService.startConversation).toHaveBeenCalledWith(
        'test-user',
        'Bruce',
        'Hello, I need assistance'
      );
    });
  });

  test('allows sending messages', async () => {
    render(<AgentChat userId="test-user" />);
    
    // Wait for initial conversation
    await waitFor(() => {
      expect(agentService.startConversation).toHaveBeenCalled();
    });
    
    // Type a message
    const inputField = screen.getByPlaceholderText(/Type your message/i);
    fireEvent.change(inputField, { target: { value: 'Hello agent' } });
    
    // Send the message
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    // Check that the message was sent
    await waitFor(() => {
      expect(agentService.getResponse).toHaveBeenCalledWith(
        'test-conversation-id',
        'Hello agent'
      );
    });
    
    // Check that the response is displayed
    await waitFor(() => {
      expect(screen.getByText('This is a test response from the agent.')).toBeInTheDocument();
    });
  });

  test('handles errors gracefully', async () => {
    // Mock an error for this test
    agentService.startConversation.mockRejectedValue(new Error('Connection error'));
    
    render(<AgentChat userId="test-user" />);
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/Sorry, I was unable to connect/i)).toBeInTheDocument();
    });
  });
});

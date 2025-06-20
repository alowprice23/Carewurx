import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AgentChat from '../AgentChat'; // Adjust path as necessary
import { agentService } from '../../services'; // Adjust path
import DOMPurify from 'dompurify';

// Mock agentService
jest.mock('../../services', () => ({
  agentService: {
    startConversation: jest.fn(),
    getResponse: jest.fn(),
    processMessage: jest.fn(), // Assuming processMessage is used if no conversationId
  },
}));

// Mock DOMPurify
jest.mock('dompurify', () => ({
  sanitize: jest.fn((html) => html), // Simple pass-through for testing
}));

describe('AgentChat Component', () => {
  const mockUserId = 'test-user-123';
  const initialLexxiMessage = "Hello, I'm Lexxi. How can I assist you today?";
  const initialBruceMessage = "Hello, I'm Bruce. How can I assist you today?";

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    agentService.startConversation.mockImplementation(async (userId, agentName) => {
      return {
        conversationId: `${agentName.toLowerCase()}-conv-id`,
        initialMessage: `Hello, I'm ${agentName}. How can I assist you today?`, // This might not be used by component
      };
    });
    agentService.getResponse.mockResolvedValue('Mocked agent response.');
    agentService.processMessage.mockResolvedValue({ text: 'Mocked agent response via processMessage.'});
  });

  test('renders initial state with Lexxi selected and Lexxi initial message', async () => {
    render(<AgentChat userId={mockUserId} />);

    expect(screen.getByText('Chat with Lexxi')).toHaveClass('selected');
    expect(screen.getByText('Chat with Bruce')).not.toHaveClass('selected');

    // Wait for the initial message from Lexxi (due to useEffect calling startConversation)
    await waitFor(() => {
      expect(screen.getByText(initialLexxiMessage)).toBeInTheDocument();
    });
    expect(agentService.startConversation).toHaveBeenCalledWith(mockUserId, 'Lexxi', expect.any(String));
  });

  test('switches to Bruce and loads initial Bruce message', async () => {
    render(<AgentChat userId={mockUserId} />);

    // Wait for Lexxi's initial setup
    await waitFor(() => expect(agentService.startConversation).toHaveBeenCalledWith(mockUserId, 'Lexxi', expect.any(String)));
    agentService.startConversation.mockClear(); // Clear calls from initial load

    fireEvent.click(screen.getByText('Chat with Bruce'));

    expect(screen.getByText('Chat with Bruce')).toHaveClass('selected');
    expect(screen.getByText('Chat with Lexxi')).not.toHaveClass('selected');

    await waitFor(() => {
      expect(agentService.startConversation).toHaveBeenCalledWith(mockUserId, 'Bruce', expect.any(String));
    });
    await waitFor(() => {
      expect(screen.getByText(initialBruceMessage)).toBeInTheDocument();
    });
  });

  test('sends a message and displays user/agent responses when conversationId exists', async () => {
    render(<AgentChat userId={mockUserId} />);
    await waitFor(() => expect(screen.getByText(initialLexxiMessage)).toBeInTheDocument()); // Initial load

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Hello Lexxi' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Hello Lexxi')).toBeInTheDocument(); // User message
    });
    expect(agentService.getResponse).toHaveBeenCalledWith('lexxi-conv-id', 'Hello Lexxi');
    await waitFor(() => {
      expect(screen.getByText('Mocked agent response.')).toBeInTheDocument(); // Agent response
    });
    expect(input.value).toBe(''); // Input cleared
  });

  test('sends a message using processMessage if conversationId does not exist (e.g., after agent switch error)', async () => {
    // Simulate startConversation failing to set a conversationId initially for Lexxi
    agentService.startConversation.mockImplementationOnce(async (userId, agentName) => {
       if (agentName === 'Lexxi') {
        // Simulate Lexxi failing to provide conversationId but still providing initial message
         setMessages([{ text: initialLexxiMessage, sender: 'Lexxi', timestamp: new Date() }]);
         return {}; // No conversationId
       }
       // Bruce works fine
       return { conversationId: 'bruce-conv-id', initialMessage: initialBruceMessage };
    });

    render(<AgentChat userId={mockUserId} />);
    // Initial message from Lexxi might be set manually by the component if startConversation fails
    // For this test, let's assume it might show an error or a generic greeting. We'll focus on sending.

    // Forcing a state where conversationId is null for Lexxi
    // This requires more direct state manipulation or a more complex scenario setup.
    // Simpler: Assume Lexxi is selected, conversationId is null.
    // The component's internal `conversationId` state would be null.

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Hello Lexxi (no convId)' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Hello Lexxi (no convId)')).toBeInTheDocument();
    });
    // Because conversationId is null (simulated), processMessage should be called
    expect(agentService.processMessage).toHaveBeenCalledWith(mockUserId, 'Hello Lexxi (no convId)', { agent: 'Lexxi' });
    await waitFor(() => {
      expect(screen.getByText('Mocked agent response via processMessage.')).toBeInTheDocument();
    });
  });


  test('shows typing indicator when isLoading is true', async () => {
    agentService.getResponse.mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('Slow response'), 100));
    });
    render(<AgentChat userId={mockUserId} />);
    await waitFor(() => expect(screen.getByText(initialLexxiMessage)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'Test loading' } });
    fireEvent.click(screen.getByText('Send'));

    expect(screen.getByText('Sending...')).toBeInTheDocument(); // Button text changes
    expect(screen.getByRole('status', { name: /typing/i })).toBeInTheDocument(); // Assuming typing indicator has role status and accessible name

    await waitFor(() => expect(screen.getByText('Slow response')).toBeInTheDocument());
    expect(screen.queryByRole('status', { name: /typing/i })).not.toBeInTheDocument();
  });

  test('handles error when starting conversation', async () => {
    agentService.startConversation.mockRejectedValueOnce(new Error('Connection failed'));
    render(<AgentChat userId={mockUserId} />);
    await waitFor(() => {
      expect(screen.getByText('Sorry, I was unable to connect. Please try again later.')).toBeInTheDocument();
    });
  });

  test('handles error when sending message', async () => {
    agentService.getResponse.mockRejectedValueOnce(new Error('Send failed'));
    render(<AgentChat userId={mockUserId} />);
    await waitFor(() => expect(screen.getByText(initialLexxiMessage)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'Test error send' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Sorry, I encountered an error processing your request.')).toBeInTheDocument();
    });
  });

  test('handles "Electron API not available" error specifically', async () => {
    agentService.getResponse.mockRejectedValueOnce(new Error('Electron API not available - simulated'));
    render(<AgentChat userId={mockUserId} />);
    await waitFor(() => expect(screen.getByText(initialLexxiMessage)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'Test API error' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Unable to connect to the backend service. Please check your application settings.')).toBeInTheDocument();
    });
  });

  test('sanitizes user input and agent response using DOMPurify', async () => {
    const maliciousInput = '<img src=x onerror=alert(1)>Hello';
    const sanitizedInputForDisplay = '&lt;img src=x onerror=alert(1)&gt;Hello'; // How it might look after basic sanitization for display
    const agentResponse = '<script>doEvil()</script>Agent says hi';
    const sanitizedAgentResponse = '&lt;script&gt;doEvil()&lt;/script&gt;Agent says hi';

    DOMPurify.sanitize.mockImplementation(html => html.replace(/</g, '&lt;').replace(/>/g, '&gt;')); // Basic mock for test
    agentService.getResponse.mockResolvedValue(agentResponse);

    render(<AgentChat userId={mockUserId} />);
    await waitFor(() => expect(screen.getByText(initialLexxiMessage)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: maliciousInput } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      // Check that DOMPurify was called for user input and agent response
      expect(DOMPurify.sanitize).toHaveBeenCalledWith(maliciousInput);
      expect(DOMPurify.sanitize).toHaveBeenCalledWith(agentResponse);
      // Check that the displayed text is the sanitized version
      expect(screen.getByText(sanitizedInputForDisplay, { exact: false })).toBeInTheDocument();
      expect(screen.getByText(sanitizedAgentResponse, { exact: false })).toBeInTheDocument();
    });
  });

  test('prevents sending empty or too short messages', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<AgentChat userId={mockUserId} />);

    fireEvent.click(screen.getByText('Send')); // Empty message
    expect(agentService.getResponse).not.toHaveBeenCalled();
    expect(agentService.processMessage).not.toHaveBeenCalled();
    // Alert is not directly testable for its message without more complex setup or different UI for hints.
    // The component's `validateInput` returns false, and `handleSendMessage` should not proceed.

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'H' } }); // Too short
    fireEvent.click(screen.getByText('Send'));
    expect(agentService.getResponse).not.toHaveBeenCalled();
    expect(agentService.processMessage).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  test('prevents sending overly long messages and alerts user', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<AgentChat userId={mockUserId} />);

    const longMessage = 'a'.repeat(501);
    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: longMessage } });
    fireEvent.click(screen.getByText('Send'));

    expect(agentService.getResponse).not.toHaveBeenCalled();
    expect(agentService.processMessage).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Your message is too long. Please limit to 500 characters.');

    alertSpy.mockRestore();
  });

  // Test for scrollToBottom (conceptual, hard to verify scroll position)
  test('scrollToBottom ref should be called when messages change', async () => {
    // This test is more about ensuring the mechanism is in place.
    // A more robust test would involve checking scroll position, which is hard in JSDOM.
    const mockScrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView; // Mock on prototype

    render(<AgentChat userId={mockUserId} />);
    await waitFor(() => expect(screen.getByText(initialLexxiMessage)).toBeInTheDocument()); // Initial message

    fireEvent.change(screen.getByPlaceholderText('Type your message...'), { target: { value: 'New message' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => expect(screen.getByText('New message')).toBeInTheDocument());
    // scrollIntoView is called by the browser based on the ref.
    // We check if it's called after a new message causes a re-render and useEffect to run.
    // The number of calls can be >1 due to initial render + message updates.
    expect(mockScrollIntoView).toHaveBeenCalled();
  });

});

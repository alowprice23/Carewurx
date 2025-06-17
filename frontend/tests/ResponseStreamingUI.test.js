import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResponseStreamingUI } from '../src/components';
import { agentService } from '../src/services';

// Mock the agent service
jest.mock('../src/services', () => ({
  agentService: {
    getApiKeyStatus: jest.fn(),
    streamResponse: jest.fn(),
    submitResponseFeedback: jest.fn()
  }
}));

describe('ResponseStreamingUI Component', () => {
  // Mock data for testing
  const mockApiKeyStatus = {
    groq: { isValid: true, lastValidated: '2025-06-13T12:00:00.000Z' },
    openai: { isValid: false, lastValidated: '2025-06-13T12:30:00.000Z' },
    anthropic: { isValid: false, lastValidated: null }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    agentService.getApiKeyStatus.mockResolvedValue(mockApiKeyStatus);
    
    // For streamResponse, set up a more complex mock to simulate streaming
    agentService.streamResponse.mockImplementation(({ onChunk, prompt }) => {
      // Simulate streaming by calling onChunk multiple times
      onChunk('This is ');
      onChunk('a streamed ');
      onChunk('response.');
      
      // Return the final result
      return Promise.resolve({
        fullResponse: 'This is a streamed response.',
        promptTokens: 10,
        responseTokens: 20,
        totalTokens: 30
      });
    });
    
    agentService.submitResponseFeedback.mockResolvedValue({ success: true });
  });

  test('renders the component correctly', async () => {
    render(<ResponseStreamingUI />);
    
    // Should show correct heading
    expect(screen.getByText(/Response Streaming/i)).toBeInTheDocument();
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Check for provider selectors
    expect(screen.getByText(/Provider/i)).toBeInTheDocument();
    expect(screen.getByText(/Model/i)).toBeInTheDocument();
    
    // Check for prompt area
    expect(screen.getByLabelText(/Prompt/i)).toBeInTheDocument();
    
    // Check for action buttons
    expect(screen.getByRole('button', { name: /Send Prompt/i })).toBeInTheDocument();
    
    // Check for response area
    expect(screen.getByText(/Response will appear here/i)).toBeInTheDocument();
    
    // Check for provider info
    expect(screen.getByText(/Groq/i)).toBeInTheDocument();
  });

  test('checks API key status on load', async () => {
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Since Groq is set to valid in our mock, the send button should be enabled
    const promptInput = screen.getByLabelText(/Prompt/i);
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    
    // Button should be enabled since we have a valid API key for Groq
    expect(screen.getByRole('button', { name: /Send Prompt/i })).not.toBeDisabled();
    
    // Now switch to OpenAI, which has no valid key
    fireEvent.change(screen.getByLabelText(/Provider/i), { target: { value: 'openai' } });
    
    // Should show a warning about missing API key
    expect(screen.getByText(/No valid API key/i)).toBeInTheDocument();
    
    // Send button should be disabled due to invalid API key
    expect(screen.getByRole('button', { name: /Send Prompt/i })).toBeDisabled();
  });

  test('allows sending prompts and streams responses', async () => {
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Enter a prompt
    const promptInput = screen.getByLabelText(/Prompt/i);
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    
    // Click send button
    fireEvent.click(screen.getByRole('button', { name: /Send Prompt/i }));
    
    // Button should change to "Streaming..."
    expect(screen.getByRole('button', { name: /Streaming/i })).toBeInTheDocument();
    
    // Cancel button should appear
    expect(screen.getByRole('button', { name: /Cancel Stream/i })).toBeInTheDocument();
    
    // Wait for streaming to complete
    await waitFor(() => {
      expect(screen.getByText('This is a streamed response.')).toBeInTheDocument();
    });
    
    // Token information should be displayed
    expect(screen.getByText(/Prompt Tokens: 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Response Tokens: 20/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Tokens: 30/i)).toBeInTheDocument();
    
    // Feedback section should appear
    expect(screen.getByText(/Response Quality Feedback/i)).toBeInTheDocument();
    
    // Send button should reappear
    expect(screen.getByRole('button', { name: /Send Prompt/i })).toBeInTheDocument();
  });

  test('displays error when prompt is empty', async () => {
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Click send button without entering a prompt
    fireEvent.click(screen.getByRole('button', { name: /Send Prompt/i }));
    
    // Should show error message
    expect(screen.getByText(/Please enter a prompt/i)).toBeInTheDocument();
    
    // Should not call streamResponse
    expect(agentService.streamResponse).not.toHaveBeenCalled();
  });

  test('allows submitting feedback on responses', async () => {
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Enter a prompt
    const promptInput = screen.getByLabelText(/Prompt/i);
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    
    // Click send button
    fireEvent.click(screen.getByRole('button', { name: /Send Prompt/i }));
    
    // Wait for streaming to complete
    await waitFor(() => {
      expect(screen.getByText('This is a streamed response.')).toBeInTheDocument();
    });
    
    // Quality rating options should be displayed
    expect(screen.getByText(/Rate the response quality/i)).toBeInTheDocument();
    
    // Select a quality rating
    fireEvent.click(screen.getByLabelText(/Good/i));
    
    // Add feedback comment
    const feedbackInput = screen.getByLabelText(/Additional Comments/i);
    fireEvent.change(feedbackInput, { target: { value: 'This is helpful!' } });
    
    // Submit feedback
    fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    // Wait for feedback submission
    await waitFor(() => {
      expect(agentService.submitResponseFeedback).toHaveBeenCalledWith({
        provider: 'groq',
        model: 'llama3-70b-8192',
        prompt: 'Test prompt',
        response: 'This is a streamed response.',
        quality: 'good',
        feedback: 'This is helpful!'
      });
    });
    
    // Thank you message should appear
    expect(screen.getByText(/Thank you for your feedback/i)).toBeInTheDocument();
  });

  test('allows switching between providers and models', async () => {
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Default provider should be Groq
    expect(screen.getByText(/Llama 3 70B/i)).toBeInTheDocument();
    
    // Switch to OpenAI
    fireEvent.change(screen.getByLabelText(/Provider/i), { target: { value: 'openai' } });
    
    // Should now show OpenAI models
    expect(screen.getByText(/GPT-4o/i)).toBeInTheDocument();
    
    // Switch to Anthropic
    fireEvent.change(screen.getByLabelText(/Provider/i), { target: { value: 'anthropic' } });
    
    // Should now show Anthropic models
    expect(screen.getByText(/Claude 3 Opus/i)).toBeInTheDocument();
    
    // Switch back to Groq
    fireEvent.change(screen.getByLabelText(/Provider/i), { target: { value: 'groq' } });
    
    // Change the model
    fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: 'mixtral-8x7b-32768' } });
    
    // Should now show the selected model
    expect(screen.getByText(/Mixtral 8x7B/i)).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    // Mock streamResponse to throw an error
    agentService.streamResponse.mockRejectedValue(new Error('API connection failed'));
    
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Enter a prompt
    const promptInput = screen.getByLabelText(/Prompt/i);
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    
    // Click send button
    fireEvent.click(screen.getByRole('button', { name: /Send Prompt/i }));
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Failed to stream response: API connection failed/i)).toBeInTheDocument();
    });
    
    // Send button should reappear
    expect(screen.getByRole('button', { name: /Send Prompt/i })).toBeInTheDocument();
  });

  test('allows cancelling streaming responses', async () => {
    // Create a mock AbortController to track abort signal
    const mockAbort = jest.fn();
    global.AbortController = jest.fn(() => ({
      signal: 'mock-signal',
      abort: mockAbort
    }));
    
    // Use a more complex mock implementation that doesn't resolve immediately
    agentService.streamResponse.mockImplementation(({ onChunk }) => {
      // Return a promise that never resolves to simulate long-running stream
      return new Promise(() => {
        // Call onChunk once to update the UI
        onChunk('Streaming in progress...');
      });
    });
    
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Enter a prompt
    const promptInput = screen.getByLabelText(/Prompt/i);
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    
    // Click send button
    fireEvent.click(screen.getByRole('button', { name: /Send Prompt/i }));
    
    // Wait for streaming indicator to appear
    await waitFor(() => {
      expect(screen.getByText(/Streaming in progress/i)).toBeInTheDocument();
    });
    
    // Click cancel button
    fireEvent.click(screen.getByRole('button', { name: /Cancel Stream/i }));
    
    // Check that abort was called
    expect(mockAbort).toHaveBeenCalled();
    
    // Send button should reappear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Send Prompt/i })).toBeInTheDocument();
    });
    
    // Clean up mock
    delete global.AbortController;
  });

  test('validates feedback selection before submission', async () => {
    render(<ResponseStreamingUI />);
    
    // Wait for API key status to load
    await waitFor(() => {
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
    });
    
    // Enter a prompt and get a response
    const promptInput = screen.getByLabelText(/Prompt/i);
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Prompt/i }));
    
    // Wait for streaming to complete
    await waitFor(() => {
      expect(screen.getByText('This is a streamed response.')).toBeInTheDocument();
    });
    
    // Try to submit feedback without selecting a quality rating
    fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));
    
    // Should show error message
    expect(screen.getByText(/Please select a quality rating/i)).toBeInTheDocument();
    
    // Should not call submitResponseFeedback
    expect(agentService.submitResponseFeedback).not.toHaveBeenCalled();
  });
});

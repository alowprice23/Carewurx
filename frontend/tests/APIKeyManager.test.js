import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { APIKeyManager } from '../src/components';
import { agentService } from '../src/services';

// Mock the agent service
jest.mock('../src/services', () => ({
  agentService: {
    getApiKeys: jest.fn(),
    getApiKeyStatus: jest.fn(),
    getApiUsageStats: jest.fn(),
    saveApiKey: jest.fn(),
    validateApiKey: jest.fn(),
    deleteApiKey: jest.fn()
  }
}));

describe('APIKeyManager Component', () => {
  // Mock data for testing
  const mockApiKeys = {
    groq: 'groq-api-key-123456',
    openai: 'openai-api-key-abcdef',
    anthropic: ''
  };

  const mockKeyStatus = {
    groq: { isValid: true, lastValidated: '2025-06-13T12:00:00.000Z' },
    openai: { isValid: false, lastValidated: '2025-06-13T12:30:00.000Z' },
    anthropic: { isValid: false, lastValidated: null }
  };

  const mockUsageStats = {
    groq: { requests: 150, tokens: 25000, lastRequest: '2025-06-13T14:30:00.000Z' },
    openai: { requests: 50, tokens: 8000, lastRequest: '2025-06-12T09:45:00.000Z' },
    anthropic: { requests: 0, tokens: 0, lastRequest: null }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    agentService.getApiKeys.mockResolvedValue(mockApiKeys);
    agentService.getApiKeyStatus.mockResolvedValue(mockKeyStatus);
    agentService.getApiUsageStats.mockResolvedValue(mockUsageStats);
    agentService.saveApiKey.mockResolvedValue({ success: true });
    agentService.validateApiKey.mockResolvedValue({ isValid: true });
    agentService.deleteApiKey.mockResolvedValue({ success: true });
  });

  test('renders the component correctly', async () => {
    render(<APIKeyManager />);
    
    // Should show loading state initially
    expect(screen.getByText(/API Key Management/i)).toBeInTheDocument();
    
    // Wait for API data to load
    await waitFor(() => {
      expect(agentService.getApiKeys).toHaveBeenCalled();
      expect(agentService.getApiKeyStatus).toHaveBeenCalled();
      expect(agentService.getApiUsageStats).toHaveBeenCalled();
    });
    
    // Check that provider tabs are displayed
    expect(screen.getByRole('button', { name: /Groq/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OpenAI/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Anthropic/i })).toBeInTheDocument();
    
    // Check for key input field
    expect(screen.getByLabelText(/Groq API Key/i)).toBeInTheDocument();
    
    // Check for action buttons
    expect(screen.getByRole('button', { name: /Save Key/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Validate Key/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Key/i })).toBeInTheDocument();
    
    // Check for status section
    expect(screen.getByText(/Key Status/i)).toBeInTheDocument();
    
    // Check for usage stats section
    expect(screen.getByText(/Usage Statistics/i)).toBeInTheDocument();
    
    // Check for help section
    expect(screen.getByText(/Help/i)).toBeInTheDocument();
  });

  test('loads and displays API keys correctly', async () => {
    render(<APIKeyManager />);
    
    // Wait for API data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Check status displays
    expect(screen.getByText(/Valid/i)).toBeInTheDocument();
    
    // Check usage stats
    const usageValues = screen.getAllByText(/150/i);
    expect(usageValues.length).toBeGreaterThan(0);
  });

  test('allows switching between providers', async () => {
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Click on OpenAI tab
    fireEvent.click(screen.getByRole('button', { name: /OpenAI/i }));
    
    // Should now show OpenAI key
    expect(screen.getByLabelText(/OpenAI API Key/i)).toHaveValue('openai-api-key-abcdef');
    
    // Status should show Invalid
    expect(screen.getByText(/Invalid or Not Validated/i)).toBeInTheDocument();
    
    // Click on Anthropic tab
    fireEvent.click(screen.getByRole('button', { name: /Anthropic/i }));
    
    // Should show empty Anthropic key
    expect(screen.getByLabelText(/Anthropic API Key/i)).toHaveValue('');
    
    // Last validated should show "Never"
    expect(screen.getByText(/Never/i)).toBeInTheDocument();
  });

  test('allows toggling key visibility', async () => {
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Key should be hidden by default (password type)
    const keyInput = screen.getByLabelText(/Groq API Key/i);
    expect(keyInput).toHaveAttribute('type', 'password');
    
    // Click show button
    fireEvent.click(screen.getByRole('button', { name: /Show/i }));
    
    // Key should now be visible (text type)
    expect(keyInput).toHaveAttribute('type', 'text');
    
    // Click hide button
    fireEvent.click(screen.getByRole('button', { name: /Hide/i }));
    
    // Key should be hidden again
    expect(keyInput).toHaveAttribute('type', 'password');
  });

  test('allows saving API key', async () => {
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Change the key value
    fireEvent.change(screen.getByLabelText(/Groq API Key/i), {
      target: { value: 'new-groq-api-key' }
    });
    
    // Click save button
    fireEvent.click(screen.getByRole('button', { name: /Save Key/i }));
    
    // Should call saveApiKey with correct values
    await waitFor(() => {
      expect(agentService.saveApiKey).toHaveBeenCalledWith('groq', 'new-groq-api-key');
    });
    
    // Should show success message
    expect(screen.getByText(/Groq API key saved successfully/i)).toBeInTheDocument();
    
    // Should validate the key after saving
    expect(agentService.validateApiKey).toHaveBeenCalledWith('groq', 'new-groq-api-key');
  });

  test('allows validating API key', async () => {
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Click validate button
    fireEvent.click(screen.getByRole('button', { name: /Validate Key/i }));
    
    // Should call validateApiKey with correct values
    await waitFor(() => {
      expect(agentService.validateApiKey).toHaveBeenCalledWith('groq', 'groq-api-key-123456');
    });
    
    // Should show success message
    expect(screen.getByText(/Groq API key validated successfully/i)).toBeInTheDocument();
  });

  test('allows deleting API key', async () => {
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Click remove button
    fireEvent.click(screen.getByRole('button', { name: /Remove Key/i }));
    
    // Should call deleteApiKey with correct values
    await waitFor(() => {
      expect(agentService.deleteApiKey).toHaveBeenCalledWith('groq');
    });
    
    // Should show success message
    expect(screen.getByText(/Groq API key removed successfully/i)).toBeInTheDocument();
    
    // Input should be cleared
    expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('');
  });

  test('allows refreshing usage statistics', async () => {
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Refresh/i })).not.toBeDisabled();
    });
    
    // Click refresh button
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    
    // Should call getApiUsageStats again
    await waitFor(() => {
      expect(agentService.getApiUsageStats).toHaveBeenCalledTimes(2);
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock API to throw error
    agentService.getApiKeys.mockRejectedValue(new Error('API Error'));
    
    render(<APIKeyManager />);
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to load API keys/i)).toBeInTheDocument();
    });
  });

  test('validates API key field is not empty before saving', async () => {
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Change to Anthropic tab (which has empty key)
    fireEvent.click(screen.getByRole('button', { name: /Anthropic/i }));
    
    // Try to save the empty key
    fireEvent.click(screen.getByRole('button', { name: /Save Key/i }));
    
    // Should show error
    expect(screen.getByText(/Please enter an API key/i)).toBeInTheDocument();
    
    // Should not call saveApiKey
    expect(agentService.saveApiKey).not.toHaveBeenCalled();
  });

  test('handles validation failure', async () => {
    // Mock validation to fail
    agentService.validateApiKey.mockResolvedValue({ 
      isValid: false, 
      message: 'Invalid API key format' 
    });
    
    render(<APIKeyManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Groq API Key/i)).toHaveValue('groq-api-key-123456');
    });
    
    // Click validate button
    fireEvent.click(screen.getByRole('button', { name: /Validate Key/i }));
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Groq API key validation failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Invalid API key format/i)).toBeInTheDocument();
    });
    
    // Status should be updated to invalid
    await waitFor(() => {
      expect(screen.getByText(/Invalid or Not Validated/i)).toBeInTheDocument();
    });
  });
});

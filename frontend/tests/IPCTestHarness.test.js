import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IPCTestHarness } from '../src/components';
import { notificationService } from '../src/services';

// Mock the notification service
jest.mock('../src/services', () => ({
  notificationService: {
    showNotification: jest.fn()
  }
}));

describe('IPCTestHarness Component', () => {
  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock timer functions
    jest.useFakeTimers();
  });

  // Restore timers after tests
  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders component with loading state', () => {
    render(<IPCTestHarness />);
    
    // Check for loading indicator
    expect(screen.getByText('Loading available endpoints...')).toBeInTheDocument();
    
    // Check for component title
    expect(screen.getByText('IPC Test Harness')).toBeInTheDocument();
  });

  test('renders endpoints after loading', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Check for endpoint selector
    expect(screen.getByLabelText('Endpoint:')).toBeInTheDocument();
    expect(screen.getByText('-- Select an endpoint --')).toBeInTheDocument();
    
    // Check if the endpoints are loaded in the selector
    const endpointSelect = screen.getByRole('combobox');
    expect(endpointSelect).toBeInTheDocument();
    
    // There should be multiple endpoints in the dropdown
    expect(endpointSelect.querySelectorAll('option').length).toBeGreaterThan(1);
  });

  test('selects an endpoint and shows parameters', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete and endpoints to be available
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Select an endpoint
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'getClients' } });
    
    // Check if the endpoint description is shown
    expect(screen.getByText('Get all clients or a specific client')).toBeInTheDocument();
    
    // Check if parameters section is shown
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    
    // Check if specific parameters for the selected endpoint are shown
    expect(screen.getByText('clientId:')).toBeInTheDocument();
    expect(screen.getByText('includeInactive:')).toBeInTheDocument();
  });

  test('handles parameter input changes', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Select an endpoint with text input
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'getClients' } });
    
    // Find the clientId input
    const clientIdInput = screen.getByLabelText('clientId:').nextElementSibling.querySelector('input');
    
    // Change the input value
    fireEvent.change(clientIdInput, { target: { value: 'client-123' } });
    
    // Check if the input value was updated
    expect(clientIdInput.value).toBe('client-123');
    
    // Find the includeInactive checkbox
    const includeInactiveCheckbox = screen.getByLabelText('includeInactive:').nextElementSibling.querySelector('input');
    
    // Check the checkbox
    fireEvent.click(includeInactiveCheckbox);
    
    // Check if the checkbox was checked
    expect(includeInactiveCheckbox).toBeChecked();
  });

  test('handles form submission with valid parameters', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Select an endpoint
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'getClients' } });
    
    // Click execute button
    fireEvent.click(screen.getByText('Execute IPC Call'));
    
    // Check if loading state is shown
    expect(screen.getByText('Executing...')).toBeInTheDocument();
    
    // Fast-forward timer to trigger response simulation
    jest.advanceTimersByTime(1100);
    
    // Check if notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'IPC Call Successful'
      })
    );
    
    // Check if response tab is now active
    expect(screen.getByText('Response').closest('button')).toHaveClass('active');
    
    // Check if the response is displayed
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  test('validates required parameters before submission', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Select an endpoint with required parameters
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'createSchedule' } });
    
    // Try to submit without filling required fields
    fireEvent.click(screen.getByText('Execute IPC Call'));
    
    // Check if validation error is shown
    expect(screen.getByText(/Missing required parameters/)).toBeInTheDocument();
    
    // Fill in the required parameters
    const clientIdInput = screen.getByLabelText(/clientId:/i).nextElementSibling.querySelector('input');
    fireEvent.change(clientIdInput, { target: { value: 'client-123' } });
    
    const caregiverIdInput = screen.getByLabelText(/caregiverId:/i).nextElementSibling.querySelector('input');
    fireEvent.change(caregiverIdInput, { target: { value: 'caregiver-123' } });
    
    const startTimeInput = screen.getByLabelText(/startTime:/i).nextElementSibling.querySelector('input');
    fireEvent.change(startTimeInput, { target: { value: '2025-06-15T09:00' } });
    
    const endTimeInput = screen.getByLabelText(/endTime:/i).nextElementSibling.querySelector('input');
    fireEvent.change(endTimeInput, { target: { value: '2025-06-15T11:00' } });
    
    // Submit again with required fields filled
    fireEvent.click(screen.getByText('Execute IPC Call'));
    
    // No validation error should be shown now
    expect(screen.queryByText(/Missing required parameters/)).not.toBeInTheDocument();
    
    // Fast-forward timer to trigger response simulation
    jest.advanceTimersByTime(1100);
    
    // Should switch to response tab automatically
    expect(screen.getByText('Response').closest('button')).toHaveClass('active');
  });

  test('toggles between raw JSON and visualized response', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Select an endpoint
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'getClients' } });
    
    // Execute the call
    fireEvent.click(screen.getByText('Execute IPC Call'));
    
    // Fast-forward timer to trigger response simulation
    jest.advanceTimersByTime(1100);
    
    // Check the visualized response is shown by default
    expect(screen.getByText('Array (2 items)')).toBeInTheDocument();
    
    // Toggle to raw JSON
    fireEvent.click(screen.getByLabelText('Show Raw JSON'));
    
    // Check that raw JSON is now shown
    expect(screen.getByText(/"success": true/)).toBeInTheDocument();
    
    // Toggle back to visualized response
    fireEvent.click(screen.getByLabelText('Show Raw JSON'));
    
    // Check that visualized response is shown again
    expect(screen.getByText('Array (2 items)')).toBeInTheDocument();
  });

  test('maintains a response history', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Execute first call
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'getClients' } });
    fireEvent.click(screen.getByText('Execute IPC Call'));
    jest.advanceTimersByTime(1100);
    
    // Execute second call
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'getCaregivers' } });
    fireEvent.click(screen.getByText('Execute IPC Call'));
    jest.advanceTimersByTime(1100);
    
    // Switch to history tab
    fireEvent.click(screen.getByText('History'));
    
    // Check that history contains both calls
    expect(screen.getByText('Response History')).toBeInTheDocument();
    
    // Both calls should be in the history
    expect(screen.getByText('getClients')).toBeInTheDocument();
    expect(screen.getByText('getCaregivers')).toBeInTheDocument();
    
    // Test clicking on a history item
    fireEvent.click(screen.getByText('getClients').closest('.history-item'));
    
    // Should switch to response tab
    expect(screen.getByText('Response').closest('button')).toHaveClass('active');
    
    // Should show the response for the selected history item
    expect(screen.getByText('getClients')).toBeInTheDocument();
    
    // Test clearing history
    fireEvent.click(screen.getByText('History'));
    fireEvent.click(screen.getByText('Clear History'));
    
    // History should be empty
    expect(screen.getByText('No history yet. Execute IPC calls to see history.')).toBeInTheDocument();
  });

  test('handles array parameters correctly', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Select an endpoint with array parameter
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'validateDatabaseIntegrity' } });
    
    // Find the entityTypes input (array type)
    const entityTypesInput = screen.getByLabelText('entityTypes:').nextElementSibling.querySelector('input');
    
    // Enter comma-separated values
    fireEvent.change(entityTypesInput, { target: { value: 'clients, caregivers, schedules' } });
    
    // Execute the call
    fireEvent.click(screen.getByText('Execute IPC Call'));
    
    // Fast-forward timer to trigger response simulation
    jest.advanceTimersByTime(1100);
    
    // Switch to history tab to verify the parameter was processed as array
    fireEvent.click(screen.getByText('History'));
    
    // Find the history item and check the parameter
    const historyItem = screen.getByText('validateDatabaseIntegrity').closest('.history-item');
    const paramValue = historyItem.querySelector('.param-value');
    
    // The parameter should have been processed as an array
    expect(paramValue.textContent).toBe('clients, caregivers, schedules');
  });

  test('handles boolean parameters correctly', async () => {
    render(<IPCTestHarness />);
    
    // Fast-forward timer to trigger the endpoints loading
    jest.advanceTimersByTime(600);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading available endpoints...')).not.toBeInTheDocument();
    });
    
    // Select an endpoint with boolean parameter
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'getSystemStatus' } });
    
    // Find the boolean inputs
    const processStatsCheckbox = screen.getByLabelText('includeProcessStats:').nextElementSibling.querySelector('input');
    const memoryUsageCheckbox = screen.getByLabelText('includeMemoryUsage:').nextElementSibling.querySelector('input');
    
    // Check one checkbox
    fireEvent.click(processStatsCheckbox);
    
    // Execute the call
    fireEvent.click(screen.getByText('Execute IPC Call'));
    
    // Fast-forward timer to trigger response simulation
    jest.advanceTimersByTime(1100);
    
    // Check if the response includes process stats but not memory usage
    const response = screen.getByText('cpu:').closest('.property');
    expect(response).toBeInTheDocument();
    
    // Memory usage should not be in the response
    expect(screen.queryByText('total:')).not.toBeInTheDocument();
  });
});

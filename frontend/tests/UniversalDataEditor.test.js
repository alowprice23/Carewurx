import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UniversalDataEditor } from '../src/components';
import { schedulerService, notificationService } from '../src/services';

// Mock the scheduler and notification services
jest.mock('../src/services', () => ({
  schedulerService: {
    getAllClients: jest.fn(),
    getAllCaregivers: jest.fn(),
    getAllSchedules: jest.fn(),
    getClient: jest.fn(),
    getCaregiver: jest.fn(),
    getSchedule: jest.fn(),
    updateClient: jest.fn(),
    updateCaregiver: jest.fn(),
    updateSchedule: jest.fn(),
    createClient: jest.fn(),
    createCaregiver: jest.fn(),
    createSchedule: jest.fn()
  },
  notificationService: {
    showNotification: jest.fn()
  }
}));

describe('UniversalDataEditor Component', () => {
  // Mock data for testing
  const mockClients = [
    { id: 'client1', name: 'John Doe', email: 'john@example.com', phone: '1234567890', type: 'client' },
    { id: 'client2', name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321', type: 'client' }
  ];
  
  const mockCaregivers = [
    { id: 'caregiver1', name: 'Mark Johnson', email: 'mark@example.com', phone: '5551234567', type: 'caregiver' },
    { id: 'caregiver2', name: 'Sarah Williams', email: 'sarah@example.com', phone: '5559876543', type: 'caregiver' }
  ];
  
  const mockSchedules = [
    { 
      id: 'schedule1', 
      clientId: 'client1', 
      caregiverId: 'caregiver1', 
      date: '2025-06-15', 
      startTime: '09:00', 
      endTime: '12:00',
      status: 'scheduled',
      type: 'schedule'
    },
    { 
      id: 'schedule2', 
      clientId: 'client2', 
      caregiverId: 'caregiver2', 
      date: '2025-06-16', 
      startTime: '14:00', 
      endTime: '17:00',
      status: 'confirmed',
      type: 'schedule'
    }
  ];
  
  const mockClientDetail = {
    id: 'client1', 
    name: 'John Doe', 
    email: 'john@example.com', 
    phone: '1234567890',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    notes: 'Some notes about John'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    schedulerService.getAllClients.mockResolvedValue(mockClients);
    schedulerService.getAllCaregivers.mockResolvedValue(mockCaregivers);
    schedulerService.getAllSchedules.mockResolvedValue(mockSchedules);
    schedulerService.getClient.mockResolvedValue(mockClientDetail);
    schedulerService.getCaregiver.mockResolvedValue(mockCaregivers[0]);
    schedulerService.getSchedule.mockResolvedValue(mockSchedules[0]);
    schedulerService.updateClient.mockResolvedValue({ success: true });
    schedulerService.updateCaregiver.mockResolvedValue({ success: true });
    schedulerService.updateSchedule.mockResolvedValue({ success: true });
    schedulerService.createClient.mockResolvedValue({ id: 'newClient', success: true });
    schedulerService.createCaregiver.mockResolvedValue({ id: 'newCaregiver', success: true });
    schedulerService.createSchedule.mockResolvedValue({ id: 'newSchedule', success: true });
  });

  test('renders the component correctly', async () => {
    render(<UniversalDataEditor />);
    
    // Check for main components
    expect(screen.getByText(/Universal Data Editor/i)).toBeInTheDocument();
    
    // Check for entity type tabs
    expect(screen.getByText(/Clients/i)).toBeInTheDocument();
    expect(screen.getByText(/Caregivers/i)).toBeInTheDocument();
    expect(screen.getByText(/Schedules/i)).toBeInTheDocument();
    
    // Wait for client data to load (default entity type)
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Check client list is populated
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
    
    // Check for New button
    expect(screen.getByText(/\+ New client/i)).toBeInTheDocument();
    
    // Check form is initialized for new client by default
    expect(screen.getByText(/New Client/i)).toBeInTheDocument();
  });

  test('allows switching between entity types', async () => {
    render(<UniversalDataEditor />);
    
    // Wait for client data to load (default entity type)
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Switch to caregivers
    fireEvent.click(screen.getByText(/Caregivers/i));
    
    // Wait for caregiver data to load
    await waitFor(() => {
      expect(schedulerService.getAllCaregivers).toHaveBeenCalled();
    });
    
    // Check caregiver list is populated
    expect(screen.getByText(/Mark Johnson/i)).toBeInTheDocument();
    expect(screen.getByText(/Sarah Williams/i)).toBeInTheDocument();
    
    // Should show New Caregiver form
    expect(screen.getByText(/New Caregiver/i)).toBeInTheDocument();
    
    // Switch to schedules
    fireEvent.click(screen.getByText(/Schedules/i));
    
    // Wait for schedule data to load
    await waitFor(() => {
      expect(schedulerService.getAllSchedules).toHaveBeenCalled();
    });
    
    // Check schedule list is populated
    expect(screen.getByText(/2025-06-15 • scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/2025-06-16 • confirmed/i)).toBeInTheDocument();
    
    // Should show New Schedule form
    expect(screen.getByText(/New Schedule/i)).toBeInTheDocument();
    
    // Switch back to clients
    fireEvent.click(screen.getByText(/Clients/i));
    
    // Should show New Client form again
    await waitFor(() => {
      expect(screen.getByText(/New Client/i)).toBeInTheDocument();
    });
  });

  test('loads entity details when selected', async () => {
    render(<UniversalDataEditor />);
    
    // Wait for client data to load (default entity type)
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Click on a client in the list
    fireEvent.click(screen.getByText(/John Doe/i));
    
    // Wait for client details to load
    await waitFor(() => {
      expect(schedulerService.getClient).toHaveBeenCalledWith('client1');
    });
    
    // Should show Edit Client form now
    expect(screen.getByText(/Edit Client/i)).toBeInTheDocument();
    
    // Form fields should be populated
    expect(screen.getByLabelText(/Name/i)).toHaveValue('John Doe');
    expect(screen.getByLabelText(/Email/i)).toHaveValue('john@example.com');
    expect(screen.getByLabelText(/Phone/i)).toHaveValue('1234567890');
    expect(screen.getByLabelText(/Address/i)).toHaveValue('123 Main St');
  });

  test('validates form fields', async () => {
    render(<UniversalDataEditor />);
    
    // Wait for client data to load (default entity type)
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Enter invalid email
    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    // Check for validation error
    expect(await screen.findByText(/Please enter a valid email address/i)).toBeInTheDocument();
    
    // Correct the email
    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
    
    // Error message should be gone
    await waitFor(() => {
      expect(screen.queryByText(/Please enter a valid email address/i)).not.toBeInTheDocument();
    });
    
    // Submit with missing required fields
    fireEvent.click(screen.getByText(/Save/i));
    
    // Check for validation errors on required fields
    await waitFor(() => {
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Validation Error'
        })
      );
    });
  });

  test('creates a new entity', async () => {
    render(<UniversalDataEditor />);
    
    // Wait for client data to load (default entity type)
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'New Test Client' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '5555555555' } });
    fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '456 Test St' } });
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Test City' } });
    fireEvent.change(screen.getByLabelText(/State/i), { target: { value: 'TS' } });
    fireEvent.change(screen.getByLabelText(/ZIP Code/i), { target: { value: '12345' } });
    
    // Submit the form
    fireEvent.click(screen.getByText(/Save/i));
    
    // Wait for creation API call
    await waitFor(() => {
      expect(schedulerService.createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Test Client',
          email: 'test@example.com',
          phone: '5555555555',
          address: '456 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345'
        })
      );
    });
    
    // Check success message
    expect(screen.getByText(/Data saved successfully/i)).toBeInTheDocument();
    
    // Client list should be refreshed
    expect(schedulerService.getAllClients).toHaveBeenCalledTimes(2);
    
    // Success notification should be shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Data Saved'
      })
    );
  });

  test('updates an existing entity', async () => {
    render(<UniversalDataEditor />);
    
    // Wait for client data to load
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Click on a client in the list
    fireEvent.click(screen.getByText(/John Doe/i));
    
    // Wait for client details to load
    await waitFor(() => {
      expect(schedulerService.getClient).toHaveBeenCalledWith('client1');
    });
    
    // Edit a field
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John Doe Updated' } });
    
    // Submit the form
    fireEvent.click(screen.getByText(/Save/i));
    
    // Wait for update API call
    await waitFor(() => {
      expect(schedulerService.updateClient).toHaveBeenCalledWith(
        'client1',
        expect.objectContaining({
          name: 'John Doe Updated'
        })
      );
    });
    
    // Check success message
    expect(screen.getByText(/Data saved successfully/i)).toBeInTheDocument();
    
    // Success notification should be shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Data Saved'
      })
    );
  });

  test('handles cancel button correctly', async () => {
    render(<UniversalDataEditor />);
    
    // Wait for client data to load
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Click on a client in the list
    fireEvent.click(screen.getByText(/John Doe/i));
    
    // Wait for client details to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Name/i)).toHaveValue('John Doe');
    });
    
    // Edit a field
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'John Doe Changed' } });
    
    // Click cancel button
    fireEvent.click(screen.getByText(/Cancel/i));
    
    // Should reset to new client form
    await waitFor(() => {
      expect(screen.getByText(/New Client/i)).toBeInTheDocument();
    });
    
    // Form should be empty
    expect(screen.getByLabelText(/Name/i)).toHaveValue('');
  });

  test('handles API errors gracefully', async () => {
    // Mock API to throw error
    schedulerService.createClient.mockRejectedValue(new Error('Network error'));
    
    render(<UniversalDataEditor />);
    
    // Wait for client data to load
    await waitFor(() => {
      expect(schedulerService.getAllClients).toHaveBeenCalled();
    });
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Error Test Client' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'error@example.com' } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '1231231234' } });
    fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '123 Error St' } });
    fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Error City' } });
    fireEvent.change(screen.getByLabelText(/State/i), { target: { value: 'ES' } });
    fireEvent.change(screen.getByLabelText(/ZIP Code/i), { target: { value: '54321' } });
    
    // Submit the form
    fireEvent.click(screen.getByText(/Save/i));
    
    // Wait for API error
    await waitFor(() => {
      expect(schedulerService.createClient).toHaveBeenCalled();
    });
    
    // Check error message
    expect(screen.getByText(/Failed to save client data/i)).toBeInTheDocument();
    
    // Error notification should be shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Save Error'
      })
    );
  });
});

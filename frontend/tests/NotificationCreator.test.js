import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationCreator } from '../src/components';
import { notificationService } from '../src/services';

// Mock the notification service
jest.mock('../src/services', () => ({
  notificationService: {
    getAvailableRecipients: jest.fn(),
    createNotification: jest.fn()
  }
}));

describe('NotificationCreator Component', () => {
  // Mock data for testing
  const mockRecipients = [
    { id: 'admin-1', name: 'Admin User', type: 'admin' },
    { id: 'caregiver-1', name: 'Jane Smith', type: 'caregiver' },
    { id: 'caregiver-2', name: 'Mark Johnson', type: 'caregiver' },
    { id: 'client-1', name: 'John Doe', type: 'client' },
    { id: 'client-2', name: 'Alice Johnson', type: 'client' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    notificationService.getAvailableRecipients.mockResolvedValue(mockRecipients);
    notificationService.createNotification.mockResolvedValue({ success: true });
  });

  test('renders the component correctly', async () => {
    render(<NotificationCreator />);
    
    // Should show form with required fields
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notification Type/i)).toBeInTheDocument();
    
    // Should show loading state for recipients
    expect(screen.getByText(/Loading recipients/i)).toBeInTheDocument();
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(notificationService.getAvailableRecipients).toHaveBeenCalled();
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Check for notification type options
    expect(screen.getByText(/Info/i)).toBeInTheDocument();
    expect(screen.getByText(/Urgent/i)).toBeInTheDocument();
    expect(screen.getByText(/Reminder/i)).toBeInTheDocument();
    
    // Check for buttons
    expect(screen.getByText(/Create Notification/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear Form/i)).toBeInTheDocument();
  });

  test('loads and displays recipients', async () => {
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Check for recipient sections
    expect(screen.getByText(/Admins/i)).toBeInTheDocument();
    expect(screen.getByText(/Caregivers/i)).toBeInTheDocument();
    expect(screen.getByText(/Clients/i)).toBeInTheDocument();
    
    // Check for specific recipients
    expect(screen.getByText(/Admin User/i)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Mark Johnson/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice Johnson/i)).toBeInTheDocument();
    
    // Check for select/remove all buttons
    expect(screen.getAllByText(/Select All/i).length).toBe(3);
    expect(screen.getAllByText(/Remove All/i).length).toBe(3);
  });

  test('allows selecting recipients', async () => {
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Check initial state
    expect(screen.getByText(/Selected Recipients \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/No recipients selected/i)).toBeInTheDocument();
    
    // Select a recipient
    const firstRecipientCheckbox = screen.getAllByRole('checkbox')[3]; // First recipient checkbox (after type radio buttons)
    fireEvent.click(firstRecipientCheckbox);
    
    // Check that the recipient is now selected
    expect(screen.queryByText(/No recipients selected/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Selected Recipients \(1\)/i)).toBeInTheDocument();
  });

  test('allows selecting all recipients of a type', async () => {
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Click "Select All" for Caregivers
    const selectAllButtons = screen.getAllByText(/Select All/i);
    fireEvent.click(selectAllButtons[1]); // Caregivers select all button
    
    // Should now have 2 caregivers selected
    expect(screen.getByText(/Selected Recipients \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Mark Johnson/i)).toBeInTheDocument();
  });

  test('allows removing all recipients of a type', async () => {
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // First select all caregivers
    const selectAllButtons = screen.getAllByText(/Select All/i);
    fireEvent.click(selectAllButtons[1]); // Caregivers select all button
    
    // Should now have 2 caregivers selected
    expect(screen.getByText(/Selected Recipients \(2\)/i)).toBeInTheDocument();
    
    // Now remove all caregivers
    const removeAllButtons = screen.getAllByText(/Remove All/i);
    fireEvent.click(removeAllButtons[1]); // Caregivers remove all button
    
    // Should now have 0 recipients selected
    expect(screen.getByText(/Selected Recipients \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/No recipients selected/i)).toBeInTheDocument();
  });

  test('allows toggling scheduled notifications', async () => {
    render(<NotificationCreator />);
    
    // Schedule checkbox should exist but date/time inputs should not be visible initially
    const scheduleCheckbox = screen.getByLabelText(/Schedule this notification for later/i);
    expect(scheduleCheckbox).toBeInTheDocument();
    expect(scheduleCheckbox).not.toBeChecked();
    expect(screen.queryByLabelText(/Date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Time/i)).not.toBeInTheDocument();
    
    // Click the checkbox to enable scheduling
    fireEvent.click(scheduleCheckbox);
    
    // Date/time inputs should now be visible
    expect(scheduleCheckbox).toBeChecked();
    expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Time/i)).toBeInTheDocument();
    
    // Click the checkbox again to disable scheduling
    fireEvent.click(scheduleCheckbox);
    
    // Date/time inputs should be hidden again
    expect(scheduleCheckbox).not.toBeChecked();
    expect(screen.queryByLabelText(/Date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Time/i)).not.toBeInTheDocument();
  });

  test('validates form before submission', async () => {
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Try to submit the form without filling required fields
    fireEvent.click(screen.getByText(/Create Notification/i));
    
    // Should show validation error
    expect(screen.getByText(/Please fill in all required fields/i)).toBeInTheDocument();
    
    // Fill in title and message
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Notification' } });
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'This is a test notification.' } });
    
    // Still missing recipients, should show error
    fireEvent.click(screen.getByText(/Create Notification/i));
    expect(screen.getByText(/Please fill in all required fields/i)).toBeInTheDocument();
    
    // Select a recipient
    const firstRecipientCheckbox = screen.getAllByRole('checkbox')[3]; // First recipient checkbox (after type radio buttons)
    fireEvent.click(firstRecipientCheckbox);
    
    // Submit the form again
    fireEvent.click(screen.getByText(/Create Notification/i));
    
    // Should call createNotification
    await waitFor(() => {
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Notification',
          message: 'This is a test notification.',
          type: 'info',
          recipients: expect.arrayContaining([mockRecipients[0].id])
        })
      );
    });
    
    // Should show success message
    expect(screen.getByText(/Notification created successfully/i)).toBeInTheDocument();
  });

  test('handles scheduled notification creation', async () => {
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Fill in title and message
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Scheduled Notification' } });
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'This is a scheduled notification.' } });
    
    // Select a recipient
    const firstRecipientCheckbox = screen.getAllByRole('checkbox')[3]; // First recipient checkbox (after type radio buttons)
    fireEvent.click(firstRecipientCheckbox);
    
    // Enable scheduling
    fireEvent.click(screen.getByLabelText(/Schedule this notification for later/i));
    
    // Set date and time
    fireEvent.change(screen.getByLabelText(/Date/i), { target: { value: '2025-12-25' } });
    fireEvent.change(screen.getByLabelText(/Time/i), { target: { value: '09:00' } });
    
    // Submit the form
    fireEvent.click(screen.getByText(/Create Notification/i));
    
    // Should call createNotification with scheduled date
    await waitFor(() => {
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Scheduled Notification',
          message: 'This is a scheduled notification.',
          scheduled: expect.stringContaining('2025-12-25T09:00')
        })
      );
    });
    
    // Should show success message
    expect(screen.getByText(/Notification created successfully/i)).toBeInTheDocument();
  });

  test('clears form when Clear Form button is clicked', async () => {
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Fill in title and message
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Notification' } });
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'This is a test notification.' } });
    
    // Select a recipient
    const firstRecipientCheckbox = screen.getAllByRole('checkbox')[3]; // First recipient checkbox (after type radio buttons)
    fireEvent.click(firstRecipientCheckbox);
    
    // Click the Clear Form button
    fireEvent.click(screen.getByText(/Clear Form/i));
    
    // Form should be reset
    expect(screen.getByLabelText(/Title/i)).toHaveValue('');
    expect(screen.getByLabelText(/Message/i)).toHaveValue('');
    expect(screen.getByText(/Selected Recipients \(0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/No recipients selected/i)).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    // Mock service to throw error when creating notification
    notificationService.createNotification.mockRejectedValue(new Error('API Error'));
    
    render(<NotificationCreator />);
    
    // Wait for recipients to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading recipients/i)).not.toBeInTheDocument();
    });
    
    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Notification' } });
    fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'This is a test notification.' } });
    
    // Select a recipient
    const firstRecipientCheckbox = screen.getAllByRole('checkbox')[3]; // First recipient checkbox (after type radio buttons)
    fireEvent.click(firstRecipientCheckbox);
    
    // Submit the form
    fireEvent.click(screen.getByText(/Create Notification/i));
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to create notification/i)).toBeInTheDocument();
    });
  });
});

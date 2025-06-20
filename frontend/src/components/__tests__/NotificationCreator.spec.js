import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import NotificationCreator from '../NotificationCreator';
import { notificationService } from '../../services';

// Mock the notificationService
jest.mock('../../services', () => ({
  notificationService: {
    getAvailableRecipients: jest.fn(),
    createNotification: jest.fn(),
    showNotification: jest.fn(), // For component's own success/error messages if it uses this for toasts
  },
}));

const mockRecipients = [
  { id: 'admin1', name: 'Admin User One', type: 'admin' },
  { id: 'user1', name: 'System User Bob', type: 'user' }, // Assuming 'user' is a valid type from backend
  { id: 'client1', name: 'Client Alpha', type: 'client' },
  { id: 'client2', name: 'Client Beta', type: 'client' },
  { id: 'caregiver1', name: 'Caregiver Gamma', type: 'caregiver' },
  { id: 'caregiver2', name: 'Caregiver Delta', type: 'caregiver' },
];

describe('NotificationCreator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationService.getAvailableRecipients.mockResolvedValue([...mockRecipients]);
    notificationService.createNotification.mockResolvedValue({ success: true, id: 'notif-new-123' });
  });

  const renderComponent = (props) => render(<NotificationCreator {...props} />);

  describe('Rendering and Initial State', () => {
    test('shows loading state for recipients initially', () => {
      notificationService.getAvailableRecipients.mockReturnValue(new Promise(() => {})); // Keep it pending
      renderComponent();
      expect(screen.getByText('Loading recipients...')).toBeInTheDocument();
    });

    test('renders recipient list after successful fetch', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('Admin User One')).toBeInTheDocument());
      expect(screen.getByText('Client Alpha')).toBeInTheDocument();
      expect(screen.getByText('Caregiver Gamma')).toBeInTheDocument();
      expect(screen.queryByText('Loading recipients...')).not.toBeInTheDocument();
    });

    test('shows error message if recipient fetch fails', async () => {
      notificationService.getAvailableRecipients.mockRejectedValueOnce(new Error('Fetch failed'));
      renderComponent();
      await waitFor(() => expect(screen.getByText('Failed to load recipients. Please try again.')).toBeInTheDocument());
    });

    test('renders form fields correctly', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeInTheDocument());
      expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Info/i)).toBeChecked(); // Default type
      expect(screen.getByLabelText(/Link/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Schedule this notification/i)).not.toBeChecked();
      expect(screen.queryByLabelText(/Date/i)).not.toBeInTheDocument(); // Schedule date/time hidden initially
    });
  });

  describe('Form Input and State', () => {
    test('updates title, message, and link state on input', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()); // Ensure form is loaded

      fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Title' } });
      expect(screen.getByLabelText(/Title/i)).toHaveValue('Test Title');

      fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'Test Message' } });
      expect(screen.getByLabelText(/Message/i)).toHaveValue('Test Message');

      fireEvent.change(screen.getByLabelText(/Link/i), { target: { value: '/test-link' } });
      expect(screen.getByLabelText(/Link/i)).toHaveValue('/test-link');
    });

    test('updates notification type state on change', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByLabelText(/Urgent/i)).toBeInTheDocument());
      fireEvent.click(screen.getByLabelText(/Urgent/i));
      expect(screen.getByLabelText(/Urgent/i)).toBeChecked();
    });

    test('toggles schedule date/time inputs and updates state', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByLabelText(/Schedule this notification/i)).toBeInTheDocument());

      const scheduleCheckbox = screen.getByLabelText(/Schedule this notification/i);
      fireEvent.click(scheduleCheckbox);
      expect(scheduleCheckbox).toBeChecked();
      const dateInput = screen.getByLabelText(/Date/i);
      const timeInput = screen.getByLabelText(/Time/i);
      expect(dateInput).toBeInTheDocument();
      expect(timeInput).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-12-25' } });
      });
      expect(await screen.findByDisplayValue('2024-12-25')).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(timeInput, { target: { value: '14:30' } });
      });
      expect(await screen.findByDisplayValue('14:30')).toBeInTheDocument();

      await act(async () => { // Ensure state update for checkbox is processed
        fireEvent.click(scheduleCheckbox);
      });
      expect(scheduleCheckbox).not.toBeChecked();
      expect(screen.queryByLabelText(/Date/i)).not.toBeInTheDocument();
    });
  });

  describe('Recipient Selection', () => {
    test('selects and deselects individual recipients', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('Admin User One')).toBeInTheDocument());

      const adminCheckbox = screen.getByLabelText('Admin User One');
      fireEvent.click(adminCheckbox);
      expect(adminCheckbox).toBeChecked();
      expect(screen.getByText('Selected Recipients (1)')).toBeInTheDocument();
      expect(screen.getByText('Admin User One', { selector: '.selected-recipient .recipient-name' })).toBeInTheDocument();


      fireEvent.click(adminCheckbox);
      expect(adminCheckbox).not.toBeChecked();
      expect(screen.getByText('Selected Recipients (0)')).toBeInTheDocument();
      expect(screen.queryByText('Admin User One', { selector: '.selected-recipient .recipient-name' })).not.toBeInTheDocument();
    });

    test('selects all recipients of a type', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());
      // Find "Select All" button for clients
      const clientTypeDiv = screen.getByText('Clients').closest('.recipient-type');
      const selectAllClientsButton = Array.from(clientTypeDiv.querySelectorAll('button')).find(btn => btn.textContent === 'Select All');
      fireEvent.click(selectAllClientsButton);

      expect(screen.getByLabelText('Client Alpha')).toBeChecked();
      expect(screen.getByLabelText('Client Beta')).toBeChecked();
      expect(screen.getByText('Selected Recipients (2)')).toBeInTheDocument();
    });

    test('removes all recipients of a type', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());

      const clientTypeDiv = screen.getByText('Clients').closest('.recipient-type');
      const selectAllClientsButton = Array.from(clientTypeDiv.querySelectorAll('button')).find(btn => btn.textContent === 'Select All');
      fireEvent.click(selectAllClientsButton); // Select all first
      expect(screen.getByLabelText('Client Alpha')).toBeChecked(); // Confirm selection

      const removeAllClientsButton = Array.from(clientTypeDiv.querySelectorAll('button')).find(btn => btn.textContent === 'Remove All');
      fireEvent.click(removeAllClientsButton);

      expect(screen.getByLabelText('Client Alpha')).not.toBeChecked();
      expect(screen.getByLabelText('Client Beta')).not.toBeChecked();
       // Assuming only clients were selected, count should be 0. If others were selected, this needs adjustment.
      // For simplicity, this test assumes only clients were being manipulated.
      // A more robust test would pre-select other types and ensure they remain.
      const selectedCountText = await screen.findByText(/Selected Recipients \(\d+\)/);
      expect(selectedCountText.textContent).toMatch(/Selected Recipients \(0\)/);
    });
  });

  describe('Form Submission (handleSubmit)', () => {
    test('shows validation error if title, message, or recipients are missing', async () => {
      renderComponent();
      await waitFor(() => expect(screen.getByText('Create Notification')).toBeInTheDocument());

      await act(async () => {
        fireEvent.click(screen.getByText('Create Notification'));
      });
      await screen.findByText('Please fill in all required fields and select at least one recipient.');
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    test('successfully creates a notification', async () => {
      const onNotificationCreatedMock = jest.fn();
      renderComponent({ onNotificationCreated: onNotificationCreatedMock });
      await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Success' } });
      fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'Success message' } });
      fireEvent.click(screen.getByLabelText('Admin User One')); // Select one recipient

      await act(async () => {
        fireEvent.click(screen.getByText('Create Notification'));
      });

      await waitFor(() => {
        expect(notificationService.createNotification).toHaveBeenCalledWith({
          title: 'Test Success',
          message: 'Success message',
          type: 'info',
          recipients: ['admin1'],
          link: null,
          scheduled: null,
        });
      });
      expect(screen.getByText('Notification created successfully!')).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/i)).toHaveValue(''); // Form reset
      expect(onNotificationCreatedMock).toHaveBeenCalledTimes(1);
    });

    test('successfully creates a scheduled notification', async () => {
        renderComponent();
        await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Scheduled Test' } });
        fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'Scheduled message' } });
        fireEvent.click(screen.getByLabelText('Client Alpha'));
        fireEvent.click(screen.getByLabelText(/Schedule this notification/i));
        // Fill all required fields for this scheduled notification test
        fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'Scheduled message content' } });

        await act(async () => { // Wrap checkbox click that reveals new inputs
            fireEvent.click(screen.getByLabelText(/Schedule this notification/i));
        });

        const dateInputScheduled = await screen.findByLabelText(/Date/i);
        const timeInputScheduled = await screen.findByLabelText(/Time/i);

        await act(async () => {
            fireEvent.change(dateInputScheduled, { target: { value: '2024-12-31' } });
            fireEvent.change(timeInputScheduled, { target: { value: '23:59' } });
        });

        // Ensure values are set before submitting
        expect(dateInputScheduled).toHaveValue('2024-12-31');
        expect(timeInputScheduled).toHaveValue('23:59');

        await act(async () => {
            fireEvent.click(screen.getByText('Create Notification'));
        });

        await waitFor(() => {
            expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Scheduled Test',
                message: 'Scheduled message content',
                recipients: ['client1'],
                scheduled: new Date('2024-12-31T23:59:00.000Z').toISOString(),
            }));
        });
    });


    test('shows error if createNotification service call fails', async () => {
      notificationService.createNotification.mockRejectedValueOnce(new Error('Creation failed miserably'));
      renderComponent();
      await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Test Fail' } });
      fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'Fail message' } });
      fireEvent.click(screen.getByLabelText('Admin User One'));

      await act(async () => {
        fireEvent.click(screen.getByText('Create Notification'));
      });

      await waitFor(() =>
        expect(screen.getByText('Failed to create notification. Please try again.')).toBeInTheDocument()
      );
      expect(screen.getByLabelText(/Title/i)).toHaveValue('Test Fail'); // Form not reset
    });
  });

  test('"Clear Form" button resets all fields and messages', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeInTheDocument());

    // Enter some data
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Some Title' } });
    fireEvent.click(screen.getByLabelText('Admin User One'));
    // Simulate an error message being present
    // Fill only title to ensure message and recipients are missing for validation
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Incomplete form to clear' } });
    // Message and recipients are missing for this part of the test

    await act(async () => {
      fireEvent.click(screen.getByText('Create Notification'));
    });
    await screen.findByText(/Please fill in all required fields/i); // Wait for error to show


    fireEvent.click(screen.getByText('Clear Form'));

    expect(screen.getByLabelText(/Title/i)).toHaveValue('');
    expect(screen.getByLabelText(/Message/i)).toHaveValue('');
    expect(screen.getByLabelText(/Info/i)).toBeChecked();
    expect(screen.getByLabelText(/Link/i)).toHaveValue('');
    expect(screen.getByLabelText(/Schedule this notification/i)).not.toBeChecked();
    expect(screen.queryByText(/Please fill in all required fields/i)).not.toBeInTheDocument(); // Error cleared
    expect(screen.getByText('Selected Recipients (0)')).toBeInTheDocument();
  });
});

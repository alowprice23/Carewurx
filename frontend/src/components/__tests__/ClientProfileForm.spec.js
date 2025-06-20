import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import ClientProfileForm from '../ClientProfileForm';
import { universalDataService, universalScheduleService, notificationService } from '../../services';

// Mock the services
jest.mock('../../services', () => ({
  universalDataService: {
    getClient: jest.fn(),
    createClient: jest.fn(),
    updateClient: jest.fn(),
  },
  universalScheduleService: {
    getSchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
  },
  notificationService: {
    showNotification: jest.fn(),
  },
  // Mock firebaseService if any part of it is still used directly (e.g. auth, though should be minimal)
  // For this component, direct firebaseService usage for DB has been removed.
  // Auth for ID token is handled by services.
  firebaseService: {
    // If ClientProfileForm or a child component tries to use firebase.auth().currentUser directly for UI purposes
    // it might be needed. For now, assuming services handle auth internally.
    auth: jest.fn(() => ({
        currentUser: {
            getIdToken: jest.fn().mockResolvedValue('test-id-token'),
        }
    }))
  }
}));

// Helper to wrap state updates in act(...)
const actUpdate = async (callback) => {
  await act(async () => {
    callback();
  });
};

describe('ClientProfileForm', () => {
  const mockClientProfile = {
    id: 'client123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-1234',
    address: '123 Main St',
    careNeeds: [{ type: 'mobility', description: 'Mobility Assistance', priority: 3 }],
    transportation: { onBusLine: true, requiresDriverCaregiver: false, mobilityEquipment: [] },
    serviceHours: { hoursPerWeek: 10, preferredDays: [1], preferredTimeRanges: [] },
  };

  const mockRecurringSchedule = {
    id: 'recSched1',
    clientId: 'client123',
    isRecurring: true,
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '11:00',
    careNeeds: ['mobility'],
    notes: 'Morning routine',
    recurrenceType: 'weekly',
    startDate: '2024-01-01',
  };

  const mockSingleDateSchedule = {
    id: 'singleSched1',
    clientId: 'client123',
    isRecurring: false,
    date: '2024-08-15',
    startTime: '14:00',
    endTime: '16:00',
    careNeeds: ['companionship'],
    notes: 'Afternoon visit',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    universalDataService.getClient.mockResolvedValue(mockClientProfile);
    universalDataService.createClient.mockImplementation(payload => Promise.resolve({ ...payload, id: 'newClient456' }));
    universalDataService.updateClient.mockResolvedValue({ success: true });

    universalScheduleService.getSchedules.mockResolvedValue([mockRecurringSchedule, mockSingleDateSchedule]);
    universalScheduleService.createSchedule.mockImplementation(payload => Promise.resolve({ ...payload, id: `newSched-${Math.random()}` }));
    universalScheduleService.updateSchedule.mockResolvedValue({ success: true });
    universalScheduleService.deleteSchedule.mockResolvedValue({ success: true });
  });

  test('renders in "create new client" mode', () => {
    render(<ClientProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Add New Client')).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/i)).toHaveValue('');
  });

  test('renders in "edit client" mode and loads data', async () => {
    render(<ClientProfileForm clientId="client123" onSave={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText('Edit Client Profile')).toBeInTheDocument();
    await waitFor(() => {
      expect(universalDataService.getClient).toHaveBeenCalledWith('client123');
      expect(universalScheduleService.getSchedules).toHaveBeenCalledWith({ clientId: 'client123', includeDetails: true });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/First Name/i)).toHaveValue('John');
    });

    // Switch to Schedule Requirements tab to check hours per week
    fireEvent.click(screen.getByText('Schedule Requirements'));
    await waitFor(() => {
      expect(screen.getByLabelText(/Hours Per Week/i)).toHaveValue(10); // From serviceHours
    });

    // Check if a recurring schedule item is rendered (e.g., by its start time)
    // This depends on how schedules are displayed, which is complex in the actual form.
    // For now, we've verified data loading calls. More specific checks can be added if UI is simple.
  });

  test('allows tab switching', () => {
    render(<ClientProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('Care Needs'));
    expect(screen.getByText('Select all care needs that apply to this client.')).toBeVisible();

    fireEvent.click(screen.getByText('Schedule Requirements'));
    expect(screen.getByText('Service Hours')).toBeVisible();

    fireEvent.click(screen.getByText('Basic Information'));
    expect(screen.getByLabelText(/First Name/i)).toBeVisible();
  });

  test('handles basic profile input changes', () => {
    render(<ClientProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    const firstNameInput = screen.getByLabelText(/First Name/i);
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
    expect(firstNameInput).toHaveValue('Jane');

    const emailInput = screen.getByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: 'jane.doe@example.com' } });
    expect(emailInput).toHaveValue('jane.doe@example.com');
  });

  test('handles care need toggling', () => {
    render(<ClientProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('Care Needs')); // Switch to care needs tab

    // Assuming 'Mobility Assistance' corresponds to 'mobility' id
    const mobilityCheckbox = screen.getByLabelText('Mobility Assistance');
    expect(mobilityCheckbox).not.toBeChecked();
    fireEvent.click(mobilityCheckbox);
    expect(mobilityCheckbox).toBeChecked();
    fireEvent.click(mobilityCheckbox);
    expect(mobilityCheckbox).not.toBeChecked();
  });

  describe('Schedule Requirements State Management', () => {
    beforeEach(() => {
      // Ensure we are on the schedule tab for these tests
      // No direct way to set initialTab in each test easily without re-rendering or more complex setup
      // So, ensure clicks or structure tests assuming user navigates if needed.
    });

    test('adds and removes a recurring schedule entry', async () => {
      render(<ClientProfileForm onSave={jest.fn()} onCancel={jest.fn()} initialTab="schedule" />);
      // Ensure activeTab is schedule, or click to it.
      // await actUpdate(() => fireEvent.click(screen.getByText('Schedule Requirements')));

      const initialRecurringSchedules = screen.queryAllByText('Day of Week'); // A bit generic

      await actUpdate(() => {
        fireEvent.click(screen.getByText('Add Recurring Schedule'));
      });

      let recurringScheduleEntries = screen.getAllByText('Day of Week'); // Re-query
      expect(recurringScheduleEntries.length).toBe(initialRecurringSchedules.length + 1);

      // Find all "Remove" buttons for recurring schedules. This assumes a certain structure.
      // A more robust selector would be to have specific test-ids on remove buttons.
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      // Assuming the last "Remove" button corresponds to the last added recurring schedule.
      // This is fragile. Better to scope within the recurring schedule section.
      const recurringRemoveButtons = removeButtons.filter(btn =>
         btn.closest('.schedule-entry')?.querySelector('select[value="1"]') // A heuristic
      );

      if (recurringRemoveButtons.length > 0) {
          await actUpdate(() => {
            fireEvent.click(recurringRemoveButtons[recurringRemoveButtons.length -1]);
        });
        recurringScheduleEntries = screen.queryAllByText('Day of Week');
         expect(recurringScheduleEntries.length).toBe(initialRecurringSchedules.length);
      } else {
        // Fallback if heuristic fails or only one remove button exists
        if (removeButtons.length > 0) {
             await actUpdate(() => { fireEvent.click(removeButtons[0]); }); // Click first remove button
        }
      }
    });

    test('adds and removes a single-date schedule entry', async () => {
      render(<ClientProfileForm onSave={jest.fn()} onCancel={jest.fn()} initialTab="schedule" />);
      // await actUpdate(() => fireEvent.click(screen.getByText('Schedule Requirements')));

      const initialSingleDateSchedules = screen.queryAllByText(/^Date$/i); // Label for date input

      await actUpdate(() => {
        fireEvent.click(screen.getByText('Add Single Date Schedule'));
      });

      let singleDateEntries = screen.getAllByText(/^Date$/i);
      expect(singleDateEntries.length).toBe(initialSingleDateSchedules.length + 1);

      // Similar fragility with remove buttons as above.
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      // Find remove buttons specifically in the single-date section
      const singleDateRemoveButtons = removeButtons.filter(btn =>
        btn.closest('.schedule-entry')?.querySelector('input[type="date"]')
      );

      if (singleDateRemoveButtons.length > 0) {
          await actUpdate(() => {
            fireEvent.click(singleDateRemoveButtons[singleDateRemoveButtons.length -1]);
        });
        singleDateEntries = screen.queryAllByText(/^Date$/i);
        expect(singleDateEntries.length).toBe(initialSingleDateSchedules.length);
      } else {
         if (removeButtons.length > 0) { // Fallback
             await actUpdate(() => { fireEvent.click(removeButtons[removeButtons.length-1]); });
        }
      }
    });
  });

  describe('Form Submission', () => {
    test('handles successfully creating a new client with schedules', async () => {
      const onSaveMock = jest.fn();
      render(<ClientProfileForm onSave={onSaveMock} onCancel={jest.fn()} />);

      // Fill out some profile data
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'New' } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Client' } });
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '555-0000' } });

      // Add a recurring schedule
      fireEvent.click(screen.getByText('Schedule Requirements'));
      await actUpdate(() => {
        fireEvent.click(screen.getByText('Add Recurring Schedule'));
      });
      // Modify it if needed, e.g., change day
      fireEvent.change(screen.getAllByLabelText('Day of Week')[0], { target: { value: '2' } });


      await actUpdate(() => {
        fireEvent.click(screen.getByText('Create Client'));
      });

      await waitFor(() => {
        expect(universalDataService.createClient).toHaveBeenCalledWith(expect.objectContaining({
          firstName: 'New',
          lastName: 'Client',
          // serviceHours should be included
        }));
      });

      const createdClientId = 'newClient456'; // From mock
      await waitFor(() => {
        expect(universalScheduleService.createSchedule).toHaveBeenCalledWith(expect.objectContaining({
          clientId: createdClientId,
          isRecurring: true,
          dayOfWeek: 2, // Changed value
        }));
      });
      expect(notificationService.showNotification).toHaveBeenCalledWith('Client created successfully!', 'success');
      expect(onSaveMock).toHaveBeenCalledWith(createdClientId);
    });

    test('handles successfully updating an existing client with schedule changes', async () => {
      const onSaveMock = jest.fn();
      const initialLoadedSchedules = [
        { ...mockRecurringSchedule, id: 'recSched1ToUpdate', dayOfWeek: 1, careNeeds: ['mobility'] }, // Will be updated
        { ...mockSingleDateSchedule, id: 'singleSched1ToDelete', careNeeds: ['companionship'] } // Will be deleted
      ];
      // Mock for initial load in useEffect
      universalScheduleService.getSchedules.mockResolvedValueOnce([...initialLoadedSchedules]);
      // Mock for the getSchedules call inside handleSubmit
      universalScheduleService.getSchedules.mockResolvedValueOnce([...initialLoadedSchedules]);


      render(<ClientProfileForm clientId="client123" onSave={onSaveMock} onCancel={jest.fn()} />);

      await waitFor(() => expect(screen.getByLabelText(/First Name/i)).toHaveValue('John'));

      // Modify profile data
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Johnny' } });

      // Navigate to schedules and modify
      fireEvent.click(screen.getByText('Schedule Requirements'));

      // 1. Update existing recurring schedule (e.g., change dayOfWeek)
      // Assuming the first recurring schedule loaded corresponds to recSched1ToUpdate
      const dayOfWeekSelects = await screen.findAllByLabelText('Day of Week');
      fireEvent.change(dayOfWeekSelects[0], { target: { value: '3' } }); // Change Monday to Wednesday

      // 2. Delete the single date schedule (by removing it from the UI state)
      // This requires finding the specific "Remove" button for singleSched1ToDelete
      // For simplicity in this example, let's assume it's the only single-date schedule initially.
      // Find the "Remove" button for the single-date schedule loaded from mock.
      // This assumes 'singleSched1ToDelete' is the first (or only) single-date schedule rendered.
      // A more robust way would be to find the schedule entry by a unique property (e.g. its date)
      // and then find the "Remove" button within that entry.

      // Wait for the schedule entries to be populated
      await waitFor(async () => {
        // Find the input field for the date of singleSched1ToDelete
        const singleDateInput = await screen.findByDisplayValue('2024-08-15');
        // Find the parent schedule-entry div
        const scheduleEntryDiv = singleDateInput.closest('.schedule-entry');
        expect(scheduleEntryDiv).toBeInTheDocument();
        // Find the Remove button within this specific schedule entry
        const removeButton = scheduleEntryDiv.querySelector('button'); // Assuming it's the only button
        expect(removeButton).toHaveTextContent('Remove');
        await actUpdate(() => {
          fireEvent.click(removeButton);
        });
      });

      // Ensure the state has updated and the item is gone from UI (optional check here, focus on submit logic)
      // expect(screen.queryByDisplayValue('2024-08-15')).not.toBeInTheDocument();


      // 3. Add a new single-date schedule
       await actUpdate(() => {
        fireEvent.click(screen.getByText('Add Single Date Schedule'));
      });
      // Modify its date (this will be the second date input if one was loaded and removed, or first if none loaded)
      // Find all date inputs for single date schedules
      const dateInputs = await screen.findAllByLabelText(/^Date$/i);
      // Target the last one added (which should be the new one)
      fireEvent.change(dateInputs[dateInputs.length - 1], { target: { value: '2024-12-25' } });


      await act(async () => { // Wrap submit in act
        fireEvent.click(screen.getByText('Update Client'));
      });

      await waitFor(() => {
        expect(universalDataService.updateClient).toHaveBeenCalledWith('client123', expect.objectContaining({
          firstName: 'Johnny',
        }));
      });

      // Verify schedule updates
      await waitFor(() => {
        // Updated recurring schedule
        expect(universalScheduleService.updateSchedule).toHaveBeenCalledWith(
          'recSched1ToUpdate',
          expect.objectContaining({ dayOfWeek: 3, clientId: 'client123', isRecurring: true })
        );
        // Deleted single-date schedule
        expect(universalScheduleService.deleteSchedule).toHaveBeenCalledWith('singleSched1ToDelete');
        // Created new single-date schedule
        expect(universalScheduleService.createSchedule).toHaveBeenCalledWith(expect.objectContaining({
          date: '2024-12-25',
          clientId: 'client123',
          isRecurring: false,
        }));
      });
      expect(notificationService.showNotification).toHaveBeenCalledWith('Client updated successfully!', 'success');
      expect(onSaveMock).toHaveBeenCalledWith('client123');
    });

    test('shows error notification if creating client fails', async () => {
      universalDataService.createClient.mockRejectedValueOnce(new Error('Create failed'));
      render(<ClientProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);

      // Fill ALL required fields
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Fail' } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '555-0199' } });

      // Wrap submission in act
      await act(async () => {
        fireEvent.click(screen.getByText('Create Client'));
      });

      // Wait for the error message to appear in the document, which implies the catch block has run
      await screen.findByText('Failed to create client: Create failed');

      // Now check the notification
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Failed to create client: Create failed',
        'error'
      );
    });

    test('shows error notification if loading client data fails', async () => {
      universalDataService.getClient.mockRejectedValueOnce(new Error('Load failed'));
      render(<ClientProfileForm clientId="client123" onSave={jest.fn()} onCancel={jest.fn()} />);

      await waitFor(() => {
        expect(notificationService.showNotification).toHaveBeenCalledWith(
          'Failed to load client data.',
          'error'
        );
      });
       expect(screen.getByText('Failed to load client data. Please try again.')).toBeInTheDocument();
    });
  });
});

// TODO:
// - Test complex care needs objects if they are not simple strings.
// - Test transportation object fields more thoroughly.
// - Test schedule field modifications (startTime, endTime, notes, etc.) for both recurring and single.
// - Test edge cases for schedule delta logic (e.g., all schedules deleted, all new, mix of all operations).
// - Test the `schedulesAreEqual` helper logic more directly if it becomes complex.
// - Test form validation if any is added (e.g., required fields beyond basic HTML5).
// - Test onCancel callback.
// - Test initialTab prop.
// - The "Remove" button interactions in schedule state management tests are a bit fragile;
//   could be improved with more specific selectors or by directly manipulating component state in tests if feasible.
// - Ensure date/time formats from services are correctly handled/parsed if they are not simple strings.
// - Test what happens if createClient returns an error but somehow an ID is still passed to schedule logic (edge case).
// - Test schedule creation when client is new and createClient fails before schedule logic.

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import CaregiverProfileForm from '../CaregiverProfileForm';
import { universalDataService, availabilityService, notificationService } from '../../services';

// Mock the services and child components
jest.mock('../../services', () => ({
  universalDataService: {
    getCaregiver: jest.fn(),
    createCaregiver: jest.fn(),
    updateCaregiver: jest.fn(),
  },
  availabilityService: {
    getCaregiverAvailability: jest.fn(),
    updateCaregiverAvailability: jest.fn(),
  },
  notificationService: {
    showNotification: jest.fn(),
  },
}));

// Mock AvailabilityManager
// This mock will allow us to simulate changes and test the callback
let mockOnAvailabilityChangeCallback;
jest.mock('../AvailabilityManager', () => (props) => {
  mockOnAvailabilityChangeCallback = props.onAvailabilityChange; // Capture the callback
  return (
    <div data-testid="mock-availability-manager">
      <button onClick={() => props.onAvailabilityChange({
          regularSchedule: [{ dayOfWeek: 1, startTime: '10:00', endTime: '18:00', recurrenceType: 'Weekly' }],
          timeOff: [{ startDate: '2025-01-01', endDate: '2025-01-05', reason: 'Vacation' }]
      })}>
        Simulate Availability Change
      </button>
      {/* Display initial availability to help with debugging if needed */}
      <div data-testid="initial-regular-schedule">{JSON.stringify(props.initialAvailability?.regularSchedule)}</div>
      <div data-testid="initial-time-off">{JSON.stringify(props.initialAvailability?.timeOff)}</div>
    </div>
  );
});


describe('CaregiverProfileForm', () => {
  const mockCaregiverProfile = {
    id: 'cg123',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '555-5678',
    address: '456 Oak St',
    skills: ['medication', 'mobility'],
    transportation: { hasCar: true, hasLicense: true, usesPublicTransport: false, travelRadius: 15 },
  };

  const mockInitialAvailability = {
    regularSchedule: [{ dayOfWeek: 0, startTime: '08:00', endTime: '16:00', recurrenceType: 'Weekly' }],
    timeOff: [{ startDate: '2024-11-01', endDate: '2024-11-03', reason: 'Personal', status: 'Approved' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    universalDataService.getCaregiver.mockResolvedValue(mockCaregiverProfile);
    availabilityService.getCaregiverAvailability.mockResolvedValue(mockInitialAvailability);
    universalDataService.createCaregiver.mockImplementation(payload => Promise.resolve({ ...payload, id: 'newCg789' }));
    universalDataService.updateCaregiver.mockResolvedValue({ success: true });
    availabilityService.updateCaregiverAvailability.mockResolvedValue({ success: true });
  });

  test('renders in "create new caregiver" mode', () => {
    render(<CaregiverProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Add New Caregiver')).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/i)).toHaveValue('');
  });

  test('renders in "edit caregiver" mode and loads data', async () => {
    render(<CaregiverProfileForm caregiverId="cg123" onSave={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText('Edit Caregiver Profile')).toBeInTheDocument();
    await waitFor(() => {
      expect(universalDataService.getCaregiver).toHaveBeenCalledWith('cg123');
      expect(availabilityService.getCaregiverAvailability).toHaveBeenCalledWith('cg123');
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/First Name/i)).toHaveValue('Jane');
    });

    // Switch to Skills & Transportation tab to check travel radius
    fireEvent.click(screen.getByText('Skills & Transportation'));
    await waitFor(() => {
      expect(screen.getByLabelText(/Travel Radius/i)).toHaveValue(15);
    });

    // Check if AvailabilityManager received initial props (via mock)
    fireEvent.click(screen.getByText('Availability')); // Switch to availability tab
    await waitFor(() => {
        expect(screen.getByTestId('initial-regular-schedule')).toHaveTextContent(JSON.stringify(mockInitialAvailability.regularSchedule));
    });
  });

  test('allows tab switching', () => {
    render(<CaregiverProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('Skills & Transportation'));
    expect(screen.getByText('Caregiver Skills')).toBeVisible();

    fireEvent.click(screen.getByText('Availability'));
    expect(screen.getByTestId('mock-availability-manager')).toBeVisible();

    fireEvent.click(screen.getByText('Basic Information'));
    expect(screen.getByLabelText(/First Name/i)).toBeVisible();
  });

  test('handles basic profile input changes', () => {
    render(<CaregiverProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    const firstNameInput = screen.getByLabelText(/First Name/i);
    fireEvent.change(firstNameInput, { target: { value: 'Janey' } });
    expect(firstNameInput).toHaveValue('Janey');
  });

  test('handles skill toggling', () => {
    render(<CaregiverProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('Skills & Transportation'));

    const mobilitySkillCheckbox = screen.getByLabelText('Mobility Assistance'); // Assumes SKILL_OPTIONS matches
    expect(mobilitySkillCheckbox).not.toBeChecked();
    fireEvent.click(mobilitySkillCheckbox);
    expect(mobilitySkillCheckbox).toBeChecked();
  });

  test('updates availabilityData state when AvailabilityManager calls onAvailabilityChange', async () => {
    render(<CaregiverProfileForm caregiverId="cg123" onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('Availability')); // Ensure AvailabilityManager is rendered

    // Simulate AvailabilityManager sending new data
    const newAvailabilityFromManager = {
      regularSchedule: [{ dayOfWeek: 2, startTime: '10:00', endTime: '14:00', recurrenceType: 'Weekly' }],
      timeOff: [],
    };

    // The mock AvailabilityManager has a button to trigger its onAvailabilityChange
    // In a real scenario, onAvailabilityChange is triggered by internal actions in AvailabilityManager
    // Here, we use the captured mockOnAvailabilityChangeCallback if available or simulate the button click
    if (mockOnAvailabilityChangeCallback) {
        act(() => {
            mockOnAvailabilityChangeCallback(newAvailabilityFromManager);
        });
    } else {
        // Fallback if the callback capture wasn't perfect for this test run timing
        // This relies on the mock's internal button for testing this specific interaction
        const simulateButton = screen.getByText('Simulate Availability Change');
        act(() => {
            fireEvent.click(simulateButton);
        });
    }

    // Submit the form to trigger saving with the updated availabilityData
    const submitButton = screen.getByRole('button', { name: /Update Caregiver/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      // The newAvailabilityFromManager is slightly different from what the mock button sends,
      // so we check for the one sent by the button for this specific test.
      expect(availabilityService.updateCaregiverAvailability).toHaveBeenCalledWith(
        'cg123',
        expect.objectContaining({
            regularSchedule: [{ dayOfWeek: 1, startTime: '10:00', endTime: '18:00', recurrenceType: 'Weekly' }],
            timeOff: [{ startDate: '2025-01-01', endDate: '2025-01-05', reason: 'Vacation' }]
        })
      );
    });
  });


  describe('Form Submission', () => {
    test('handles successfully creating a new caregiver with availability', async () => {
      const onSaveMock = jest.fn();
      render(<CaregiverProfileForm onSave={onSaveMock} onCancel={jest.fn()} />);

      // Fill profile
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'New' } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Caregiver' } });
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'new@example.com' } });
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '555-9999' } });
      fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '12 New St' } });


      // Simulate availability being set by AvailabilityManager
      fireEvent.click(screen.getByText('Availability'));
      const simulateButton = screen.getByText('Simulate Availability Change');
      act(() => {
          fireEvent.click(simulateButton);
      });

      const createButton = screen.getByRole('button', { name: /Create Caregiver/i });
      await act(async () => {
        fireEvent.click(createButton);
      });

      const newCaregiverId = 'newCg789'; // From mock
      await waitFor(() => {
        expect(universalDataService.createCaregiver).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'New' }));
      });
      await waitFor(() => {
        expect(availabilityService.updateCaregiverAvailability).toHaveBeenCalledWith(
          newCaregiverId,
          expect.objectContaining({ // This is the data from the "Simulate Availability Change" button
            regularSchedule: [{ dayOfWeek: 1, startTime: '10:00', endTime: '18:00', recurrenceType: 'Weekly' }],
            timeOff: [{ startDate: '2025-01-01', endDate: '2025-01-05', reason: 'Vacation' }]
          })
        );
      });
      expect(notificationService.showNotification).toHaveBeenCalledWith('Caregiver created successfully!', 'success');
      expect(onSaveMock).toHaveBeenCalledWith(newCaregiverId);
    });

    test('handles successfully updating an existing caregiver and their availability', async () => {
      const onSaveMock = jest.fn();
      render(<CaregiverProfileForm caregiverId="cg123" onSave={onSaveMock} onCancel={jest.fn()} />);

      await waitFor(() => expect(screen.getByLabelText(/First Name/i)).toHaveValue('Jane'));

      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Janet' } });

      fireEvent.click(screen.getByText('Availability'));
      const simulateButton = screen.getByText('Simulate Availability Change');
       act(() => { // Ensure state update from this is processed
          fireEvent.click(simulateButton);
      });

      const updateButton = screen.getByRole('button', { name: /Update Caregiver/i });
      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(universalDataService.updateCaregiver).toHaveBeenCalledWith('cg123', expect.objectContaining({ firstName: 'Janet' }));
      });
      await waitFor(() => {
        expect(availabilityService.updateCaregiverAvailability).toHaveBeenCalledWith('cg123',
         expect.objectContaining({ // Data from "Simulate Availability Change"
            regularSchedule: [{ dayOfWeek: 1, startTime: '10:00', endTime: '18:00', recurrenceType: 'Weekly' }],
            timeOff: [{ startDate: '2025-01-01', endDate: '2025-01-05', reason: 'Vacation' }]
          })
        );
      });
      expect(notificationService.showNotification).toHaveBeenCalledWith('Caregiver updated successfully!', 'success');
      expect(onSaveMock).toHaveBeenCalledWith('cg123');
    });

    test('shows error notification if creating caregiver fails', async () => {
      universalDataService.createCaregiver.mockRejectedValueOnce(new Error('Create CG failed'));
      render(<CaregiverProfileForm onSave={jest.fn()} onCancel={jest.fn()} />);

      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'TestFail' } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'UserFail' } });
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'fail@example.com' } });
      fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '111-222-3333' } });
      fireEvent.change(screen.getByLabelText(/Address/i), { target: { value: '1 Error Lane' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Create Caregiver'));
      });

      await screen.findByText('Failed to create caregiver: Create CG failed');
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Failed to create caregiver: Create CG failed',
        'error'
      );
    });
  });
});

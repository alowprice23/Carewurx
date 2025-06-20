import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import AvailabilityManager from '../AvailabilityManager';
import { notificationService } from '../../services'; // Only if direct error notifications are still in AvailabilityManager

// Mock notificationService if used for internal errors (e.g., start time after end time)
jest.mock('../../services', () => ({
  notificationService: {
    showNotification: jest.fn(),
  },
}));

describe('AvailabilityManager', () => {
  const initialAvailability = {
    regularSchedule: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', recurrenceType: 'Weekly' },
    ],
    timeOff: [
      { startDate: '2024-12-20', endDate: '2024-12-22', reason: 'Vacation', status: 'Approved' },
    ],
  };

  let onAvailabilityChangeMock;

  beforeEach(() => {
    onAvailabilityChangeMock = jest.fn();
    notificationService.showNotification.mockClear();
  });

  test('renders initial availability correctly', () => {
    render(
      <AvailabilityManager
        initialAvailability={initialAvailability}
        onAvailabilityChange={onAvailabilityChangeMock}
      />
    );

    // Check if initial regular schedule is rendered
    expect(screen.getByText('Monday')).toBeInTheDocument(); // From dayOfWeek: 1
    expect(screen.getByText(/09:00 AM - 05:00 PM/i)).toBeInTheDocument(); // Using formatTime logic

    // Check if initial time off is rendered
    expect(screen.getByText(/12\/20\/2024 - 12\/22\/2024/i)).toBeInTheDocument(); // Using formatDate
    expect(screen.getByText('Vacation')).toBeInTheDocument();
  });

  test('calls onAvailabilityChange when a new regular schedule entry is added', async () => {
    render(
      <AvailabilityManager
        initialAvailability={{ regularSchedule: [], timeOff: [] }}
        onAvailabilityChange={onAvailabilityChangeMock}
      />
    );
    onAvailabilityChangeMock.mockClear(); // Clear after initial mount effects


    fireEvent.click(screen.getByRole('button', { name: /Add Schedule/i })); // Open form

    // Fill the form (assuming default values are fine for this test, or change them)
    // Default is Monday, 09:00-17:00, Weekly
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add Schedule' })); // Submit the small form
    });

    expect(onAvailabilityChangeMock).toHaveBeenCalledTimes(1); // Called once after adding
    expect(onAvailabilityChangeMock).toHaveBeenCalledWith({
      regularSchedule: [
        expect.objectContaining({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }),
      ],
      timeOff: [],
    });
  });

  test('calls onAvailabilityChange when a regular schedule entry is removed', async () => {
    render(
      <AvailabilityManager
        initialAvailability={initialAvailability}
        onAvailabilityChange={onAvailabilityChangeMock}
      />
    );

    // onAvailabilityChange is called once on init due to useEffect dependency on regularSchedule/timeOff
    // This is fine as it reflects the initial state.
    // So, for the next change, it will be the second call.
    // Let's clear it after initial render if we only want to test the change from interaction
    onAvailabilityChangeMock.mockClear();


    const removeButtons = screen.getAllByTitle('Remove schedule');
    expect(removeButtons.length).toBeGreaterThan(0);

    await act(async () => {
        fireEvent.click(removeButtons[0]);
    });

    expect(onAvailabilityChangeMock).toHaveBeenCalledTimes(1);
    expect(onAvailabilityChangeMock).toHaveBeenCalledWith({
      regularSchedule: [], // Removed the only one
      timeOff: initialAvailability.timeOff,
    });
  });

  test('calls onAvailabilityChange when a new time off entry is added', async () => {
    render(
      <AvailabilityManager
        initialAvailability={{ regularSchedule: [], timeOff: [] }}
        onAvailabilityChange={onAvailabilityChangeMock}
      />
    );
    onAvailabilityChangeMock.mockClear(); // Clear after initial effect run

    fireEvent.click(screen.getByRole('button', { name: /Request Time Off/i })); // Open form

    // Fill the form (using default values: today for start/end, 'Personal')
    const startDateInput = screen.getByLabelText('Start Date');
    const today = new Date().toISOString().split('T')[0];
    fireEvent.change(startDateInput, { target: { value: today } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: today } });


    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Request Time Off' })); // Submit the small form
    });

    expect(onAvailabilityChangeMock).toHaveBeenCalledTimes(1);
    expect(onAvailabilityChangeMock).toHaveBeenCalledWith({
      regularSchedule: [],
      timeOff: [
        expect.objectContaining({ startDate: today, endDate: today, reason: 'Personal' }),
      ],
    });
  });

  test('calls onAvailabilityChange when a time off entry is removed', async () => {
    render(
      <AvailabilityManager
        initialAvailability={initialAvailability}
        onAvailabilityChange={onAvailabilityChangeMock}
      />
    );
    onAvailabilityChangeMock.mockClear();

    const removeButtons = screen.getAllByTitle('Remove time off');
    expect(removeButtons.length).toBeGreaterThan(0);

    await act(async () => {
        fireEvent.click(removeButtons[0]);
    });

    expect(onAvailabilityChangeMock).toHaveBeenCalledTimes(1);
    expect(onAvailabilityChangeMock).toHaveBeenCalledWith({
      regularSchedule: initialAvailability.regularSchedule,
      timeOff: [], // Removed the only one
    });
  });

  test('validates that schedule end time is after start time', async () => {
    render(
      <AvailabilityManager
        initialAvailability={{ regularSchedule: [], timeOff: [] }}
        onAvailabilityChange={onAvailabilityChangeMock}
      />
    );
    onAvailabilityChangeMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Add Schedule/i })); // Open form

    fireEvent.change(screen.getByLabelText('Start Time'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '09:00' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Schedule' }));
    });

    expect(screen.getByText('End time must be after start time')).toBeInTheDocument();
    expect(onAvailabilityChangeMock).not.toHaveBeenCalled(); // Should not proceed
  });

  test('validates that time off end date is on or after start date', async () => {
    render(
      <AvailabilityManager
        initialAvailability={{ regularSchedule: [], timeOff: [] }}
        onAvailabilityChange={onAvailabilityChangeMock}
      />
    );
    onAvailabilityChangeMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Request Time Off/i })); // Open form

    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2024-10-15' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2024-10-14' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Request Time Off' }));
    });

    expect(screen.getByText('End date must be on or after start date')).toBeInTheDocument();
    expect(onAvailabilityChangeMock).not.toHaveBeenCalled();
  });
});

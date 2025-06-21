import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UniversalScheduleView } from '../src/components';
import { universalScheduleService } from '../src/services';

import { act } from 'react-dom/test-utils'; // Import act

// Mock the universalScheduleService
jest.mock('../src/services/universalScheduleService', () => ({
  getSchedules: jest.fn(),
  getSchedule: jest.fn(),
  findConflicts: jest.fn(),
  createSchedule: jest.fn(),
  updateSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
  getScheduleWithDetails: jest.fn()
}));
// const universalScheduleService = require('../src/services/universalScheduleService'); // This line is redundant and causes the error


describe('UniversalScheduleView Component', () => {
  // Mock data for testing
  const mockSchedules = [
    {
      id: 'sched-1',
      title: 'Morning Care Visit',
      date: '2025-06-15',
      startTime: '09:00',
      endTime: '11:00',
      clientId: 'client-1',
      caregiverId: 'caregiver-1',
      client: { id: 'client-1', name: 'John Doe' },
      caregiver: { id: 'caregiver-1', name: 'Jane Smith' }
    },
    {
      id: 'sched-2',
      title: 'Medication Management',
      date: '2025-06-16',
      startTime: '14:00',
      endTime: '15:00',
      clientId: 'client-2',
      caregiverId: null,
      client: { id: 'client-2', name: 'Alice Johnson' },
      caregiver: null
    }
  ];

  let getSchedulesPromise;
  let findConflictsPromise;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Each test will set its own promise resolution for getSchedules if needed for specific timing
    // Default successful resolution
    universalScheduleService.getSchedules.mockResolvedValue(mockSchedules);
    universalScheduleService.findConflicts.mockResolvedValue([]);
    universalScheduleService.createSchedule.mockResolvedValue({ id: 'new-sched', ...mockSchedules[0], client: mockSchedules[0].client, caregiver: mockSchedules[0].caregiver });
    universalScheduleService.updateSchedule.mockResolvedValue({ success: true });
    universalScheduleService.deleteSchedule.mockResolvedValue({ success: true });
    universalScheduleService.getScheduleWithDetails.mockImplementation(async (id) => {
      return mockSchedules.find(s => s.id === id) || null;
    });
    
    window.confirm = jest.fn(() => true);
    window.prompt = jest.fn(() => 'Updated Title');
  });

  test('renders the component correctly and shows loading state, then schedules', async () => {
    // Make getSchedules not resolve immediately to test loading state
    let resolveGetSchedules;
    let resolveFindConflicts;
    const initialGetSchedulesPromise = new Promise(resolve => { resolveGetSchedules = resolve; });
    const initialFindConflictsPromise = new Promise(resolve => { resolveFindConflicts = resolve; });

    universalScheduleService.getSchedules.mockImplementationOnce(() => initialGetSchedulesPromise);
    // Assuming findConflicts is called for each schedule from the above promise
    universalScheduleService.findConflicts.mockImplementation(() => initialFindConflictsPromise);


    render(<UniversalScheduleView />);
    
    expect(screen.getByText(/Day/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading schedules/i)).toBeInTheDocument();

    // Resolve the promises and wait for state updates
    await act(async () => {
      resolveGetSchedules(mockSchedules); // Resolve with mock data
      await initialGetSchedulesPromise;
      // Since findConflicts is called per schedule, resolve them all
      // For simplicity, we'll assume they resolve quickly after getSchedules.
      // In a more complex scenario, each findConflicts call might need individual resolution.
      resolveFindConflicts([]); // Resolve with empty conflicts for all
      await Promise.all(mockSchedules.map(() => initialFindConflictsPromise));
    });
    
    expect(screen.queryByText(/Loading schedules/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Morning Care Visit/i)).toBeInTheDocument();
    expect(screen.getByText(/Medication Management/i)).toBeInTheDocument();
  });


  test('allows switching between view modes', async () => {
    render(<UniversalScheduleView />);
    
    // Wait for initial load to complete
    await screen.findByText(/Morning Care Visit/i); // Ensures initial data is loaded

    await act(async () => {
      fireEvent.click(screen.getByText(/Day/i));
    });
    // Add assertions if view change triggers new data fetches or specific UI updates
    // For now, just check the button is still there and active class might change
    expect(screen.getByText(/Day/i)).toHaveClass('active');
    
    await act(async () => {
      fireEvent.click(screen.getByText(/Week/i));
    });
    expect(screen.getByText(/Week/i)).toHaveClass('active');

    await act(async () => {
      fireEvent.click(screen.getByText(/Month/i));
    });
    expect(screen.getByText(/Month/i)).toHaveClass('active');
  });

  test('allows filtering by display mode', async () => {
    render(<UniversalScheduleView />);
    await screen.findByText(/Morning Care Visit/i); // Ensures initial data is loaded
    
    await act(async () => {
      fireEvent.click(screen.getByText(/Client Only/i));
    });
    expect(screen.getByText(/Client Only/i)).toHaveClass('active');
    // Potentially assert that only client schedules are visible if component supports it visually
    
    await act(async () => {
      fireEvent.click(screen.getByText(/Caregiver Only/i));
    });
    expect(screen.getByText(/Caregiver Only/i)).toHaveClass('active');

    await act(async () => {
      fireEvent.click(screen.getByText(/All Schedules/i));
    });
    expect(screen.getByText(/All Schedules/i)).toHaveClass('active');
  });

  test('allows creating a new schedule', async () => {
    // Reset getSchedules to be called for the refresh
    universalScheduleService.getSchedules.mockResolvedValueOnce(mockSchedules) // Initial load
                                        .mockResolvedValueOnce([...mockSchedules, { id: 'new-sched', ...mockSchedules[0], title: 'New Schedule From API' }]); // After creation

    render(<UniversalScheduleView />);
    await screen.findByText(/Morning Care Visit/i); // Initial load complete

    await act(async () => {
      fireEvent.click(screen.getByText(/\+ New Schedule/i));
      // Ensure createSchedule promise resolves before getSchedules is called again
      await universalScheduleService.createSchedule.mock.results[0].value;
      // Wait for the subsequent getSchedules call to resolve
      if (universalScheduleService.getSchedules.mock.calls.length > 1) {
        await universalScheduleService.getSchedules.mock.results[1].value;
      }
    });
    
    expect(universalScheduleService.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Schedule' // This matches the default title in handleCreateSchedule
      })
    );
    
    expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(2);
    // Optionally, check if the new schedule is rendered
    // await screen.findByText(/New Schedule From API/i); // If the mock returns it with this title
  });

  test('allows navigating date ranges', async () => {
    // Initial call
    universalScheduleService.getSchedules.mockResolvedValueOnce(mockSchedules);
    // Call after "Previous"
    universalScheduleService.getSchedules.mockResolvedValueOnce([{ ...mockSchedules[0], title: "Previous Range Schedule" }]);
    // Call after "Next"
    universalScheduleService.getSchedules.mockResolvedValueOnce([{ ...mockSchedules[0], title: "Next Range Schedule" }]);


    render(<UniversalScheduleView />);
    await screen.findByText(/Morning Care Visit/i); // Initial load
    expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByText(/< Previous/i));
      // Wait for the specific mock call to resolve
      if (universalScheduleService.getSchedules.mock.calls.length > 1) {
         await universalScheduleService.getSchedules.mock.results[1].value;
      }
    });
    expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(2);
    await screen.findByText(/Previous Range Schedule/i);
    
    await act(async () => {
      fireEvent.click(screen.getByText(/Next >/i));
       if (universalScheduleService.getSchedules.mock.calls.length > 2) {
         await universalScheduleService.getSchedules.mock.results[2].value;
      }
    });
    expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(3);
    await screen.findByText(/Next Range Schedule/i);
  });
});

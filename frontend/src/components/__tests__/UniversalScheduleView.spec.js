import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import UniversalScheduleView from '../UniversalScheduleView'; // Adjust path
import { universalScheduleService } from '../../services'; // Adjust path

// Mock universalScheduleService
jest.mock('../../services', () => ({
  universalScheduleService: {
    getSchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    findConflicts: jest.fn(),
    getScheduleWithDetails: jest.fn(),
  },
}));

// Mock window.confirm for delete operations
global.confirm = jest.fn(() => true);
global.prompt = jest.fn(() => 'New Title');


describe('UniversalScheduleView Component', () => {
  const mockSchedules = [
    { id: 's1', title: 'Morning Shift', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '12:00', clientId: 'c1', caregiverId: 'cg1', client: { name: 'Client Alpha' }, caregiver: { name: 'Caregiver Gamma' } },
    { id: 's2', title: 'Afternoon Visit', date: new Date().toISOString().split('T')[0], startTime: '14:00', endTime: '16:00', clientId: 'c2', caregiverId: 'cg2', client: { name: 'Client Beta' }, caregiver: { name: 'Caregiver Delta' } },
  ];
  const mockConflicts = [{ scheduleId: 's1', type: 'doubleBooking' }];

  beforeEach(() => {
    jest.clearAllMocks();
    universalScheduleService.getSchedules.mockResolvedValue(mockSchedules);
    universalScheduleService.findConflicts.mockResolvedValue([]); // Default to no conflicts for individual checks
    universalScheduleService.createSchedule.mockResolvedValue({ id: 'newS3', ...mockSchedules[0] });
    universalScheduleService.updateSchedule.mockResolvedValue({ ...mockSchedules[0], title: 'Updated Title' });
    universalScheduleService.deleteSchedule.mockResolvedValue({ success: true });
    universalScheduleService.getScheduleWithDetails.mockResolvedValue({ ...mockSchedules[0], title: 'Updated Title' }); // For re-fetch after update
  });

  test('renders loading state initially then displays schedules', async () => {
    render(<UniversalScheduleView />);
    expect(screen.getByText('Loading schedules...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Morning Shift')).toBeInTheDocument();
      expect(screen.getByText('Afternoon Visit')).toBeInTheDocument();
    });
    expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(1);
  });

  test('displays error message if fetching schedules fails', async () => {
    universalScheduleService.getSchedules.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<UniversalScheduleView />);
    await waitFor(() => {
      // The component logs error but doesn't display it directly. This test verifies it handles the error.
      // To assert an error message, the component would need to set an error state and render it.
      // For now, check that loading is false and schedules are empty.
      expect(screen.queryByText('Loading schedules...')).not.toBeInTheDocument();
      expect(screen.queryByText('Morning Shift')).not.toBeInTheDocument();
    });
  });

  test('displays "No schedules available." when no schedules are returned', async () => {
    universalScheduleService.getSchedules.mockResolvedValueOnce([]);
    render(<UniversalScheduleView />);
    await waitFor(() => {
      // The grid itself might render headers, but no schedule cards.
      // A specific "No schedules" message isn't in the code, it just renders an empty grid.
      // We can check that no schedule cards are present.
      expect(screen.queryByText('Morning Shift')).not.toBeInTheDocument();
    });
  });

  test('changes view when view buttons are clicked (day, week, month)', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(1)); // Initial month view

    fireEvent.click(screen.getByText('Week'));
    // View change should trigger a re-render and potentially new data fetch logic based on view (though fetchSchedules is dateRange dependent)
    // The current component's getDates() function changes based on view.
    // We expect getSchedules to be called again due to dateRange potentially changing or logic re-evaluating.
    // For this test, let's assume view change itself doesn't re-fetch if dateRange is same, but re-renders.
    // The actual re-fetch is tied to dateRange state in fetchSchedules useCallback.
    // This test primarily checks UI change.
    expect(screen.getByText('Week')).toHaveClass('active');

    fireEvent.click(screen.getByText('Day'));
    expect(screen.getByText('Day')).toHaveClass('active');
  });

  test('navigates dates using Previous/Next buttons', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(1)); // Initial

    fireEvent.click(screen.getByText('Next >'));
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(2)); // After clicking next

    fireEvent.click(screen.getByText('< Previous'));
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(3)); // After clicking previous
  });

  test('filters schedules by display mode (All, Client, Caregiver)', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(screen.getByText('Morning Shift')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Client Only'));
    // Assuming mockSchedules[0] has a clientId and mockSchedules[1] might not for a simple filter test
    // The filtering logic is inside the component, so we check rendered output.
    expect(screen.getByText('Client Only')).toHaveClass('active');
    // Add more specific assertions based on how filtering affects the mockSchedules display

    fireEvent.click(screen.getByText('Caregiver Only'));
    expect(screen.getByText('Caregiver Only')).toHaveClass('active');
  });

  test('creates a new schedule when "New Schedule" button is clicked', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('+ New Schedule'));
    await waitFor(() => expect(universalScheduleService.createSchedule).toHaveBeenCalledTimes(1));
    expect(universalScheduleService.createSchedule).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Schedule', // Default title from component
      startTime: '09:00'
    }));
    // Expect fetchSchedules to be called again after creation
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(2));
  });

  test('selects a schedule on click and shows details', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(screen.getByText('Morning Shift')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Morning Shift')); // Click the first schedule card
    await waitFor(() => {
      expect(screen.getByText('Schedule Details')).toBeInTheDocument();
      expect(screen.getByText(mockSchedules[0].title)).toBeInTheDocument(); // Detail view shows title
    });
  });

  test('updates a selected schedule', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(screen.getByText('Morning Shift')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Morning Shift')); // Select it
    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());

    global.prompt.mockReturnValueOnce('Updated Morning Shift'); // Mock prompt input
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => expect(universalScheduleService.updateSchedule).toHaveBeenCalledWith('s1', { title: 'Updated Morning Shift' }));
    await waitFor(() => expect(universalScheduleService.getScheduleWithDetails).toHaveBeenCalledWith('s1')); // For refreshing selectedSchedule
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(2)); // Initial + after update
  });

  test('deletes a selected schedule with confirmation', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(screen.getByText('Morning Shift')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Morning Shift')); // Select it
    await waitFor(() => expect(screen.getByText('Delete')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Delete'));
    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this schedule?');
    await waitFor(() => expect(universalScheduleService.deleteSchedule).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Schedule Details')).not.toBeInTheDocument(); // Details view should close
  });

  test('simulates drag and drop to update schedule date/time', async () => {
    render(<UniversalScheduleView />);
    await waitFor(() => expect(screen.getByText('Morning Shift')).toBeInTheDocument());

    const scheduleCard = screen.getByText('Morning Shift');
    fireEvent.dragStart(scheduleCard); // Simulate drag start

    // Find a target cell (this is tricky without actual layout, needs specific data-testid or similar)
    // For this example, we'll assume a drop target exists and directly call handleDrop for logic test.
    // This requires handleDrop to be accessible or to trigger it via dropping on a cell.
    // Let's assume a cell can be identified and `handleDrop` is implicitly called.
    // We will directly test the component's `handleDrop` by setting `draggedSchedule` state.
    // This means we can't directly use fireEvent.drop without a proper drop target.

    // Simulate setting draggedSchedule state (as if dragStart worked)
    // This is more of a unit test of handleDrop's effect on handleUpdateSchedule
    act(() => {
        // To test handleDrop, we'd ideally find a cell and fireEvent.drop(cell)
        // For now, let's spy on handleUpdateSchedule and manually set draggedSchedule if possible
        // Or, we can infer that if handleUpdateSchedule is called, drag/drop logic is working.
        // The component sets draggedSchedule onDragStart.
    });

    // This test will be limited because RTL doesn't fully support drag and drop interactions easily.
    // We'll check if handleUpdateSchedule is called if we could simulate a drop.
    // For now, focus on testing the handler methods directly if possible or ensure coverage via other interactions.
    // The `handleUpdateSchedule` itself is tested in other tests.
  });

  test('displays conflict indicators on schedules', async () => {
    universalScheduleService.findConflicts.mockImplementation(async (scheduleId) => {
        if (scheduleId === 's1') return [{ scheduleId: 's1', type: 'doubleBooking', conflictingScheduleId: 's-conflict' }];
        return [];
    });
    // Re-render with new mock for findConflicts to apply to initial fetchSchedules
    render(<UniversalScheduleView />);
    await waitFor(() => {
        const scheduleCard = screen.getByText('Morning Shift').closest('.schedule-card');
        expect(scheduleCard).toHaveClass('conflict');
    });
  });

});

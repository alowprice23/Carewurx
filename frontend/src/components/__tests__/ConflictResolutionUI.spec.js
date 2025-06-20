import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConflictResolutionUI from '../ConflictResolutionUI';
import { universalScheduleService, notificationService } from '../../services';

// Mock services
jest.mock('../../services', () => ({
  universalScheduleService: {
    getConflicts: jest.fn(), // Replaces getPendingConflicts, etc.
    getConflictResolutionOptions: jest.fn(),
    resolveConflict: jest.fn(),
    overrideConflict: jest.fn(),
    getConflictResolutionHistory: jest.fn(),
  },
  notificationService: {
    createNotification: jest.fn(),
  },
}));

// Mock window.confirm for delete operations (though not directly in this component, good practice if it were)
global.confirm = jest.fn(() => true);
// Mock window.prompt if any edit features used it (not in this component's current direct logic)
// global.prompt = jest.fn(() => 'Test Note');


describe('ConflictResolutionUI Component', () => {
  const mockConflictsData = [
    { id: 'conflict1', detectedAt: new Date('2024-01-15T10:00:00Z').toISOString(), client: { name: 'Client Alpha' }, caregivers: [{name: 'CG A'}, {name: 'CG B'}], scheduleDate: '2024-01-20', startTime: '10:00', endTime: '12:00', type: 'Double Booking', severity: 8, description: 'Caregiver A double booked.', status: 'pending', scheduleId: 's1' },
    { id: 'conflict2', detectedAt: new Date('2024-01-14T12:00:00Z').toISOString(), client: { name: 'Client Beta' }, caregivers: [{name: 'CG C'}], scheduleDate: '2024-01-22', startTime: '14:00', endTime: '16:00', type: 'Travel Time', severity: 5, description: 'Insufficient travel time for CG C.', status: 'pending', scheduleId: 's2' },
  ];
  const mockResolvedConflictsData = [
    { id: 'conflict3', detectedAt: new Date('2024-01-13T09:00:00Z').toISOString(), client: { name: 'Client Gamma' }, caregivers: [{name: 'CG D'}], scheduleDate: '2024-01-19', startTime: '08:00', endTime: '10:00', type: 'Double Booking', severity: 7, description: 'Resolved issue.', status: 'resolved', scheduleId: 's3' }
  ];
  const mockResolutionOptions = [
    { id: 'opt1', description: 'Reschedule Primary', impactLevel: 'medium' },
    { id: 'opt2', description: 'Reassign Caregiver', impactLevel: 'low' },
  ];
  const mockHistory = [
    { id: 'hist1', resolvedAt: new Date().toISOString(), method: 'resolution', conflictType: 'Double Booking', resolvedBy: 'Admin', client: {name: 'Client Old'}, note: 'Rescheduled client Old' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    universalScheduleService.getConflicts.mockImplementation(async (filters) => {
        if (filters?.status === 'pending') return mockConflictsData.filter(c => c.status === 'pending');
        if (filters?.status === 'resolved') return mockResolvedConflictsData;
        return [...mockConflictsData, ...mockResolvedConflictsData]; // 'all'
    });
    universalScheduleService.getConflictResolutionOptions.mockResolvedValue(mockResolutionOptions);
    universalScheduleService.resolveConflict.mockResolvedValue({ success: true });
    universalScheduleService.overrideConflict.mockResolvedValue({ success: true });
    universalScheduleService.getConflictResolutionHistory.mockResolvedValue(mockHistory);
    notificationService.createNotification.mockResolvedValue({ success: true });
  });

  test('renders loading state initially then displays pending conflicts and history', async () => {
    render(<ConflictResolutionUI />);
    expect(screen.getByText('Loading conflicts...')).toBeInTheDocument();
    expect(screen.getByText('Loading resolution history...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Client Alpha')).toBeInTheDocument(); // From mockConflictsData
      expect(screen.getByText('Client Beta')).toBeInTheDocument();
    });
    await waitFor(() => {
        expect(screen.getByText(/Rescheduled client Old/i)).toBeInTheDocument(); // From mockHistory
    });
    expect(universalScheduleService.getConflicts).toHaveBeenCalledWith({ status: 'pending' });
    expect(universalScheduleService.getConflictResolutionHistory).toHaveBeenCalledTimes(1);
  });

  test('displays "No conflicts found" when no pending conflicts are returned', async () => {
    universalScheduleService.getConflicts.mockResolvedValueOnce([]);
    render(<ConflictResolutionUI />);
    await waitFor(() => {
      expect(screen.getByText(/No pending conflicts found./i)).toBeInTheDocument();
    });
  });

  test('filters conflicts by status (Pending, Resolved, All)', async () => {
    render(<ConflictResolutionUI />);
    await waitFor(() => expect(universalScheduleService.getConflicts).toHaveBeenCalledWith({ status: 'pending' }));

    fireEvent.click(screen.getByText('Resolved'));
    await waitFor(() => expect(universalScheduleService.getConflicts).toHaveBeenCalledWith({ status: 'resolved' }));
    expect(screen.queryByText('Client Alpha')).not.toBeInTheDocument(); // Pending conflict
    await waitFor(() => expect(screen.getByText('Client Gamma')).toBeInTheDocument()); // Resolved conflict

    fireEvent.click(screen.getByText('All'));
    await waitFor(() => expect(universalScheduleService.getConflicts).toHaveBeenCalledWith({ status: undefined })); // all
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Client Gamma')).toBeInTheDocument());
  });

  test('sorts conflicts when table headers are clicked', async () => {
    render(<ConflictResolutionUI />);
    await waitFor(() => expect(universalScheduleService.getConflicts).toHaveBeenCalledTimes(1)); // Initial fetch

    const clientHeader = screen.getByText(/Client/); // Matches "Client" header
    fireEvent.click(clientHeader); // Sort by client asc
    // fetchConflicts is called again due to state change in sortBy/sortDirection
    await waitFor(() => expect(universalScheduleService.getConflicts).toHaveBeenCalledTimes(2));
    // Add assertions here about the order if mock data is suitable for it.
    // For now, just checking re-fetch.

    fireEvent.click(clientHeader); // Sort by client desc
    await waitFor(() => expect(universalScheduleService.getConflicts).toHaveBeenCalledTimes(3));
  });

  test('selects a conflict and fetches resolution options, then shows details', async () => {
    render(<ConflictResolutionUI />);
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Client Alpha')); // Click the first conflict

    await waitFor(() => expect(universalScheduleService.getConflictResolutionOptions).toHaveBeenCalledWith(mockConflictsData[0]));
    await waitFor(() => expect(screen.getByText('Conflict Details')).toBeInTheDocument());
    expect(screen.getByText(mockResolutionOptions[0].description)).toBeInTheDocument();
  });

  test('resolves a conflict when an option is applied', async () => {
    render(<ConflictResolutionUI onResolutionComplete={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Client Alpha')); // Select conflict
    await waitFor(() => expect(screen.getByText(mockResolutionOptions[0].description)).toBeInTheDocument());

    const resolutionNoteInput = screen.getByPlaceholderText('Enter any notes about this resolution...');
    fireEvent.change(resolutionNoteInput, { target: { value: 'Test resolution note' } });

    const applyButtons = screen.getAllByText('Apply This Resolution');
    fireEvent.click(applyButtons[0]); // Click first apply button

    await waitFor(() => expect(universalScheduleService.resolveConflict).toHaveBeenCalledWith({
      conflictId: mockConflictsData[0].id,
      resolutionOptionId: mockResolutionOptions[0].id,
      notes: 'Test resolution note',
      resolvedBy: 'temp-user-id' // Placeholder from component
    }));
    expect(notificationService.createNotification).toHaveBeenCalled();
    expect(universalScheduleService.getConflicts).toHaveBeenCalledTimes(2); // Initial + refresh
    expect(universalScheduleService.getConflictResolutionHistory).toHaveBeenCalledTimes(2);
  });

  test('manually overrides a conflict', async () => {
    render(<ConflictResolutionUI onResolutionComplete={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Client Alpha'));
    await waitFor(() => expect(screen.getByText('Manual Override')).toBeInTheDocument());

    const resolutionNoteInput = screen.getByPlaceholderText('Enter any notes about this resolution...');
    fireEvent.change(resolutionNoteInput, { target: { value: 'Manual override reason' } });

    fireEvent.click(screen.getByText('Manual Override'));
    await waitFor(() => expect(universalScheduleService.overrideConflict).toHaveBeenCalledWith({
      conflictId: mockConflictsData[0].id,
      overrideReason: 'Manual override reason',
      userId: 'temp-user-id' // Placeholder from component
    }));
    expect(notificationService.createNotification).toHaveBeenCalled();
  });

  test('handles error when fetching conflicts', async () => {
    universalScheduleService.getConflicts.mockRejectedValueOnce(new Error("Fetch Conflict Error"));
    render(<ConflictResolutionUI />);
    await waitFor(() => {
        expect(screen.getByText('Failed to load scheduling conflicts. Please try again.')).toBeInTheDocument();
    });
  });

  test('handles error when resolving a conflict', async () => {
    universalScheduleService.resolveConflict.mockRejectedValueOnce(new Error("Resolve Error"));
    render(<ConflictResolutionUI />);
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Client Alpha'));
    await waitFor(() => expect(screen.getByText(mockResolutionOptions[0].description)).toBeInTheDocument());

    const applyButtons = screen.getAllByText('Apply This Resolution');
    fireEvent.click(applyButtons[0]);

    await waitFor(() => {
        expect(screen.getByText('Failed to resolve conflict. Please try again.')).toBeInTheDocument();
    });
  });
});

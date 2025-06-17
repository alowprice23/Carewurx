import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConflictResolutionUI } from '../src/components';
import { universalScheduleService, notificationService } from '../src/services';

// Mock the services
jest.mock('../src/services', () => ({
  universalScheduleService: {
    getPendingConflicts: jest.fn(),
    getResolvedConflicts: jest.fn(),
    getAllConflicts: jest.fn(),
    getConflictResolutionOptions: jest.fn(),
    getConflictResolutionHistory: jest.fn(),
    resolveConflict: jest.fn(),
    overrideConflict: jest.fn()
  },
  notificationService: {
    createNotification: jest.fn()
  }
}));

describe('ConflictResolutionUI Component', () => {
  // Mock data for testing
  const mockConflicts = [
    {
      id: 'conflict-1',
      type: 'Caregiver Double Booking',
      severity: 8,
      detectedAt: '2025-06-14T10:30:00.000Z',
      client: { id: 'client-1', name: 'John Doe' },
      caregivers: [
        { id: 'caregiver-1', name: 'Jane Smith' },
        { id: 'caregiver-2', name: 'Mark Johnson' }
      ],
      scheduleId: 'schedule-1',
      scheduleDate: '2025-06-15',
      startTime: '09:00',
      endTime: '11:00',
      description: 'Jane Smith is already assigned to another client during this time slot.'
    },
    {
      id: 'conflict-2',
      type: 'Client Preference Mismatch',
      severity: 5,
      detectedAt: '2025-06-14T11:15:00.000Z',
      client: { id: 'client-2', name: 'Alice Johnson' },
      caregivers: [
        { id: 'caregiver-3', name: 'Robert Brown' }
      ],
      scheduleId: 'schedule-2',
      scheduleDate: '2025-06-16',
      startTime: '14:00',
      endTime: '16:00',
      description: 'This schedule conflicts with client-specified unavailable times.'
    }
  ];

  const mockResolutionOptions = [
    {
      id: 'option-1',
      description: 'Reassign to caregiver Sarah Wilson who is available during this time slot.',
      impactLevel: 'Low'
    },
    {
      id: 'option-2',
      description: 'Reschedule to 2:00 PM on the same day when Jane Smith is available.',
      impactLevel: 'Medium'
    },
    {
      id: 'option-3',
      description: 'Cancel this appointment and reschedule for next week.',
      impactLevel: 'High'
    }
  ];

  const mockResolutionHistory = [
    {
      id: 'history-1',
      conflictId: 'conflict-old-1',
      conflictType: 'Caregiver Double Booking',
      resolvedAt: '2025-06-10T14:30:00.000Z',
      resolvedBy: 'System Admin',
      method: 'resolution',
      resolutionDescription: 'Rescheduled to 3:00 PM when caregiver became available',
      note: 'Client was notified of the change',
      client: { id: 'client-3', name: 'Michael Brown' }
    },
    {
      id: 'history-2',
      conflictId: 'conflict-old-2',
      conflictType: 'Client Preference Mismatch',
      resolvedAt: '2025-06-09T09:45:00.000Z',
      resolvedBy: 'System Admin',
      method: 'override',
      note: 'Client agreed to the exception for this appointment only',
      client: { id: 'client-4', name: 'Susan Taylor' }
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    universalScheduleService.getPendingConflicts.mockResolvedValue(mockConflicts);
    universalScheduleService.getResolvedConflicts.mockResolvedValue([]);
    universalScheduleService.getAllConflicts.mockResolvedValue([...mockConflicts, ...mockResolutionHistory]);
    universalScheduleService.getConflictResolutionOptions.mockResolvedValue(mockResolutionOptions);
    universalScheduleService.getConflictResolutionHistory.mockResolvedValue(mockResolutionHistory);
    universalScheduleService.resolveConflict.mockResolvedValue({ success: true });
    universalScheduleService.overrideConflict.mockResolvedValue({ success: true });
    notificationService.createNotification.mockResolvedValue({ success: true });
  });

  test('renders the component correctly', async () => {
    render(<ConflictResolutionUI />);
    
    // Should show loading state initially
    expect(screen.getByText(/Loading conflicts/i)).toBeInTheDocument();
    
    // Wait for conflicts to load
    await waitFor(() => {
      expect(universalScheduleService.getPendingConflicts).toHaveBeenCalled();
      expect(universalScheduleService.getConflictResolutionHistory).toHaveBeenCalled();
    });
    
    // Check for filter options
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    
    // Check that conflicts are displayed
    expect(screen.getByText('Schedule Conflicts')).toBeInTheDocument();
    expect(screen.getByText('Resolution History')).toBeInTheDocument();
  });

  test('displays conflict list correctly', async () => {
    render(<ConflictResolutionUI />);
    
    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading conflicts/i)).not.toBeInTheDocument();
    });
    
    // Check for conflict items
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Caregiver Double Booking')).toBeInTheDocument();
    expect(screen.getByText('Client Preference Mismatch')).toBeInTheDocument();
  });

  test('shows conflict details when a conflict is selected', async () => {
    render(<ConflictResolutionUI />);
    
    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading conflicts/i)).not.toBeInTheDocument();
    });
    
    // Click on first conflict
    fireEvent.click(screen.getByText('John Doe'));
    
    // Check that conflict details are displayed
    expect(screen.getByText('Conflict Details')).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith is already assigned/i)).toBeInTheDocument();
    
    // Check for resolution options section
    expect(screen.getByText('Resolution Options')).toBeInTheDocument();
    
    // Wait for resolution options to load
    await waitFor(() => {
      expect(universalScheduleService.getConflictResolutionOptions).toHaveBeenCalledWith('conflict-1');
    });
    
    // Check that resolution options are displayed
    expect(screen.getByText(/Reassign to caregiver Sarah Wilson/i)).toBeInTheDocument();
    expect(screen.getByText(/Reschedule to 2:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel this appointment/i)).toBeInTheDocument();
  });

  test('allows resolving a conflict', async () => {
    render(<ConflictResolutionUI />);
    
    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading conflicts/i)).not.toBeInTheDocument();
    });
    
    // Click on first conflict
    fireEvent.click(screen.getByText('John Doe'));
    
    // Wait for resolution options to load
    await waitFor(() => {
      expect(screen.getByText(/Reassign to caregiver Sarah Wilson/i)).toBeInTheDocument();
    });
    
    // Add resolution note
    fireEvent.change(screen.getByPlaceholderText(/Enter any notes/i), {
      target: { value: 'Testing resolution note' }
    });
    
    // Click on first resolution option
    const applyButtons = screen.getAllByText('Apply This Resolution');
    fireEvent.click(applyButtons[0]);
    
    // Check that resolveConflict was called with correct data
    await waitFor(() => {
      expect(universalScheduleService.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-1',
        resolutionOptionId: 'option-1',
        note: 'Testing resolution note'
      });
    });
    
    // Check that notification was created
    expect(notificationService.createNotification).toHaveBeenCalled();
    
    // Check that conflicts are refreshed
    expect(universalScheduleService.getPendingConflicts).toHaveBeenCalledTimes(2);
    expect(universalScheduleService.getConflictResolutionHistory).toHaveBeenCalledTimes(2);
  });

  test('allows manual override of a conflict', async () => {
    render(<ConflictResolutionUI />);
    
    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading conflicts/i)).not.toBeInTheDocument();
    });
    
    // Click on first conflict
    fireEvent.click(screen.getByText('John Doe'));
    
    // Wait for resolution options to load
    await waitFor(() => {
      expect(screen.getByText(/Resolution Options/i)).toBeInTheDocument();
    });
    
    // Add resolution note
    fireEvent.change(screen.getByPlaceholderText(/Enter any notes/i), {
      target: { value: 'Manual override reason' }
    });
    
    // Click on manual override button
    fireEvent.click(screen.getByText('Manual Override'));
    
    // Check that overrideConflict was called with correct data
    await waitFor(() => {
      expect(universalScheduleService.overrideConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-1',
        overrideReason: 'Manual override reason'
      });
    });
    
    // Check that notification was created
    expect(notificationService.createNotification).toHaveBeenCalled();
    
    // Check that conflicts are refreshed
    expect(universalScheduleService.getPendingConflicts).toHaveBeenCalledTimes(2);
    expect(universalScheduleService.getConflictResolutionHistory).toHaveBeenCalledTimes(2);
  });

  test('allows changing filter status', async () => {
    render(<ConflictResolutionUI />);
    
    // Wait for conflicts to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading conflicts/i)).not.toBeInTheDocument();
    });
    
    // Click on Resolved filter
    fireEvent.click(screen.getByText('Resolved'));
    
    // Check that getResolvedConflicts was called
    await waitFor(() => {
      expect(universalScheduleService.getResolvedConflicts).toHaveBeenCalled();
    });
    
    // Click on All filter
    fireEvent.click(screen.getByText('All'));
    
    // Check that getAllConflicts was called
    await waitFor(() => {
      expect(universalScheduleService.getAllConflicts).toHaveBeenCalled();
    });
  });

  test('displays resolution history correctly', async () => {
    render(<ConflictResolutionUI />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading conflicts/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Loading resolution history/i)).not.toBeInTheDocument();
    });
    
    // Check for history items
    expect(screen.getByText('Michael Brown')).toBeInTheDocument();
    expect(screen.getByText('Susan Taylor')).toBeInTheDocument();
    expect(screen.getByText('Manual Override')).toBeInTheDocument();
    expect(screen.getByText('Automatic Resolution')).toBeInTheDocument();
  });

  test('handles errors gracefully', async () => {
    // Mock service to throw error
    universalScheduleService.getPendingConflicts.mockRejectedValue(new Error('API Error'));
    
    render(<ConflictResolutionUI />);
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to load scheduling conflicts/i)).toBeInTheDocument();
    });
  });
});

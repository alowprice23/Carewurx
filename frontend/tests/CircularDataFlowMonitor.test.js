import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CircularDataFlowMonitor } from '../src/components';
import { schedulerService, notificationService, universalScheduleService } from '../src/services';

// Mock the services
jest.mock('../src/services', () => ({
  schedulerService: {
    getEntityFlowData: jest.fn()
  },
  notificationService: {
    showNotification: jest.fn()
  },
  universalScheduleService: {
    getDataFlowMetrics: jest.fn(),
    getUpdateHistory: jest.fn(),
    getDataConflicts: jest.fn(),
    resolveConflict: jest.fn()
  }
}));

// Mock canvas operations
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn()
  })),
  font: '',
  fillStyle: '',
  textAlign: '',
  strokeStyle: '',
  lineWidth: 0,
  fillText: jest.fn()
}));

describe('CircularDataFlowMonitor Component', () => {
  // Mock data for testing
  const mockFlowData = {
    entities: [
      { 
        id: 'client1', 
        type: 'CLIENT', 
        name: 'John Doe', 
        updateCount: 5, 
        lastUpdate: '2025-06-10T10:30:00Z', 
        hasConflict: false 
      },
      { 
        id: 'caregiver1', 
        type: 'CAREGIVER', 
        name: 'Jane Smith', 
        updateCount: 3, 
        lastUpdate: '2025-06-11T14:15:00Z', 
        hasConflict: true 
      },
      { 
        id: 'schedule1', 
        type: 'SCHEDULE', 
        name: 'Appointment #1', 
        updateCount: 2, 
        lastUpdate: '2025-06-12T09:00:00Z', 
        hasConflict: false 
      },
      {
        id: 'relation1',
        type: 'RELATION',
        sourceId: 'client1',
        targetId: 'schedule1',
        strength: 2,
        flowRate: 3,
        hasConflict: false
      },
      {
        id: 'relation2',
        type: 'RELATION',
        sourceId: 'caregiver1',
        targetId: 'schedule1',
        strength: 2,
        flowRate: 1,
        hasConflict: true
      }
    ]
  };
  
  const mockUpdateHistory = {
    updates: [
      {
        id: 'update1',
        entityId: 'client1',
        entityName: 'John Doe',
        entityType: 'CLIENT',
        timestamp: '2025-06-10T10:30:00Z',
        updateType: 'MODIFY',
        userId: 'user1',
        description: 'Updated client information',
        changes: {
          'phone': {
            previous: '123-456-7890',
            new: '987-654-3210'
          }
        }
      },
      {
        id: 'update2',
        entityId: 'schedule1',
        entityName: 'Appointment #1',
        entityType: 'SCHEDULE',
        timestamp: '2025-06-12T09:00:00Z',
        updateType: 'CREATE',
        userId: 'user1',
        description: 'Created new schedule'
      }
    ]
  };
  
  const mockConflicts = {
    conflicts: [
      {
        id: 'conflict1',
        title: 'Scheduling Conflict',
        sourceEntityId: 'caregiver1',
        sourceEntityName: 'Jane Smith',
        sourceEntityType: 'CAREGIVER',
        targetEntityId: 'schedule1',
        targetEntityName: 'Appointment #1',
        targetEntityType: 'SCHEDULE',
        severity: 'high',
        type: 'TIME_OVERLAP',
        description: 'Caregiver is already scheduled during this time',
        detectedAt: '2025-06-11T14:15:00Z',
        resolutionOptions: [
          { id: 'reschedule', label: 'Reschedule Appointment' },
          { id: 'reassign', label: 'Reassign Caregiver' },
          { id: 'cancel', label: 'Cancel Appointment' }
        ]
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    universalScheduleService.getDataFlowMetrics.mockResolvedValue(mockFlowData);
    universalScheduleService.getUpdateHistory.mockResolvedValue(mockUpdateHistory);
    universalScheduleService.getDataConflicts.mockResolvedValue(mockConflicts);
    universalScheduleService.resolveConflict.mockResolvedValue({ success: true });
  });

  test('renders the component correctly', async () => {
    render(<CircularDataFlowMonitor />);
    
    // Check for main components
    expect(screen.getByText('Circular Data Flow Monitor')).toBeInTheDocument();
    
    // Check for time range selector
    expect(screen.getByText('Time Range:')).toBeInTheDocument();
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    
    // Check for auto-refresh controls
    expect(screen.getByText('Auto-refresh:')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    
    // Check for refresh button
    expect(screen.getByText('Refresh Now')).toBeInTheDocument();
    
    // Check for view tabs
    expect(screen.getByText('Flow Visualization')).toBeInTheDocument();
    expect(screen.getByText('Update History')).toBeInTheDocument();
    expect(screen.getByText('Conflicts')).toBeInTheDocument();
    
    // Check for canvas
    expect(document.querySelector('canvas')).toBeInTheDocument();
    
    // Wait for initial data fetch
    await waitFor(() => {
      expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalled();
      expect(universalScheduleService.getUpdateHistory).toHaveBeenCalled();
      expect(universalScheduleService.getDataConflicts).toHaveBeenCalled();
    });
  });

  test('fetches data with correct time range', async () => {
    render(<CircularDataFlowMonitor />);
    
    // Wait for initial data fetch
    await waitFor(() => {
      expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalledWith({
        timeRange: '24h'
      });
    });
    
    // Change time range
    const timeRangeSelect = screen.getByText('Last 24 Hours').closest('select');
    fireEvent.change(timeRangeSelect, { target: { value: '7d' } });
    
    // Wait for data to be fetched with new time range
    await waitFor(() => {
      expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalledWith({
        timeRange: '7d'
      });
    });
  });

  test('handles manual refresh correctly', async () => {
    render(<CircularDataFlowMonitor />);
    
    // Wait for initial data fetch
    await waitFor(() => {
      expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalledTimes(1);
    });
    
    // Click refresh button
    fireEvent.click(screen.getByText('Refresh Now'));
    
    // Wait for data to be fetched again
    await waitFor(() => {
      expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalledTimes(2);
    });
  });

  test('switches between view tabs', async () => {
    render(<CircularDataFlowMonitor />);
    
    // Wait for initial data fetch
    await waitFor(() => {
      expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalled();
    });
    
    // Flow visualization should be active by default
    expect(screen.getByText('Flow Visualization')).toHaveClass('active');
    
    // Click Update History tab
    fireEvent.click(screen.getByText('Update History'));
    
    // Update History tab should be active now
    expect(screen.getByText('Update History')).toHaveClass('active');
    expect(screen.getByText('Update History Timeline')).toBeInTheDocument();
    
    // Check for update history content
    expect(screen.getByText('Updated client information')).toBeInTheDocument();
    expect(screen.getByText('Created new schedule')).toBeInTheDocument();
    
    // Click Conflicts tab
    fireEvent.click(screen.getByText('Conflicts'));
    
    // Conflicts tab should be active now
    expect(screen.getByText('Conflicts')).toHaveClass('active');
    expect(screen.getByText('Data Conflicts')).toBeInTheDocument();
    
    // Check for conflict content
    expect(screen.getByText('Scheduling Conflict')).toBeInTheDocument();
    expect(screen.getByText('Caregiver is already scheduled during this time')).toBeInTheDocument();
    
    // Switch back to Flow Visualization
    fireEvent.click(screen.getByText('Flow Visualization'));
    
    // Flow Visualization tab should be active again
    expect(screen.getByText('Flow Visualization')).toHaveClass('active');
  });

  test('displays conflict resolution options', async () => {
    render(<CircularDataFlowMonitor />);
    
    // Wait for initial data fetch
    await waitFor(() => {
      expect(universalScheduleService.getDataConflicts).toHaveBeenCalled();
    });
    
    // Switch to Conflicts tab
    fireEvent.click(screen.getByText('Conflicts'));
    
    // Check for resolution options
    expect(screen.getByText('Reschedule Appointment')).toBeInTheDocument();
    expect(screen.getByText('Reassign Caregiver')).toBeInTheDocument();
    expect(screen.getByText('Cancel Appointment')).toBeInTheDocument();
    
    // Click on a resolution option
    fireEvent.click(screen.getByText('Reschedule Appointment'));
    
    // Wait for conflict resolution call
    await waitFor(() => {
      expect(universalScheduleService.resolveConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conflict1',
          resolutionOption: 'reschedule'
        })
      );
    });
    
    // Should show notification
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Conflict Resolved'
      })
    );
    
    // Should refresh data
    expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalledTimes(2);
  });

  test('handles API errors gracefully', async () => {
    // Mock API to throw error
    universalScheduleService.getDataFlowMetrics.mockRejectedValue(new Error('API error'));
    
    render(<CircularDataFlowMonitor />);
    
    // Wait for error notification
    await waitFor(() => {
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Data Flow Error'
        })
      );
    });
    
    // Error message should be displayed
    expect(screen.getByText('Failed to load data flow information. Please try again.')).toBeInTheDocument();
  });

  test('displays empty states when no data is available', async () => {
    // Mock empty data
    universalScheduleService.getDataFlowMetrics.mockResolvedValue({ entities: [] });
    universalScheduleService.getUpdateHistory.mockResolvedValue({ updates: [] });
    universalScheduleService.getDataConflicts.mockResolvedValue({ conflicts: [] });
    
    render(<CircularDataFlowMonitor />);
    
    // Wait for data fetch
    await waitFor(() => {
      expect(universalScheduleService.getDataFlowMetrics).toHaveBeenCalled();
    });
    
    // Switch to Update History tab
    fireEvent.click(screen.getByText('Update History'));
    
    // Should show empty state
    expect(screen.getByText('No updates found in the selected time range.')).toBeInTheDocument();
    
    // Switch to Conflicts tab
    fireEvent.click(screen.getByText('Conflicts'));
    
    // Should show empty state with success message
    expect(screen.getByText('No conflicts detected in the selected time range.')).toBeInTheDocument();
  });

  test('shows serious conflict notifications', async () => {
    render(<CircularDataFlowMonitor />);
    
    // Wait for data fetch
    await waitFor(() => {
      expect(universalScheduleService.getDataConflicts).toHaveBeenCalled();
    });
    
    // Should show notification for serious conflicts
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Critical Data Conflicts Detected',
        message: '1 critical conflicts found. Review immediately.'
      })
    );
  });
});

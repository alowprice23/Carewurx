import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScheduleOptimizationControls } from '../src/components';
import { schedulerService, notificationService } from '../src/services';

// Mock the services
jest.mock('../src/services', () => ({
  schedulerService: {
    getSchedulesInRange: jest.fn(),
    getOptimizationHistory: jest.fn(),
    optimizeSchedule: jest.fn(),
    getOptimizationDetails: jest.fn(),
    applyOptimizedSchedule: jest.fn()
  },
  notificationService: {
    showNotification: jest.fn()
  }
}));

describe('ScheduleOptimizationControls Component', () => {
  // Mock data for testing
  const mockCurrentSchedule = [
    {
      id: 'appt1',
      clientId: 'client1',
      clientName: 'John Doe',
      caregiverId: 'caregiver1',
      caregiverName: 'Jane Smith',
      date: '2025-06-15',
      startTime: '09:00',
      endTime: '11:00'
    },
    {
      id: 'appt2',
      clientId: 'client2',
      clientName: 'Bob Johnson',
      caregiverId: 'caregiver2',
      caregiverName: 'Sarah Williams',
      date: '2025-06-15',
      startTime: '13:00',
      endTime: '15:00'
    }
  ];
  
  const mockOptimizedSchedule = [
    {
      id: 'appt1',
      clientId: 'client1',
      clientName: 'John Doe',
      caregiverId: 'caregiver1',
      caregiverName: 'Jane Smith',
      date: '2025-06-15',
      startTime: '09:00',
      endTime: '11:00'
    },
    {
      id: 'appt2',
      clientId: 'client2',
      clientName: 'Bob Johnson',
      caregiverId: 'caregiver1', // Changed caregiver
      caregiverName: 'Jane Smith', // Changed caregiver name
      date: '2025-06-15',
      startTime: '13:00',
      endTime: '15:00'
    }
  ];
  
  const mockOptimizationMetrics = {
    optimizationId: 'opt123',
    timestamp: '2025-06-14T13:25:00Z',
    scheduleDays: 7,
    improvementPercentage: 12.5,
    travelDistance: {
      before: 150,
      after: 120,
      change: -30,
      improvementPercentage: 20
    },
    clientSatisfaction: {
      before: 85,
      after: 90,
      change: 5,
      improvementPercentage: 5.9
    },
    caregiverWorkload: {
      before: 12,
      after: 10,
      change: -2,
      improvementPercentage: 16.7
    },
    scheduleConflicts: {
      before: 3,
      after: 0,
      change: -3,
      improvementPercentage: 100
    },
    specialtyMatching: {
      before: 80,
      after: 95,
      change: 15,
      improvementPercentage: 18.8
    },
    changedAppointments: 5,
    affectedCaregivers: 2,
    affectedClients: 4
  };
  
  const mockOptimizationHistory = [
    {
      id: 'hist1',
      optimizationType: 'balanced',
      priorityFactor: 'distance',
      timeframe: '7d',
      scheduleDays: 7,
      maxTravelDistance: 30,
      timestamp: '2025-06-10T10:30:00Z',
      improvementPercentage: 8.5,
      travelDistanceChange: -25,
      travelDistanceImprovement: 15.3,
      clientSatisfactionChange: 3,
      clientSatisfactionImprovement: 3.6,
      workloadChange: -1,
      workloadImprovement: 10.0,
      affectedAppointments: 3,
      applied: true
    },
    {
      id: 'hist2',
      optimizationType: 'client-focused',
      priorityFactor: 'preferences',
      timeframe: '14d',
      scheduleDays: 14,
      maxTravelDistance: 40,
      timestamp: '2025-06-13T15:45:00Z',
      improvementPercentage: 12.5,
      travelDistanceChange: -30,
      travelDistanceImprovement: 20.0,
      clientSatisfactionChange: 7,
      clientSatisfactionImprovement: 8.2,
      workloadChange: 1,
      workloadImprovement: -8.3,
      affectedAppointments: 6,
      applied: false
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    schedulerService.getSchedulesInRange.mockResolvedValue(mockCurrentSchedule);
    schedulerService.getOptimizationHistory.mockResolvedValue(mockOptimizationHistory);
    schedulerService.optimizeSchedule.mockResolvedValue({
      optimizedSchedule: mockOptimizedSchedule,
      metrics: mockOptimizationMetrics
    });
    schedulerService.getOptimizationDetails.mockResolvedValue({
      optimizedSchedule: mockOptimizedSchedule,
      metrics: mockOptimizationMetrics,
      parameters: {
        timeframe: '7d',
        optimizationType: 'balanced',
        priorityFactor: 'distance',
        maxShiftsPerDay: 2,
        allowWeekends: true,
        minBreakHours: 10,
        considerTraffic: true,
        maxTravelDistance: 30,
        enforceSpecialties: true,
        weightClientPreference: 3,
        weightCaregiverPreference: 3,
        applyAutomatically: false
      }
    });
    schedulerService.applyOptimizedSchedule.mockResolvedValue({ success: true });
  });

  test('renders the component correctly', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
      expect(schedulerService.getOptimizationHistory).toHaveBeenCalled();
    });
    
    // Check for main elements
    expect(screen.getByText('Optimization Parameters')).toBeInTheDocument();
    expect(screen.getByText('Optimization Results')).toBeInTheDocument();
    expect(screen.getByText('Optimization History')).toBeInTheDocument();
    
    // Check for preset buttons
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Client-Focused')).toBeInTheDocument();
    expect(screen.getByText('Caregiver-Focused')).toBeInTheDocument();
    expect(screen.getByText('Efficiency-Focused')).toBeInTheDocument();
    
    // Check for parameter sections
    expect(screen.getByText('Schedule Range')).toBeInTheDocument();
    expect(screen.getByText('Caregiver Constraints')).toBeInTheDocument();
    expect(screen.getByText('Travel & Distance')).toBeInTheDocument();
    expect(screen.getByText('Preference Weights')).toBeInTheDocument();
    
    // Check for run button
    expect(screen.getByText('Run Optimization')).toBeInTheDocument();
  });

  test('applies a preset when clicked', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    // Get client preference weight selector initial value
    const clientPrefSelect = screen.getByLabelText('Client Preference Weight:');
    expect(clientPrefSelect.value).toBe('3'); // Default value
    
    // Click on Client-Focused preset
    fireEvent.click(screen.getByText('Client-Focused'));
    
    // Check that client preference weight changed to 5
    expect(clientPrefSelect.value).toBe('5');
    
    // Check that other params were updated too
    const maxTravelDistanceInput = screen.getByLabelText('Max Travel Distance (miles):');
    expect(maxTravelDistanceInput.value).toBe('40');
  });

  test('changes parameters when inputs are modified', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    // Change max shifts per day
    const maxShiftsInput = screen.getByLabelText('Max Shifts Per Day:');
    fireEvent.change(maxShiftsInput, { target: { value: '3' } });
    expect(maxShiftsInput.value).toBe('3');
    
    // Change time range
    const timeRangeSelect = screen.getByLabelText('Time Range:');
    fireEvent.change(timeRangeSelect, { target: { value: '14d' } });
    expect(timeRangeSelect.value).toBe('14d');
    
    // Toggle a checkbox
    const weekendCheckbox = screen.getByLabelText('Allow Weekend Scheduling');
    expect(weekendCheckbox.checked).toBe(true); // Default is true
    fireEvent.click(weekendCheckbox);
    expect(weekendCheckbox.checked).toBe(false);
  });

  test('runs optimization when button is clicked', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    // Click run optimization button
    fireEvent.click(screen.getByText('Run Optimization'));
    
    // Check that optimizeSchedule was called
    await waitFor(() => {
      expect(schedulerService.optimizeSchedule).toHaveBeenCalledWith({
        startDate: expect.any(String),
        endDate: expect.any(String),
        parameters: expect.any(Object),
        applyChanges: false
      });
    });
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Optimization Complete'
      })
    );
    
    // Check that we switched to results tab
    await waitFor(() => {
      expect(screen.getByText('Optimization Results')).toHaveClass('active');
    });
    
    // Check for results content
    expect(screen.getByText('Side by Side')).toBeInTheDocument();
  });

  test('switches between view modes in results tab', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    // Run optimization
    fireEvent.click(screen.getByText('Run Optimization'));
    
    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Current Schedule')).toBeInTheDocument();
    });
    
    // Switch to metrics view
    const viewModeSelect = screen.getByLabelText('View Mode:');
    fireEvent.change(viewModeSelect, { target: { value: 'metrics' } });
    
    // Check for metrics content
    await waitFor(() => {
      expect(screen.getByText('Optimization Summary')).toBeInTheDocument();
      expect(screen.getByText('Overall Improvement')).toBeInTheDocument();
      expect(screen.getByText('Travel Distance')).toBeInTheDocument();
    });
    
    // Check metric values
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    
    // Switch to diff view
    fireEvent.change(viewModeSelect, { target: { value: 'diff' } });
    
    // Check for diff view content
    await waitFor(() => {
      expect(screen.getByText('Current Schedule')).toBeInTheDocument();
      expect(screen.getByText('Optimized Schedule')).toBeInTheDocument();
    });
  });

  test('applies optimized schedule when apply button is clicked', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    // Run optimization
    fireEvent.click(screen.getByText('Run Optimization'));
    
    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Apply Optimized Schedule')).toBeInTheDocument();
    });
    
    // Click apply button
    fireEvent.click(screen.getByText('Apply Optimized Schedule'));
    
    // Check that applyOptimizedSchedule was called
    await waitFor(() => {
      expect(schedulerService.applyOptimizedSchedule).toHaveBeenCalledWith({
        optimizationId: 'opt123'
      });
    });
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Schedule Updated'
      })
    );
  });

  test('shows optimization history', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getOptimizationHistory).toHaveBeenCalled();
    });
    
    // Switch to history tab
    fireEvent.click(screen.getByText('Optimization History'));
    
    // Check for history items
    await waitFor(() => {
      expect(screen.getByText('Balanced Optimization')).toBeInTheDocument();
      expect(screen.getByText('Client-Focused Optimization')).toBeInTheDocument();
    });
    
    // Check for history details
    expect(screen.getByText('8.5% Improvement')).toBeInTheDocument();
    expect(screen.getByText('12.5% Improvement')).toBeInTheDocument();
    
    // Expand a history item
    fireEvent.click(screen.getByText('Client-Focused Optimization'));
    
    // Check for expanded details
    await waitFor(() => {
      expect(screen.getByText('Optimization Parameters')).toBeInTheDocument();
      expect(screen.getByText('Results Summary')).toBeInTheDocument();
    });
  });

  test('handles errors gracefully', async () => {
    // Mock API to throw error
    schedulerService.optimizeSchedule.mockRejectedValue(new Error('Optimization error'));
    
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    // Run optimization (will fail)
    fireEvent.click(screen.getByText('Run Optimization'));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText('Failed to run optimization. Please try again.')).toBeInTheDocument();
    });
    
    // Check error notification
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Optimization Error'
      })
    );
  });

  test('handles apply errors gracefully', async () => {
    // Mock apply API to throw error
    schedulerService.applyOptimizedSchedule.mockRejectedValue(new Error('Apply error'));
    
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    // Run optimization
    fireEvent.click(screen.getByText('Run Optimization'));
    
    // Wait for results to load
    await waitFor(() => {
      expect(screen.getByText('Apply Optimized Schedule')).toBeInTheDocument();
    });
    
    // Click apply button (will fail)
    fireEvent.click(screen.getByText('Apply Optimized Schedule'));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText('Failed to apply optimized schedule. Please try again.')).toBeInTheDocument();
    });
    
    // Check error notification
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Schedule Update Error'
      })
    );
  });

  test('allows viewing historical optimization details', async () => {
    render(<ScheduleOptimizationControls />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getOptimizationHistory).toHaveBeenCalled();
    });
    
    // Switch to history tab
    fireEvent.click(screen.getByText('Optimization History'));
    
    // Wait for history to load
    await waitFor(() => {
      expect(screen.getByText('Balanced Optimization')).toBeInTheDocument();
    });
    
    // Expand a history item
    fireEvent.click(screen.getByText('Client-Focused Optimization'));
    
    // Wait for expanded details
    await waitFor(() => {
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });
    
    // Click view details
    fireEvent.click(screen.getByText('View Details'));
    
    // Check that getOptimizationDetails was called
    await waitFor(() => {
      expect(schedulerService.getOptimizationDetails).toHaveBeenCalledWith('hist2');
    });
    
    // Check that we switched to results tab
    await waitFor(() => {
      expect(screen.getByText('Optimization Results')).toHaveClass('active');
    });
  });
});

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
    
    // Check for main elements (tab buttons)
    expect(screen.getByRole('button', { name: /Optimization Parameters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Optimization Results/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Optimization History/i })).toBeInTheDocument();

    // Check for heading within the active parameters tab
    expect(screen.getByRole('heading', { name: /Optimization Parameters/i, level: 3 })).toBeInTheDocument();

    // Check for preset buttons (specifically their name part)
    expect(screen.getByRole('button', { name: /Balanced/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Client-Focused/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Caregiver-Focused/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Efficiency-Focused/i })).toBeInTheDocument();

    // Check for parameter section headings (level 4)
    expect(screen.getByRole('heading', { name: /Schedule Range/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Caregiver Constraints/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Travel & Distance/i, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Preference Weights/i, level: 4 })).toBeInTheDocument();
    
    // Check for run button
    expect(screen.getByRole('button', { name: /Run Optimization/i })).toBeInTheDocument();
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
    
    // Click on Client-Focused preset button
    // Using a more specific selector for the preset button
    const clientFocusedPresetButton = screen.getAllByRole('button').find(
      button => button.textContent.includes('Client-Focused') && button.textContent.includes('Prioritize client preferences and needs')
    );
    expect(clientFocusedPresetButton).toBeInTheDocument();
    fireEvent.click(clientFocusedPresetButton);
    
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
    await act(async () => {
      fireEvent.change(maxShiftsInput, { target: { value: '3' } });
    });
    expect(maxShiftsInput.value).toBe('3');
    
    // Change time range
    const timeRangeSelect = screen.getByLabelText('Time Range:');
     await act(async () => {
      fireEvent.change(timeRangeSelect, { target: { value: '14d' } });
    });
    expect(timeRangeSelect.value).toBe('14d');
    
    // Toggle a checkbox
    const weekendCheckbox = screen.getByLabelText('Allow Weekend Scheduling');
    expect(weekendCheckbox.checked).toBe(true); // Default is true
    await act(async () => {
      fireEvent.click(weekendCheckbox);
    });
    expect(weekendCheckbox.checked).toBe(false);
  });

  test('runs optimization when button is clicked', async () => {
    render(<ScheduleOptimizationControls />);
    
    await waitFor(() => {
      expect(schedulerService.getSchedulesInRange).toHaveBeenCalled();
    });
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Optimization/i }));
      await schedulerService.optimizeSchedule.mock.results[0].value; // Wait for optimizeSchedule to resolve
    });

    expect(schedulerService.optimizeSchedule).toHaveBeenCalledWith({
      startDate: expect.any(String),
      endDate: expect.any(String),
      parameters: expect.any(Object),
      applyChanges: false
    });
    
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Optimization Complete'
      })
    );
    
    await waitFor(() => {
      // Tab button for "Optimization Results"
      const resultsTabButton = screen.getAllByRole('button', { name: /Optimization Results/i }).find(btn => btn.closest('.tab-navigation'));
      expect(resultsTabButton).toHaveClass('active');
    });
    
    expect(screen.getByRole('option', { name: /Side by Side/i, selected: true })).toBeInTheDocument();
  });

  test('switches between view modes in results tab', async () => {
    render(<ScheduleOptimizationControls />);
    
    await waitFor(() => expect(schedulerService.getSchedulesInRange).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Optimization/i }));
      await schedulerService.optimizeSchedule.mock.results[0].value;
    });
    
    await waitFor(() => expect(screen.getByText('Current Schedule')).toBeInTheDocument()); // Wait for results tab to populate
    
    const viewModeSelect = screen.getByRole('combobox', { name: /View Mode:/i });

    await act(async () => {
      fireEvent.change(viewModeSelect, { target: { value: 'metrics' } });
    });
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Optimization Summary/i, level: 4 })).toBeInTheDocument();
      expect(screen.getByText(/Overall Improvement/i)).toBeInTheDocument();
    });
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.change(viewModeSelect, { target: { value: 'diff' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Current Schedule')).toBeInTheDocument();
      expect(screen.getByText('Optimized Schedule')).toBeInTheDocument();
    });
  });

  test('applies optimized schedule when apply button is clicked', async () => {
    render(<ScheduleOptimizationControls />);
    await waitFor(() => expect(schedulerService.getSchedulesInRange).toHaveBeenCalled());
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Optimization/i }));
      await schedulerService.optimizeSchedule.mock.results[0].value;
    });
    
    await waitFor(() => expect(screen.getByRole('button', { name: /Apply Optimized Schedule/i })).toBeInTheDocument());
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Optimized Schedule/i }));
      await schedulerService.applyOptimizedSchedule.mock.results[0].value;
    });
    
    expect(schedulerService.applyOptimizedSchedule).toHaveBeenCalledWith({
      optimizationId: 'opt123'
    });
    
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Schedule Updated'
      })
    );
  });

  test('shows optimization history', async () => {
    render(<ScheduleOptimizationControls />);
    await waitFor(() => expect(schedulerService.getOptimizationHistory).toHaveBeenCalled());
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Optimization History/i }));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Balanced Optimization/i)).toBeInTheDocument();
      expect(screen.getByText(/Client-Focused Optimization/i)).toBeInTheDocument();
    });
    
    expect(screen.getByText(/8.5% Improvement/i)).toBeInTheDocument();
    expect(screen.getByText(/12.5% Improvement/i)).toBeInTheDocument();
    
    // Expand a history item by clicking its title area (more robust than just text)
    const clientFocusedHeader = screen.getByText(/Client-Focused Optimization/i).closest('.history-item-header');
    await act(async () => {
      fireEvent.click(clientFocusedHeader);
    });
    
    await waitFor(() => {
      // Check for a heading specific to the expanded details
      expect(screen.getByRole('heading', { name: /Optimization Parameters/i, level: 5 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Results Summary/i, level: 5 })).toBeInTheDocument();
    });
  });

  test('handles errors gracefully', async () => {
    schedulerService.optimizeSchedule.mockRejectedValue(new Error('Optimization error'));
    render(<ScheduleOptimizationControls />);
    await waitFor(() => expect(schedulerService.getSchedulesInRange).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Optimization/i }));
      // Wait for the promise to reject and error handling to complete
      try {
        await schedulerService.optimizeSchedule.mock.results[0].value;
      } catch (e) {
        // Expected error
      }
    });
    
    await waitFor(() => {
      expect(screen.getByText('Failed to run optimization. Please try again.')).toBeInTheDocument();
    });
    
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Optimization Error'
      })
    );
  });

  test('handles apply errors gracefully', async () => {
    schedulerService.applyOptimizedSchedule.mockRejectedValue(new Error('Apply error'));
    render(<ScheduleOptimizationControls />);
    await waitFor(() => expect(schedulerService.getSchedulesInRange).toHaveBeenCalled());
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Optimization/i }));
      await schedulerService.optimizeSchedule.mock.results[0].value;
    });
    
    await waitFor(() => expect(screen.getByRole('button', { name: /Apply Optimized Schedule/i })).toBeInTheDocument());
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Optimized Schedule/i }));
      try {
        await schedulerService.applyOptimizedSchedule.mock.results[0].value;
      } catch (e) {
        // Expected error
      }
    });
    
    await waitFor(() => {
      expect(screen.getByText('Failed to apply optimized schedule. Please try again.')).toBeInTheDocument();
    });
    
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Schedule Update Error'
      })
    );
  });

  test('allows viewing historical optimization details', async () => {
    render(<ScheduleOptimizationControls />);
    await waitFor(() => expect(schedulerService.getOptimizationHistory).toHaveBeenCalled());
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Optimization History/i }));
    });
    
    await waitFor(() => expect(screen.getByText(/Balanced Optimization/i)).toBeInTheDocument());
    
    const clientFocusedHeader = screen.getByText(/Client-Focused Optimization/i).closest('.history-item-header');
    await act(async () => {
      fireEvent.click(clientFocusedHeader);
    });
    
    await waitFor(() => expect(screen.getAllByRole('button', { name: /View Details/i })[0]).toBeInTheDocument());
    
    const viewDetailsButton = screen.getAllByRole('button', { name: /View Details/i }).find(
      btn => btn.closest('.history-item-details') // ensure it's the button within the expanded section
    );
    expect(viewDetailsButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(viewDetailsButton);
      await schedulerService.getOptimizationDetails.mock.results[0].value;
    });
    
    expect(schedulerService.getOptimizationDetails).toHaveBeenCalledWith('hist2');
    
    await waitFor(() => {
      const resultsTabButton = screen.getAllByRole('button', { name: /Optimization Results/i }).find(btn => btn.closest('.tab-navigation'));
      expect(resultsTabButton).toHaveClass('active');
    });
  });
});

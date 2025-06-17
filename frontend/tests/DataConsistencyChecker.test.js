import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataConsistencyChecker } from '../src/components';
import { notificationService } from '../src/services';

// Mock the notification service
jest.mock('../src/services', () => ({
  notificationService: {
    showNotification: jest.fn()
  }
}));

describe('DataConsistencyChecker Component', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock timer functions
    jest.useFakeTimers();
  });

  // Restore timers after tests
  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders component with initial state', () => {
    render(<DataConsistencyChecker />);
    
    // Check for component title
    expect(screen.getByText('Data Consistency Checker')).toBeInTheDocument();
    
    // Check for initial tabs
    expect(screen.getByText('Database Status')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    
    // The Issues and Repair tabs should be disabled initially
    const issuesTab = screen.getByRole('button', { name: /issues/i });
    const repairTab = screen.getByRole('button', { name: /repair/i });
    expect(issuesTab).toBeDisabled();
    expect(repairTab).toBeDisabled();
  });

  test('renders health status chart after loading', async () => {
    render(<DataConsistencyChecker />);
    
    // Fast-forward initial timer
    jest.advanceTimersByTime(1100);
    
    // Check for health status indicator
    await waitFor(() => {
      const statusBadge = screen.getByText(/HEALTHY|ISSUES|CRITICAL|UNKNOWN/i);
      expect(statusBadge).toBeInTheDocument();
    });
    
    // Check for health chart (canvas element)
    const canvasElements = document.querySelectorAll('canvas');
    expect(canvasElements.length).toBeGreaterThan(0);
    
    // Check for run check button
    expect(screen.getByRole('button', { name: /run health check/i })).toBeInTheDocument();
  });

  test('loads database statistics', async () => {
    render(<DataConsistencyChecker />);
    
    // Initially, stats should be loading
    expect(screen.getByText(/loading database statistics/i)).toBeInTheDocument();
    
    // Fast-forward timer to trigger the stats loading
    jest.advanceTimersByTime(1000);
    
    // Verify stats have loaded
    await waitFor(() => {
      expect(screen.queryByText(/loading database statistics/i)).not.toBeInTheDocument();
      expect(screen.getByText(/storage used/i)).toBeInTheDocument();
      expect(screen.getByText(/last backup/i)).toBeInTheDocument();
    });
  });

  test('runs health check when button is clicked', async () => {
    render(<DataConsistencyChecker />);
    
    // Fast-forward initial timer
    jest.advanceTimersByTime(1100);
    
    // Get and click the run health check button
    const runCheckButton = screen.getByRole('button', { name: /run health check/i });
    fireEvent.click(runCheckButton);
    
    // Button should show loading state
    expect(screen.getByText(/running check/i)).toBeInTheDocument();
    
    // Fast-forward timer to trigger the health check completion
    jest.advanceTimersByTime(2000);
    
    // Notification should be shown
    expect(notificationService.showNotification).toHaveBeenCalledTimes(1);
    
    // Check button is back to normal
    await waitFor(() => {
      expect(screen.queryByText(/running check/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /run health check/i })).toBeInTheDocument();
    });
  });

  test('enables Issues tab when inconsistencies are found', async () => {
    // Mock Math.random to return 0.8 to ensure 'issues' status
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.8);
    
    render(<DataConsistencyChecker />);
    
    // Fast-forward initial timer
    jest.advanceTimersByTime(1100);
    
    // Issues tab should now be enabled
    await waitFor(() => {
      const issuesTab = screen.getByRole('button', { name: /issues/i });
      expect(issuesTab).not.toBeDisabled();
    });
    
    // Restore original Math.random
    Math.random = originalRandom;
  });

  test('shows inconsistencies in Issues tab', async () => {
    // Mock Math.random to return 0.8 to ensure 'issues' status
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.8);
    
    render(<DataConsistencyChecker />);
    
    // Fast-forward initial timer
    jest.advanceTimersByTime(1100);
    
    // Click on Issues tab
    const issuesTab = await waitFor(() => screen.getByRole('button', { name: /issues/i }));
    expect(issuesTab).not.toBeDisabled();
    fireEvent.click(issuesTab);
    
    // Check that the inconsistencies table is shown
    await waitFor(() => {
      expect(screen.getByText(/database inconsistencies/i)).toBeInTheDocument();
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
    
    // Check table headers
    expect(screen.getByText(/type/i)).toBeInTheDocument();
    expect(screen.getByText(/entity/i)).toBeInTheDocument();
    expect(screen.getByText(/description/i)).toBeInTheDocument();
    expect(screen.getByText(/severity/i)).toBeInTheDocument();
    
    // Restore original Math.random
    Math.random = originalRandom;
  });

  test('allows selecting inconsistencies for repair', async () => {
    // Mock Math.random to return 0.8 to ensure 'issues' status
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.8);
    
    render(<DataConsistencyChecker />);
    
    // Fast-forward initial timer
    jest.advanceTimersByTime(1100);
    
    // Click on Issues tab
    const issuesTab = await waitFor(() => screen.getByRole('button', { name: /issues/i }));
    fireEvent.click(issuesTab);
    
    // Wait for issues table to appear
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    
    // Find all checkboxes in the table
    const checkboxes = screen.getAllByRole('checkbox');
    
    // Should have at least one checkbox (for the first row)
    expect(checkboxes.length).toBeGreaterThan(1);
    
    // Click the first issue checkbox
    fireEvent.click(checkboxes[1]); // First checkbox after header
    
    // Click on Repair tab
    const repairTab = screen.getByRole('button', { name: /repair/i });
    fireEvent.click(repairTab);
    
    // Check that the repair options are shown
    await waitFor(() => {
      expect(screen.getByText(/repair database inconsistencies/i)).toBeInTheDocument();
      expect(screen.getByText(/selected issues/i)).toBeInTheDocument();
    });
    
    // Check for repair button
    const repairButton = screen.getByRole('button', { name: /run repair operations/i });
    expect(repairButton).toBeInTheDocument();
    expect(repairButton).not.toBeDisabled();
    
    // Restore original Math.random
    Math.random = originalRandom;
  });

  test('can run repair operations', async () => {
    // Mock Math.random to return consistent values
    const originalRandom = Math.random;
    Math.random = jest.fn()
      .mockReturnValueOnce(0.8)  // For initial health check (issues)
      .mockReturnValueOnce(0.5)  // For auto-repair flag
      .mockReturnValueOnce(0.9); // For repair success
    
    render(<DataConsistencyChecker />);
    
    // Fast-forward initial timer
    jest.advanceTimersByTime(1100);
    
    // Click on Issues tab
    const issuesTab = await waitFor(() => screen.getByRole('button', { name: /issues/i }));
    fireEvent.click(issuesTab);
    
    // Wait for issues table to appear
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    
    // Select an issue
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // First checkbox after header
    
    // Run repair directly from issues tab
    const repairButton = screen.getByRole('button', { name: /run repair operations/i });
    fireEvent.click(repairButton);
    
    // Button should show repairing state
    expect(screen.getByText(/repairing/i)).toBeInTheDocument();
    
    // Fast-forward timer to trigger repair completion
    jest.advanceTimersByTime(2100);
    
    // Notification should be shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: expect.stringContaining('Repair Operations Completed')
      })
    );
    
    // Restore original Math.random
    Math.random = originalRandom;
  });

  test('shows settings tab correctly', async () => {
    render(<DataConsistencyChecker />);
    
    // Click on Settings tab
    const settingsTab = screen.getByRole('button', { name: /settings/i });
    fireEvent.click(settingsTab);
    
    // Check that settings sections are shown
    await waitFor(() => {
      expect(screen.getByText(/consistency checker settings/i)).toBeInTheDocument();
      expect(screen.getByText(/check configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/repair configuration/i)).toBeInTheDocument();
    });
    
    // Check for thorough check option
    const thoroughCheckOption = screen.getByLabelText(/perform thorough check/i);
    expect(thoroughCheckOption).toBeInTheDocument();
    
    // Check for repair options
    expect(screen.getByLabelText(/auto-repair safe issues/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/backup before repair/i)).toBeInTheDocument();
    
    // Test toggling options
    fireEvent.click(thoroughCheckOption);
    expect(thoroughCheckOption).toBeChecked();
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import OpportunityScanner from '../OpportunityScanner';
import { agentService, scannerService } from '../../services';

// Mock services
jest.mock('../../services', () => ({
  agentService: {
    scanForOpportunities: jest.fn(),
    applyOpportunity: jest.fn(),
    rejectOpportunity: jest.fn(),
  },
  scannerService: {
    getStatus: jest.fn(),
    forceScan: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    getHistory: jest.fn(),
  },
}));

describe('OpportunityScanner Component', () => {
  const mockOpportunities = [
    { id: 'opp1', title: 'Opportunity 1', score: 8.5, clientName: 'Client A', scheduledDate: new Date().toISOString(), startTime: '10:00', endTime: '12:00', description: 'Desc 1', status: null },
    { id: 'opp2', title: 'Opportunity 2', score: 9.0, clientName: 'Client B', scheduledDate: new Date().toISOString(), startTime: '14:00', endTime: '16:00', description: 'Desc 2', status: 'applied' },
  ];
  const mockScannerStatus = { isRunning: false, lastScan: new Date().toISOString() };
  const mockScanHistory = [{ timestamp: new Date().toISOString(), opportunitiesFound: 2, durationMs: 1000 }];

  beforeEach(() => {
    jest.clearAllMocks();
    agentService.scanForOpportunities.mockResolvedValue(mockOpportunities);
    agentService.applyOpportunity.mockResolvedValue({ success: true });
    agentService.rejectOpportunity.mockResolvedValue({ success: true });
    scannerService.getStatus.mockResolvedValue(mockScannerStatus);
    scannerService.forceScan.mockResolvedValue({ success: true }); // Assuming forceScan itself doesn't return opportunities directly
    scannerService.start.mockResolvedValue({ success: true });
    scannerService.stop.mockResolvedValue({ success: true });
    scannerService.getHistory.mockResolvedValue(mockScanHistory);
  });

  test('renders initial state, fetches initial data, and displays opportunities', async () => {
    render(<OpportunityScanner />);

    expect(screen.getByText('Scanner Status')).toBeInTheDocument(); // Header for status section
    expect(screen.getByText('Scan History')).toBeInTheDocument(); // Header for history
    expect(screen.getByText('Available Opportunities')).toBeInTheDocument(); // Header for opportunities

    await waitFor(() => {
      expect(agentService.scanForOpportunities).toHaveBeenCalledTimes(1); // From initial fetchOpportunities
      expect(scannerService.getStatus).toHaveBeenCalledTimes(1); // Initial status fetch
      expect(scannerService.getHistory).toHaveBeenCalledTimes(1); // Initial history fetch
    });

    await waitFor(() => {
      expect(screen.getByText('Opportunity 1')).toBeInTheDocument();
      expect(screen.getByText('Opportunity 2')).toBeInTheDocument(); // Should also show applied ones
    });
  });

  test('handles error when fetching initial opportunities', async () => {
    agentService.scanForOpportunities.mockRejectedValueOnce(new Error('Network Error'));
    render(<OpportunityScanner />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch opportunities: Network Error/i)).toBeInTheDocument();
    });
  });

  test('"Scan Now" button calls forceScan and refreshes opportunities', async () => {
    render(<OpportunityScanner />);
    await waitFor(() => expect(agentService.scanForOpportunities).toHaveBeenCalledTimes(1)); // Initial

    const scanNowButton = screen.getByText('Scan Now');
    fireEvent.click(scanNowButton);

    expect(scannerService.forceScan).toHaveBeenCalledTimes(1);
    // Progress bar appears
    await waitFor(() => expect(screen.getByText('0%')).toBeInTheDocument());
    // Simulating progress, this will quickly go to 100% in test if not properly handled by mocks/timers

    // scanForOpportunities is called again by fetchOpportunities after forceScan
    await waitFor(() => expect(agentService.scanForOpportunities).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Scan completed successfully')).toBeInTheDocument());
  });

  test('toggles auto-scan and calls scannerService.start/stop', async () => {
    render(<OpportunityScanner />);
    const autoScanToggle = screen.getByLabelText('Auto-scan:');

    // Enable auto-scan
    fireEvent.click(autoScanToggle);
    await waitFor(() => expect(scannerService.start).toHaveBeenCalledWith(30)); // Default interval
    expect(autoScanToggle.checked).toBe(true);

    // Disable auto-scan
    fireEvent.click(autoScanToggle);
    await waitFor(() => expect(scannerService.stop).toHaveBeenCalled());
    expect(autoScanToggle.checked).toBe(false);
  });

  test('validates interval input before starting auto-scan', async () => {
    render(<OpportunityScanner />);
    const intervalInput = screen.getByLabelText('Scan interval (minutes):');
    const autoScanToggle = screen.getByLabelText('Auto-scan:');

    // Set invalid interval
    fireEvent.change(intervalInput, { target: { value: '3' } }); // Too short
    fireEvent.click(autoScanToggle);
    expect(scannerService.start).not.toHaveBeenCalled();
    expect(screen.getByText('Scan interval must be between 5 and 120 minutes')).toBeInTheDocument();
    expect(autoScanToggle.checked).toBe(false);

    // Set valid interval
    fireEvent.change(intervalInput, { target: { value: '15' } });
    fireEvent.click(autoScanToggle);
    await waitFor(() => expect(scannerService.start).toHaveBeenCalledWith(15));
    expect(autoScanToggle.checked).toBe(true);
  });

  test('handles "Apply" on an opportunity', async () => {
    render(<OpportunityScanner />);
    await waitFor(() => expect(screen.getByText('Opportunity 1')).toBeInTheDocument());

    // Find Apply button for Opportunity 1 (assuming it's not already applied)
    const opp1Card = screen.getByText('Opportunity 1').closest('.opportunity-card');
    const applyButton = within(opp1Card).getByText('Apply');

    fireEvent.click(applyButton);
    await waitFor(() => expect(agentService.applyOpportunity).toHaveBeenCalledWith('opp1'));

    // Check if status updated in UI (re-renders with new status)
    await waitFor(() => expect(within(opp1Card).getByText('Status:')).toBeInTheDocument());
    expect(within(opp1Card).getByText('applied')).toBeInTheDocument();
  });

  test('handles "Reject" on an opportunity', async () => {
    render(<OpportunityScanner />);
    await waitFor(() => expect(screen.getByText('Opportunity 1')).toBeInTheDocument());

    const opp1Card = screen.getByText('Opportunity 1').closest('.opportunity-card');
    const rejectButton = within(opp1Card).getByText('Reject');

    fireEvent.click(rejectButton);
    await waitFor(() => expect(agentService.rejectOpportunity).toHaveBeenCalledWith('opp1', 'Not suitable'));

    await waitFor(() => expect(within(opp1Card).getByText('Status:')).toBeInTheDocument());
    expect(within(opp1Card).getByText('rejected')).toBeInTheDocument();
  });

  test('handles error during apply opportunity', async () => {
    agentService.applyOpportunity.mockRejectedValueOnce(new Error('Apply failed'));
    render(<OpportunityScanner />);
    await waitFor(() => expect(screen.getByText('Opportunity 1')).toBeInTheDocument());
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const opp1Card = screen.getByText('Opportunity 1').closest('.opportunity-card');
    const applyButton = within(opp1Card).getByText('Apply');
    fireEvent.click(applyButton);

    await waitFor(() => expect(agentService.applyOpportunity).toHaveBeenCalled());
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error applying for opportunity:', expect.any(Error));
    // Check that status did NOT change
    expect(within(opp1Card).queryByText('Status:')).not.toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  // Test for status update polling (conceptual due to setInterval)
  test('useEffect sets up and clears status interval', () => {
    jest.useFakeTimers();
    const { unmount } = render(<OpportunityScanner />);
    expect(scannerService.getStatus).toHaveBeenCalledTimes(1); // Initial call

    act(() => {
        jest.advanceTimersByTime(60000); // Advance by 1 minute
    });
    expect(scannerService.getStatus).toHaveBeenCalledTimes(2); // Called again by interval

    unmount();
    expect(clearInterval).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

// Helper to use RTL's within with screen more easily
const within = (element) => ({
    getByText: (text, options) => screen.getByText(element, text, options),
    queryByText: (text, options) => screen.queryByText(element, text, options),
    // Add other queries if needed
});

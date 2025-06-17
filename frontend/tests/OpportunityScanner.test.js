import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OpportunityScanner } from '../src/components';
import { agentService, scannerService } from '../src/services';

// Mock the services
jest.mock('../src/services', () => ({
  agentService: {
    scanForOpportunities: jest.fn(),
    applyOpportunity: jest.fn(),
    rejectOpportunity: jest.fn()
  },
  scannerService: {
    getStatus: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    forceScan: jest.fn(),
    getHistory: jest.fn()
  }
}));

describe('OpportunityScanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    scannerService.getStatus.mockResolvedValue({
      isRunning: false,
      lastScan: '2025-06-13T18:30:00.000Z'
    });
    
    scannerService.getHistory.mockResolvedValue([
      {
        timestamp: '2025-06-13T18:30:00.000Z',
        opportunitiesFound: 5,
        durationMs: 1200
      },
      {
        timestamp: '2025-06-13T18:00:00.000Z',
        opportunitiesFound: 3,
        durationMs: 980
      }
    ]);
    
    agentService.scanForOpportunities.mockResolvedValue([
      {
        id: 'opp-1',
        title: 'Morning Care Visit',
        score: 8.5,
        clientName: 'John Doe',
        scheduledDate: '2025-06-15T09:00:00.000Z',
        startTime: '09:00',
        endTime: '11:00',
        description: 'Assistance with morning routine'
      },
      {
        id: 'opp-2',
        title: 'Medication Management',
        score: 7.2,
        clientName: 'Jane Smith',
        scheduledDate: '2025-06-16T14:00:00.000Z',
        startTime: '14:00',
        endTime: '15:00',
        description: 'Medication administration and monitoring'
      }
    ]);
    
    scannerService.start.mockResolvedValue({ success: true });
    scannerService.stop.mockResolvedValue({ success: true });
    scannerService.forceScan.mockResolvedValue({ success: true });
    
    agentService.applyOpportunity.mockResolvedValue({ success: true });
    agentService.rejectOpportunity.mockResolvedValue({ success: true });
  });

  test('renders the component correctly', async () => {
    render(<OpportunityScanner />);
    
    // Check for initial elements
    expect(screen.getByText(/Scanner Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Scanner Configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan Now/i)).toBeInTheDocument();
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(scannerService.getStatus).toHaveBeenCalled();
      expect(scannerService.getHistory).toHaveBeenCalled();
      expect(agentService.scanForOpportunities).toHaveBeenCalled();
    });
    
    // Check that opportunities are displayed
    await waitFor(() => {
      expect(screen.getByText(/Morning Care Visit/i)).toBeInTheDocument();
      expect(screen.getByText(/Medication Management/i)).toBeInTheDocument();
    });
  });

  test('allows manual scanning', async () => {
    render(<OpportunityScanner />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(scannerService.getStatus).toHaveBeenCalled();
    });
    
    // Click the scan button
    const scanButton = screen.getByText(/Scan Now/i);
    fireEvent.click(scanButton);
    
    // Check that the scan was triggered
    await waitFor(() => {
      expect(scannerService.forceScan).toHaveBeenCalled();
      expect(agentService.scanForOpportunities).toHaveBeenCalled();
      expect(scannerService.getStatus).toHaveBeenCalled();
      expect(scannerService.getHistory).toHaveBeenCalled();
    });
  });

  test('allows applying for opportunities', async () => {
    render(<OpportunityScanner />);
    
    // Wait for opportunities to load
    await waitFor(() => {
      expect(screen.getByText(/Morning Care Visit/i)).toBeInTheDocument();
    });
    
    // Find all Apply buttons and click the first one
    const applyButtons = await screen.findAllByText('Apply');
    fireEvent.click(applyButtons[0]);
    
    // Check that the opportunity was applied for
    await waitFor(() => {
      expect(agentService.applyOpportunity).toHaveBeenCalledWith('opp-1');
    });
  });

  test('allows rejecting opportunities', async () => {
    render(<OpportunityScanner />);
    
    // Wait for opportunities to load
    await waitFor(() => {
      expect(screen.getByText(/Morning Care Visit/i)).toBeInTheDocument();
    });
    
    // Find all Reject buttons and click the first one
    const rejectButtons = await screen.findAllByText('Reject');
    fireEvent.click(rejectButtons[0]);
    
    // Check that the opportunity was rejected
    await waitFor(() => {
      expect(agentService.rejectOpportunity).toHaveBeenCalledWith('opp-1', expect.any(String));
    });
  });

  test('shows scanner status correctly', async () => {
    // Mock scanner as running
    scannerService.getStatus.mockResolvedValue({
      isRunning: true,
      lastScan: '2025-06-13T18:30:00.000Z'
    });
    
    render(<OpportunityScanner />);
    
    // Check for running status
    await waitFor(() => {
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });
    
    // Change mock to stopped
    scannerService.getStatus.mockResolvedValue({
      isRunning: false,
      lastScan: '2025-06-13T18:30:00.000Z'
    });
    
    // Trigger a refresh by forcing a scan
    const scanButton = screen.getByText(/Scan Now/i);
    fireEvent.click(scanButton);
    
    // Check for stopped status
    await waitFor(() => {
      expect(screen.getByText(/Stopped/i)).toBeInTheDocument();
    });
  });
});

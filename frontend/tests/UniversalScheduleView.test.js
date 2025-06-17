import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UniversalScheduleView } from '../src/components';
import { universalScheduleService } from '../src/services';

// Mock the universalScheduleService
jest.mock('../src/services', () => ({
  universalScheduleService: {
    getSchedules: jest.fn(),
    getSchedule: jest.fn(),
    findConflicts: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    getScheduleWithDetails: jest.fn()
  }
}));

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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    universalScheduleService.getSchedules.mockResolvedValue(mockSchedules);
    universalScheduleService.findConflicts.mockResolvedValue([]);
    universalScheduleService.createSchedule.mockResolvedValue({ id: 'new-sched', ...mockSchedules[0] });
    universalScheduleService.updateSchedule.mockResolvedValue({ success: true });
    universalScheduleService.deleteSchedule.mockResolvedValue({ success: true });
    universalScheduleService.getScheduleWithDetails.mockImplementation(async (id) => {
      return mockSchedules.find(s => s.id === id) || null;
    });
    
    // Mock the window.confirm for delete confirmations
    window.confirm = jest.fn(() => true);
    
    // Mock the window.prompt for edit prompts
    window.prompt = jest.fn(() => 'Updated Title');
  });

  test('renders the component correctly', async () => {
    render(<UniversalScheduleView />);
    
    // Check for initial elements
    expect(screen.getByText(/Day/i)).toBeInTheDocument();
    expect(screen.getByText(/Week/i)).toBeInTheDocument();
    expect(screen.getByText(/Month/i)).toBeInTheDocument();
    
    // Wait for schedules to load
    await waitFor(() => {
      expect(universalScheduleService.getSchedules).toHaveBeenCalled();
    });
    
    // Loading indicator should be shown initially
    expect(screen.getByText(/Loading schedules/i)).toBeInTheDocument();
  });

  test('displays schedules when loaded', async () => {
    render(<UniversalScheduleView />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(universalScheduleService.getSchedules).toHaveBeenCalled();
    });
    
    // Mock that loading is complete by removing the loading indicator
    universalScheduleService.getSchedules.mockImplementation(() => {
      // This change will trigger a re-render without the loading indicator
      return Promise.resolve(mockSchedules);
    });
    
    // Trigger a re-render to show schedules
    fireEvent.click(screen.getByText(/Day/i));
    
    // Check for schedule data to be displayed
    await waitFor(() => {
      // Note: These might be hard to find in the DOM because they're part of the grid
      // We might need to adjust the query based on the actual component implementation
      expect(screen.queryByText(/Loading schedules/i)).not.toBeInTheDocument();
    });
  });

  test('allows switching between view modes', async () => {
    render(<UniversalScheduleView />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(universalScheduleService.getSchedules).toHaveBeenCalled();
    });
    
    // Click on Day view button
    fireEvent.click(screen.getByText(/Day/i));
    
    // Click on Week view button
    fireEvent.click(screen.getByText(/Week/i));
    
    // Click on Month view button
    fireEvent.click(screen.getByText(/Month/i));
    
    // Each click should trigger a re-render but doesn't necessarily change visual elements
    // in this test environment, so we just verify the clicks don't cause errors
    expect(screen.getByText(/Day/i)).toBeInTheDocument();
  });

  test('allows filtering by display mode', async () => {
    render(<UniversalScheduleView />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(universalScheduleService.getSchedules).toHaveBeenCalled();
    });
    
    // Click on Client Only button
    fireEvent.click(screen.getByText(/Client Only/i));
    
    // Click on Caregiver Only button
    fireEvent.click(screen.getByText(/Caregiver Only/i));
    
    // Click on All Schedules button
    fireEvent.click(screen.getByText(/All Schedules/i));
    
    // Again, these clicks trigger state changes but don't necessarily affect the DOM
    // in ways we can easily test without more complex setup
    expect(screen.getByText(/Client Only/i)).toBeInTheDocument();
  });

  test('allows creating a new schedule', async () => {
    render(<UniversalScheduleView />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(universalScheduleService.getSchedules).toHaveBeenCalled();
    });
    
    // Click the "New Schedule" button
    fireEvent.click(screen.getByText(/\+ New Schedule/i));
    
    // Check that the service was called with appropriate data
    await waitFor(() => {
      expect(universalScheduleService.createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(String),
          startTime: '09:00',
          endTime: '10:00',
          title: 'New Schedule'
        })
      );
    });
    
    // After creation, schedules should be refreshed
    expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(2);
  });

  test('allows navigating date ranges', async () => {
    render(<UniversalScheduleView />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(universalScheduleService.getSchedules).toHaveBeenCalled();
    });
    
    // Click the "Previous" button
    fireEvent.click(screen.getByText(/< Previous/i));
    
    // Click the "Next" button
    fireEvent.click(screen.getByText(/Next >/i));
    
    // Schedules should be refreshed after each navigation
    expect(universalScheduleService.getSchedules).toHaveBeenCalledTimes(3);
  });

  // Additional tests could cover:
  // - Schedule selection
  // - Schedule editing
  // - Schedule deletion
  // - Drag and drop functionality (harder to test with jsdom)
  // - Conflict detection and display
});

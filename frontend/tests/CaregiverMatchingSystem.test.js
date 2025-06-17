import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CaregiverMatchingSystem } from '../src/components';
import { schedulerService, notificationService } from '../src/services';

// Mock the services
jest.mock('../src/services', () => ({
  schedulerService: {
    getMatchingHistory: jest.fn(),
    getAvailableCaregivers: jest.fn(),
    getUnassignedClients: jest.fn(),
    runAutomatedMatching: jest.fn(),
    applyMatches: jest.fn(),
    saveMatchingCriteria: jest.fn(),
    getDefaultMatchingCriteria: jest.fn(),
    getHistoricalMatches: jest.fn(),
    revertMatches: jest.fn()
  },
  notificationService: {
    showNotification: jest.fn()
  }
}));

describe('CaregiverMatchingSystem Component', () => {
  // Mock data for testing
  const mockAvailableCaregivers = [
    {
      id: 'caregiver1',
      name: 'Jane Smith',
      specialties: ['Elderly Care', 'Medication Management'],
      experience: 5,
      availability: [
        { day: 'Monday', slots: ['morning', 'afternoon'] },
        { day: 'Wednesday', slots: ['morning', 'afternoon', 'evening'] },
        { day: 'Friday', slots: ['morning'] }
      ]
    },
    {
      id: 'caregiver2',
      name: 'Sarah Williams',
      specialties: ['Disability Support', 'Physiotherapy Assistance'],
      experience: 3,
      availability: [
        { day: 'Tuesday', slots: ['afternoon', 'evening'] },
        { day: 'Thursday', slots: ['morning', 'afternoon'] },
        { day: 'Saturday', slots: ['morning', 'afternoon'] }
      ]
    }
  ];
  
  const mockUnassignedClients = [
    {
      id: 'client1',
      name: 'John Doe',
      address: '123 Main St, Anytown',
      careNeeds: ['Elderly Care', 'Medication Management'],
      preferences: 'Morning appointments preferred'
    },
    {
      id: 'client2',
      name: 'Bob Johnson',
      address: '456 Oak Ave, Anytown',
      careNeeds: ['Disability Support'],
      preferences: 'Female caregivers preferred'
    }
  ];
  
  const mockMatchingResults = [
    {
      clientId: 'client1',
      clientName: 'John Doe',
      clientAddress: '123 Main St, Anytown',
      clientCareNeeds: 'Elderly Care, Medication Management',
      clientPreferences: 'Morning appointments preferred',
      caregiverId: 'caregiver1',
      caregiverName: 'Jane Smith',
      caregiverSpecialties: 'Elderly Care, Medication Management',
      caregiverExperience: 5,
      distance: 3.2,
      score: '92',
      factors: [
        { name: 'Specialty Match', score: 5, weight: 4 },
        { name: 'Distance', score: 4, weight: 3 },
        { name: 'Availability', score: 5, weight: 5 },
        { name: 'Experience', score: 4, weight: 2 },
        { name: 'Client Preference', score: 4, weight: 5 }
      ]
    },
    {
      clientId: 'client2',
      clientName: 'Bob Johnson',
      clientAddress: '456 Oak Ave, Anytown',
      clientCareNeeds: 'Disability Support',
      clientPreferences: 'Female caregivers preferred',
      caregiverId: 'caregiver2',
      caregiverName: 'Sarah Williams',
      caregiverSpecialties: 'Disability Support, Physiotherapy Assistance',
      caregiverExperience: 3,
      distance: 5.7,
      score: '85',
      factors: [
        { name: 'Specialty Match', score: 4, weight: 4 },
        { name: 'Distance', score: 3, weight: 3 },
        { name: 'Availability', score: 4, weight: 5 },
        { name: 'Experience', score: 3, weight: 2 },
        { name: 'Client Preference', score: 5, weight: 5 }
      ]
    }
  ];
  
  const mockMatchingHistory = [
    {
      id: 'hist1',
      timestamp: '2025-06-10T10:30:00Z',
      matchCount: 5,
      averageScore: 87,
      status: 'Applied',
      optimizationType: 'balanced',
      priorityFactor: 'distance',
      timeframe: '7d',
      scheduleDays: 7,
      maxTravelDistance: 30,
      affectedAppointments: 5
    },
    {
      id: 'hist2',
      timestamp: '2025-06-13T15:45:00Z',
      matchCount: 3,
      averageScore: 92,
      status: 'Pending',
      optimizationType: 'client-focused',
      priorityFactor: 'preferences',
      timeframe: '14d',
      scheduleDays: 14,
      maxTravelDistance: 40,
      affectedAppointments: 3
    }
  ];

  const mockDefaultCriteria = {
    distanceWeight: 3,
    specialtyWeight: 4,
    clientPreferenceWeight: 5,
    caregiverPreferenceWeight: 3,
    experienceWeight: 2,
    availabilityWeight: 5,
    considerLanguage: true,
    considerGender: false,
    considerPastMatches: true,
    maxDistance: 30,
    minCompatibilityScore: 70
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    schedulerService.getMatchingHistory.mockResolvedValue(mockMatchingHistory);
    schedulerService.getAvailableCaregivers.mockResolvedValue(mockAvailableCaregivers);
    schedulerService.getUnassignedClients.mockResolvedValue(mockUnassignedClients);
    schedulerService.runAutomatedMatching.mockResolvedValue(mockMatchingResults);
    schedulerService.applyMatches.mockResolvedValue({ success: true });
    schedulerService.saveMatchingCriteria.mockResolvedValue({ success: true });
    schedulerService.getDefaultMatchingCriteria.mockResolvedValue(mockDefaultCriteria);
    schedulerService.getHistoricalMatches.mockResolvedValue(mockMatchingResults);
    schedulerService.revertMatches.mockResolvedValue({ success: true });
    
    // Mock window.confirm for testing revert functionality
    window.confirm = jest.fn().mockImplementation(() => true);
  });

  test('renders the component correctly', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
      expect(schedulerService.getAvailableCaregivers).toHaveBeenCalled();
      expect(schedulerService.getUnassignedClients).toHaveBeenCalled();
    });
    
    // Check for main elements
    expect(screen.getByText('Matching Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Matching Criteria')).toBeInTheDocument();
    expect(screen.getByText('Matching History')).toBeInTheDocument();
    
    // Check for matching status
    expect(screen.getByText('Ready to Start Matching')).toBeInTheDocument();
    
    // Check for start button
    expect(screen.getByText('Start Automated Matching')).toBeInTheDocument();
  });

  test('runs automated matching when button is clicked', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Click the start matching button
    fireEvent.click(screen.getByText('Start Automated Matching'));
    
    // Verify matching is in progress
    expect(screen.getByText('Matching In Progress...')).toBeInTheDocument();
    
    // Wait for matching to complete
    await waitFor(() => {
      expect(schedulerService.runAutomatedMatching).toHaveBeenCalled();
    });
    
    // Check that results are displayed
    expect(screen.getByText('Matching Completed')).toBeInTheDocument();
    expect(screen.getByText('Total Matches:')).toBeInTheDocument();
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Matching Complete'
      })
    );
  });

  test('applies matches when apply button is clicked', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Run automated matching
    fireEvent.click(screen.getByText('Start Automated Matching'));
    
    // Wait for matching to complete
    await waitFor(() => {
      expect(screen.getByText('Apply Matches')).toBeInTheDocument();
    });
    
    // Click apply matches button
    fireEvent.click(screen.getByText('Apply Matches'));
    
    // Verify applyMatches was called
    await waitFor(() => {
      expect(schedulerService.applyMatches).toHaveBeenCalledWith({
        matches: mockMatchingResults
      });
    });
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Matches Applied'
      })
    );
    
    // Verify we're back to the initial state
    expect(screen.getByText('Ready to Start Matching')).toBeInTheDocument();
  });

  test('allows viewing match details', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Run automated matching
    fireEvent.click(screen.getByText('Start Automated Matching'));
    
    // Wait for matching to complete
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Click view details on first match
    const viewButtons = screen.getAllByText('View Details');
    fireEvent.click(viewButtons[0]);
    
    // Check that match details are shown
    await waitFor(() => {
      expect(screen.getByText('Match Details')).toBeInTheDocument();
      expect(screen.getByText('Match Score')).toBeInTheDocument();
    });
    
    // Verify client and caregiver details are shown
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Caregiver')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    
    // Close the details modal
    fireEvent.click(screen.getByText('Close Details'));
    
    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByText('Match Details')).not.toBeInTheDocument();
    });
  });

  test('allows toggling to manual override mode', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Run automated matching
    fireEvent.click(screen.getByText('Start Automated Matching'));
    
    // Wait for matching to complete
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Toggle manual override mode
    fireEvent.click(screen.getByLabelText('Manual Override Mode'));
    
    // Verify override mode is active
    expect(screen.getByText('Manual override mode is active. Select caregivers for each client below.')).toBeInTheDocument();
    
    // Check that dropdown selectors are shown instead of view buttons
    expect(screen.getAllByText('Select Caregiver')[0]).toBeInTheDocument();
  });

  test('shows matching criteria tab', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Switch to matching criteria tab
    fireEvent.click(screen.getByText('Matching Criteria'));
    
    // Check for criteria sections
    expect(screen.getByText('Configure Matching Criteria')).toBeInTheDocument();
    expect(screen.getByText('Weight Factors')).toBeInTheDocument();
    expect(screen.getByText('Consideration Factors')).toBeInTheDocument();
    expect(screen.getByText('Thresholds')).toBeInTheDocument();
    
    // Verify weight inputs are displayed
    expect(screen.getByLabelText('Distance Weight:')).toBeInTheDocument();
    expect(screen.getByLabelText('Specialty Match Weight:')).toBeInTheDocument();
    expect(screen.getByLabelText('Client Preference Weight:')).toBeInTheDocument();
    
    // Verify checkbox options
    expect(screen.getByLabelText('Consider Language Match')).toBeInTheDocument();
    expect(screen.getByLabelText('Consider Gender Preference')).toBeInTheDocument();
    
    // Verify threshold inputs
    expect(screen.getByLabelText('Maximum Distance (miles):')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimum Compatibility Score:')).toBeInTheDocument();
    
    // Verify action buttons
    expect(screen.getByText('Save as Default')).toBeInTheDocument();
    expect(screen.getByText('Reset to System Defaults')).toBeInTheDocument();
  });

  test('saves matching criteria when button is clicked', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Switch to matching criteria tab
    fireEvent.click(screen.getByText('Matching Criteria'));
    
    // Change a criterion
    const maxDistanceInput = screen.getByLabelText('Maximum Distance (miles):');
    fireEvent.change(maxDistanceInput, { target: { value: '40' } });
    
    // Click save button
    fireEvent.click(screen.getByText('Save as Default'));
    
    // Verify saveMatchingCriteria was called
    await waitFor(() => {
      expect(schedulerService.saveMatchingCriteria).toHaveBeenCalled();
    });
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Criteria Saved'
      })
    );
  });

  test('resets matching criteria when button is clicked', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Switch to matching criteria tab
    fireEvent.click(screen.getByText('Matching Criteria'));
    
    // Click reset button
    fireEvent.click(screen.getByText('Reset to System Defaults'));
    
    // Verify getDefaultMatchingCriteria was called
    await waitFor(() => {
      expect(schedulerService.getDefaultMatchingCriteria).toHaveBeenCalled();
    });
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: 'Criteria Reset'
      })
    );
  });

  test('shows matching history tab', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Switch to matching history tab
    fireEvent.click(screen.getByText('Matching History'));
    
    // Check that history items are displayed
    expect(screen.getByText('Matching History')).toBeInTheDocument();
    expect(screen.getAllByText('Applied')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Pending')[0]).toBeInTheDocument();
    
    // Verify view buttons are present
    expect(screen.getAllByText('View')[0]).toBeInTheDocument();
    
    // Verify revert button is present for applied matches
    expect(screen.getByText('Revert')).toBeInTheDocument();
  });

  test('allows reverting applied matches', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Switch to matching history tab
    fireEvent.click(screen.getByText('Matching History'));
    
    // Click revert button
    fireEvent.click(screen.getByText('Revert'));
    
    // Verify confirmation dialog was shown
    expect(window.confirm).toHaveBeenCalled();
    
    // Verify revertMatches was called
    await waitFor(() => {
      expect(schedulerService.revertMatches).toHaveBeenCalledWith('hist1');
    });
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Matches Reverted'
      })
    );
  });

  test('handles errors gracefully', async () => {
    // Mock API to throw error
    schedulerService.runAutomatedMatching.mockRejectedValue(new Error('Matching error'));
    
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Click start matching button
    fireEvent.click(screen.getByText('Start Automated Matching'));
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to run automated matching. Please try again.')).toBeInTheDocument();
    });
    
    // Check that error notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Matching Error'
      })
    );
    
    // Verify matching status is failed
    expect(screen.getByText('Matching Failed')).toBeInTheDocument();
  });

  test('discards matching results when discard button is clicked', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Run automated matching
    fireEvent.click(screen.getByText('Start Automated Matching'));
    
    // Wait for matching to complete
    await waitFor(() => {
      expect(screen.getByText('Discard & Start Over')).toBeInTheDocument();
    });
    
    // Click discard button
    fireEvent.click(screen.getByText('Discard & Start Over'));
    
    // Verify we're back to the initial state
    expect(screen.getByText('Ready to Start Matching')).toBeInTheDocument();
  });

  test('loads historical matches when viewing from history', async () => {
    render(<CaregiverMatchingSystem />);
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(schedulerService.getMatchingHistory).toHaveBeenCalled();
    });
    
    // Switch to matching history tab
    fireEvent.click(screen.getByText('Matching History'));
    
    // Click view button for a history item
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);
    
    // Verify getHistoricalMatches was called
    await waitFor(() => {
      expect(schedulerService.getHistoricalMatches).toHaveBeenCalledWith('hist1');
    });
    
    // Verify we switched to matching tab with results
    await waitFor(() => {
      expect(screen.getByText('Matching Completed')).toBeInTheDocument();
      expect(screen.getByText('Total Matches:')).toBeInTheDocument();
    });
  });
});

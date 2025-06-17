import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgentInsightDisplay } from '../src/components';
import { agentService } from '../src/services';

// Mock the agent service
jest.mock('../src/services', () => ({
  agentService: {
    getInsights: jest.fn(),
    getSuggestions: jest.fn()
  }
}));

describe('AgentInsightDisplay Component', () => {
  // Mock data for testing
  const mockInsights = [
    {
      id: 'insight-1',
      type: 'Schedule Analysis',
      content: 'There are 3 scheduling conflicts that need resolution.',
      timestamp: '2025-06-13T12:00:00.000Z',
      metrics: {
        'Conflicts': 3,
        'Total Schedules': 25,
        'Conflict Rate': '12%'
      }
    },
    {
      id: 'insight-2',
      type: 'Performance Report',
      content: 'Caregiver assignments have improved efficiency by 15% this week.',
      timestamp: '2025-06-12T15:30:00.000Z',
      metrics: {
        'Efficiency Gain': '15%',
        'Travel Time': '-10%',
        'Client Satisfaction': '+8%'
      }
    }
  ];

  const mockSuggestions = [
    {
      id: 'suggestion-1',
      type: 'Schedule Optimization',
      content: 'Reassign Jane Smith to morning shifts to improve coverage.',
      timestamp: '2025-06-13T14:20:00.000Z',
      impact: 'Medium',
      status: null
    },
    {
      id: 'suggestion-2',
      type: 'Client Care',
      content: 'Consider adding a second caregiver for John Doe on Thursdays.',
      timestamp: '2025-06-12T10:15:00.000Z',
      impact: 'High',
      status: 'accepted'
    },
    {
      id: 'suggestion-3',
      type: 'Resource Allocation',
      content: 'Reduce overlapping shifts on weekends to optimize staffing.',
      timestamp: '2025-06-11T09:30:00.000Z',
      impact: 'Low',
      status: 'rejected',
      rejectionReason: 'Weekend coverage needs to be maintained'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    agentService.getInsights.mockResolvedValue(mockInsights);
    agentService.getSuggestions.mockResolvedValue(mockSuggestions);
  });

  test('renders the component correctly', async () => {
    render(<AgentInsightDisplay entityId="test-entity" entityType="schedule" />);
    
    // Should show loading state initially
    expect(screen.getByText(/Loading agent insights/i)).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
      expect(agentService.getInsights).toHaveBeenCalledWith('test-entity');
      expect(agentService.getSuggestions).toHaveBeenCalledWith('test-entity', 'schedule');
    });
  });

  test('displays insights when "Insights" tab is active', async () => {
    render(<AgentInsightDisplay entityId="test-entity" entityType="schedule" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading agent insights/i)).not.toBeInTheDocument();
    });
    
    // Check that insights tab is active by default
    expect(screen.getByText(/Schedule Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Performance Report/i)).toBeInTheDocument();
    
    // Check for specific insight content
    expect(screen.getByText(/There are 3 scheduling conflicts/i)).toBeInTheDocument();
    expect(screen.getByText(/Caregiver assignments have improved/i)).toBeInTheDocument();
    
    // Check for metrics
    expect(screen.getByText(/Conflicts:/i)).toBeInTheDocument();
    expect(screen.getByText(/Efficiency Gain:/i)).toBeInTheDocument();
  });

  test('switches to suggestions tab when clicked', async () => {
    render(<AgentInsightDisplay entityId="test-entity" entityType="schedule" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading agent insights/i)).not.toBeInTheDocument();
    });
    
    // Click on Suggestions tab
    fireEvent.click(screen.getByText('Suggestions'));
    
    // Check that suggestions are now displayed
    expect(screen.getByText(/Schedule Optimization/i)).toBeInTheDocument();
    expect(screen.getByText(/Client Care/i)).toBeInTheDocument();
    expect(screen.getByText(/Resource Allocation/i)).toBeInTheDocument();
    
    // Check for specific suggestion content
    expect(screen.getByText(/Reassign Jane Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Consider adding a second caregiver/i)).toBeInTheDocument();
    
    // Check for impact labels
    expect(screen.getByText(/Impact:/i)).toBeInTheDocument();
    expect(screen.getByText(/Medium/i)).toBeInTheDocument();
  });

  test('allows accepting a suggestion', async () => {
    render(<AgentInsightDisplay entityId="test-entity" entityType="schedule" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading agent insights/i)).not.toBeInTheDocument();
    });
    
    // Click on Suggestions tab
    fireEvent.click(screen.getByText('Suggestions'));
    
    // Find and click the Accept button on the first suggestion
    const acceptButtons = screen.getAllByText('Accept');
    fireEvent.click(acceptButtons[0]);
    
    // The UI should update to show the suggestion was accepted
    // Note: This is testing the UI update, not the actual API call since we mocked it
    await waitFor(() => {
      expect(screen.getAllByText('Accept').length).toBe(0);
    });
  });

  test('allows rejecting a suggestion', async () => {
    render(<AgentInsightDisplay entityId="test-entity" entityType="schedule" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading agent insights/i)).not.toBeInTheDocument();
    });
    
    // Click on Suggestions tab
    fireEvent.click(screen.getByText('Suggestions'));
    
    // Find and click the Reject button on the first suggestion
    const rejectButtons = screen.getAllByText('Reject');
    fireEvent.click(rejectButtons[0]);
    
    // The UI should update to show the suggestion was rejected
    // Note: This is testing the UI update, not the actual API call since we mocked it
    await waitFor(() => {
      expect(screen.getAllByText('Reject').length).toBe(0);
    });
  });

  test('displays appropriate message when no insights are available', async () => {
    // Mock empty insights and suggestions
    agentService.getInsights.mockResolvedValue([]);
    agentService.getSuggestions.mockResolvedValue([]);
    
    render(<AgentInsightDisplay entityId="test-entity" entityType="schedule" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading agent insights/i)).not.toBeInTheDocument();
    });
    
    // Check for no data message
    expect(screen.getByText(/No insights available/i)).toBeInTheDocument();
    
    // Click on Suggestions tab
    fireEvent.click(screen.getByText('Suggestions'));
    
    // Check for no suggestions message
    expect(screen.getByText(/No suggestions available/i)).toBeInTheDocument();
  });

  test('displays error message when API call fails', async () => {
    // Mock API failure
    agentService.getInsights.mockRejectedValue(new Error('API Error'));
    agentService.getSuggestions.mockRejectedValue(new Error('API Error'));
    
    render(<AgentInsightDisplay entityId="test-entity" entityType="schedule" />);
    
    // Wait for error to display
    await waitFor(() => {
      expect(screen.getByText(/Failed to load agent insights/i)).toBeInTheDocument();
    });
  });
});

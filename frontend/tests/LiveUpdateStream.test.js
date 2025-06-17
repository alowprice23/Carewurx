import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LiveUpdateStream } from '../src/components';
import { notificationService } from '../src/services';

// Mock the services
jest.mock('../src/services', () => ({
  notificationService: {
    showNotification: jest.fn()
  }
}));

// Mock EventSource since it's not available in the test environment
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.onopen = jest.fn();
    this.onerror = jest.fn();
    this.close = jest.fn();
    this.addEventListener = jest.fn((event, callback) => {
      this[`on${event}`] = callback;
    });
    
    // Call onopen asynchronously to simulate connection
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
}

global.EventSource = MockEventSource;

describe('LiveUpdateStream Component', () => {
  // Mock data for testing
  const mockUpdate = {
    id: 'update-1',
    type: 'schedule',
    title: 'Schedule Updated',
    message: 'Client schedule has been updated',
    timestamp: '2025-06-14T05:30:00Z',
    priority: 'medium',
    details: { clientId: 'client-123', changes: ['time', 'caregiver'] }
  };
  
  const mockHighPriorityUpdate = {
    id: 'update-2',
    type: 'client',
    title: 'New Client Added',
    message: 'A new client has been added to the system',
    timestamp: '2025-06-14T05:35:00Z',
    priority: 'high',
    details: { clientId: 'client-456', name: 'Jane Doe' }
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders the component correctly', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Check for main elements
    expect(screen.getByText('Live Updates')).toBeInTheDocument();
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('Priority:')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    
    // Check for filter options
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Caregiver')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    
    // Check for buttons
    expect(screen.getByText('Mark All Read')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
    
    // Wait for connection status to update
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });
  
  test('displays updates when received', async () => {
    const mockOnUpdate = jest.fn();
    
    // Render component
    render(<LiveUpdateStream onUpdate={mockOnUpdate} />);
    
    // Wait for connection
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    // Simulate receiving an update
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockUpdate) });
    });
    
    // Check if update is displayed
    await waitFor(() => {
      expect(screen.getByText('Schedule Updated')).toBeInTheDocument();
      expect(screen.getByText('Client schedule has been updated')).toBeInTheDocument();
      expect(screen.getByText('schedule')).toBeInTheDocument();
    });
    
    // Check if onUpdate callback was called
    expect(mockOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: mockUpdate.id,
      title: mockUpdate.title
    }));
  });
  
  test('shows notification for high priority updates', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Wait for connection
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    // Simulate receiving a high priority update
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockHighPriorityUpdate) });
    });
    
    // Check if notification service was called
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: mockHighPriorityUpdate.title
      })
    );
  });
  
  test('handles connection errors', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Simulate connection error
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onerror(new Error('Connection failed'));
    });
    
    // Check for disconnected status
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
    
    // Check for reconnect button after max attempts
    act(() => {
      for (let i = 0; i < 5; i++) {
        eventSourceInstance.onerror(new Error('Connection failed'));
      }
    });
    
    await waitFor(() => {
      expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });
  });
  
  test('allows pausing and resuming the stream', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Wait for connection
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    // Click pause button
    fireEvent.click(screen.getByText('Pause'));
    
    // Check that status changes
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });
    
    // Verify that EventSource was closed
    const eventSourceInstance = global.EventSource.mock.instances[0];
    expect(eventSourceInstance.close).toHaveBeenCalled();
    
    // Click resume button
    fireEvent.click(screen.getByText('Resume'));
    
    // Check that connection is re-established
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });
  
  test('applies filters to updates', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Wait for connection
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    // Add two different updates
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockUpdate) }); // schedule type
      eventSourceInstance.onupdate({ data: JSON.stringify(mockHighPriorityUpdate) }); // client type
    });
    
    // Check that both updates are displayed
    await waitFor(() => {
      expect(screen.getByText('Schedule Updated')).toBeInTheDocument();
      expect(screen.getByText('New Client Added')).toBeInTheDocument();
    });
    
    // Filter by type 'schedule'
    fireEvent.change(screen.getByLabelText('Type:'), { target: { value: 'schedule' } });
    
    // Check that only schedule update is displayed
    await waitFor(() => {
      expect(screen.getByText('Schedule Updated')).toBeInTheDocument();
      expect(screen.queryByText('New Client Added')).not.toBeInTheDocument();
    });
    
    // Filter by type 'client'
    fireEvent.change(screen.getByLabelText('Type:'), { target: { value: 'client' } });
    
    // Check that only client update is displayed
    await waitFor(() => {
      expect(screen.queryByText('Schedule Updated')).not.toBeInTheDocument();
      expect(screen.getByText('New Client Added')).toBeInTheDocument();
    });
    
    // Filter by priority 'high'
    fireEvent.change(screen.getByLabelText('Type:'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Priority:'), { target: { value: 'high' } });
    
    // Check that only high priority update is displayed
    await waitFor(() => {
      expect(screen.queryByText('Schedule Updated')).not.toBeInTheDocument();
      expect(screen.getByText('New Client Added')).toBeInTheDocument();
    });
  });
  
  test('marks update as read when clicked', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Add an update
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockUpdate) });
    });
    
    // Check for unread indicator
    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument();
    });
    
    // Click on the update to mark as read
    fireEvent.click(screen.getByText('Schedule Updated'));
    
    // Check that unread indicator is gone
    await waitFor(() => {
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });
  });
  
  test('marks all updates as read when button clicked', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Add two updates
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockUpdate) });
      eventSourceInstance.onupdate({ data: JSON.stringify(mockHighPriorityUpdate) });
    });
    
    // Check for unread indicators
    await waitFor(() => {
      expect(screen.getAllByText('New').length).toBe(2);
    });
    
    // Click mark all read button
    fireEvent.click(screen.getByText('Mark All Read'));
    
    // Check that unread indicators are gone
    await waitFor(() => {
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });
  });
  
  test('clears all updates when clear button clicked', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Add two updates
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockUpdate) });
      eventSourceInstance.onupdate({ data: JSON.stringify(mockHighPriorityUpdate) });
    });
    
    // Check that updates are displayed
    await waitFor(() => {
      expect(screen.getByText('Schedule Updated')).toBeInTheDocument();
      expect(screen.getByText('New Client Added')).toBeInTheDocument();
    });
    
    // Click clear all button
    fireEvent.click(screen.getByText('Clear All'));
    
    // Check that updates are gone
    await waitFor(() => {
      expect(screen.queryByText('Schedule Updated')).not.toBeInTheDocument();
      expect(screen.queryByText('New Client Added')).not.toBeInTheDocument();
      expect(screen.getByText('No updates available')).toBeInTheDocument();
    });
  });
  
  test('properly displays update timeline', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Check for empty timeline message initially
    expect(screen.getByText('No update history available')).toBeInTheDocument();
    
    // Add an update
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockUpdate) });
    });
    
    // Check that timeline no longer shows empty message
    await waitFor(() => {
      expect(screen.queryByText('No update history available')).not.toBeInTheDocument();
    });
    
    // Check for timeline stats
    await waitFor(() => {
      const totalStat = screen.getByText('Total:');
      expect(totalStat.nextSibling.textContent).toBe('1');
    });
  });
  
  test('displays details when update has them', async () => {
    render(<LiveUpdateStream onUpdate={jest.fn()} />);
    
    // Add an update with details
    const eventSourceInstance = global.EventSource.mock.instances[0];
    act(() => {
      eventSourceInstance.onupdate({ data: JSON.stringify(mockUpdate) });
    });
    
    // Check that details are in the document (as JSON string)
    await waitFor(() => {
      const detailsText = JSON.stringify(mockUpdate.details, null, 2);
      expect(screen.getByText(detailsText)).toBeInTheDocument();
    });
  });
});

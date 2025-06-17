import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CollaborationTools } from '../src/components';
import { notificationService } from '../src/services';

// Mock the services
jest.mock('../src/services', () => ({
  notificationService: {
    showNotification: jest.fn()
  }
}));

// Mock WebSocket since it's not available in the test environment
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // WebSocket.OPEN
    this.OPEN = 1;
    this.onopen = jest.fn();
    this.onmessage = jest.fn();
    this.onclose = jest.fn();
    this.onerror = jest.fn();
    this.send = jest.fn();
    this.close = jest.fn();
    
    // Call onopen asynchronously to simulate connection
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
}

global.WebSocket = MockWebSocket;

describe('CollaborationTools Component', () => {
  const mockEntityType = 'client';
  const mockEntityId = 'client-123';
  const mockOnConflictResolved = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset confirm dialog mock to return true
    window.confirm = jest.fn(() => true);
  });
  
  test('renders the component correctly', async () => {
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Check for main elements
    expect(screen.getByText('Collaboration Tools')).toBeInTheDocument();
    
    // Check for tab buttons
    expect(screen.getByText(/Active Users/)).toBeInTheDocument();
    expect(screen.getByText(/Edit History/)).toBeInTheDocument();
    expect(screen.getByText(/Conflicts/)).toBeInTheDocument();
    
    // Wait for connection status to update
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    // Initial tab should be users tab
    expect(screen.getByText(/Currently editing/)).toBeInTheDocument();
    
    // Verify WebSocket connection was attempted with correct URL
    expect(global.WebSocket.mock.calls[0][0]).toBe(
      `ws://localhost:8080/collaboration/${mockEntityType}/${mockEntityId}`
    );
  });
  
  test('switches between tabs correctly', async () => {
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Default tab should be users tab
    expect(screen.getByText(/Currently editing/)).toBeInTheDocument();
    
    // Switch to history tab
    fireEvent.click(screen.getByText(/Edit History/));
    
    // Check that history tab content is displayed
    expect(screen.getByText('Refresh History')).toBeInTheDocument();
    
    // Switch to conflicts tab
    fireEvent.click(screen.getByText(/Conflicts/));
    
    // Check that conflicts tab content is displayed
    expect(screen.getByText('No conflicts detected')).toBeInTheDocument();
    
    // Switch back to users tab
    fireEvent.click(screen.getByText(/Active Users/));
    
    // Check that users tab content is displayed again
    expect(screen.getByText(/Currently editing/)).toBeInTheDocument();
  });
  
  test('displays active users correctly', async () => {
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Check for user items
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    
    // Check for active status
    expect(screen.getAllByText('Currently editing').length).toBe(2);
    
    // Check for inactive status
    expect(screen.getByText(/Last active/)).toBeInTheDocument();
  });
  
  test('displays edit history correctly', async () => {
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Switch to history tab
    fireEvent.click(screen.getByText(/Edit History/));
    
    // Check for history items
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText('Client Name')).toBeInTheDocument();
    expect(screen.getByText('John A. Client')).toBeInTheDocument();
    
    // Check for revert button on someone else's edit
    expect(screen.getAllByText('Revert').length).toBe(2);
    
    // Should not show revert button on own edits
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    const ownEdit = screen.getByText('john@example.com').closest('.history-item');
    expect(ownEdit).not.toHaveTextContent('Revert');
  });
  
  test('displays conflicts correctly', async () => {
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Switch to conflicts tab
    fireEvent.click(screen.getByText(/Conflicts/));
    
    // Check for conflict items
    expect(screen.getByText('Appointment Time')).toBeInTheDocument();
    expect(screen.getByText('Your edit:')).toBeInTheDocument();
    expect(screen.getByText('2:00 PM')).toBeInTheDocument();
    expect(screen.getByText('3:00 PM')).toBeInTheDocument();
    
    // Check that no resolver is shown yet
    expect(screen.queryByText('Resolve Conflict')).not.toBeInTheDocument();
    
    // Click on conflict to select it
    fireEvent.click(screen.getByText('Your edit:').closest('.conflict-item'));
    
    // Check that resolver is now shown
    expect(screen.getByText('Resolve Conflict')).toBeInTheDocument();
    expect(screen.getByText('Your Change')).toBeInTheDocument();
    expect(screen.getByText(`Jane Smith's Change`)).toBeInTheDocument();
    expect(screen.getByText('Custom Resolution')).toBeInTheDocument();
    
    // Check for resolution buttons
    expect(screen.getByText('Use Your Version')).toBeInTheDocument();
    expect(screen.getByText('Use Their Version')).toBeInTheDocument();
    expect(screen.getByText('Use Custom Version')).toBeInTheDocument();
  });
  
  test('handles WebSocket connection errors', async () => {
    // Simulate connection error
    global.WebSocket = class ErrorWebSocket extends MockWebSocket {
      constructor(url) {
        super(url);
        // Simulate error and close events
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Connection error'));
          if (this.onclose) this.onclose();
        }, 0);
      }
    };
    
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Check for disconnected status
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
    
    // Check for error message
    expect(screen.getByText('Connection error. Please try again.')).toBeInTheDocument();
    
    // Check for reconnect button
    expect(screen.getByText('Reconnect')).toBeInTheDocument();
  });
  
  test('handles resolving conflicts', async () => {
    const mockWebSocketSend = jest.fn();
    global.WebSocket = class TestWebSocket extends MockWebSocket {
      constructor(url) {
        super(url);
        this.send = mockWebSocketSend;
      }
    };
    
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Switch to conflicts tab
    fireEvent.click(screen.getByText(/Conflicts/));
    
    // Click on conflict to select it
    fireEvent.click(screen.getByText('Your edit:').closest('.conflict-item'));
    
    // Resolve conflict with your version
    fireEvent.click(screen.getByText('Use Your Version'));
    
    // Check that WebSocket message was sent
    expect(mockWebSocketSend).toHaveBeenCalledWith(
      expect.stringContaining('"type":"resolve_conflict"')
    );
    expect(mockWebSocketSend).toHaveBeenCalledWith(
      expect.stringContaining('"resolution":"yours"')
    );
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Conflict Resolved'
      })
    );
    
    // Check that callback was called
    expect(mockOnConflictResolved).toHaveBeenCalled();
  });
  
  test('handles reverting edits', async () => {
    const mockWebSocketSend = jest.fn();
    global.WebSocket = class TestWebSocket extends MockWebSocket {
      constructor(url) {
        super(url);
        this.send = mockWebSocketSend;
      }
    };
    
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Switch to history tab
    fireEvent.click(screen.getByText(/Edit History/));
    
    // Find first revert button and click it
    fireEvent.click(screen.getAllByText('Revert')[0]);
    
    // Check that confirmation dialog was shown
    expect(window.confirm).toHaveBeenCalled();
    
    // Check that WebSocket message was sent
    expect(mockWebSocketSend).toHaveBeenCalledWith(
      expect.stringContaining('"type":"revert"')
    );
    
    // Check that notification was shown
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: 'Edit Reverted'
      })
    );
  });
  
  test('handles canceled revert', async () => {
    // Mock the confirm to return false (cancel)
    window.confirm = jest.fn(() => false);
    
    const mockWebSocketSend = jest.fn();
    global.WebSocket = class TestWebSocket extends MockWebSocket {
      constructor(url) {
        super(url);
        this.send = mockWebSocketSend;
      }
    };
    
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Switch to history tab
    fireEvent.click(screen.getByText(/Edit History/));
    
    // Find first revert button and click it
    fireEvent.click(screen.getAllByText('Revert')[0]);
    
    // Check that confirmation dialog was shown
    expect(window.confirm).toHaveBeenCalled();
    
    // Check that WebSocket message was NOT sent
    expect(mockWebSocketSend).not.toHaveBeenCalled();
    
    // Check that no notification was shown
    expect(notificationService.showNotification).not.toHaveBeenCalled();
  });
  
  test('handles refreshing history', async () => {
    jest.useFakeTimers();
    
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Switch to history tab
    fireEvent.click(screen.getByText(/Edit History/));
    
    // Click refresh history button
    fireEvent.click(screen.getByText('Refresh History'));
    
    // Button should now be disabled
    expect(screen.getByText('Refreshing...')).toBeDisabled();
    
    // Advance timers
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    // Button should be enabled again
    expect(screen.getByText('Refresh History')).not.toBeDisabled();
    
    jest.useRealTimers();
  });
  
  test('processes incoming WebSocket messages', async () => {
    // Mock WebSocket that can simulate incoming messages
    let mockMessageHandler;
    global.WebSocket = class MessageTestWebSocket extends MockWebSocket {
      constructor(url) {
        super(url);
        this.onmessage = jest.fn(handler => {
          mockMessageHandler = handler;
        });
      }
    };
    
    render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    // Simulate incoming users_update message
    const usersUpdateMessage = {
      type: 'users_update',
      users: [
        { id: 'new-user', name: 'New User', color: '#9b59b6', active: true, lastActivity: new Date().toISOString() }
      ]
    };
    
    act(() => {
      // Get the onmessage handler and call it with the message
      const webSocketInstance = global.WebSocket.mock.instances[0];
      webSocketInstance.onmessage({ data: JSON.stringify(usersUpdateMessage) });
    });
    
    // Check that new user is displayed
    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });
  });
  
  test('cleans up WebSocket on unmount', () => {
    const { unmount } = render(
      <CollaborationTools 
        entityType={mockEntityType} 
        entityId={mockEntityId} 
        onConflictResolved={mockOnConflictResolved} 
      />
    );
    
    // Get the WebSocket instance
    const webSocketInstance = global.WebSocket.mock.instances[0];
    
    // Unmount the component
    unmount();
    
    // Check that WebSocket was closed
    expect(webSocketInstance.close).toHaveBeenCalled();
  });
});

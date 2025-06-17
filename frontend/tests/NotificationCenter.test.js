import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationCenter } from '../src/components';
import { notificationService } from '../src/services';

// Mock the notification service
jest.mock('../src/services', () => ({
  notificationService: {
    getNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    getNotificationCount: jest.fn(),
    subscribeToNotifications: jest.fn(),
    createNotification: jest.fn()
  }
}));

describe('NotificationCenter Component', () => {
  // Mock data for testing
  const mockNotifications = [
    {
      id: 'notif-1',
      title: 'New Schedule',
      message: 'A new schedule has been created',
      timestamp: '2025-06-13T18:30:00.000Z',
      read: false,
      type: 'info',
      actionable: true
    },
    {
      id: 'notif-2',
      title: 'Urgent Opportunity',
      message: 'An urgent opportunity is available',
      timestamp: '2025-06-13T17:45:00.000Z',
      read: false,
      type: 'urgent',
      actionable: true
    },
    {
      id: 'notif-3',
      title: 'Reminder',
      message: 'You have a meeting tomorrow',
      timestamp: '2025-06-13T16:20:00.000Z',
      read: true,
      type: 'reminder',
      actionable: false
    }
  ];
  
  let mockUnsubscribe;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    notificationService.getNotifications.mockResolvedValue(mockNotifications);
    notificationService.getNotificationCount.mockResolvedValue(2); // 2 unread
    notificationService.markAsRead.mockResolvedValue({ success: true });
    notificationService.markAllAsRead.mockResolvedValue({ success: true });
    notificationService.deleteNotification.mockResolvedValue({ success: true });
    
    // Mock the subscription
    mockUnsubscribe = jest.fn();
    notificationService.subscribeToNotifications.mockImplementation(callback => {
      // Store the callback for later use in tests
      window.mockNotificationCallback = callback;
      return mockUnsubscribe;
    });
  });

  test('renders the component correctly', async () => {
    render(<NotificationCenter />);
    
    // Header should be visible initially
    expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
    
    // Unread count badge should be displayed
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    
    // Expand the notification center
    fireEvent.click(screen.getByText(/Notifications/i));
    
    // Category tabs should be visible
    expect(screen.getByText(/All/i)).toBeInTheDocument();
    expect(screen.getByText(/Urgent/i)).toBeInTheDocument();
    expect(screen.getByText(/Info/i)).toBeInTheDocument();
    expect(screen.getByText(/Reminders/i)).toBeInTheDocument();
    
    // Notifications should be loaded and displayed
    await waitFor(() => {
      expect(screen.getByText(/New Schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/Urgent Opportunity/i)).toBeInTheDocument();
      expect(screen.getByText(/You have a meeting tomorrow/i)).toBeInTheDocument();
    });
  });

  test('allows filtering by category', async () => {
    render(<NotificationCenter />);
    
    // Expand the notification center
    fireEvent.click(screen.getByText(/Notifications/i));
    
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText(/New Schedule/i)).toBeInTheDocument();
    });
    
    // Filter by urgent notifications
    fireEvent.click(screen.getByText(/Urgent/i));
    
    // Service should be called with type filter
    await waitFor(() => {
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'urgent' })
      );
    });
  });

  test('allows filtering by unread status', async () => {
    render(<NotificationCenter />);
    
    // Expand the notification center
    fireEvent.click(screen.getByText(/Notifications/i));
    
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText(/New Schedule/i)).toBeInTheDocument();
    });
    
    // Check the "Unread only" checkbox
    const unreadCheckbox = screen.getByLabelText(/Unread only/i);
    fireEvent.click(unreadCheckbox);
    
    // Service should be called with read:false filter
    await waitFor(() => {
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ read: false })
      );
    });
  });

  test('allows marking a notification as read', async () => {
    render(<NotificationCenter />);
    
    // Expand the notification center
    fireEvent.click(screen.getByText(/Notifications/i));
    
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText(/New Schedule/i)).toBeInTheDocument();
    });
    
    // Click on a notification to mark as read
    fireEvent.click(screen.getByText(/A new schedule has been created/i));
    
    // Service should be called with correct notification ID
    await waitFor(() => {
      expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-1');
    });
  });

  test('allows marking all notifications as read', async () => {
    render(<NotificationCenter />);
    
    // Expand the notification center
    fireEvent.click(screen.getByText(/Notifications/i));
    
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText(/New Schedule/i)).toBeInTheDocument();
    });
    
    // Click "Mark all as read" button
    fireEvent.click(screen.getByText(/Mark all as read/i));
    
    // Service should be called
    await waitFor(() => {
      expect(notificationService.markAllAsRead).toHaveBeenCalled();
    });
  });

  test('allows deleting a notification', async () => {
    render(<NotificationCenter />);
    
    // Expand the notification center
    fireEvent.click(screen.getByText(/Notifications/i));
    
    // Wait for notifications to load
    await waitFor(() => {
      expect(screen.getByText(/New Schedule/i)).toBeInTheDocument();
    });
    
    // Find the delete button and click it
    const deleteButtons = screen.getAllByText('🗑️');
    fireEvent.click(deleteButtons[0]);
    
    // Service should be called with correct notification ID
    await waitFor(() => {
      expect(notificationService.deleteNotification).toHaveBeenCalledWith('notif-1');
    });
  });

  test('handles subscription to new notifications', async () => {
    render(<NotificationCenter />);
    
    // Wait for subscription to be set up
    await waitFor(() => {
      expect(notificationService.subscribeToNotifications).toHaveBeenCalled();
    });
    
    // Simulate a new notification coming in
    const newNotification = {
      id: 'notif-new',
      title: 'New Alert',
      message: 'This is a new notification',
      timestamp: new Date().toISOString(),
      read: false,
      type: 'info'
    };
    
    // Call the stored callback
    window.mockNotificationCallback(newNotification);
    
    // Expand the notification center if not already expanded
    if (!screen.queryByText(/New Alert/i)) {
      fireEvent.click(screen.getByText(/Notifications/i));
    }
    
    // New notification should be displayed
    await waitFor(() => {
      expect(screen.getByText(/New Alert/i)).toBeInTheDocument();
    });
  });

  test('unsubscribes when unmounted', async () => {
    const { unmount } = render(<NotificationCenter />);
    
    // Wait for subscription to be set up
    await waitFor(() => {
      expect(notificationService.subscribeToNotifications).toHaveBeenCalled();
    });
    
    // Unmount the component
    unmount();
    
    // Unsubscribe should be called
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

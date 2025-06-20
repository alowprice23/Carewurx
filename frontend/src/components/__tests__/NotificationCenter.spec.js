import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationCenter from '../NotificationCenter'; // Adjust path
import { notificationService, agentService } from '../../services'; // Adjust path

// Mock services
jest.mock('../../services', () => ({
  notificationService: {
    getNotifications: jest.fn(),
    getNotificationCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    subscribeToNotifications: jest.fn(() => jest.fn()), // Returns a mock unsubscribe function
  },
  agentService: {
    applyOpportunity: jest.fn(),
    rejectOpportunity: jest.fn(),
  },
}));

describe('NotificationCenter Component', () => {
  const mockNotifications = [
    { id: 'n1', title: 'New Opportunity', message: 'Opp available.', timestamp: new Date().toISOString(), read: false, type: 'opportunity', actionable: true, entityType: 'opportunity', entityId: 'opp1' },
    { id: 'n2', title: 'Schedule Reminder', message: 'Upcoming appointment.', timestamp: new Date(Date.now() - 3600000).toISOString(), read: true, type: 'reminder' },
    { id: 'n3', title: 'System Update', message: 'Maintenance soon.', timestamp: new Date(Date.now() - 7200000).toISOString(), read: false, type: 'info' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService.getNotifications.mockResolvedValue(mockNotifications);
    notificationService.getNotificationCount.mockResolvedValue(mockNotifications.filter(n => !n.read).length);
    notificationService.markAsRead.mockResolvedValue({ success: true });
    notificationService.markAllAsRead.mockResolvedValue({ success: true });
    notificationService.deleteNotification.mockResolvedValue({ success: true });
    agentService.applyOpportunity.mockResolvedValue({ success: true });
    agentService.rejectOpportunity.mockResolvedValue({ success: true });
  });

  test('renders loading state initially then displays notifications', async () => {
    render(<NotificationCenter />);
    // Initially, it's collapsed, header is visible
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Notifications')); // Expand

    expect(screen.getByText('Loading notifications...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('New Opportunity')).toBeInTheDocument();
      expect(screen.getByText('Schedule Reminder')).toBeInTheDocument();
    });
    expect(notificationService.getNotifications).toHaveBeenCalledTimes(1);
    expect(notificationService.getNotificationCount).toHaveBeenCalledTimes(1);
  });

  test('displays unread count badge correctly', async () => {
    render(<NotificationCenter />);
    await waitFor(() => {
      expect(screen.getByText(mockNotifications.filter(n => !n.read).length.toString())).toBeInTheDocument();
    });
  });

  test('expands and collapses on header click', async () => {
    render(<NotificationCenter />);
    const header = screen.getByText('Notifications');

    // Should be collapsed initially (no filter/list visible)
    expect(screen.queryByText('All')).not.toBeInTheDocument();

    fireEvent.click(header); // Expand
    await waitFor(() => expect(screen.getByText('All')).toBeInTheDocument()); // Filters visible
    await waitFor(() => expect(screen.getByText('New Opportunity')).toBeInTheDocument()); // List visible

    fireEvent.click(header); // Collapse
    await waitFor(() => expect(screen.queryByText('All')).not.toBeInTheDocument());
  });

  test('filters notifications by category', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByText('Notifications')); // Expand
    await waitFor(() => expect(notificationService.getNotifications).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Urgent')); // Assuming 'urgent' is a category
    await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(expect.objectContaining({ type: 'urgent' }));
    });
  });

  test('filters notifications by unread only', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByText('Notifications'));
    await waitFor(() => expect(notificationService.getNotifications).toHaveBeenCalledTimes(1));

    const unreadCheckbox = screen.getByLabelText('Unread only');
    fireEvent.click(unreadCheckbox);
    await waitFor(() => {
        expect(notificationService.getNotifications).toHaveBeenCalledWith(expect.objectContaining({ read: false }));
    });
  });

  test('marks a notification as read', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByText('Notifications'));
    await waitFor(() => expect(screen.getByText('New Opportunity')).toBeInTheDocument());

    // Click on the content of the first unread notification to mark as read
    fireEvent.click(screen.getByText('New Opportunity'));
    await waitFor(() => expect(notificationService.markAsRead).toHaveBeenCalledWith('n1'));
    // Check if UI updates (e.g., unread class removed or count changes)
    // This depends on how 'read' status is visually represented.
  });

  test('marks all notifications as read', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByText('Notifications'));
    await waitFor(() => expect(screen.getByText('Mark all as read')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Mark all as read'));
    await waitFor(() => expect(notificationService.markAllAsRead).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument()); // Unread count badge
  });

  test('deletes a notification', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByText('Notifications'));
    await waitFor(() => expect(screen.getByText('New Opportunity')).toBeInTheDocument());

    const deleteButtons = screen.getAllByText('🗑️'); // Get delete button for the first notification
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(notificationService.deleteNotification).toHaveBeenCalledWith('n1'));
    expect(screen.queryByText('New Opportunity')).not.toBeInTheDocument();
  });

  describe('Actionable Notifications', () => {
    const actionableNotification = mockNotifications[0]; // n1, opportunity

    test('displays action buttons for actionable notification', async () => {
      render(<NotificationCenter />);
      fireEvent.click(screen.getByText('Notifications'));
      await waitFor(() => expect(screen.getByText(actionableNotification.title)).toBeInTheDocument());

      const notificationItem = screen.getByText(actionableNotification.title).closest('.notification-item');
      expect(within(notificationItem).getByText('✓')).toBeInTheDocument(); // Accept button
      expect(within(notificationItem).getByText('✗')).toBeInTheDocument(); // Reject button
    });

    test('handles "accept" action for an opportunity', async () => {
      render(<NotificationCenter />);
      fireEvent.click(screen.getByText('Notifications'));
      await waitFor(() => expect(screen.getByText(actionableNotification.title)).toBeInTheDocument());

      const notificationItem = screen.getByText(actionableNotification.title).closest('.notification-item');
      const acceptButton = within(notificationItem).getByText('✓');
      fireEvent.click(acceptButton);

      await waitFor(() => expect(agentService.applyOpportunity).toHaveBeenCalledWith(actionableNotification.entityId));
      await waitFor(() => expect(notificationService.markAsRead).toHaveBeenCalledWith(actionableNotification.id));
      // Check if UI reflects action (e.g., buttons disabled or text change)
      // The component adds `actionTaken: 'accept'`, so buttons should disappear
      expect(within(notificationItem).queryByText('✓')).not.toBeInTheDocument();
    });

    test('handles "reject" action for an opportunity', async () => {
      render(<NotificationCenter />);
      fireEvent.click(screen.getByText('Notifications'));
      await waitFor(() => expect(screen.getByText(actionableNotification.title)).toBeInTheDocument());

      const notificationItem = screen.getByText(actionableNotification.title).closest('.notification-item');
      const rejectButton = within(notificationItem).getByText('✗');
      fireEvent.click(rejectButton);

      await waitFor(() => expect(agentService.rejectOpportunity).toHaveBeenCalledWith(actionableNotification.entityId, "Rejected via notification"));
      await waitFor(() => expect(notificationService.markAsRead).toHaveBeenCalledWith(actionableNotification.id));
      expect(within(notificationItem).queryByText('✗')).not.toBeInTheDocument();
    });

    test('handles error if agentService.applyOpportunity fails', async () => {
      agentService.applyOpportunity.mockRejectedValueOnce(new Error("Apply failed"));
      render(<NotificationCenter />);
      fireEvent.click(screen.getByText('Notifications'));
      await waitFor(() => expect(screen.getByText(actionableNotification.title)).toBeInTheDocument());

      const notificationItem = screen.getByText(actionableNotification.title).closest('.notification-item');
      const acceptButton = within(notificationItem).getByText('✓');

      // Spy on console.error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      fireEvent.click(acceptButton);

      await waitFor(() => expect(agentService.applyOpportunity).toHaveBeenCalled());
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error handling accept action"), expect.any(Error));
      // Check if notification shows error state (actionError property)
      // This would require component to render based on n.actionError
      consoleErrorSpy.mockRestore();
    });
  });

  test('subscribes and unsubscribes to notifications', () => {
    const mockUnsubscribe = jest.fn();
    notificationService.subscribeToNotifications.mockReturnValue(mockUnsubscribe);

    const { unmount } = render(<NotificationCenter />);
    expect(notificationService.subscribeToNotifications).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('adds new notification from subscription and updates unread count', async () => {
    let subscriptionCallback;
    notificationService.subscribeToNotifications.mockImplementation((callback) => {
      subscriptionCallback = callback;
      return jest.fn(); // unsubscribe
    });

    render(<NotificationCenter />);
    fireEvent.click(screen.getByText('Notifications')); // Expand
    await waitFor(() => expect(screen.getByText('New Opportunity')).toBeInTheDocument());
    const initialUnreadCount = mockNotifications.filter(n => !n.read).length;

    const newNotification = { id: 'n4', title: 'Real-time Alert', message: 'Something happened!', timestamp: new Date().toISOString(), read: false, type: 'urgent' };

    act(() => {
      subscriptionCallback(newNotification);
    });

    await waitFor(() => expect(screen.getByText('Real-time Alert')).toBeInTheDocument());
    expect(screen.getByText((initialUnreadCount + 1).toString())).toBeInTheDocument(); // Badge updated
  });

});

// Helper to use RTL's within with screen
const within = (element) => ({
    getByText: (text, options) => screen.getByText(element, text, options),
    queryByText: (text, options) => screen.queryByText(element, text, options),
    // Add other queries if needed
});

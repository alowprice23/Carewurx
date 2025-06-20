// frontend/src/services/__tests__/notificationService.spec.js
import notificationService from '../notificationService';
import firebase from '../firebase'; // To be mocked

// Mock firebase for auth
const mockGetIdToken = jest.fn().mockResolvedValue('test-id-token');
let mockCurrentUser = null;

jest.mock('../firebase', () => ({
  auth: () => ({
    currentUser: mockCurrentUser, // Dynamically set in tests
  }),
}));

// Mock window.electronAPI for all notification methods
const mockElectronAPINotifications = {
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllNotificationsAsRead: jest.fn(),
  createNotification: jest.fn(),
  deleteNotification: jest.fn(),
};

global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPINotifications,
  writable: true,
});

// Mock for DOM manipulation in showNotification
let mockNotificationElement;
let appendChildSpy;
let removeChildSpy;

describe('NotificationService', () => {
  const mockToken = 'test-id-token';
  let originalIsElectronAvailable; // To store and restore the original instance property

  beforeEach(() => {
    jest.useRealTimers(); // Ensure real timers are used for all tests by default
    jest.clearAllMocks();
    mockCurrentUser = null;
    mockGetIdToken.mockClear().mockResolvedValue('test-id-token');

    for (const key in mockElectronAPINotifications) {
      mockElectronAPINotifications[key].mockReset();
    }

    // Store original isElectronAvailable from the singleton instance
    originalIsElectronAvailable = notificationService.isElectronAvailable;

    // DOM mocks for showNotification
    mockNotificationElement = document.createElement('div');
    mockNotificationElement.style.opacity = '0';
    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    // Ensure createElement is spied on correctly for the showNotification test.
    // It's better to spy on document.createElement within the specific test or describe block for showNotification
    // if other tests might also call it, to avoid interference.
  });

  afterEach(() => {
    // Restore the original isElectronAvailable on the instance
    notificationService.isElectronAvailable = originalIsElectronAvailable;
    jest.useRealTimers(); // Ensure timers are reset after tests that might use fake ones

    // Restore any other global mocks if necessary
    if (appendChildSpy) appendChildSpy.mockRestore();
    if (removeChildSpy) removeChildSpy.mockRestore();
    // If document.createElement was spied on, restore it here too.
    // jest.spyOn(document, 'createElement').mockRestore(); // This would require it to be spied in beforeEach
  });

  describe('showNotification', () => {
    let createElementSpy;
    beforeEach(() => {
        createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockNotificationElement);
        jest.useFakeTimers();
    });
    afterEach(() => {
        createElementSpy.mockRestore();
        jest.useRealTimers();
    });

    it('should create and display a notification element', () => {
      notificationService.showNotification('Test message', 'info', 100);
      expect(createElementSpy).toHaveBeenCalledWith('div');
      expect(appendChildSpy).toHaveBeenCalledWith(mockNotificationElement);

      jest.advanceTimersByTime(10); // For opacity animation
      expect(mockNotificationElement.style.opacity).toBe('1');

      jest.advanceTimersByTime(100); // For duration
      expect(mockNotificationElement.style.opacity).toBe('0');

      jest.advanceTimersByTime(300); // For removal
      expect(removeChildSpy).toHaveBeenCalledWith(mockNotificationElement);
    });
  });

  const protectedMethods = [
    { name: 'getNotifications', ipcName: 'getNotifications', args: [{}], expectedIpcArgs: { options: {} } },
    { name: 'markAsRead', ipcName: 'markAsRead', args: ['notif1'], expectedIpcArgs: { notificationId: 'notif1' } },
    { name: 'markAllAsRead', ipcName: 'markAllNotificationsAsRead', args: [], expectedIpcArgs: {} },
    { name: 'createNotification', ipcName: 'createNotification', args: [{ title: 't', message: 'm', type: 'info' }], expectedIpcArgs: { notificationData: { title: 't', message: 'm', type: 'info' } } },
    { name: 'deleteNotification', ipcName: 'deleteNotification', args: ['notif1'], expectedIpcArgs: { notificationId: 'notif1' } },
  ];

  protectedMethods.forEach(({ name, ipcName, args, expectedIpcArgs }) => {
    describe(name, () => {
      it(`should call electronAPI.${ipcName} with idToken if in Electron and authenticated`, async () => {
        notificationService.isElectronAvailable = true;
        mockCurrentUser = { getIdToken: mockGetIdToken };
        const mockResponse = { success: true, data: 'mockData' };
        mockElectronAPINotifications[ipcName].mockResolvedValue(mockResponse);

        const result = await notificationService[name](...args);

        expect(mockGetIdToken).toHaveBeenCalled();
        expect(mockElectronAPINotifications[ipcName]).toHaveBeenCalledWith({
          idToken: mockToken,
          ...expectedIpcArgs,
        });
        expect(result).toEqual(mockResponse);
      });

      it(`should throw error in Electron mode if not authenticated for ${name}`, async () => {
        notificationService.isElectronAvailable = true;
        mockCurrentUser = null;

        await expect(notificationService[name](...args))
          .rejects.toThrow('Authentication required');
        expect(mockElectronAPINotifications[ipcName]).not.toHaveBeenCalled();
      });

      it(`should use mock logic in browser mode for ${name}`, async () => {
        notificationService.isElectronAvailable = false;

        // Specific mock logic verification for browser mode
        if (name === 'getNotifications') {
          const result = await notificationService.getNotifications({});
          expect(result).toEqual(expect.any(Array)); // Returns mock notifications
        } else if (name === 'markAsRead') {
            notificationService.mockNotifications = [{id: 'notif1', read: false, message: 'test', type: 'info'}]; // ensure structure
            const result = await notificationService.markAsRead('notif1');
            expect(result.read).toBe(true);
        } else if (name === 'markAllAsRead') {
            notificationService.mockNotifications = [{id: 'notif1', read: false}, {id: 'notif2', read: false}];
            const result = await notificationService.markAllAsRead();
            expect(result.success).toBe(true);
            expect(notificationService.mockNotifications.every(n => n.read)).toBe(true);
        } else if (name === 'createNotification') {
            jest.spyOn(notificationService, 'showNotification').mockImplementation(() => {}); // Mock showNotification
            const initialCount = notificationService.mockNotifications.length;
            const result = await notificationService[name](...args);
            expect(result.id).toBeDefined();
            expect(notificationService.mockNotifications.length).toBe(initialCount + 1);
            notificationService.showNotification.mockRestore();
        } else if (name === 'deleteNotification') {
            notificationService.mockNotifications = [{id: 'notif1'}];
            const result = await notificationService[name](...args);
            expect(result.success).toBe(true);
            expect(notificationService.mockNotifications.find(n => n.id === 'notif1')).toBeUndefined();
        }
        expect(mockElectronAPINotifications[ipcName]).not.toHaveBeenCalled();
      });
    });
  });

  describe('subscribeToNotifications', () => {
    it('should add and remove event listener', () => {
      const callback = jest.fn();
      const addEventSpy = jest.spyOn(window, 'addEventListener');
      const removeEventSpy = jest.spyOn(window, 'removeEventListener');

      const unsubscribe = notificationService.subscribeToNotifications(callback);

      expect(addEventSpy).toHaveBeenCalledWith('new-notification', expect.any(Function));

      unsubscribe();
      expect(removeEventSpy).toHaveBeenCalledWith('new-notification', expect.any(Function));
    });
  });

  describe('getNotificationCount', () => {
    it('should return count of unread notifications by type using getNotifications', async () => {
      notificationService.isElectronAvailable = false; // Use mock path of getNotifications
      notificationService.mockNotifications = [
        { id: 'n1', type: 'info', read: false, message: 'm1', title: 't1' },
        { id: 'n2', type: 'warning', read: false, message: 'm2', title: 't2' },
        { id: 'n3', type: 'info', read: true, message: 'm3', title: 't3' },
        { id: 'n4', type: 'info', read: false, message: 'm4', title: 't4' },
      ];

      let count = await notificationService.getNotificationCount('info');
      expect(count).toBe(2);

      count = await notificationService.getNotificationCount();
      expect(count).toBe(3);
    });
  });
});

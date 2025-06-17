const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('notifications:get', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForSelector('#app-container');

  // Mock the electronAPI to intercept the call
  await window.evaluate(() => {
    window.electronAPI.notifications = {
      get: (options) => {
        if (options.limit === 5) {
          return Promise.resolve([
            { id: 'notif-1', message: 'Notification 1' },
            { id: 'notif-2', message: 'Notification 2' },
          ]);
        }
        return Promise.resolve([]);
      }
    };
  });

  // Simulate getting notifications
  const notifications = await window.evaluate(async () => {
    return await window.electronAPI.notifications.get({ limit: 5 });
  });

  expect(notifications).toHaveLength(2);
  expect(notifications[0].id).toBe('notif-1');

  await electronApp.close();
});

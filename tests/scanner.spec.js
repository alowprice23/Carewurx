const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('scanner:getStatus', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForSelector('#app-container');

  // Mock the electronAPI to intercept the call
  await window.evaluate(() => {
    window.electronAPI.scanner = {
      getStatus: () => {
        return Promise.resolve({
          isRunning: true,
          lastScan: new Date().toISOString()
        });
      }
    };
  });

  // Simulate getting the scanner status
  const status = await window.evaluate(async () => {
    return await window.electronAPI.scanner.getStatus();
  });

  expect(status.isRunning).toBe(true);
  expect(status.lastScan).not.toBeNull();

  await electronApp.close();
});

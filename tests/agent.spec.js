const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('agent:processMessage', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForSelector('#app-container');

  // Mock the electronAPI to intercept the call
  await window.evaluate(() => {
    window.electronAPI.agent = {
      processMessage: (userId, message) => {
        if (userId === 'test-user' && message === 'hello') {
          return Promise.resolve({
            text: 'Hello there!',
            agent: 'bruce',
            actions: [],
            timestamp: new Date().toISOString()
          });
        }
        return Promise.resolve({ text: 'Unknown message' });
      }
    };
  });

  // Simulate a user sending a message
  const response = await window.evaluate(async () => {
    return await window.electronAPI.agent.processMessage('test-user', 'hello');
  });

  expect(response.text).toBe('Hello there!');
  expect(response.agent).toBe('bruce');

  await electronApp.close();
});

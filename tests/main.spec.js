const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('launch app', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForSelector('#app-container');
  expect(await window.title()).toBe('Carewurx');
  await electronApp.close();
});

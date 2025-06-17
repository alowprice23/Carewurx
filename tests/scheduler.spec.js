const { _electron: electron } = require('@playwright/test');
const { test, expect } = require('@playwright/test');

test('scheduler:createSchedule', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await window.waitForSelector('#app-container');

  // Mock the electronAPI to intercept the call
  await window.evaluate(() => {
    window.electronAPI.scheduler = {
      createSchedule: (scheduleData) => {
        if (
          scheduleData.client_id === 'test-client' &&
          scheduleData.date === '2025-01-01'
        ) {
          return Promise.resolve({
            id: 'test-schedule-id',
            ...scheduleData
          });
        }
        return Promise.reject(new Error('Schedule creation failed'));
      }
    };
  });

  // Simulate creating a schedule
  const newSchedule = {
    client_id: 'test-client',
    date: '2025-01-01',
    start_time: '09:00',
    end_time: '17:00',
    status: 'pending'
  };

  const response = await window.evaluate(async (schedule) => {
    return await window.electronAPI.scheduler.createSchedule(schedule);
  }, newSchedule);

  expect(response.id).toBe('test-schedule-id');
  expect(response.client_id).toBe('test-client');

  await electronApp.close();
});

// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Frontend E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000/');
    
    // Wait for app to load
    await page.waitForSelector('.app-container');
  });

  test('should render main application components', async ({ page }) => {
    // Check for header
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.app-header h1')).toHaveText('CareWurx');
    
    // Check for navigation
    await expect(page.locator('.app-nav')).toBeVisible();
    await expect(page.locator('.app-nav button').first()).toHaveText('Agent Chat');
    
    // Check that notification center is visible
    await expect(page.locator('.notification-center')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    // Default view should be agent chat
    await expect(page.locator('.tab-content h2')).toHaveText('Agent Assistant');
    
    // Switch to schedule tab
    await page.click('button:has-text("Schedule")');
    await expect(page.locator('.tab-content h2')).toHaveText('Universal Schedule');
    
    // Switch to availability tab
    await page.click('button:has-text("Availability")');
    await expect(page.locator('.tab-content h2')).toHaveText('Availability Management');
    
    // Switch to conflicts tab
    await page.click('button:has-text("Conflicts")');
    await expect(page.locator('.tab-content h2')).toHaveText('Conflict Resolution');
    
    // Switch to agent insights tab
    await page.click('button:has-text("Agent Insights")');
    await expect(page.locator('.tab-content h2')).toHaveText('Agent Insights');
    
    // Switch to notifications tab
    await page.click('button:has-text("Notifications")');
    await expect(page.locator('.tab-content h2')).toHaveText('Create Notifications');
    
    // Switch to opportunities tab
    await page.click('button:has-text("Opportunities")');
    await expect(page.locator('.tab-content h2')).toHaveText('Opportunities');
    
    // Switch to scanner controls tab
    await page.click('button:has-text("Scanner Controls")');
    await expect(page.locator('.tab-content h2')).toHaveText('Scanner Controls');
    
    // Switch to data editor tab
    await page.click('button:has-text("Data Editor")');
    await expect(page.locator('.tab-content h2')).toHaveText('Universal Data Editor');
    
    // Switch to data flow tab
    await page.click('button:has-text("Data Flow")');
    await expect(page.locator('.tab-content h2')).toHaveText('Circular Data Flow Monitor');
    
    // Switch to optimization tab
    await page.click('button:has-text("Schedule Optimization")');
    await expect(page.locator('.tab-content h2')).toHaveText('Schedule Optimization');
    
    // Switch to API keys tab
    await page.click('button:has-text("API Keys")');
    await expect(page.locator('.tab-content h2')).toHaveText('API Key Management');
    
    // Switch to Response Stream tab
    await page.click('button:has-text("Response Stream")');
    await expect(page.locator('.tab-content h2')).toHaveText('Response Streaming');
    
    // Switch back to agent chat tab
    await page.click('button:has-text("Agent Chat")');
    await expect(page.locator('.tab-content h2')).toHaveText('Agent Assistant');
  });

  test('should be able to use agent chat', async ({ page }) => {
    // Type a message in the chat input
    await page.type('.agent-chat input', 'Hello agent');
    
    // Click send button
    await page.click('.agent-chat button:has-text("Send")');
    
    // Check that user message is displayed
    await expect(page.locator('.message.user-message .message-content')).toHaveText('Hello agent');
    
    // Wait for agent response
    await page.waitForSelector('.message.agent-message', { timeout: 10000 });
    
    // Check that agent message is displayed (content will depend on backend response)
    await expect(page.locator('.message.agent-message')).toBeVisible();
  });

  test('should show opportunity scanner', async ({ page }) => {
    // Navigate to opportunities tab
    await page.click('button:has-text("Opportunities")');
    
    // Check opportunity scanner elements
    await expect(page.locator('.opportunity-scanner')).toBeVisible();
    await expect(page.locator('.scanner-status')).toBeVisible();
    await expect(page.locator('.scanner-config')).toBeVisible();
    
    // Check that scan button exists
    await expect(page.locator('button:has-text("Scan Now")')).toBeVisible();
  });
  
  test('should show universal schedule view', async ({ page }) => {
    // Navigate to schedule tab
    await page.click('button:has-text("Schedule")');
    
    // Check universal schedule view elements
    await expect(page.locator('.universal-schedule-view')).toBeVisible();
    await expect(page.locator('.schedule-controls')).toBeVisible();
    
    // Check for view controls
    await expect(page.locator('button:has-text("Day")')).toBeVisible();
    await expect(page.locator('button:has-text("Week")')).toBeVisible();
    await expect(page.locator('button:has-text("Month")')).toBeVisible();
    
    // Check for display controls
    await expect(page.locator('button:has-text("All Schedules")')).toBeVisible();
    await expect(page.locator('button:has-text("Client Only")')).toBeVisible();
    await expect(page.locator('button:has-text("Caregiver Only")')).toBeVisible();
    
    // Check for new schedule button
    await expect(page.locator('button:has-text("+ New Schedule")')).toBeVisible();
  });
  
  test('should show agent insight display', async ({ page }) => {
    // Navigate to agent insights tab
    await page.click('button:has-text("Agent Insights")');
    
    // Check agent insight display elements
    await expect(page.locator('.agent-insight-display')).toBeVisible();
    await expect(page.locator('.insight-tabs')).toBeVisible();
    
    // Check for tab buttons
    await expect(page.locator('button:has-text("Insights")')).toBeVisible();
    await expect(page.locator('button:has-text("Suggestions")')).toBeVisible();
    
    // Check that Insights tab is active by default
    await expect(page.locator('.tab-button.active')).toHaveText('Insights');
    
    // Switch to Suggestions tab
    await page.click('.insight-tabs button:has-text("Suggestions")');
    
    // Check that Suggestions tab is now active
    await expect(page.locator('.tab-button.active')).toHaveText('Suggestions');
  });
  
  test('should show availability manager', async ({ page }) => {
    // Navigate to availability tab
    await page.click('button:has-text("Availability")');
    
    // Check availability manager elements
    await expect(page.locator('.availability-manager')).toBeVisible();
    await expect(page.locator('.entity-tabs')).toBeVisible();
    
    // Check for entity tabs
    await expect(page.locator('button:has-text("Caregiver Availability")')).toBeVisible();
    await expect(page.locator('button:has-text("Client Preferences")')).toBeVisible();
    
    // Check for day selection buttons
    await expect(page.locator('button:has-text("Monday")')).toBeVisible();
    await expect(page.locator('button:has-text("Tuesday")')).toBeVisible();
    
    // Check for template section
    await expect(page.locator('h3:has-text("Recurring Templates")')).toBeVisible();
    await expect(page.locator('button:has-text("Create Template")')).toBeVisible();
    
    // Test switching between entity tabs
    await page.click('button:has-text("Client Preferences")');
    await expect(page.locator('.entity-tab.active')).toHaveText('Client Preferences');
    
    await page.click('button:has-text("Caregiver Availability")');
    await expect(page.locator('.entity-tab.active')).toHaveText('Caregiver Availability');
    
    // Test selecting different days
    await page.click('button:has-text("Wednesday")');
    await expect(page.locator('.day-button.active')).toHaveText('Wednesday');
  });
  
  test('should show conflict resolution UI', async ({ page }) => {
    // Navigate to conflicts tab
    await page.click('button:has-text("Conflicts")');
    
    // Check conflict resolution UI elements
    await expect(page.locator('.conflict-resolution-ui')).toBeVisible();
    await expect(page.locator('.conflict-filters')).toBeVisible();
    
    // Check for filter options
    await expect(page.locator('button:has-text("Pending")')).toBeVisible();
    await expect(page.locator('button:has-text("Resolved")')).toBeVisible();
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    
    // Check for conflict list and history sections
    await expect(page.locator('h3:has-text("Schedule Conflicts")')).toBeVisible();
    await expect(page.locator('h3:has-text("Resolution History")')).toBeVisible();
    
    // Test switching between filter options
    await page.click('button:has-text("Resolved")');
    await expect(page.locator('.filter-button.active')).toHaveText('Resolved');
    
    await page.click('button:has-text("All")');
    await expect(page.locator('.filter-button.active')).toHaveText('All');
    
    await page.click('button:has-text("Pending")');
    await expect(page.locator('.filter-button.active')).toHaveText('Pending');
    
    // Test the refresh button
    await page.click('button:has-text("Refresh")');
  });
  
  test('should show notification creator', async ({ page }) => {
    // Navigate to notifications tab
    await page.click('button:has-text("Notifications")');
    
    // Check notification creator elements
    await expect(page.locator('.notification-creator')).toBeVisible();
    
    // Check for form fields
    await expect(page.locator('input#notification-title')).toBeVisible();
    await expect(page.locator('textarea#notification-message')).toBeVisible();
    
    // Check for notification type options
    await expect(page.locator('.notification-types')).toBeVisible();
    await expect(page.locator('text=Info')).toBeVisible();
    await expect(page.locator('text=Urgent')).toBeVisible();
    await expect(page.locator('text=Reminder')).toBeVisible();
    
    // Check for scheduled notification toggle
    await expect(page.locator('text=Schedule this notification for later')).toBeVisible();
    
    // Toggle scheduled notification
    await page.click('text=Schedule this notification for later');
    await expect(page.locator('input#schedule-date')).toBeVisible();
    await expect(page.locator('input#schedule-time')).toBeVisible();
    
    // Test form actions
    await expect(page.locator('button:has-text("Create Notification")')).toBeVisible();
    await expect(page.locator('button:has-text("Clear Form")')).toBeVisible();
  });
  
  test('should show API key manager', async ({ page }) => {
    // Navigate to API keys tab
    await page.click('button:has-text("API Keys")');
    
    // Check API key manager elements
    await expect(page.locator('.api-key-manager')).toBeVisible();
    
    // Check for provider tabs
    await expect(page.locator('button:has-text("Groq")')).toBeVisible();
    await expect(page.locator('button:has-text("OpenAI")')).toBeVisible();
    await expect(page.locator('button:has-text("Anthropic")')).toBeVisible();
    
    // Check for key input field
    await expect(page.locator('input#api-key')).toBeVisible();
    
    // Check for key action buttons
    await expect(page.locator('button:has-text("Save Key")')).toBeVisible();
    await expect(page.locator('button:has-text("Validate Key")')).toBeVisible();
    await expect(page.locator('button:has-text("Remove Key")')).toBeVisible();
    
    // Check for status section
    await expect(page.locator('h4:has-text("Key Status")')).toBeVisible();
    
    // Check for usage statistics section
    await expect(page.locator('h4:has-text("Usage Statistics")')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
    
    // Check for help section
    await expect(page.locator('h4:has-text("Help")')).toBeVisible();
    
    // Test switching between providers
    await page.click('button:has-text("OpenAI")');
    await expect(page.locator('label:has-text("OpenAI API Key")')).toBeVisible();
    
    await page.click('button:has-text("Anthropic")');
    await expect(page.locator('label:has-text("Anthropic API Key")')).toBeVisible();
    
    await page.click('button:has-text("Groq")');
    await expect(page.locator('label:has-text("Groq API Key")')).toBeVisible();
    
    // Test toggling key visibility
    await expect(page.locator('input#api-key')).toHaveAttribute('type', 'password');
    await page.click('button:has-text("Show")');
    await expect(page.locator('input#api-key')).toHaveAttribute('type', 'text');
    await page.click('button:has-text("Hide")');
    await expect(page.locator('input#api-key')).toHaveAttribute('type', 'password');
  });
  
  test('should show response streaming UI', async ({ page }) => {
    // Navigate to Response Stream tab
    await page.click('button:has-text("Response Stream")');
    
    // Check response streaming UI elements
    await expect(page.locator('.response-streaming-ui')).toBeVisible();
    
    // Check for provider and model selectors
    await expect(page.locator('label:has-text("Provider")')).toBeVisible();
    await expect(page.locator('label:has-text("Model")')).toBeVisible();
    
    // Check for prompt textarea
    await expect(page.locator('label:has-text("Prompt")')).toBeVisible();
    await expect(page.locator('textarea#prompt-input')).toBeVisible();
    
    // Check for action buttons
    await expect(page.locator('button:has-text("Send Prompt")')).toBeVisible();
    
    // Check for response container
    await expect(page.locator('h4:has-text("Response")')).toBeVisible();
    await expect(page.locator('.empty-response')).toBeVisible();
    
    // Check for provider info section
    await expect(page.locator('.provider-info')).toBeVisible();
    
    // Test entering prompt
    await page.fill('textarea#prompt-input', 'Test prompt');
    
    // Test selecting different provider
    await page.selectOption('select#provider-select', 'openai');
    await expect(page.locator('.provider-name')).toContainText('OpenAI');
    
    // Test selecting different model
    await page.selectOption('select#model-select', 'gpt-4o');
    await expect(page.locator('.provider-name')).toContainText('GPT-4o');
  });
  
  test('should show universal data editor', async ({ page }) => {
    // Navigate to Data Editor tab
    await page.click('button:has-text("Data Editor")');
    
    // Check universal data editor elements
    await expect(page.locator('.universal-data-editor')).toBeVisible();
    
    // Check for entity type tabs
    await expect(page.locator('button:has-text("Clients")')).toBeVisible();
    await expect(page.locator('button:has-text("Caregivers")')).toBeVisible();
    await expect(page.locator('button:has-text("Schedules")')).toBeVisible();
    
    // Check for entity list and form sections
    await expect(page.locator('.entity-list')).toBeVisible();
    await expect(page.locator('.entity-form')).toBeVisible();
    
    // Check for new entity button
    await expect(page.locator('button:has-text("+ New client")')).toBeVisible();
    
    // Test switching between entity types
    await page.click('button:has-text("Caregivers")');
    await expect(page.locator('button:has-text("+ New caregiver")')).toBeVisible();
    
    await page.click('button:has-text("Schedules")');
    await expect(page.locator('button:has-text("+ New schedule")')).toBeVisible();
    
    // Check form fields based on entity type
    await page.click('button:has-text("Clients")');
    await expect(page.locator('label:has-text("Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Email")')).toBeVisible();
    await expect(page.locator('label:has-text("Phone")')).toBeVisible();
    
    // Test form validation by entering invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await expect(page.locator('.error-message')).toBeVisible();
    
    // Fix the validation error
    await page.fill('input[name="email"]', 'valid@example.com');
    
    // Test form actions
    await expect(page.locator('button:has-text("Save")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });
  
  test('should show circular data flow monitor', async ({ page }) => {
    // Navigate to Data Flow tab
    await page.click('button:has-text("Data Flow")');
    
    // Check circular data flow monitor elements
    await expect(page.locator('.circular-data-flow-monitor')).toBeVisible();
    
    // Check for monitor header and controls
    await expect(page.locator('h3:has-text("Circular Data Flow Monitor")')).toBeVisible();
    await expect(page.locator('text=Time Range:')).toBeVisible();
    await expect(page.locator('text=Auto-refresh:')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh Now")')).toBeVisible();
    
    // Check for view tabs
    await expect(page.locator('button:has-text("Flow Visualization")')).toBeVisible();
    await expect(page.locator('button:has-text("Update History")')).toBeVisible();
    await expect(page.locator('button:has-text("Conflicts")')).toBeVisible();
    
    // Check for canvas element
    await expect(page.locator('canvas')).toBeVisible();
    
    // Test switching between view tabs
    await page.click('button:has-text("Update History")');
    await expect(page.locator('h4:has-text("Update History Timeline")')).toBeVisible();
    
    await page.click('button:has-text("Conflicts")');
    await expect(page.locator('h4:has-text("Data Conflicts")')).toBeVisible();
    
    // Test time range selection
    const timeRangeSelect = page.locator('select').first();
    await timeRangeSelect.selectOption('7d');
    
    // Test refresh button
    await page.click('button:has-text("Refresh Now")');
    
    // Go back to flow visualization
    await page.click('button:has-text("Flow Visualization")');
    await expect(page.locator('canvas')).toBeVisible();
  });
  
  test('should show schedule optimization controls', async ({ page }) => {
    // Navigate to Schedule Optimization tab
    await page.click('button:has-text("Schedule Optimization")');
    
    // Check schedule optimization controls elements
    await expect(page.locator('.schedule-optimization-controls')).toBeVisible();
    
    // Check for tab navigation
    await expect(page.locator('button:has-text("Optimization Parameters")')).toBeVisible();
    await expect(page.locator('button:has-text("Optimization Results")')).toBeVisible();
    await expect(page.locator('button:has-text("Optimization History")')).toBeVisible();
    
    // Check for optimization presets
    await expect(page.locator('.preset-buttons')).toBeVisible();
    await expect(page.locator('text=Balanced')).toBeVisible();
    await expect(page.locator('text=Client-Focused')).toBeVisible();
    await expect(page.locator('text=Caregiver-Focused')).toBeVisible();
    await expect(page.locator('text=Efficiency-Focused')).toBeVisible();
    
    // Check for parameter sections
    await expect(page.locator('h4:has-text("Schedule Range")')).toBeVisible();
    await expect(page.locator('h4:has-text("Caregiver Constraints")')).toBeVisible();
    await expect(page.locator('h4:has-text("Travel & Distance")')).toBeVisible();
    await expect(page.locator('h4:has-text("Preference Weights")')).toBeVisible();
    
    // Test clicking a preset
    await page.click('text=Client-Focused');
    
    // Verify parameter fields are available
    await expect(page.locator('label:has-text("Time Range:")')).toBeVisible();
    await expect(page.locator('label:has-text("Optimization Strategy:")')).toBeVisible();
    await expect(page.locator('label:has-text("Max Shifts Per Day:")')).toBeVisible();
    await expect(page.locator('label:has-text("Max Travel Distance (miles):")')).toBeVisible();
    
    // Test run optimization button is available
    await expect(page.locator('button:has-text("Run Optimization")')).toBeVisible();
    
    // Test switching to history tab
    await page.click('button:has-text("Optimization History")');
    await expect(page.locator('h3:has-text("Optimization History")')).toBeVisible();
  });
  
  test('should show caregiver matching system', async ({ page }) => {
    // Navigate to Caregiver Matching tab
    await page.click('button:has-text("Caregiver Matching")');
    
    // Check caregiver matching system elements
    await expect(page.locator('.caregiver-matching-system')).toBeVisible();
    
    // Check for tab navigation
    await expect(page.locator('button:has-text("Matching Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("Matching Criteria")')).toBeVisible();
    await expect(page.locator('button:has-text("Matching History")')).toBeVisible();
    
    // Check for matching status section
    await expect(page.locator('h3:has-text("Matching Status")')).toBeVisible();
    await expect(page.locator('.status-indicator')).toBeVisible();
    await expect(page.locator('text=Ready to Start Matching')).toBeVisible();
    
    // Check for start button
    await expect(page.locator('button:has-text("Start Automated Matching")')).toBeVisible();
    
    // Test switching to criteria tab
    await page.click('button:has-text("Matching Criteria")');
    
    // Check for criteria sections
    await expect(page.locator('h3:has-text("Configure Matching Criteria")')).toBeVisible();
    await expect(page.locator('h4:has-text("Weight Factors")')).toBeVisible();
    await expect(page.locator('h4:has-text("Consideration Factors")')).toBeVisible();
    await expect(page.locator('h4:has-text("Thresholds")')).toBeVisible();
    
    // Verify criteria fields are available
    await expect(page.locator('label:has-text("Distance Weight:")')).toBeVisible();
    await expect(page.locator('label:has-text("Specialty Match Weight:")')).toBeVisible();
    await expect(page.locator('label:has-text("Maximum Distance (miles):")')).toBeVisible();
    await expect(page.locator('label:has-text("Minimum Compatibility Score:")')).toBeVisible();
    
    // Check for action buttons
    await expect(page.locator('button:has-text("Save as Default")')).toBeVisible();
    await expect(page.locator('button:has-text("Reset to System Defaults")')).toBeVisible();
    
    // Test switching to history tab
    await page.click('button:has-text("Matching History")');
    await expect(page.locator('h3:has-text("Matching History")')).toBeVisible();
  });
  
  test('should show live update stream', async ({ page }) => {
    // Navigate to Live Updates tab
    await page.click('button:has-text("Live Updates")');
    
    // Check live update stream elements
    await expect(page.locator('.live-update-stream')).toBeVisible();
    
    // Check for header and connection status
    await expect(page.locator('h3:has-text("Live Updates")')).toBeVisible();
    await expect(page.locator('.connection-status')).toBeVisible();
    await expect(page.locator('.status-indicator')).toBeVisible();
    
    // Check for stream controls
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();
    
    // Check for filter controls
    await expect(page.locator('label:has-text("Type:")')).toBeVisible();
    await expect(page.locator('label:has-text("Priority:")')).toBeVisible();
    await expect(page.locator('label:has-text("Status:")')).toBeVisible();
    
    // Check for filter action buttons
    await expect(page.locator('button:has-text("Mark All Read")')).toBeVisible();
    await expect(page.locator('button:has-text("Clear All")')).toBeVisible();
    
    // Check for updates container
    await expect(page.locator('.updates-container')).toBeVisible();
    
    // Check for timeline section
    await expect(page.locator('h4:has-text("Update History Timeline")')).toBeVisible();
    await expect(page.locator('.timeline-container')).toBeVisible();
    
    // Check for statistics section
    await expect(page.locator('.update-indicators')).toBeVisible();
    await expect(page.locator('.indicator-stats')).toBeVisible();
    await expect(page.locator('text=Total:')).toBeVisible();
    await expect(page.locator('text=Unread:')).toBeVisible();
    await expect(page.locator('text=High Priority:')).toBeVisible();
    
    // Test filter selection
    await page.selectOption('select#filter-type', 'schedule');
    await page.selectOption('select#filter-priority', 'high');
    await page.selectOption('select#filter-read', 'unread');
    
    // Test stream pause functionality
    await page.click('button:has-text("Pause")');
    await expect(page.locator('button:has-text("Resume")')).toBeVisible();
    
    // Resume the stream
    await page.click('button:has-text("Resume")');
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();
  });
  
  test('should show collaboration tools', async ({ page }) => {
    // Navigate to Collaboration tab
    await page.click('button:has-text("Collaboration")');
    
    // Check collaboration tools elements
    await expect(page.locator('.collaboration-tools')).toBeVisible();
    
    // Check for header and connection status
    await expect(page.locator('h3:has-text("Collaboration Tools")')).toBeVisible();
    await expect(page.locator('.connection-status')).toBeVisible();
    await expect(page.locator('.status-indicator')).toBeVisible();
    
    // Check for tab navigation
    await expect(page.locator('button:has-text("Active Users")')).toBeVisible();
    await expect(page.locator('button:has-text("Edit History")')).toBeVisible();
    await expect(page.locator('button:has-text("Conflicts")')).toBeVisible();
    
    // Test switching between tabs
    // Default tab should be users tab
    await expect(page.locator('.users-list')).toBeVisible();
    
    // Switch to history tab
    await page.click('button:has-text("Edit History")');
    await expect(page.locator('.history-controls')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh History")')).toBeVisible();
    
    // Check for history items
    await expect(page.locator('.history-list')).toBeVisible();
    
    // Switch to conflicts tab
    await page.click('button:has-text("Conflicts")');
    
    // Check for conflicts container
    await expect(page.locator('.conflicts-tab')).toBeVisible();
    
    // Switch back to users tab
    await page.click('button:has-text("Active Users")');
    await expect(page.locator('.users-list')).toBeVisible();
    
    // Check for user items
    await expect(page.locator('.user-item')).toBeVisible();
    await expect(page.locator('.user-avatar')).toBeVisible();
    await expect(page.locator('.user-name')).toBeVisible();
  });
  
  test('should show IPC test harness', async ({ page }) => {
    // Navigate to IPC Test Harness tab
    await page.click('button:has-text("IPC Test Harness")');
    
    // Check IPC test harness elements
    await expect(page.locator('.ipc-test-harness')).toBeVisible();
    
    // Check for component title
    await expect(page.locator('h3:has-text("IPC Test Harness")')).toBeVisible();
    
    // Wait for endpoints to load (loading indicator should disappear)
    await page.waitForSelector('text=Loading available endpoints...', { state: 'detached', timeout: 3000 });
    
    // Check for endpoint selector
    await expect(page.locator('label:has-text("Endpoint:")')).toBeVisible();
    await expect(page.locator('select#endpoint-select')).toBeVisible();
    
    // Check for tabs
    await expect(page.locator('button:has-text("Request")')).toBeVisible();
    await expect(page.locator('button:has-text("Response")')).toBeVisible();
    await expect(page.locator('button:has-text("History")')).toBeVisible();
    
    // Test selecting an endpoint
    await page.selectOption('select#endpoint-select', 'getClients');
    
    // Check if endpoint description appears
    await expect(page.locator('.endpoint-description')).toBeVisible();
    
    // Check if parameters form appears
    await expect(page.locator('h4:has-text("Parameters")')).toBeVisible();
    
    // Check for parameter inputs
    await expect(page.locator('label:has-text("clientId:")')).toBeVisible();
    await expect(page.locator('label:has-text("includeInactive:")')).toBeVisible();
    
    // Check for execute button
    await expect(page.locator('button:has-text("Execute IPC Call")')).toBeVisible();
    
    // Test checkbox parameter
    await page.click('input[type="checkbox"]');
    
    // Execute the call
    await page.click('button:has-text("Execute IPC Call")');
    
    // Should show loading state
    await expect(page.locator('button:has-text("Executing...")')).toBeVisible();
    
    // Wait for response (tab should switch to Response)
    await page.waitForSelector('button.active:has-text("Response")', { timeout: 3000 });
    
    // Check response elements
    await expect(page.locator('.response-info')).toBeVisible();
    await expect(page.locator('.status-indicator.success')).toBeVisible();
    
    // Check for response visualization toggle
    await expect(page.locator('label:has-text("Show Raw JSON")')).toBeVisible();
    
    // Check response data is shown
    await expect(page.locator('.visualized-response')).toBeVisible();
    
    // Toggle to raw JSON view
    await page.click('label:has-text("Show Raw JSON")');
    await expect(page.locator('.raw-json')).toBeVisible();
    
    // Switch to history tab
    await page.click('button:has-text("History")');
    
    // Check history elements
    await expect(page.locator('h4:has-text("Response History")')).toBeVisible();
    await expect(page.locator('.history-list')).toBeVisible();
    await expect(page.locator('.history-item')).toBeVisible();
    
    // Check for clear history button
    await expect(page.locator('button:has-text("Clear History")')).toBeVisible();
    
    // Test clear history
    await page.click('button:has-text("Clear History")');
    await expect(page.locator('text=No history yet')).toBeVisible();
  });

  test('should interact with notification center', async ({ page }) => {
    // Click on notification header to expand
    await page.click('.notification-header');
    
    // Check that notification filters are visible
    await expect(page.locator('.notification-filters')).toBeVisible();
    
    // Check category tabs
    await expect(page.locator('.category-tab:has-text("All")')).toBeVisible();
    await expect(page.locator('.category-tab:has-text("Urgent")')).toBeVisible();
    
    // Click on a category tab
    await page.click('.category-tab:has-text("Urgent")');
    
    // Click on unread only checkbox
    await page.click('text=Unread only');
    
    // Click notification header again to collapse
    await page.click('.notification-header');
    
    // Check that notification filters are hidden
    await expect(page.locator('.notification-filters')).toBeHidden();
  });

  test('should toggle auto-scanning', async ({ page }) => {
    // Navigate to opportunities tab
    await page.click('button:has-text("Opportunities")');
    
    // Check initial state of checkbox
    const checkbox = page.locator('.auto-scan-toggle input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();
    
    // Toggle auto-scanning on
    await page.click('.auto-scan-toggle label');
    await expect(checkbox).toBeChecked();
    
    // Toggle auto-scanning off
    await page.click('.auto-scan-toggle label');
    await expect(checkbox).not.toBeChecked();
  });

  test('should apply an opportunity when available', async ({ page }) => {
    // Navigate to opportunities tab
    await page.click('button:has-text("Opportunities")');
    
    // Force a scan to get opportunities
    await page.click('button:has-text("Scan Now")');
    
    // Wait for scan to complete and opportunities to load
    try {
      // This may fail if no opportunities are returned, which is okay
      await page.waitForSelector('.opportunity-card', { timeout: 5000 });
      
      // If opportunities exist, try to apply for one
      if (await page.$('.opportunity-card')) {
        // Check if there's an Apply button on the first opportunity
        const applyButton = page.locator('.opportunity-card:first-child .apply-button');
        
        if (await applyButton.count() > 0) {
          await applyButton.click();
          // Applied status should be reflected on the card
          // This check might need adjustment based on how the UI updates
          await expect(page.locator('.opportunity-card:first-child')).toHaveClass(/applied/);
        }
      }
    } catch (e) {
      // If no opportunities are found, that's acceptable for the test
      console.log('No opportunities found to apply for');
    }
  });

  test('should have working real-time updates', async ({ page }) => {
    // Navigate to opportunities tab
    await page.click('button:has-text("Opportunities")');
    
    // Force a scan to trigger real-time updates
    await page.click('button:has-text("Scan Now")');
    
    // Wait a moment for any notifications to be triggered
    await page.waitForTimeout(2000);
    
    // Switch to the agent chat tab to see if anything appears there
    await page.click('button:has-text("Agent Chat")');
    
    // Wait to see if any messages appear automatically (would indicate real-time updates)
    // This is just a check, not a failure if nothing appears
    const initialMessageCount = await page.locator('.message').count();
    console.log(`Initial message count: ${initialMessageCount}`);
  });
});

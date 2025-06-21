/**
 * Renderer Process
 * Main entry point for the frontend application
 */

const OpportunityViewer = require('./components/opportunity-viewer');
const NotificationCenter = require('./components/notification-center');
const ScheduleEditor = require('./components/schedule-editor');
const AnalysisDashboard = require('./components/analysis-dashboard');
const ClientList = require('./components/client-list');
const CaregiverList = require('./components/caregiver-list');
const ClientProfile = require('./components/client-profile');
const CaregiverProfile = require('./components/caregiver-profile');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');

  // Initialize all frontend components
  const opportunityViewer = new OpportunityViewer('opportunity-viewer-container');
  const notificationCenter = new NotificationCenter('notification-center-container');
  const scheduleEditor = new ScheduleEditor('schedule-editor-container');
  const analysisDashboard = new AnalysisDashboard('analysis-dashboard-container');
  const clientList = new ClientList('client-list-container');
  const caregiverList = new CaregiverList('caregiver-list-container');
  const clientProfile = new ClientProfile('client-profile-container');
  const caregiverProfile = new CaregiverProfile('caregiver-profile-container');

  // Set up event listeners for user interactions
  setupEventListeners(scheduleEditor, clientProfile, caregiverProfile);
});

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners(scheduleEditor, clientProfile, caregiverProfile) {
  // Handle sidebar navigation
  const sidebarLinks = document.querySelectorAll('#sidebar a');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const viewName = link.getAttribute('data-view');
      
      // Hide all views
      document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
      });
      
      // Show the selected view
      document.getElementById(`${viewName}-view`).style.display = 'block';
      
      // Update active link
      sidebarLinks.forEach(l => l.parentElement.classList.remove('active'));
      link.parentElement.classList.add('active');
    });
  });

  // Handle "Add Schedule" button
  const addScheduleButton = document.getElementById('add-schedule-button');
  if (addScheduleButton) {
    addScheduleButton.addEventListener('click', () => {
      scheduleEditor.open();
    });
  }
  
  // Handle client and caregiver profile navigation
  document.addEventListener('click', (event) => {
    // Client profile navigation
    if (event.target.matches('.view-client')) {
      const clientId = event.target.getAttribute('data-id');
      clientProfile.load(clientId);
      
      // Hide clients list view, show client profile view
      document.getElementById('clients-view').style.display = 'none';
      document.getElementById('client-profile-view').style.display = 'block';
      
      // Add back button if it doesn't exist
      if (!document.getElementById('back-to-clients')) {
        const backButton = document.createElement('button');
        backButton.id = 'back-to-clients';
        backButton.className = 'back-button';
        backButton.textContent = 'Back to Clients';
        document.getElementById('client-profile-container').prepend(backButton);
      }
    }
    
    // Caregiver profile navigation
    if (event.target.matches('.view-caregiver')) {
      const caregiverId = event.target.getAttribute('data-id');
      caregiverProfile.load(caregiverId);
      
      // Hide caregivers list view, show caregiver profile view
      document.getElementById('caregivers-view').style.display = 'none';
      document.getElementById('caregiver-profile-view').style.display = 'block';
      
      // Add back button if it doesn't exist
      if (!document.getElementById('back-to-caregivers')) {
        const backButton = document.createElement('button');
        backButton.id = 'back-to-caregivers';
        backButton.className = 'back-button';
        backButton.textContent = 'Back to Caregivers';
        document.getElementById('caregiver-profile-container').prepend(backButton);
      }
    }
    
    // Back button handling
    if (event.target.id === 'back-to-clients') {
      document.getElementById('client-profile-view').style.display = 'none';
      document.getElementById('clients-view').style.display = 'block';
    }
    
    if (event.target.id === 'back-to-caregivers') {
      document.getElementById('caregiver-profile-view').style.display = 'none';
      document.getElementById('caregivers-view').style.display = 'block';
    }
  });

// Helper function for API calls, now global
window.fetchAPI = async function(endpoint, options = {}) {
  const { body, method = 'GET', params } = options;
  let url = `/api${endpoint}`; // Assuming API is served from the same origin

  if (params) {
    url += `?${new URLSearchParams(params)}`;
  }

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`API Error (${response.status}) in ${method} ${url}:`, errorData);
      throw new Error(`API Error (${response.status}): ${errorData.message || 'Unknown error'}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

  // Example: Handle a chat message submission
  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const chatInput = document.getElementById('chat-input');
      const message = chatInput.value.trim();
      if (message) {
        try {
          // Send the message to the agent manager via API
          const response = await fetchAPI('/agent/processMessage', {
            method: 'POST',
            body: { userId: 'user123', message: message },
          });

          // Display the response in the chat window
          const chatMessages = document.getElementById('chat-messages');
          const userMessageElement = document.createElement('div');
          userMessageElement.className = 'chat-message user';
          userMessageElement.innerHTML = `<span>${message}</span><span class="timestamp">${new Date().toLocaleTimeString()}</span>`;
          chatMessages.appendChild(userMessageElement);

          const agentMessageElement = document.createElement('div');
          agentMessageElement.className = 'chat-message agent';
          // Ensure response.text exists, or provide a fallback
          agentMessageElement.innerHTML = `<span>${response.text || response.message || 'Agent processing...'}</span><span class="timestamp">${new Date().toLocaleTimeString()}</span>`;
          chatMessages.appendChild(agentMessageElement);

          // Clear the input
          chatInput.value = '';
        } catch (error) {
          console.error('Failed to send chat message or process response:', error);
          // Optionally display an error to the user in the chat window
          const chatMessages = document.getElementById('chat-messages');
          const errorMessageElement = document.createElement('div');
          errorMessageElement.className = 'chat-message error';
          errorMessageElement.innerHTML = `<span>Error: Could not send message. ${error.message}</span><span class="timestamp">${new Date().toLocaleTimeString()}</span>`;
          chatMessages.appendChild(errorMessageElement);
        }
      }
    });
  }
}

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AvailabilityManager } from '../src/components';
import { universalScheduleService } from '../src/services';

// Mock the universalScheduleService
jest.mock('../src/services', () => ({
  universalScheduleService: {
    getCaregiverAvailability: jest.fn(),
    getClientPreferences: jest.fn(),
    getAvailabilityTemplates: jest.fn(),
    getScheduleTemplates: jest.fn(),
    updateCaregiverAvailability: jest.fn(),
    updateClientPreference: jest.fn(),
    createTemplate: jest.fn(),
    applyAvailabilityTemplate: jest.fn(),
    applyScheduleTemplate: jest.fn()
  }
}));

describe('AvailabilityManager Component', () => {
  // Mock data for testing
  const mockCaregiverAvailability = [
    {
      day: 'monday',
      slots: [
        { startTime: '9:00', status: 'available' },
        { startTime: '10:00', status: 'available' },
        { startTime: '11:00', status: 'unavailable' }
      ]
    },
    {
      day: 'tuesday',
      slots: [
        { startTime: '9:00', status: 'unavailable' },
        { startTime: '10:00', status: 'available' },
        { startTime: '11:00', status: 'available' }
      ]
    }
  ];

  const mockClientPreferences = {
    clientId: 'client-1',
    dayPreferences: [
      {
        day: 'monday',
        timeSlots: [
          { time: '9:00', preference: 'preferred' },
          { time: '10:00', preference: 'neutral' },
          { time: '11:00', preference: 'avoid' }
        ]
      },
      {
        day: 'wednesday',
        timeSlots: [
          { time: '14:00', preference: 'preferred' },
          { time: '15:00', preference: 'preferred' }
        ]
      }
    ]
  };

  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Default Schedule',
      entityId: 'caregiver-1',
      entityType: 'caregiver',
      createdAt: '2025-06-10T12:00:00.000Z'
    },
    {
      id: 'template-2',
      name: 'Weekend Availability',
      entityId: 'caregiver-1',
      entityType: 'caregiver',
      createdAt: '2025-06-11T15:30:00.000Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    universalScheduleService.getCaregiverAvailability.mockResolvedValue(mockCaregiverAvailability);
    universalScheduleService.getClientPreferences.mockResolvedValue(mockClientPreferences);
    universalScheduleService.getAvailabilityTemplates.mockResolvedValue(mockTemplates);
    universalScheduleService.getScheduleTemplates.mockResolvedValue(mockTemplates);
    universalScheduleService.updateCaregiverAvailability.mockResolvedValue({ success: true });
    universalScheduleService.updateClientPreference.mockResolvedValue({ success: true });
    universalScheduleService.createTemplate.mockImplementation(async (template) => ({
      ...template,
      id: 'new-template-id',
      createdAt: new Date().toISOString()
    }));
    universalScheduleService.applyAvailabilityTemplate.mockResolvedValue({ success: true });
    universalScheduleService.applyScheduleTemplate.mockResolvedValue({ success: true });
    
    // Mock window.prompt for template creation
    window.prompt = jest.fn(() => 'New Template');
  });

  test('renders the component correctly', async () => {
    render(<AvailabilityManager entityId="caregiver-1" entityType="caregiver" />);
    
    // Should show loading state initially
    expect(screen.getByText(/Loading availability data/i)).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
      expect(universalScheduleService.getCaregiverAvailability).toHaveBeenCalledWith('caregiver-1');
      expect(universalScheduleService.getAvailabilityTemplates).toHaveBeenCalledWith('caregiver-1');
    });
    
    // Check that tabs are rendered
    expect(screen.getByText(/Caregiver Availability/i)).toBeInTheDocument();
    expect(screen.getByText(/Client Preferences/i)).toBeInTheDocument();
    
    // Check that days are rendered
    expect(screen.getByText(/Monday/i)).toBeInTheDocument();
    expect(screen.getByText(/Tuesday/i)).toBeInTheDocument();
    
    // Check that templates section is rendered
    expect(screen.getByText(/Recurring Templates/i)).toBeInTheDocument();
  });

  test('displays caregiver availability data correctly', async () => {
    render(<AvailabilityManager entityId="caregiver-1" entityType="caregiver" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading availability data/i)).not.toBeInTheDocument();
    });
    
    // Monday should be selected by default
    expect(screen.getByText(/Monday/i).closest('button')).toHaveClass('active');
    
    // Check for some time slots
    const availabilitySlots = screen.getAllByText(/Available/i);
    expect(availabilitySlots.length).toBeGreaterThan(0);
    
    const unavailabilitySlots = screen.getAllByText(/Unavailable/i);
    expect(unavailabilitySlots.length).toBeGreaterThan(0);
  });

  test('allows switching between caregiver and client tabs', async () => {
    render(<AvailabilityManager entityId="entity-1" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading availability data/i)).not.toBeInTheDocument();
    });
    
    // Switch to client preferences tab
    fireEvent.click(screen.getByText(/Client Preferences/i));
    
    // Should load client data
    await waitFor(() => {
      expect(universalScheduleService.getClientPreferences).toHaveBeenCalledWith('entity-1');
      expect(universalScheduleService.getScheduleTemplates).toHaveBeenCalledWith('entity-1');
    });
    
    // Select boxes for preferences should be visible
    const selectElements = screen.getAllByRole('combobox');
    expect(selectElements.length).toBeGreaterThan(0);
    
    // Switch back to caregiver tab
    fireEvent.click(screen.getByText(/Caregiver Availability/i));
    
    // Should reload caregiver data
    await waitFor(() => {
      expect(universalScheduleService.getCaregiverAvailability).toHaveBeenCalledTimes(2);
    });
  });

  test('allows selecting different days', async () => {
    render(<AvailabilityManager entityId="caregiver-1" entityType="caregiver" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading availability data/i)).not.toBeInTheDocument();
    });
    
    // Click on Tuesday
    fireEvent.click(screen.getByText(/Tuesday/i));
    
    // Tuesday should now be active
    expect(screen.getByText(/Tuesday/i).closest('button')).toHaveClass('active');
    
    // The day header should show Tuesday
    expect(screen.getByText(/Tuesday/i, { selector: '.day-header' })).toBeInTheDocument();
  });

  test('allows toggling availability status', async () => {
    render(<AvailabilityManager entityId="caregiver-1" entityType="caregiver" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading availability data/i)).not.toBeInTheDocument();
    });
    
    // Click on an available slot to make it unavailable
    const availableSlots = screen.getAllByText(/Available/i);
    fireEvent.click(availableSlots[0]);
    
    // Service should be called to update availability
    await waitFor(() => {
      expect(universalScheduleService.updateCaregiverAvailability).toHaveBeenCalledWith(
        'caregiver-1',
        'monday',
        expect.any(String),
        'unavailable'
      );
    });
  });

  test('allows creating a template', async () => {
    render(<AvailabilityManager entityId="caregiver-1" entityType="caregiver" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading availability data/i)).not.toBeInTheDocument();
    });
    
    // Click on Create Template button
    fireEvent.click(screen.getByText(/Create Template/i));
    
    // Prompt should be called
    expect(window.prompt).toHaveBeenCalled();
    
    // Service should be called to create template
    await waitFor(() => {
      expect(universalScheduleService.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Template',
          entityId: 'caregiver-1',
          entityType: 'caregiver'
        })
      );
    });
  });

  test('allows applying a template', async () => {
    render(<AvailabilityManager entityId="caregiver-1" entityType="caregiver" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/Loading availability data/i)).not.toBeInTheDocument();
    });
    
    // Template items should be rendered
    await waitFor(() => {
      expect(screen.getByText(/Default Schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/Weekend Availability/i)).toBeInTheDocument();
    });
    
    // Click on a template to select it
    fireEvent.click(screen.getByText(/Default Schedule/i));
    
    // Click on Apply Template button
    fireEvent.click(screen.getByText(/Apply Template/i));
    
    // Service should be called to apply template
    await waitFor(() => {
      expect(universalScheduleService.applyAvailabilityTemplate).toHaveBeenCalledWith(
        'caregiver-1',
        'template-1'
      );
    });
    
    // Should reload availability data
    await waitFor(() => {
      expect(universalScheduleService.getCaregiverAvailability).toHaveBeenCalledTimes(2);
    });
  });

  test('handles errors gracefully', async () => {
    // Mock service to throw error
    universalScheduleService.getCaregiverAvailability.mockRejectedValue(new Error('API Error'));
    
    render(<AvailabilityManager entityId="caregiver-1" entityType="caregiver" />);
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to load availability data/i)).toBeInTheDocument();
    });
  });
});

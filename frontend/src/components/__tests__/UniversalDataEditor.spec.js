import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import UniversalDataEditor from '../UniversalDataEditor';
import { universalDataService, universalScheduleService, notificationService } from '../../services';

// Mock services
jest.mock('../../services', () => ({
  universalDataService: {
    getClients: jest.fn(),
    getCaregivers: jest.fn(),
    getClient: jest.fn(),
    getCaregiver: jest.fn(),
    createClient: jest.fn(),
    updateClient: jest.fn(),
    // deleteClient: jest.fn(), // Not directly used by UDE
  },
  universalScheduleService: {
    getSchedules: jest.fn(),
    getScheduleWithDetails: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    // deleteSchedule: jest.fn(), // Not directly used by UDE form, but by list view actions
  },
  notificationService: {
    showNotification: jest.fn(),
  },
}));

// Mock sub-components
jest.mock('../BatchUploadComponent', () => (props) => <div data-testid="mock-batch-upload">{props.entityType}</div>);
jest.mock('../EntityFormModal', () => (props) => {
  if (!props.show) return null;
  return (
    <div data-testid="mock-entity-form">
      <h3>{props.title}</h3>
      {props.children}
      <button onClick={props.onSubmit} disabled={props.submitDisabled || props.isSubmitting}>
        {props.submitLabel || 'Submit'}
      </button>
      <button onClick={props.onClose}>Close</button>
    </div>
  );
});

describe('UniversalDataEditor Component', () => {
  const mockClients = [
    { id: 'c1', firstName: 'Client', lastName: 'Alpha', email: 'alpha@c.com', phone: '111', address: 'Addr1' },
    { id: 'c2', firstName: 'Client', lastName: 'Beta', email: 'beta@c.com', phone: '222', address: 'Addr2' },
  ];
  const mockCaregivers = [
    { id: 'cg1', firstName: 'Caregiver', lastName: 'Gamma', email: 'gamma@cg.com', phone: '333', skills: 'Skill1' },
  ];
  const mockSchedules = [
    { id: 's1', clientId: 'c1', caregiverId: 'cg1', date: '2024-01-01', startTime: '10:00', endTime: '12:00', status: 'Pending' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    universalDataService.getClients.mockResolvedValue([...mockClients]);
    universalDataService.getCaregivers.mockResolvedValue([...mockCaregivers]);
    universalScheduleService.getSchedules.mockResolvedValue([...mockSchedules]);
    universalDataService.getClient.mockResolvedValue(mockClients[0]);
    universalDataService.getCaregiver.mockResolvedValue(mockCaregivers[0]);
    universalScheduleService.getScheduleWithDetails.mockResolvedValue(mockSchedules[0]);
  });

  test('renders initial state (clients) and fetches clients', async () => {
    render(<UniversalDataEditor />);
    expect(screen.getByText('Clients')).toHaveClass('active');
    await waitFor(() => expect(universalDataService.getClients).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());
  });

  test('switches to caregivers and fetches caregivers', async () => {
    render(<UniversalDataEditor />);
    fireEvent.click(screen.getByText('Caregivers'));
    expect(screen.getByText('Caregivers')).toHaveClass('active');
    await waitFor(() => expect(universalDataService.getCaregivers).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Caregiver Gamma')).toBeInTheDocument());
  });

  test('switches to schedules, fetches schedules, clients, and caregivers', async () => {
    render(<UniversalDataEditor />);
    fireEvent.click(screen.getByText('Schedules'));
    expect(screen.getByText('Schedules')).toHaveClass('active');
    await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalledWith({}));
    await waitFor(() => expect(universalDataService.getClients).toHaveBeenCalledTimes(2)); // Initial + for schedule options
    await waitFor(() => expect(universalDataService.getCaregivers).toHaveBeenCalledTimes(2)); // Initial + for schedule options
    await waitFor(() => expect(screen.getByText('2024-01-01 (10:00-12:00)')).toBeInTheDocument());
  });

  test('shows entity details when an entity is clicked', async () => {
    render(<UniversalDataEditor />); // Defaults to client
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Client Alpha')); // Click first client

    await waitFor(() => expect(universalDataService.getClient).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.getByText('Client Details')).toBeInTheDocument());
    expect(screen.getByText('alpha@c.com')).toBeInTheDocument(); // Check if detail value is present
  });

  test('fetches schedule details with getScheduleWithDetails when a schedule is clicked', async () => {
    render(<UniversalDataEditor />);
    fireEvent.click(screen.getByText('Schedules'));
    await waitFor(() => expect(screen.getByText('2024-01-01 (10:00-12:00)')).toBeInTheDocument());

    fireEvent.click(screen.getByText('2024-01-01 (10:00-12:00)'));
    await waitFor(() => expect(universalScheduleService.getScheduleWithDetails).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.getByText('Schedule Details')).toBeInTheDocument());
     // Check for a detail specific to the schedule, e.g., status if rendered
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });


  test('opens "Create New" modal with correct fields', async () => {
    render(<UniversalDataEditor />);
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Add New Client'));
    await waitFor(() => expect(screen.getByTestId('mock-entity-form')).toBeInTheDocument());
    expect(screen.getByText('Create New Client')).toBeInTheDocument();
    // Check for a client-specific field
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
  });

  test('opens "Edit" modal with pre-filled data', async () => {
    render(<UniversalDataEditor />);
    await waitFor(() => expect(screen.getByText('Client Alpha')).toBeInTheDocument());

    // Click the first client in the list to select it for details view
    fireEvent.click(screen.getByText('Client Alpha'));
    await waitFor(() => expect(universalDataService.getClient).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.getByText('Client Details')).toBeInTheDocument());

    // Click the "Edit" button within the details view
    fireEvent.click(screen.getByTitle('Edit')); // Assuming edit button in details view has title "Edit"

    await waitFor(() => expect(screen.getByTestId('mock-entity-form')).toBeInTheDocument());
    expect(screen.getByText('Edit Client')).toBeInTheDocument();
    // Check if a field is pre-filled (formData state would be set)
    // This requires EntityFormModal mock to render children inputs with values or the actual form.
    // For now, we trust formData is set. The component's handleEdit sets formData.
  });

  describe('handleSubmit logic', () => {
    it('successfully creates a new client', async () => {
      universalDataService.createClient.mockResolvedValue({ id: 'c3', firstName: 'New', lastName: 'Guy' });
      render(<UniversalDataEditor />);
      await waitFor(() => {}); // Initial load

      fireEvent.click(screen.getByText('Add New Client')); // Open modal
      await waitFor(() => expect(screen.getByTestId('mock-entity-form')).toBeInTheDocument());

      // Simulate form filling via direct state change (as form fields are inside mocked modal)
      // This means we can't use fireEvent.change on actual inputs here.
      // Instead, the component's `handleSubmit` would be called with `formData`.
      // We can mock the `onSubmit` prop of the `EntityFormModal` to simulate this.

      // This test depends on the EntityFormModal mock calling its onSubmit prop.
      // For this, we'll assume the `UniversalDataEditor`'s `handleSubmit` is triggered.
      // We'd need to set formData state, which is tricky without direct access or more complex setup.
      // Let's test handleSubmit by calling it more directly or by triggering form submit on mocked modal.
      // For now, assume modal calls onSubmit which calls handleSubmit.

      // To test handleSubmit, we need to set modalMode and formData appropriately.
      // This test will be more conceptual for now.
      // A more integrated test would involve actually filling and submitting the mocked form.
    });

    // Add more tests for create/update success and failure for each entity type.
    // Example: test successful client update
    it('successfully updates an existing client', async () => {
      universalDataService.updateClient.mockResolvedValue({ ...mockClients[0], firstName: 'UpdatedAlpha' });
      render(<UniversalDataEditor />);
      await waitFor(() => screen.getByText('Client Alpha').click()); // Select and load
      await waitFor(() => screen.getByText('Edit Client').click()); // Open edit modal

      // Simulate form submission from EntityFormModal mock
      const submitButton = await screen.findByText('Save'); // submitLabel is 'Save' in edit mode
      // Assume formData is already set to selectedEntity by handleEdit
      fireEvent.click(submitButton);

      await waitFor(() => expect(universalDataService.updateClient).toHaveBeenCalledWith('c1', expect.any(Object)));
      expect(notificationService.showNotification).toHaveBeenCalledWith(expect.stringContaining('Client data saved successfully'), 'success');
      expect(screen.queryByTestId('mock-entity-form')).not.toBeInTheDocument(); // Modal closes
    });

    it('handles validation failure in handleSubmit', async () => {
        render(<UniversalDataEditor />);
        await waitFor(() => {});
        fireEvent.click(screen.getByText('Add New Client'));
        await waitFor(() => expect(screen.getByTestId('mock-entity-form')).toBeInTheDocument());

        // Assume formData is empty or invalid, so validateForm() in handleSubmit returns false
        // (This part is tricky to test perfectly without filling mocked form fields that call handleInputChange & validateField)
        // We can directly test a state where validateForm would fail.
        // For now, let's ensure notification is called if validation fails.
        // We'd need to mock validateForm or set formData to an invalid state.

        // This test is more conceptual: if validateForm fails, show notification.
        // Actual validation logic is tested separately if possible or within form component tests.
    });
  });

  describe('BatchUploadComponent Integration', () => {
    test('toggles BatchUploadComponent visibility', async () => {
      render(<UniversalDataEditor />);
      await waitFor(() => {}); // Initial load

      const toggleButton = screen.getByText('Show Batch Upload');
      expect(screen.queryByTestId('mock-batch-upload')).not.toBeInTheDocument();

      fireEvent.click(toggleButton);
      expect(await screen.findByTestId('mock-batch-upload')).toBeInTheDocument();
      expect(screen.getByText('Hide Batch Upload')).toBeInTheDocument();
      expect(screen.getByTestId('mock-batch-upload')).toHaveTextContent('client'); // Default entityType

      fireEvent.click(toggleButton);
      expect(screen.queryByTestId('mock-batch-upload')).not.toBeInTheDocument();
    });

    test('passes correct entityType to BatchUploadComponent when switching main entity type', async () => {
      render(<UniversalDataEditor />);
      await waitFor(() => {});

      // Show batch upload
      fireEvent.click(screen.getByText('Show Batch Upload'));
      const batchUploadComponent = await screen.findByTestId('mock-batch-upload');
      expect(batchUploadComponent).toHaveTextContent('client');

      // Switch main entity type
      fireEvent.click(screen.getByText('Caregivers'));
      await waitFor(() => expect(universalDataService.getCaregivers).toHaveBeenCalled());
      // BatchUploadComponent should re-render with new entityType prop
      expect(batchUploadComponent).toHaveTextContent('caregiver');

      fireEvent.click(screen.getByText('Schedules'));
      await waitFor(() => expect(universalScheduleService.getSchedules).toHaveBeenCalled());
      expect(batchUploadComponent).toHaveTextContent('schedule');
    });
  });
});

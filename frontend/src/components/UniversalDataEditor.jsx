import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { notificationService, universalDataService, universalScheduleService } from '../services'; // Added universalScheduleService
import BatchUploadComponent from './BatchUploadComponent';
import EntityFormModal from './EntityFormModal';

/**
 * Universal Data Editor Component
 * A centralized interface for editing different entity types (client, caregiver, schedule)
 * with real-time validation feedback
 */
const UniversalDataEditor = () => {
  // Entity type and selection state
  const [entityType, setEntityType] = useState('client');
  const [entities, setEntities] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [showBatchUpload, setShowBatchUpload] = useState(false);

  // State for select options in schedule form
  const [clientOptions, setClientOptions] = useState([]);
  const [caregiverOptions, setCaregiverOptions] = useState([]);
  
  // Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  
  // Form state
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Load entities of the selected type
  useEffect(() => {
    const fetchEntities = async () => {
      setIsLoading(true);
      try {
        let fetchedEntities = [];
        
        if (entityType === 'client') {
          fetchedEntities = await universalDataService.getClients();
        } else if (entityType === 'caregiver') {
          fetchedEntities = await universalDataService.getCaregivers();
        } else if (entityType === 'schedule') {
          fetchedEntities = await universalScheduleService.getSchedules({}); // Use universalScheduleService
          // Fetch clients and caregivers for dropdowns if not already fetched or if they might change
          // For simplicity, always fetch here. In a real app, consider caching or context.
          const clients = await universalDataService.getClients();
          const caregivers = await universalDataService.getCaregivers();
          setClientOptions(clients.map(c => ({ id: c.id, name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.id })));
          setCaregiverOptions(caregivers.map(cg => ({ id: cg.id, name: `${cg.firstName || ''} ${cg.lastName || ''}`.trim() || cg.id })));
        }
        
        setEntities(fetchedEntities);
        setSelectedEntityId(null);
        setSelectedEntity(null);
        setFormData({});
        setFormErrors({});
        setIsFormDirty(false);
        setSaveSuccess(false);
        setSaveError(null);
      } catch (error) {
        console.error(`Error fetching ${entityType} entities:`, error);
        notificationService.showNotification(
          `Could not load ${entityType} data. Please try again.`, 
          'error'
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEntities();
  }, [entityType]);
  
  // Load selected entity data
  useEffect(() => {
    const fetchEntityData = async () => {
      if (!selectedEntityId) {
        setSelectedEntity(null);
        return;
      }
      
      setIsLoading(true);
      try {
        let fetchedEntity = null;
        
        if (entityType === 'client') {
          fetchedEntity = await universalDataService.getClient(selectedEntityId);
        } else if (entityType === 'caregiver') {
          fetchedEntity = await universalDataService.getCaregiver(selectedEntityId);
        } else if (entityType === 'schedule') {
          // Use getScheduleWithDetails for schedules
          if (selectedEntityId) { // Ensure selectedEntityId is not null
            fetchedEntity = await universalScheduleService.getScheduleWithDetails(selectedEntityId);
          } else {
            fetchedEntity = null; // Or some default empty object
          }
        }
        
        setSelectedEntity(fetchedEntity);
      } catch (error) {
        console.error(`Error fetching ${entityType} data:`, error);
        notificationService.showNotification(
          `Could not load ${entityType} details. Please try again.`,
          'error'
        );
        setSelectedEntity(null);
        setFormData({});
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEntityData();
  }, [selectedEntityId, entityType, entities]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));
    
    setIsFormDirty(true);
    setSaveSuccess(false);
    
    // Validate the field as user types
    validateField(name, value);
  };
  
  // Validate a single field
  const validateField = (name, value) => {
    let error = '';
    
    // Common validations
    if (value.trim() === '') {
      error = 'This field is required';
    }
    
    // Specific validations by field type
    if (name === 'email' && value.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        error = 'Please enter a valid email address';
      }
    }
    
    if (name === 'phone' && value.trim() !== '') {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(value.replace(/\D/g, ''))) {
        error = 'Please enter a valid 10-digit phone number';
      }
    }
    
    if (name === 'zipCode' && value.trim() !== '') {
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(value)) {
        error = 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)';
      }
    }
    
    // Schedule-specific validations
    if (entityType === 'schedule') {
      if (name === 'startTime' && value.trim() !== '') {
        // Validate start time format
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(value)) {
          error = 'Please enter a valid time (HH:MM)';
        }
      }
      
      if (name === 'endTime' && value.trim() !== '') {
        // Validate end time format and compare with start time
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(value)) {
          error = 'Please enter a valid time (HH:MM)';
        } else if (formData.startTime && value <= formData.startTime) {
          error = 'End time must be after start time';
        }
      }
      
      if (name === 'date' && value.trim() !== '') {
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          error = 'Please enter a valid date (YYYY-MM-DD)';
        }
      }
    }
    
    setFormErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error
    }));
    
    return error === '';
  };
  
  // Validate the entire form
  const validateForm = () => {
    const errors = {};
    let isValid = true;
    
    // Validate all fields in the form
    Object.entries(formData).forEach(([name, value]) => {
      if (typeof value === 'string') {
        const fieldIsValid = validateField(name, value);
        if (!fieldIsValid) {
          isValid = false;
        }
      }
    });
    
    // Check for required fields based on entity type
    const requiredFields = {
      client: ['firstName', 'lastName', 'email', 'phone', 'address'],
      caregiver: ['firstName', 'lastName', 'email', 'phone'],
      schedule: ['clientId', 'caregiverId', 'date', 'startTime', 'endTime']
    };
    
    requiredFields[entityType].forEach((field) => {
      if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
        errors[field] = 'This field is required';
        isValid = false;
      }
    });
    
    setFormErrors(errors);
    return isValid;
  };
  
  // Open modal for creating a new entity
  const handleCreateNew = () => {
    setFormData({});
    setFormErrors({});
    setIsFormDirty(false);
    setSaveSuccess(false);
    setSaveError(null);
    setModalMode('create');
    setShowFormModal(true);
  };

  // Open modal for editing an entity
  const handleEdit = (entity) => {
    setFormData(entity || {});
    setFormErrors({});
    setIsFormDirty(false);
    setSaveSuccess(false);
    setSaveError(null);
    setModalMode('edit');
    setShowFormModal(true);
  };
  
  // Close the form modal
  const handleCloseModal = () => {
    setShowFormModal(false);
    // If we're in browser mode, wait for animation to complete
    setTimeout(() => {
      setFormData({});
      setFormErrors({});
      setIsFormDirty(false);
    }, 300);
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      notificationService.showNotification(
        'Please correct the errors in the form before saving.',
        'error'
      );
      return;
    }
    
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      let result;
      
      if (entityType === 'client') {
        if (modalMode === 'edit' && selectedEntityId) {
          result = await universalDataService.updateClient(selectedEntityId, formData);
        } else {
          result = await universalDataService.createClient(formData);
        }
      } else if (entityType === 'caregiver') {
        if (modalMode === 'edit' && selectedEntityId) {
          result = await universalDataService.updateCaregiver(selectedEntityId, formData);
        } else {
          result = await universalDataService.createCaregiver(formData);
        }
      } else if (entityType === 'schedule') {
        if (modalMode === 'edit' && selectedEntityId) {
          result = await universalScheduleService.updateSchedule(selectedEntityId, formData); // Use universalScheduleService
        } else {
          result = await universalScheduleService.createSchedule(formData); // Use universalScheduleService
        }
      }
      
      setSaveSuccess(true);
      setIsFormDirty(false);
      
      notificationService.showNotification(
        `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} data saved successfully.`,
        'success'
      );
      
      // Refresh entity list
      const updatedEntities = await (entityType === 'client' 
        ? universalDataService.getClients()
        : entityType === 'caregiver'
          ? universalDataService.getCaregivers()
          : universalScheduleService.getSchedules({})); // Use universalScheduleService
      
      setEntities(updatedEntities);
      
      // Close the modal
      setShowFormModal(false);
      
      // If we're viewing an entity and just edited it, update the selected entity
      if (modalMode === 'edit' && selectedEntityId) {
        setSelectedEntity(result);
      }
    } catch (error) {
      console.error(`Error saving ${entityType} data:`, error);
      setSaveError(`Failed to save ${entityType} data. Please try again.`);
      
      notificationService.showNotification(
        `Could not save ${entityType} data. Please try again.`,
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };
  
  // Get form fields based on entity type
  const getFormFields = () => {
    switch (entityType) {
      case 'client':
        return [
          { name: 'firstName', label: 'First Name', type: 'text', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'address', label: 'Address', type: 'text', required: true },
          { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ];
        
      case 'caregiver':
        return [
          { name: 'firstName', label: 'First Name', type: 'text', required: true },
          { name: 'lastName', label: 'Last Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'certifications', label: 'Certifications (comma separated)', type: 'text', required: false },
          { name: 'skills', label: 'Skills (comma separated)', type: 'text', required: false },
          { name: 'address', label: 'Address', type: 'text', required: false },
          { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ];
        
      case 'schedule':
        return [
          { 
            name: 'clientId', 
            label: 'Client', 
            type: 'select', 
            options: clientOptions, // Use dedicated clientOptions state
            required: true 
          },
          { 
            name: 'caregiverId', 
            label: 'Caregiver', 
            type: 'select', 
            options: caregiverOptions, // Use dedicated caregiverOptions state
            required: true 
          },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'startTime', label: 'Start Time', type: 'time', required: true },
          { name: 'endTime', label: 'End Time', type: 'time', required: true },
          { name: 'status', label: 'Status', type: 'select', 
            options: [
              { id: 'pending', name: 'Pending' },
              { id: 'confirmed', name: 'Confirmed' },
              { id: 'completed', name: 'Completed' },
              { id: 'cancelled', name: 'Cancelled' }
            ], 
            required: true 
          },
          { name: 'notes', label: 'Notes', type: 'textarea', required: false }
        ];
        
      default:
        return [];
    }
  };
  
  // Helper function to render form inputs based on field type
  const renderFormInput = (field) => {
    const { name, label, type, required, placeholder, options } = field;
    
    switch (type) {
      case 'select':
        return (
          <select
            id={name}
            name={name}
            value={formData[name] || ''}
            onChange={handleInputChange}
            required={required}
            className={formErrors[name] ? 'error' : ''}
          >
            <option value="">Select {label}</option>
            {options && options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        );
        
      case 'textarea':
        return (
          <textarea
            id={name}
            name={name}
            value={formData[name] || ''}
            onChange={handleInputChange}
            required={required}
            placeholder={placeholder || ''}
            className={formErrors[name] ? 'error' : ''}
            rows={4}
          />
        );
        
      default:
        return (
          <input
            id={name}
            name={name}
            type={type}
            value={formData[name] || ''}
            onChange={handleInputChange}
            required={required}
            placeholder={placeholder || ''}
            className={formErrors[name] ? 'error' : ''}
          />
        );
    }
  };
  
  // View entity details
  const handleViewEntity = (entityId) => {
    // If this entity is already selected, don't do anything
    if (selectedEntityId === entityId) return;
    
    // Clear any previous selection
    setSelectedEntity(null);
    // Set new selection ID which will trigger the useEffect to load the entity
    setSelectedEntityId(entityId);
    
    // Show notification that details are loading
    notificationService.showNotification(
      `Loading ${entityType} details...`,
      'info'
    );
  };
  
  // Clear selected entity
  const handleClearSelection = () => {
    setSelectedEntityId(null);
    setSelectedEntity(null);
  };

  // Format entity name for display
  const getEntityName = (entity) => {
    if (!entity) return '';
    
    if (entityType === 'client' || entityType === 'caregiver') {
      return `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || `[No Name]`;
    } else if (entityType === 'schedule') {
      return `${entity.date || ''} (${entity.startTime || ''}-${entity.endTime || ''})`.trim() || `Schedule #${entity.id}`;
    }
    
    return entity.id;
  };
  
  return (
    <div className="universal-data-editor">
      <h3>Universal Data Editor</h3>
      
      <div className="entity-type-selector">
        <div className="selector-tabs">
          <button 
            className={entityType === 'client' ? 'active' : ''}
            onClick={() => setEntityType('client')}
          >
            Clients
          </button>
          <button 
            className={entityType === 'caregiver' ? 'active' : ''}
            onClick={() => setEntityType('caregiver')}
          >
            Caregivers
          </button>
          <button 
            className={entityType === 'schedule' ? 'active' : ''}
            onClick={() => setEntityType('schedule')}
          >
            Schedules
          </button>
        </div>
      </div>
      
      <div className="batch-upload-toggle-container">
        <button 
          className={`batch-upload-toggle ${showBatchUpload ? 'active' : ''}`}
          onClick={() => setShowBatchUpload(!showBatchUpload)}
        >
          {showBatchUpload ? 'Hide Batch Upload' : 'Show Batch Upload'}
        </button>
        
        <div className="batch-upload-description">
          Upload Excel, PDF, or Word files with multiple {entityType} records at once
        </div>
      </div>
      
      {showBatchUpload && (
        <BatchUploadComponent entityType={entityType} />
      )}
      
      <div className="add-button-container">
        <button 
          className="big-add-button"
          onClick={handleCreateNew}
        >
          <div className="plus-icon">+</div>
          <div className="add-text">ADD {entityType.toUpperCase()}</div>
        </button>
      </div>
      
      <div className="data-editor-container">
        {/* Action Bar */}
        <div className="action-bar">
          <button 
            className="action-button primary"
            onClick={handleCreateNew}
          >
            <span className="icon">+</span>
            Add New {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </button>
        </div>
        
        {/* Entity List */}
        <div className="entities-table-container">
          <h4>{entityType.charAt(0).toUpperCase() + entityType.slice(1)} List</h4>
          
          {isLoading ? (
            <div className="loading-indicator">Loading {entityType}s...</div>
          ) : entities.length === 0 ? (
            <div className="empty-state">
              No {entityType}s found. Create a new one to get started.
            </div>
          ) : (
            <table className="entities-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  {entityType === 'client' && (
                    <>
                      <th>Email</th>
                      <th>Phone</th>
                    </>
                  )}
                  {entityType === 'caregiver' && (
                    <>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Skills</th>
                    </>
                  )}
                  {entityType === 'schedule' && (
                    <>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Status</th>
                    </>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => (
                  <tr 
                    key={entity.id}
                    className={selectedEntityId === entity.id ? 'selected' : ''}
                    onClick={() => handleViewEntity(entity.id)}
                  >
                    <td className="id-cell">{entity.id}</td>
                    <td>{getEntityName(entity)}</td>
                    
                    {entityType === 'client' && (
                      <>
                        <td>{entity.email}</td>
                        <td>{entity.phone}</td>
                      </>
                    )}
                    
                    {entityType === 'caregiver' && (
                      <>
                        <td>{entity.email}</td>
                        <td>{entity.phone}</td>
                        <td>
                          {entity.skills 
                            ? (Array.isArray(entity.skills) 
                                ? entity.skills.join(', ') 
                                : entity.skills)
                            : '-'}
                        </td>
                      </>
                    )}
                    
                    {entityType === 'schedule' && (
                      <>
                        <td>{entity.date || '-'}</td>
                        <td>{entity.startTime} - {entity.endTime}</td>
                        <td>
                          <span className={`status-badge ${entity.status || 'pending'}`}>
                            {entity.status || 'Pending'}
                          </span>
                        </td>
                      </>
                    )}
                    
                    <td className="actions-cell">
                      <button 
                        className="table-action-button view"
                        onClick={() => handleViewEntity(entity.id)}
                        title="View details"
                      >
                        👁️
                      </button>
                      <button 
                        className="table-action-button edit"
                        onClick={() => handleEdit(entity)}
                        title="Edit"
                      >
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Entity Details */}
        {selectedEntityId && selectedEntity && (
          <div className="entity-details">
            <div className="entity-details-header">
              <h4>{entityType.charAt(0).toUpperCase() + entityType.slice(1)} Details</h4>
              <div className="entity-details-actions">
                <button 
                  className="edit-details-button"
                  onClick={() => handleEdit(selectedEntity)}
                  title="Edit"
                >
                  <span className="icon">✎</span>
                  Edit
                </button>
                <button 
                  className="close-details-button"
                  onClick={handleClearSelection}
                  title="Close details"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="details-grid">
              {Object.entries(selectedEntity).map(([key, value]) => (
                <div key={key} className="detail-item">
                  <div className="detail-label">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                  <div className="detail-value">
                    {Array.isArray(value) 
                      ? value.join(', ') 
                      : typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value || '-')}
                  </div>
                </div>
              ))}
            </div>
            
          </div>
        )}
      </div>
      
      {/* Modal for creating/editing entities */}
      <EntityFormModal
        show={showFormModal}
        onClose={handleCloseModal}
        title={modalMode === 'create' 
          ? `Create New ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}` 
          : `Edit ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
        onSubmit={handleSubmit}
        submitDisabled={isSaving || (!isFormDirty && modalMode === 'edit')}
        submitLabel={isSaving ? 'Saving...' : 'Save'}
        isSubmitting={isSaving}
      >
        {getFormFields().map((field) => (
          <div key={field.name} className="form-group">
            <label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="required">*</span>}
            </label>
            {renderFormInput(field)}
            {formErrors[field.name] && (
              <div className="error-message">{formErrors[field.name]}</div>
            )}
          </div>
        ))}
        
        {saveError && (
          <div className="save-error">{saveError}</div>
        )}
      </EntityFormModal>

      <style jsx>{`
        .universal-data-editor {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        
        .batch-upload-toggle-container {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          padding: 12px 15px;
          background: #f1f8fe;
          border-radius: 4px;
          border-left: 3px solid #3498db;
        }
        
        .batch-upload-toggle {
          padding: 8px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        
        .batch-upload-toggle:hover {
          background: #2980b9;
        }
        
        .batch-upload-toggle.active {
          background: #2c3e50;
        }
        
        .batch-upload-description {
          margin-left: 15px;
          color: #2c3e50;
          font-size: 0.9rem;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #2c3e50;
        }
        
        .entity-type-selector {
          margin-bottom: 20px;
        }
        
        .selector-tabs {
          display: flex;
          border-bottom: 1px solid #e9ecef;
        }
        
        .selector-tabs button {
          padding: 10px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 1rem;
          color: #6c757d;
        }
        
        .selector-tabs button.active {
          border-bottom-color: #3498db;
          color: #3498db;
          font-weight: 500;
        }
        
        .selector-tabs button:hover:not(.active) {
          border-bottom-color: #e9ecef;
          background-color: #f8f9fa;
        }
        
        .data-editor-container {
          margin-top: 20px;
        }
        
        .action-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .action-button {
          padding: 10px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          border: none;
          transition: all 0.2s;
        }
        
        .action-button.primary {
          background: #3498db;
          color: white;
        }
        
        .action-button.primary:hover {
          background: #2980b9;
        }
        
        .action-button.secondary {
          background: #f8f9fa;
          color: #2c3e50;
          border: 1px solid #dee2e6;
        }
        
        .action-button.secondary:hover {
          background: #e9ecef;
        }
        
        .action-button.clear {
          background: #f8f9fa;
          color: #6c757d;
          border: 1px solid #dee2e6;
        }
        
        .action-button.clear:hover {
          background: #e9ecef;
          color: #e74c3c;
        }
        
        .icon {
          margin-right: 8px;
          font-weight: bold;
        }
        
        .entities-table-container {
          margin-bottom: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        
        .entities-table-container h4 {
          margin-top: 0;
          margin-bottom: 16px;
          color: #2c3e50;
          border-bottom: 1px solid #e9ecef;
          padding-bottom: 10px;
        }
        
        .entities-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.95rem;
        }
        
        .entities-table th {
          background: #f8f9fa;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #2c3e50;
          border-bottom: 2px solid #e9ecef;
        }
        
        .entities-table td {
          padding: 12px;
          border-bottom: 1px solid #e9ecef;
          color: #6c757d;
        }
        
        .entities-table tr:hover td {
          background-color: #f5f9ff;
        }
        
        .entities-table tr.selected td {
          background-color: #ebf5fd;
          border-left: 3px solid #3498db;
        }
        
        .id-cell {
          font-family: monospace;
          color: #7f8c8d;
          font-size: 0.85rem;
        }
        
        .actions-cell {
          white-space: nowrap;
          text-align: right;
        }
        
        .table-action-button {
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          margin-left: 8px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        
        .table-action-button:hover {
          opacity: 1;
        }
        
        .table-action-button.view {
          color: #3498db;
        }
        
        .table-action-button.edit {
          color: #2ecc71;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .status-badge.pending {
          background-color: #fef9e7;
          color: #f39c12;
        }
        
        .status-badge.confirmed {
          background-color: #eafaf1;
          color: #2ecc71;
        }
        
        .status-badge.completed {
          background-color: #ebedef;
          color: #34495e;
        }
        
        .status-badge.cancelled {
          background-color: #fdedec;
          color: #e74c3c;
        }
        
        .entity-details {
          background: white;
          border-radius: 8px;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
          padding: 0;
          position: relative;
          margin-top: 30px;
          overflow: hidden;
        }
        
        .entity-details-header {
          background: linear-gradient(to right, #3498db, #2980b9);
          color: white;
          padding: 15px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .entity-details-header h4 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .entity-details-actions {
          display: flex;
          gap: 10px;
        }
        
        .edit-details-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          border-radius: 4px;
          padding: 5px 12px;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }
        
        .edit-details-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .close-details-button {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          font-size: 1.2rem;
          line-height: 1;
          color: white;
          cursor: pointer;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }
        
        .close-details-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          padding: 20px;
          background: #f8f9fa;
        }
        
        .detail-item {
          padding: 15px;
          background: white;
          border-radius: 6px;
          border-left: 4px solid #3498db;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
          margin-bottom: 5px;
        }
        
        .detail-label {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 6px;
          font-size: 0.9rem;
        }
        
        .detail-value {
          color: #6c757d;
          word-break: break-word;
        }
        
        .add-button-container {
          display: flex;
          justify-content: center;
          margin: 20px 0;
        }
        
        .big-add-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 40px;
          background: linear-gradient(135deg, #3498db, #2980b9);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 400px;
        }
        
        .big-add-button:hover {
          background: linear-gradient(135deg, #2980b9, #2c3e50);
          transform: translateY(-2px);
          box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
        }
        
        .plus-icon {
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .add-text {
          font-size: 1.2rem;
          font-weight: bold;
          letter-spacing: 1px;
        }
        
        .details-actions {
          display: flex;
          justify-content: flex-start;
          margin-top: 20px;
        }
        
        .empty-state {
          padding: 20px;
          text-align: center;
          color: #6c757d;
          font-style: italic;
        }
        
        .entity-form {
          flex: 1;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          padding: 20px;
          overflow-y: auto;
        }
        
        .entity-form h4 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #2c3e50;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #2c3e50;
        }
        
        .required {
          color: #e74c3c;
          margin-left: 4px;
        }
        
        input, select, textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.2s;
        }
        
        input:focus, select:focus, textarea:focus {
          border-color: #3498db;
          outline: none;
        }
        
        input.error, select.error, textarea.error {
          border-color: #e74c3c;
          background-color: #fff6f6;
        }
        
        .error-message {
          color: #e74c3c;
          font-size: 0.85rem;
          margin-top: 5px;
        }
        
        .loading-indicator {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100px;
          color: #6c757d;
        }
        
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        
        .save-button {
          padding: 10px 20px;
          background: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        
        .save-button:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .save-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .cancel-button {
          padding: 10px 20px;
          background: #f8f9fa;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
          color: #6c757d;
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        
        .cancel-button::before {
          content: "×";
          margin-right: 5px;
          font-weight: bold;
          font-size: 1.2rem;
        }
        
        .cancel-button:hover {
          background: #e9ecef;
        }
        
        .save-error {
          padding: 10px;
          background: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .save-success {
          padding: 10px;
          background: #d4edda;
          color: #155724;
          border-radius: 4px;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
};

export default UniversalDataEditor;

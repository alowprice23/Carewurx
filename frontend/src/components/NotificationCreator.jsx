import React, { useState, useEffect } from 'react';
import { notificationService } from '../services';

/**
 * Notification Creator Component
 * UI for manually creating and scheduling notifications
 */
const NotificationCreator = ({ onNotificationCreated }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info'); // 'info', 'urgent', 'reminder'
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [link, setLink] = useState('');
  const [schedule, setSchedule] = useState({
    isScheduled: false,
    date: '',
    time: ''
  });
  const [loading, setLoading] = useState(false);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load available recipients (users, caregivers, clients)
  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        const data = await notificationService.getAvailableRecipients();
        setRecipients(data);
        setRecipientsLoading(false);
      } catch (err) {
        console.error('Error fetching recipients:', err);
        setError('Failed to load recipients. Please try again.');
        setRecipientsLoading(false);
      }
    };
    
    fetchRecipients();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title || !message || selectedRecipients.length === 0) {
      setError('Please fill in all required fields and select at least one recipient.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const notificationData = {
        title,
        message,
        type,
        recipients: selectedRecipients,
        link: link || null,
        scheduled: schedule.isScheduled ? 
          new Date(`${schedule.date}T${schedule.time}`).toISOString() : null
      };
      
      await notificationService.createNotification(notificationData);
      
      // Reset form
      setTitle('');
      setMessage('');
      setType('info');
      setSelectedRecipients([]);
      setLink('');
      setSchedule({
        isScheduled: false,
        date: '',
        time: ''
      });
      
      setSuccess('Notification created successfully!');
      
      // Call the callback if provided
      if (onNotificationCreated) {
        onNotificationCreated();
      }
    } catch (err) {
      console.error('Error creating notification:', err);
      setError('Failed to create notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle recipient selection
  const handleRecipientSelect = (recipientId) => {
    setSelectedRecipients(prev => {
      if (prev.includes(recipientId)) {
        return prev.filter(id => id !== recipientId);
      } else {
        return [...prev, recipientId];
      }
    });
  };

  // Handle bulk recipient selection
  const handleSelectAllRecipients = (type) => {
    const typeRecipients = recipients
      .filter(recipient => recipient.type === type)
      .map(recipient => recipient.id);
    
    setSelectedRecipients(prev => {
      const remainingRecipients = prev.filter(id => 
        !recipients.find(r => r.id === id && r.type === type)
      );
      
      return [...remainingRecipients, ...typeRecipients];
    });
  };

  // Handle removing all recipients of a type
  const handleRemoveAllRecipients = (type) => {
    setSelectedRecipients(prev => 
      prev.filter(id => 
        !recipients.find(r => r.id === id && r.type === type)
      )
    );
  };

  // Group recipients by type for display
  const getRecipientsByType = () => {
    const grouped = {
      admin: [],
      caregiver: [],
      client: []
    };
    
    recipients.forEach(recipient => {
      if (grouped[recipient.type]) {
        grouped[recipient.type].push(recipient);
      }
    });
    
    return grouped;
  };

  // Get recipient name by ID
  const getRecipientName = (id) => {
    const recipient = recipients.find(r => r.id === id);
    return recipient ? recipient.name : 'Unknown';
  };

  // Toggle scheduled notification
  const toggleScheduled = () => {
    setSchedule(prev => ({
      ...prev,
      isScheduled: !prev.isScheduled
    }));
  };

  const recipientsByType = getRecipientsByType();

  return (
    <div className="notification-creator">
      <h3>Create New Notification</h3>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="notification-title">Title *</label>
          <input
            id="notification-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="notification-message">Message *</label>
          <textarea
            id="notification-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Notification message"
            rows={4}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Notification Type *</label>
          <div className="notification-types">
            <label className={`type-option ${type === 'info' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="notification-type"
                value="info"
                checked={type === 'info'}
                onChange={() => setType('info')}
              />
              <span className="type-name">Info</span>
            </label>
            <label className={`type-option ${type === 'urgent' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="notification-type"
                value="urgent"
                checked={type === 'urgent'}
                onChange={() => setType('urgent')}
              />
              <span className="type-name">Urgent</span>
            </label>
            <label className={`type-option ${type === 'reminder' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="notification-type"
                value="reminder"
                checked={type === 'reminder'}
                onChange={() => setType('reminder')}
              />
              <span className="type-name">Reminder</span>
            </label>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="notification-link">Link (Optional)</label>
          <input
            id="notification-link"
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="URL or internal link"
          />
        </div>
        
        <div className="form-group">
          <div className="schedule-toggle">
            <label>
              <input
                type="checkbox"
                checked={schedule.isScheduled}
                onChange={toggleScheduled}
              />
              Schedule this notification for later
            </label>
          </div>
          
          {schedule.isScheduled && (
            <div className="schedule-inputs">
              <div className="schedule-date">
                <label htmlFor="schedule-date">Date</label>
                <input
                  id="schedule-date"
                  type="date"
                  value={schedule.date}
                  onChange={(e) => setSchedule(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required={schedule.isScheduled}
                />
              </div>
              <div className="schedule-time">
                <label htmlFor="schedule-time">Time</label>
                <input
                  id="schedule-time"
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule(prev => ({ ...prev, time: e.target.value }))}
                  required={schedule.isScheduled}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="form-group recipients-group">
          <label>Recipients *</label>
          
          {recipientsLoading ? (
            <div className="loading">Loading recipients...</div>
          ) : (
            <div className="recipients-container">
              <div className="recipients-list">
                {Object.entries(recipientsByType).map(([type, typeRecipients]) => (
                  <div key={type} className="recipient-type">
                    <div className="recipient-type-header">
                      <h4>{type.charAt(0).toUpperCase() + type.slice(1)}s</h4>
                      <div className="recipient-type-actions">
                        <button 
                          type="button" 
                          className="select-all-button"
                          onClick={() => handleSelectAllRecipients(type)}
                        >
                          Select All
                        </button>
                        <button 
                          type="button" 
                          className="remove-all-button"
                          onClick={() => handleRemoveAllRecipients(type)}
                        >
                          Remove All
                        </button>
                      </div>
                    </div>
                    <div className="recipient-items">
                      {typeRecipients.map(recipient => (
                        <label 
                          key={recipient.id} 
                          className={`recipient-item ${selectedRecipients.includes(recipient.id) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRecipients.includes(recipient.id)}
                            onChange={() => handleRecipientSelect(recipient.id)}
                          />
                          <span className="recipient-name">{recipient.name}</span>
                        </label>
                      ))}
                      {typeRecipients.length === 0 && (
                        <div className="no-recipients">No {type}s available</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="selected-recipients">
                <h4>Selected Recipients ({selectedRecipients.length})</h4>
                {selectedRecipients.length === 0 ? (
                  <div className="no-selected">No recipients selected</div>
                ) : (
                  <div className="selected-list">
                    {selectedRecipients.map(id => (
                      <div key={id} className="selected-recipient">
                        <span className="recipient-name">{getRecipientName(id)}</span>
                        <button 
                          type="button"
                          className="remove-recipient"
                          onClick={() => handleRecipientSelect(id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="form-actions">
          <button 
            type="submit" 
            className="create-button" 
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Notification'}
          </button>
          <button 
            type="button" 
            className="cancel-button"
            onClick={() => {
              setTitle('');
              setMessage('');
              setType('info');
              setSelectedRecipients([]);
              setLink('');
              setSchedule({
                isScheduled: false,
                date: '',
                time: ''
              });
              setError(null);
              setSuccess(null);
            }}
          >
            Clear Form
          </button>
        </div>
      </form>
      
      <style jsx>{`
        .notification-creator {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 20px;
          color: #2c3e50;
        }
        
        .error-message, .success-message {
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .error-message {
          background: #f8d7da;
          color: #721c24;
        }
        
        .success-message {
          background: #d4edda;
          color: #155724;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        input[type="text"], textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1rem;
        }
        
        textarea {
          resize: vertical;
        }
        
        .notification-types {
          display: flex;
          gap: 15px;
        }
        
        .type-option {
          display: flex;
          align-items: center;
          padding: 8px 15px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .type-option.selected {
          border-color: #3498db;
          background: #ebf5fd;
        }
        
        .type-option input {
          margin-right: 8px;
        }
        
        .schedule-toggle {
          margin-bottom: 10px;
        }
        
        .schedule-toggle label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }
        
        .schedule-toggle input {
          margin-right: 8px;
        }
        
        .schedule-inputs {
          display: flex;
          gap: 15px;
          margin-top: 10px;
        }
        
        .schedule-date, .schedule-time {
          flex: 1;
        }
        
        .recipients-group {
          margin-bottom: 30px;
        }
        
        .loading {
          padding: 20px;
          text-align: center;
          color: #6c757d;
        }
        
        .recipients-container {
          display: flex;
          gap: 20px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          padding: 15px;
        }
        
        .recipients-list {
          flex: 2;
          min-width: 0;
        }
        
        .selected-recipients {
          flex: 1;
          min-width: 0;
          border-left: 1px solid #ced4da;
          padding-left: 15px;
        }
        
        .recipient-type {
          margin-bottom: 15px;
        }
        
        .recipient-type:last-child {
          margin-bottom: 0;
        }
        
        .recipient-type-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .recipient-type-header h4 {
          margin: 0;
        }
        
        .recipient-type-actions {
          display: flex;
          gap: 10px;
        }
        
        .select-all-button, .remove-all-button {
          padding: 4px 8px;
          font-size: 0.8rem;
          background: none;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .select-all-button:hover, .remove-all-button:hover {
          background: #f8f9fa;
        }
        
        .recipient-items {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          max-height: 200px;
          overflow-y: auto;
          padding-right: 10px;
        }
        
        .recipient-item {
          display: flex;
          align-items: center;
          padding: 6px 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .recipient-item.selected {
          border-color: #3498db;
          background: #ebf5fd;
        }
        
        .recipient-item input {
          margin-right: 8px;
        }
        
        .no-recipients, .no-selected {
          padding: 10px;
          text-align: center;
          color: #6c757d;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .selected-recipients h4 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        
        .selected-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .selected-recipient {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .remove-recipient {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          font-size: 1.2rem;
          font-weight: bold;
          padding: 0 5px;
        }
        
        .form-actions {
          display: flex;
          gap: 15px;
        }
        
        .create-button, .cancel-button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }
        
        .create-button {
          background: #3498db;
          color: white;
        }
        
        .create-button:hover {
          background: #2980b9;
        }
        
        .create-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .cancel-button {
          background: #e9ecef;
          color: #495057;
        }
        
        .cancel-button:hover {
          background: #dee2e6;
        }
      `}</style>
    </div>
  );
};

export default NotificationCreator;

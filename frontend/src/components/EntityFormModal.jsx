import React from 'react';

/**
 * EntityFormModal Component
 * A modal dialog for editing entity details
 */
const EntityFormModal = ({ 
  show, 
  onClose, 
  title, 
  onSubmit, 
  children, 
  submitDisabled, 
  submitLabel = 'Save',
  isSubmitting = false
}) => {
  if (!show) return null;
  
  const handleOverlayClick = (e) => {
    // Only close if clicking directly on the overlay, not its children
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h3>{title}</h3>
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={onSubmit}>
            {children}
            
            <div className="modal-footer">
              <button
                type="submit"
                className="save-button"
                disabled={submitDisabled || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </button>
              
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }
        
        .modal-container {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          animation: modalAppear 0.2s ease-out;
        }
        
        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .modal-header h3 {
          margin: 0;
          color: #2c3e50;
          font-size: 1.25rem;
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 1.5rem;
          line-height: 1;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .close-button:hover {
          background-color: #f8f9fa;
          color: #343a40;
        }
        
        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
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
          min-width: 100px;
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
          min-width: 100px;
        }
        
        .cancel-button:hover {
          background: #e9ecef;
        }
      `}</style>
    </div>
  );
};

export default EntityFormModal;

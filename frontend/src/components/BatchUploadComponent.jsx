import React, { useState, useRef } from 'react';
import { notificationService } from '../services';

/**
 * BatchUploadComponent
 * Handles uploading and processing of batch files (Excel, PDF, Word) for various entity types
 * Uses LLM to extract and normalize data
 */
const BatchUploadComponent = ({ entityType = 'client' }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [fileType, setFileType] = useState('');
  const fileInputRef = useRef(null);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setResults(null);
    setPreviewData(null);
    
    // Determine file type from extension
    const extension = selectedFile.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(extension)) {
      setFileType('excel');
    } else if (['pdf'].includes(extension)) {
      setFileType('pdf');
    } else if (['doc', 'docx'].includes(extension)) {
      setFileType('word');
    } else {
      setFileType('unknown');
    }
  };
  
  const handleCancel = () => {
    // Reset the component state
    setFile(null);
    setResults(null);
    setPreviewData(null);
    setFileType('');
    setProgress(0);
    
    // Notify the user
    notificationService.showNotification(
      'Batch upload canceled',
      'info'
    );
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setProgress(0);
    
    try {
      // In a real implementation, this would call the actual service
      // For now, we'll simulate the upload process with a timeout
      
      // Start progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 300);
      
      // Simulate backend processing
      setTimeout(() => {
        clearInterval(progressInterval);
        setProgress(100);
        
        // Simulate results based on entity type
        const mockResults = {
          totalRecords: Math.floor(Math.random() * 20) + 5,
          added: Math.floor(Math.random() * 10) + 2,
          updated: Math.floor(Math.random() * 5),
          failed: Math.floor(Math.random() * 3),
          errors: []
        };
        
        // Generate some sample preview data
        const mockPreview = generateMockPreviewData(entityType, mockResults.totalRecords);
        setPreviewData(mockPreview);
        
        // Set results
        setResults(mockResults);
        
        // Show notification
        notificationService.showNotification(
          `Successfully processed ${mockResults.totalRecords} ${entityType} records`,
          'success'
        );
        
        setIsUploading(false);
      }, 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setResults({ error: error.message });
      notificationService.showNotification(
        `Upload failed: ${error.message}`,
        'error'
      );
      setIsUploading(false);
    }
  };
  
  // Generate mock preview data based on entity type
  const generateMockPreviewData = (type, count) => {
    const data = [];
    
    switch (type) {
      case 'client':
        for (let i = 0; i < count; i++) {
          data.push({
            id: `client-${i + 1000}`,
            firstName: ['John', 'Mary', 'Robert', 'Lisa', 'Michael'][i % 5],
            lastName: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][i % 5],
            email: `client${i}@example.com`,
            phone: `(555) ${100 + i}-${2000 + i}`,
            address: `${1000 + i} Main St, Springfield`,
            careNeeds: ['Medication Management', 'Mobility Assistance', 'Meal Preparation']
          });
        }
        break;
        
      case 'caregiver':
        for (let i = 0; i < count; i++) {
          data.push({
            id: `caregiver-${i + 1000}`,
            firstName: ['Sarah', 'James', 'Emily', 'David', 'Jessica'][i % 5],
            lastName: ['Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson'][i % 5],
            email: `caregiver${i}@example.com`,
            phone: `(555) ${300 + i}-${4000 + i}`,
            certifications: ['CNA', 'CPR', 'First Aid'],
            skills: ['Medication Management', 'Dementia Care', 'Mobility Assistance']
          });
        }
        break;
        
      case 'schedule':
        for (let i = 0; i < count; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          data.push({
            id: `schedule-${i + 1000}`,
            clientId: `client-${1000 + (i % 5)}`,
            caregiverId: `caregiver-${1000 + (i % 5)}`,
            date: date.toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '11:00',
            status: ['pending', 'confirmed', 'completed'][i % 3]
          });
        }
        break;
        
      default:
        break;
    }
    
    return data;
  };
  
  return (
    <div className="batch-upload-container">
      <h3>Batch Upload {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s</h3>
      <p className="description">
        Upload Excel, PDF, or Word documents containing {entityType} information.
        Our AI will extract and normalize the data automatically.
      </p>
      
      <div className="file-input-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv,.doc,.docx,.pdf"
          disabled={isUploading}
          className="file-input"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="file-label">
          {file ? file.name : `Choose ${entityType} file`}
        </label>
        
        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!file || isUploading}
        >
          {isUploading ? 'Processing...' : 'Upload & Process'}
        </button>
      </div>
      
      {isUploading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-label">
            {progress < 100 
              ? `Processing ${fileType} file (${progress}%)` 
              : 'Finalizing...'}
          </div>
        </div>
      )}
      
      {results && !results.error && (
        <div className="results-container">
          <div className="success-message">
            <h4>Upload Successful</h4>
            <div className="results-summary">
              <div className="result-item">
                <span className="result-label">Processed:</span>
                <span className="result-value">{results.totalRecords} records</span>
              </div>
              <div className="result-item">
                <span className="result-label">Added:</span>
                <span className="result-value success">{results.added}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Updated:</span>
                <span className="result-value info">{results.updated}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Failed:</span>
                <span className="result-value warning">{results.failed}</span>
              </div>
            </div>
            
            {results.failed > 0 && (
              <button className="view-errors-button">
                View Errors
              </button>
            )}
          </div>
        </div>
      )}
      
      {results && results.error && (
        <div className="error-container">
          <div className="error-message">
            <h4>Upload Failed</h4>
            <p>{results.error}</p>
          </div>
        </div>
      )}
      
      {previewData && previewData.length > 0 && (
        <div className="preview-container">
          <h4>Data Preview</h4>
          <p>Showing {Math.min(previewData.length, 5)} of {previewData.length} records:</p>
          
          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  {Object.keys(previewData[0]).map(key => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 5).map((item, index) => (
                  <tr key={index}>
                    {Object.values(item).map((value, valueIndex) => (
                      <td key={valueIndex}>
                        {Array.isArray(value) 
                          ? value.join(', ') 
                          : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="preview-actions">
            <button 
              className="import-button"
              onClick={() => {
                notificationService.showNotification(
                  `Successfully imported ${previewData.length} ${entityType} records`,
                  'success'
                );
                setPreviewData(null);
                setFile(null);
                setResults(null);
              }}
            >
              Import All Data
            </button>
            <button 
              className="cancel-button"
              onClick={handleCancel}
            >
              Discard Import Data
            </button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .batch-upload-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 20px;
          margin-bottom: 20px;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .description {
          color: #5d6d7e;
          margin-bottom: 20px;
          font-size: 14px;
        }
        
        .file-input-container {
          display: flex;
          margin-bottom: 20px;
          align-items: center;
        }
        
        .file-input {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
        
        .file-label {
          flex: 1;
          padding: 10px 15px;
          background: #f8f9fa;
          border: 1px solid #ced4da;
          border-radius: 4px;
          margin-right: 10px;
          cursor: pointer;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          color: #495057;
          transition: all 0.2s;
        }
        
        .file-label:hover {
          background: #e9ecef;
        }
        
        .upload-button {
          padding: 10px 15px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .upload-button:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .upload-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }
        
        .progress-container {
          margin-bottom: 20px;
        }
        
        .progress-bar {
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 5px;
        }
        
        .progress-fill {
          height: 100%;
          background: #3498db;
          transition: width 0.3s ease;
        }
        
        .progress-label {
          font-size: 14px;
          color: #6c757d;
          text-align: center;
        }
        
        .results-container {
          margin-top: 20px;
          padding: 15px;
          background: #f0f9ff;
          border-radius: 4px;
          border-left: 4px solid #3498db;
        }
        
        .success-message h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .results-summary {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 15px;
        }
        
        .result-item {
          display: flex;
          flex-direction: column;
          padding: 10px;
          background: white;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        
        .result-label {
          font-size: 13px;
          color: #6c757d;
          margin-bottom: 5px;
        }
        
        .result-value {
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .result-value.success {
          color: #2ecc71;
        }
        
        .result-value.info {
          color: #3498db;
        }
        
        .result-value.warning {
          color: #f39c12;
        }
        
        .error-container {
          margin-top: 20px;
          padding: 15px;
          background: #fff5f5;
          border-radius: 4px;
          border-left: 4px solid #e74c3c;
        }
        
        .error-message h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #c0392b;
        }
        
        .error-message p {
          margin: 0;
          color: #7f8c8d;
        }
        
        .view-errors-button {
          padding: 8px 12px;
          background: #f39c12;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .view-errors-button:hover {
          background: #e67e22;
        }
        
        .preview-container {
          margin-top: 20px;
          padding: 15px;
          background: #f9fafb;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }
        
        .preview-container h4 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .preview-container p {
          margin-top: 0;
          margin-bottom: 15px;
          color: #6c757d;
          font-size: 14px;
        }
        
        .preview-table-container {
          overflow-x: auto;
          margin-bottom: 15px;
        }
        
        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        
        .preview-table th {
          background: #f8f9fa;
          padding: 8px 12px;
          text-align: left;
          border-bottom: 2px solid #e9ecef;
          font-weight: 600;
          color: #495057;
        }
        
        .preview-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #e9ecef;
          color: #6c757d;
        }
        
        .preview-table tr:hover td {
          background: #f8f9fa;
        }
        
        .preview-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        
        .import-button {
          padding: 10px 15px;
          background: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .import-button:hover {
          background: #27ae60;
        }
        
        .cancel-button {
          padding: 10px 15px;
          background: #f8f9fa;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .cancel-button:hover {
          background: #e9ecef;
        }
      `}</style>
    </div>
  );
};

export default BatchUploadComponent;

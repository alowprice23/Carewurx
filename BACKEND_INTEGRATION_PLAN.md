# CareWurx Backend Integration and Batch Upload Plan

## Overview

This document outlines the implementation plan for connecting the CareWurx frontend to the backend services and developing a comprehensive batch upload feature that can process multiple file formats (Excel, PDF, Word) for caregivers, clients, and schedules.

## 1. Backend Connection Architecture

### 1.1 Service Layer Refactoring

Currently, the application includes browser-mode fallbacks in each service. We need to refactor these services to properly connect with the backend when available:

```javascript
// Example structure for universalDataService.js
class UniversalDataService {
  constructor() {
    this.isElectronAvailable = typeof window !== 'undefined' && window.electronAPI;
    // Initialization based on environment
  }

  async getClients(options = {}) {
    if (this.isElectronAvailable) {
      try {
        // Real backend connection
        return await window.electronAPI.getClients(options);
      } catch (error) {
        console.error("Backend connection failed, falling back to mock data:", error);
        // Fall back to mock data if backend fails
        return this.getMockClients(options);
      }
    } else {
      // Browser-only mode with mock data
      return this.getMockClients(options);
    }
  }

  // Mock data methods as fallbacks
  getMockClients(options) {
    // Mock implementation
  }
}
```

### 1.2 IPC Bridge Enhancement

The existing IPC bridge in the Electron application needs to be enhanced to support:

1. **File uploads and downloads**
2. **Batch processing operations**
3. **Long-running tasks with progress reporting**
4. **Error handling and retry mechanisms**

```javascript
// In preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  // Existing methods
  getClients: () => ipcRenderer.invoke('get-clients'),
  
  // New methods for batch operations
  uploadBatchFile: (fileType, entityType, filePath) => 
    ipcRenderer.invoke('upload-batch-file', fileType, entityType, filePath),
  
  getBatchUploadProgress: (batchId) => 
    ipcRenderer.invoke('get-batch-upload-progress', batchId),
  
  cancelBatchUpload: (batchId) => 
    ipcRenderer.invoke('cancel-batch-upload', batchId)
});
```

### 1.3 API Layer for Direct Connections

For browser deployments without Electron, we'll need a REST API layer:

```javascript
// api.js - For direct API connections in browser mode
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.carewurx.com';

export const apiClient = {
  async get(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  },
  
  // POST, PUT, DELETE methods
  // File upload methods
};
```

## 2. Batch Upload Feature

### 2.1 File Upload Component

Create a new component called `BatchUploadComponent` to handle file uploads:

```jsx
// BatchUploadComponent.jsx
import React, { useState, useRef } from 'react';
import { universalDataService } from '../services';

const BatchUploadComponent = ({ entityType }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
    }
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setProgress(0);
    
    try {
      // Start the upload
      const uploadResult = await universalDataService.uploadBatchFile(
        file, 
        entityType,
        (progressEvent) => {
          setProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      );
      
      setResults(uploadResult);
    } catch (error) {
      console.error('Upload failed:', error);
      setResults({ error: error.message });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="batch-upload-container">
      <h3>Batch Upload {entityType}</h3>
      
      <div className="file-input-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv,.doc,.docx,.pdf"
          disabled={isUploading}
        />
        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!file || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>
      </div>
      
      {isUploading && (
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <div className="progress-label">{progress}%</div>
        </div>
      )}
      
      {results && (
        <div className="results-container">
          {results.error ? (
            <div className="error-message">{results.error}</div>
          ) : (
            <div className="success-message">
              <h4>Upload Successful</h4>
              <p>Processed {results.totalRecords} records</p>
              <p>Added: {results.added}</p>
              <p>Updated: {results.updated}</p>
              <p>Failed: {results.failed}</p>
              {results.failed > 0 && (
                <button onClick={() => console.log('View errors')}>
                  View Errors
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchUploadComponent;
```

### 2.2 Integration with Universal Data Editor

Extend the `UniversalDataEditor` component to include batch upload functionality:

```jsx
// In UniversalDataEditor.jsx
import BatchUploadComponent from './BatchUploadComponent';

// Add to render method
<div className="batch-upload-section">
  <button 
    onClick={() => setShowBatchUpload(!showBatchUpload)}
    className="batch-upload-toggle"
  >
    {showBatchUpload ? 'Hide Batch Upload' : 'Show Batch Upload'}
  </button>
  
  {showBatchUpload && (
    <BatchUploadComponent entityType={entityType} />
  )}
</div>
```

### 2.3 Backend Processing Service

Create a backend service to handle file processing:

```javascript
// In main.js (Electron) or as a separate microservice
const { processExcelFile, processPdfFile, processWordFile } = require('./fileProcessors');
const { llmService } = require('./agents/core/llm-service');

// Handle IPC from renderer
ipcMain.handle('upload-batch-file', async (event, fileType, entityType, filePath) => {
  try {
    // Create a batch processing job
    const batchId = generateUniqueId();
    
    // Process the file based on type
    let extractedData;
    switch (fileType) {
      case 'excel':
        extractedData = await processExcelFile(filePath);
        break;
      case 'pdf':
        extractedData = await processPdfFile(filePath);
        break;
      case 'word':
        extractedData = await processWordFile(filePath);
        break;
      default:
        throw new Error('Unsupported file type');
    }
    
    // Use LLM to normalize and validate data
    const processedData = await llmService.normalizeData(
      extractedData, 
      entityType,
      getEntitySchema(entityType)
    );
    
    // Process the data in batches
    const results = await processEntityData(processedData, entityType);
    
    return {
      batchId,
      totalRecords: processedData.length,
      added: results.added,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors
    };
  } catch (error) {
    console.error('Batch upload failed:', error);
    return { error: error.message };
  }
});
```

## 3. LLM Integration for Document Processing

### 3.1 Document Processing Pipeline

The LLM-based document processing pipeline will include:

1. **Document parsing** (using appropriate libraries for each format)
2. **Text extraction** and structure recognition
3. **Entity identification** using LLM
4. **Data normalization** and validation
5. **Conflict resolution** for existing records

```javascript
// llm-document-processor.js
class LLMDocumentProcessor {
  constructor(llmService) {
    this.llmService = llmService;
  }
  
  async processDocument(documentData, documentType, entityType) {
    // 1. Extract raw text from document
    const rawText = this.extractText(documentData, documentType);
    
    // 2. Use LLM to identify structure and entities
    const structuredData = await this.llmService.extractStructuredData(
      rawText,
      entityType,
      this.getPromptTemplate(entityType)
    );
    
    // 3. Validate and normalize the data
    const validatedData = await this.validateData(structuredData, entityType);
    
    return validatedData;
  }
  
  getPromptTemplate(entityType) {
    // Return appropriate prompt template based on entity type
    const templates = {
      client: `Extract client information from the following document.
               Look for: name, contact details, address, care needs, emergency contacts.
               Format the output as a JSON array of client objects.`,
      
      caregiver: `Extract caregiver information from the following document.
                  Look for: name, contact details, certifications, skills, availability.
                  Format the output as a JSON array of caregiver objects.`,
      
      schedule: `Extract schedule information from the following document.
                 Look for: client names, caregiver names, dates, times, services.
                 Format the output as a JSON array of schedule objects.`
    };
    
    return templates[entityType] || templates.client;
  }
  
  // Other methods for processing specific document types
}
```

### 3.2 LLM Service Enhancements

Enhance the existing LLM service to support document processing:

```javascript
// In llm-service.js
class LLMService {
  // Existing methods
  
  /**
   * Extract structured data from raw text
   */
  async extractStructuredData(text, entityType, promptTemplate) {
    try {
      const prompt = `${promptTemplate}\n\nDocument content:\n${text}`;
      
      const response = await this.callLLM(prompt, {
        temperature: 0.1, // Low temperature for factual extraction
        max_tokens: 4000
      });
      
      // Parse the response as JSON
      return this.parseResponseAsJSON(response);
    } catch (error) {
      console.error('Error in LLM structured data extraction:', error);
      throw new Error(`Failed to extract structured data: ${error.message}`);
    }
  }
  
  /**
   * Normalize and validate entity data
   */
  async normalizeData(data, entityType, schema) {
    // Create a prompt with the data and schema
    const prompt = `Normalize and validate the following ${entityType} data according to the schema.
                   If fields are missing but can be inferred, please add them.
                   If data is inconsistent with the schema, fix it if possible or mark it as invalid.
                   
                   Schema:
                   ${JSON.stringify(schema, null, 2)}
                   
                   Data:
                   ${JSON.stringify(data, null, 2)}`;
    
    try {
      const response = await this.callLLM(prompt, {
        temperature: 0.1,
        max_tokens: 4000
      });
      
      return this.parseResponseAsJSON(response);
    } catch (error) {
      console.error('Error in LLM data normalization:', error);
      throw new Error(`Failed to normalize data: ${error.message}`);
    }
  }
}
```

## 4. Implementation Timeline

### Phase 1: Backend Connection (2 weeks)

1. **Week 1**: Refactor service layer to support real backend connections
   - Update all service modules to implement proper fallback mechanisms
   - Add connection status indicators and error handling

2. **Week 2**: Enhance IPC bridge and test backend connectivity
   - Implement file upload/download capabilities
   - Add progress reporting for long-running operations
   - Test all CRUD operations with backend

### Phase 2: Batch Upload Foundation (3 weeks)

3. **Week 3**: Develop file processing services
   - Implement Excel file processor using `xlsx` or similar library
   - Implement PDF processing using `pdf-parse` or similar
   - Implement Word processing using appropriate libraries

4. **Week 4**: Create batch upload UI components
   - Develop BatchUploadComponent with progress tracking
   - Integrate with UniversalDataEditor
   - Add validation and error reporting

5. **Week 5**: Implement basic batch processing backend
   - Create batch job management system
   - Implement CRUD operations for batch uploads
   - Add job status tracking and reporting

### Phase 3: LLM Integration (3 weeks)

6. **Week 6**: LLM service enhancements
   - Implement document processing capabilities
   - Create entity extraction and normalization functions
   - Develop prompt templates for different entity types

7. **Week 7**: Document parsing pipeline
   - Implement the full document processing pipeline
   - Add data validation and conflict resolution
   - Test with various document formats and structures

8. **Week 8**: UI enhancements and feedback
   - Improve error reporting and visualization
   - Add data preview before final import
   - Implement conflict resolution UI

### Phase 4: Testing and Refinement (2 weeks)

9. **Week 9**: Comprehensive testing
   - Test with various file formats and data structures
   - Performance testing with large files
   - Error handling and edge cases

10. **Week 10**: Refinement and documentation
    - Optimize processing for performance
    - Complete documentation
    - Create user guide for batch uploads

## 5. Technical Requirements

### Backend Dependencies

- **File Processing**:
  - Excel: `xlsx`, `exceljs`
  - PDF: `pdf-parse`, `pdf.js`
  - Word: `mammoth`, `docx`

- **LLM Integration**:
  - OpenAI API or Groq API (as configured)
  - Vector database for document embedding (optional)

- **Data Processing**:
  - Data validation library (e.g., `joi`, `yup`)
  - Data transformation tools

### Frontend Dependencies

- **File Upload**:
  - `react-dropzone` for drag-and-drop
  - Progress tracking components

- **UI Components**:
  - Data preview grid
  - Validation error display
  - Conflict resolution interface

## 6. Conclusion

This implementation plan provides a comprehensive approach to connecting the CareWurx frontend to backend services and implementing a powerful batch upload feature with LLM-powered document processing. The modular design allows for progressive implementation and testing, with fallback mechanisms to ensure the application remains functional in all environments.

By following this plan, the CareWurx application will gain the ability to efficiently process various document formats and automatically extract and normalize data, significantly reducing manual data entry and improving data quality through intelligent validation.

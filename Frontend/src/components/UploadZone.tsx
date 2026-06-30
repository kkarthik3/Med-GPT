import React, { useState, useRef } from 'react';
import type { FileOut } from '../api';
import { 
  UploadIcon, 
  FileIcon, 
  FileSpreadsheetIcon, 
  CheckIcon 
} from '../icons';

interface UploadZoneProps {
  segmentId: string;
  files: FileOut[];
  onUpload: (files: File[]) => Promise<void>;
  uploadProgress: number | null;
  isUploading: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  files,
  onUpload,
  uploadProgress,
  isUploading,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = ['.pdf', '.docx', '.csv', '.xlsx', '.xls', '.txt'];

  const validateFiles = (fileList: FileList): File[] => {
    const validFiles: File[] = [];
    let invalidFound = false;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (allowedExtensions.includes(ext)) {
        validFiles.push(file);
      } else {
        invalidFound = true;
      }
    }

    if (invalidFound) {
      setErrorMessage(`Some files were skipped. Supported: ${allowedExtensions.join(', ')}`);
      setTimeout(() => setErrorMessage(null), 5000);
    }

    return validFiles;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        await onUpload(validFiles);
      }
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(e.target.files);
      if (validFiles.length > 0) {
        await onUpload(validFiles);
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (['csv', 'xlsx', 'xls'].includes(type)) {
      return <FileSpreadsheetIcon size={20} style={{ color: 'var(--success)' }} />;
    }
    return <FileIcon size={20} style={{ color: 'var(--secondary)' }} />;
  };

  return (
    <div className="documents-panel">
      {/* Left Column: Upload Area */}
      <div className="left-column">
        <h2 className="section-title">
          <span>📤</span> Upload Medical Records
        </h2>
        
        <div 
          className={`dropzone-container ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            accept={allowedExtensions.join(',')}
            onChange={handleFileInput}
            disabled={isUploading}
          />
          
          <UploadIcon className="dropzone-icon" />
          <p className="dropzone-text">
            Drag and drop your files here, or <span style={{ color: 'var(--primary)', fontWeight: 600 }}>browse files</span>
          </p>
          <p className="dropzone-subtext">
            Supported formats: PDF, DOCX, CSV, Excel (XLSX/XLS), TXT
          </p>
        </div>

        {errorMessage && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: 'var(--danger)', 
            borderRadius: 'var(--radius-md)', 
            fontSize: '13px' 
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {isUploading && uploadProgress !== null && (
          <div className="uploading-list">
            <div className="upload-progress-item">
              <div className="upload-progress-info">
                <span>Uploading documents...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="progress-track">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Files List */}
      <div className="right-column">
        <h2 className="section-title">
          <span>📋</span> Document Inventory ({files.length})
        </h2>
        
        <div className="files-list-container">
          {files.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%', 
              color: 'var(--text-muted)', 
              fontSize: '14px', 
              textAlign: 'center', 
              padding: '20px' 
            }}>
              <span style={{ fontSize: '24px', marginBottom: '8px' }}>📂</span>
              No documents uploaded for this case yet.
            </div>
          ) : (
            files.map((file) => (
              <div key={file.id} className="file-row">
                <div className="file-row-left">
                  <div className="file-icon">
                    {getFileIcon(file.file_type)}
                  </div>
                  <div>
                    <div className="file-row-name" title={file.filename}>
                      {file.filename}
                    </div>
                    <div className="file-row-type">
                      {file.file_type} format
                    </div>
                  </div>
                </div>
                
                <div className="file-row-right">
                  <span className={`parse-badge ${file.is_parsed ? 'parsed' : 'unparsed'}`}>
                    {file.is_parsed ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckIcon size={12} /> Ready for Chat
                      </span>
                    ) : (
                      'Pending RAG'
                    )}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

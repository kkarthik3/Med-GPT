import React, { useState, useEffect } from 'react';
import { api, getApiBaseUrl, setApiBaseUrl } from './api';
import type { SegmentInfo, FileOut, SummarizeResponse } from './api';
import { SegmentSidebar } from './components/SegmentSidebar';
import { UploadZone } from './components/UploadZone';
import { MedicalSummaryView } from './components/MedicalSummaryView';
import { ChatAssistant } from './components/ChatAssistant';
import type { UIChatMessage } from './components/ChatAssistant';
import { CloseIcon, SpinnerIcon } from './icons';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  // App data state
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileOut[]>([]);
  const [summary, setSummary] = useState<SummarizeResponse | null>(null);
  const [chatMessages, setChatMessages] = useState<UIChatMessage[]>([]);

  // Loading states
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSendingChatMessage, setIsSendingChatMessage] = useState(false);

  // Nav state
  const [activeTab, setActiveTab] = useState<'docs' | 'summary' | 'chat'>('docs');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSegmentId, setNewSegmentId] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiBaseInput, setApiBaseInput] = useState(getApiBaseUrl());

  // Toasts state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Verify backend connection
  const checkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      await api.testConnection();
      setIsConnected(true);
      await loadSegments();
    } catch (err) {
      setIsConnected(false);
      addToast('error', 'Could not establish connection with MedGPT backend.');
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Load sidebar segments
  const loadSegments = async () => {
    try {
      const data = await api.fetchSegments();
      // Sort segments by created_at (newest first) or segment_id
      const sorted = data.sort((a, b) => {
        if (!a.created_at || !b.created_at) return a.segment_id.localeCompare(b.segment_id);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setSegments(sorted);
    } catch (err) {
      console.error('Failed to load segments:', err);
    }
  };

  // Run connection check on mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Set up active segment data
  const handleSelectSegment = async (segmentId: string) => {
    setActiveSegmentId(segmentId);
    setFiles([]);
    setSummary(null);
    setChatMessages([]);
    setIsLoadingFiles(true);
    setActiveTab('docs');

    try {
      // 1. Fetch files list
      const filesData = await api.fetchSegmentFiles(segmentId);
      setFiles(filesData);

      // 2. Fetch summary (if exists, handles exceptions gracefully)
      try {
        const summaryData = await api.generateSummary(segmentId);
        setSummary(summaryData);
      } catch {
        // Summary doesn't exist yet, leave as null
      }

      // 3. Fetch chat history
      try {
        const historyData = await api.fetchChatHistory(segmentId);
        const formattedHistory: UIChatMessage[] = historyData.messages.map((item) => ({
          role: item.role as 'user' | 'assistant',
          content: item.content,
          created_at: item.created_at,
          // Historic messages do not return full sources in the basic history API
        }));
        setChatMessages(formattedHistory);
      } catch {
        // Chat history empty or failed, leave as empty list
      }
    } catch (err: any) {
      addToast('error', `Failed to load details for case: ${err.message}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Create new segment
  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedId = newSegmentId.trim();
    if (!formattedId) return;

    if (segments.some((s) => s.segment_id === formattedId)) {
      addToast('error', `Patient Case '${formattedId}' already exists.`);
      return;
    }

    // Insert locally first (since segment creates on the first upload on the backend)
    const newSeg: SegmentInfo = {
      segment_id: formattedId,
      file_count: 0,
      parsed_count: 0,
      created_at: new Date().toISOString(),
    };

    setSegments((prev) => [newSeg, ...prev]);
    setActiveSegmentId(formattedId);
    setFiles([]);
    setSummary(null);
    setChatMessages([]);
    setShowCreateModal(false);
    setNewSegmentId('');
    setActiveTab('docs');
    addToast('success', `Case '${formattedId}' created successfully.`);
  };

  // Upload files handler
  const handleUploadFiles = async (selectedFiles: File[]) => {
    if (!activeSegmentId) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      await api.uploadFiles(activeSegmentId, selectedFiles, (progress) => {
        setUploadProgress(progress);
      });

      addToast('success', `Successfully uploaded ${selectedFiles.length} document(s).`);
      
      // Refresh files list and segment lists
      const updatedFiles = await api.fetchSegmentFiles(activeSegmentId);
      setFiles(updatedFiles);
      await loadSegments();
    } catch (err: any) {
      addToast('error', `Failed to upload documents: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Generate summary handler
  const handleGenerateSummary = async () => {
    if (!activeSegmentId) return;
    setIsGeneratingSummary(true);

    try {
      const summaryData = await api.generateSummary(activeSegmentId);
      setSummary(summaryData);
      addToast('success', 'Structured report generated successfully.');
    } catch (err: any) {
      addToast('error', `Generation failed: ${err.message}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Send message handler
  const handleSendMessage = async (query: string) => {
    if (!activeSegmentId) return;

    // Append user message immediately
    const userMsg: UIChatMessage = {
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsSendingChatMessage(true);

    try {
      const chatResponse = await api.sendChatMessage(activeSegmentId, query);
      
      const assistantMsg: UIChatMessage = {
        role: 'assistant',
        content: chatResponse.answer,
        created_at: new Date().toISOString(),
        sources: chatResponse.sources,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      // RAG parsing might have parsed some new files! Refresh file statuses.
      const updatedFiles = await api.fetchSegmentFiles(activeSegmentId);
      setFiles(updatedFiles);
      await loadSegments();
    } catch (err: any) {
      addToast('error', `Failed to receive answer: ${err.message}`);
      // Remove the last user message or just append an error system message
      const errorMsg: UIChatMessage = {
        role: 'assistant',
        content: `⚠️ Error: ${err.message}`,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSendingChatMessage(false);
    }
  };

  // Clear chat history handler
  const handleClearChatHistory = async () => {
    if (!activeSegmentId) return;
    if (!window.confirm('Are you sure you want to clear the conversation history for this segment?')) return;

    try {
      await api.clearChatHistory(activeSegmentId);
      setChatMessages([]);
      addToast('success', 'Chat history cleared successfully.');
    } catch (err: any) {
      addToast('error', `Failed to clear history: ${err.message}`);
    }
  };

  // Settings Save
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(apiBaseInput);
    setShowSettingsModal(false);
    addToast('info', `API endpoint set to ${apiBaseInput}`);
    checkConnection();
  };

  return (
    <div className="app-container">
      {/* Toast Alert Center */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <SegmentSidebar
        segments={segments}
        activeSegmentId={activeSegmentId}
        onSelectSegment={handleSelectSegment}
        onCreateSegmentClick={() => setShowCreateModal(true)}
        isConnected={isConnected}
        onSettingsClick={() => {
          setApiBaseInput(getApiBaseUrl());
          setShowSettingsModal(true);
        }}
      />

      {/* Main Panel Content */}
      <main className="main-content">
        {isCheckingConnection ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <SpinnerIcon size={32} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Connecting to MedGPT backend...</span>
          </div>
        ) : !isConnected ? (
          <div className="empty-state">
            <div className="empty-state-card" style={{ borderTop: '4px solid var(--danger)' }}>
              <div className="empty-state-icon" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <span>⚠️</span>
              </div>
              <h2 className="empty-state-title">Backend Server Offline</h2>
              <p className="empty-state-description">
                Could not connect to the MedGPT server at <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{getApiBaseUrl()}</code>.<br />
                Please start your FastAPI server or update connection settings.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-action primary" onClick={checkConnection}>
                  Retry Connection
                </button>
                <button className="btn-action" onClick={() => setShowSettingsModal(true)}>
                  Configure Port
                </button>
              </div>
            </div>
          </div>
        ) : !activeSegmentId ? (
          <div className="empty-state">
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <span style={{ fontSize: '28px' }}>🩺</span>
              </div>
              <h2 className="empty-state-title">Welcome to MedGPT Workspace</h2>
              <p className="empty-state-description">
                Select an existing patient case from the sidebar or click "New Patient Case" to upload files and begin medical analysis.
              </p>
              <button className="btn-action primary" onClick={() => setShowCreateModal(true)}>
                Create New Patient Case
              </button>
            </div>
          </div>
        ) : (
          <div className="workspace">
            {/* Case Header */}
            <header className="workspace-header">
              <div className="workspace-title-area">
                <div>
                  <h1 className="workspace-title">Patient Case: {activeSegmentId}</h1>
                  <p className="workspace-subtitle">
                    {files.length === 0 
                      ? 'No documents uploaded' 
                      : `${files.length} document(s) registered under this segment`}
                  </p>
                </div>
              </div>

              {/* Tab Navigation */}
              <nav className="tabs-list">
                <button 
                  className={`tab-trigger ${activeTab === 'docs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('docs')}
                >
                  📁 Documents
                </button>
                <button 
                  className={`tab-trigger ${activeTab === 'summary' ? 'active' : ''}`}
                  onClick={() => setActiveTab('summary')}
                  disabled={files.length === 0}
                >
                  📝 Clinical Summary
                </button>
                <button 
                  className={`tab-trigger ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                  disabled={files.length === 0}
                >
                  💬 Chat Assistant
                </button>
              </nav>
            </header>

            {/* Workspace Panels */}
            <div className="workspace-body">
              {isLoadingFiles ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <SpinnerIcon size={24} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading case workspace...</span>
                </div>
              ) : (
                <>
                  {activeTab === 'docs' && (
                    <UploadZone
                      segmentId={activeSegmentId}
                      files={files}
                      onUpload={handleUploadFiles}
                      uploadProgress={uploadProgress}
                      isUploading={isUploading}
                    />
                  )}
                  {activeTab === 'summary' && (
                    <MedicalSummaryView
                      segmentId={activeSegmentId}
                      summary={summary}
                      onGenerateSummary={handleGenerateSummary}
                      isGenerating={isGeneratingSummary}
                      hasFiles={files.length > 0}
                    />
                  )}
                  {activeTab === 'chat' && (
                    <ChatAssistant
                      segmentId={activeSegmentId}
                      messages={chatMessages}
                      onSendMessage={handleSendMessage}
                      onClearHistory={handleClearChatHistory}
                      isSending={isSendingChatMessage}
                      hasFiles={files.length > 0}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Create Segment */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Patient Case</h3>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleCreateSegment}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="caseId">Patient/Case Identifier</label>
                  <input
                    type="text"
                    id="caseId"
                    placeholder="e.g. patient-201, Case-ABC"
                    value={newSegmentId}
                    onChange={(e) => setNewSegmentId(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="btn-action" 
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-action primary">
                    Initialize Case
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Settings */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Connection Settings</h3>
              <button className="btn-close" onClick={() => setShowSettingsModal(false)}>
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleSaveSettings}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="apiBase">MedGPT Backend API Endpoint</label>
                  <input
                    type="url"
                    id="apiBase"
                    placeholder="http://localhost:8000"
                    value={apiBaseInput}
                    onChange={(e) => setApiBaseInput(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Make sure the server is configured with CORS enabled.
                  </span>
                </div>
                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="btn-action" 
                    onClick={() => setShowSettingsModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-action primary">
                    Save Connection
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

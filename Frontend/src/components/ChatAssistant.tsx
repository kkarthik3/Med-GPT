import React, { useState, useRef, useEffect } from 'react';
import type { SourceInfo } from '../api';
import { 
  SendIcon, 
  TrashIcon, 
  BookOpenIcon, 
  ChevronRightIcon, 
  ChevronDownIcon, 
  SpinnerIcon 
} from '../icons';

// Extend ChatHistoryItem with sources for UI mapping
export interface UIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: SourceInfo[];
}

interface ChatAssistantProps {
  segmentId: string;
  messages: UIChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  isSending: boolean;
  hasFiles: boolean;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
  isSending,
  hasFiles,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [expandedSourceIndex, setExpandedSourceIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestionChips = [
    'Explain the primary diagnosis',
    'List all prescribed medications',
    'Check for abnormal lab values',
    'What are the recommended next steps?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending || !hasFiles) return;

    const query = inputValue.trim();
    setInputValue('');
    await onSendMessage(query);
  };

  const handleChipClick = async (chipText: string) => {
    if (isSending || !hasFiles) return;
    await onSendMessage(chipText);
  };

  const toggleSources = (index: number) => {
    if (expandedSourceIndex === index) {
      setExpandedSourceIndex(null);
    } else {
      setExpandedSourceIndex(index);
    }
  };

  const formatMessageContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      // Handle bold
      const boldParts = content.split(/\*\*(.*?)\*\*/g);
      const renderedLine = boldParts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx} style={{ fontWeight: 600 }}>{part}</strong>;
        }
        return part;
      });

      return (
        <div key={idx} style={{ marginBottom: idx === lines.length - 1 ? 0 : '8px' }}>
          {renderedLine}
        </div>
      );
    });
  };

  return (
    <div className="chat-panel">
      <div className="chat-workspace">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <span style={{ color: 'var(--primary)', fontSize: '18px' }}>🤖</span>
            <span>RAG Clinical Assistant</span>
          </div>
          {messages.length > 0 && (
            <button 
              className="btn-action" 
              onClick={onClearHistory} 
              title="Clear entire conversation"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <TrashIcon size={14} style={{ color: 'var(--danger)' }} />
              <span style={{ color: 'var(--danger)' }}>Clear Chat</span>
            </button>
          )}
        </div>

        {/* Chat Messages */}
        <div className="chat-messages-container">
          {messages.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%', 
              color: 'var(--text-secondary)',
              textAlign: 'center',
              padding: '24px' 
            }}>
              <span style={{ fontSize: '32px', marginBottom: '12px' }}>🩺</span>
              <h3>Consult Patient Records</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '320px', marginTop: '8px' }}>
                Ask specific questions about treatment histories, vital statistics, or medical scans uploaded for this patient.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={index} 
                className={`chat-bubble-row ${msg.role}`}
              >
                <div className={`chat-bubble ${msg.role}`}>
                  {formatMessageContent(msg.content)}
                  
                  {/* Sources Rendering */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="sources-expansion">
                      <button 
                        className="sources-toggle"
                        onClick={() => toggleSources(index)}
                      >
                        {expandedSourceIndex === index ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                        <BookOpenIcon size={12} />
                        <span>Sources Used ({msg.sources.length})</span>
                      </button>
                      
                      {expandedSourceIndex === index && (
                        <div className="sources-list">
                          {msg.sources.map((src, sIdx) => (
                            <div key={sIdx} className="source-item">
                              <div className="source-filename">📄 {src.filename}</div>
                              {src.chunk_preview && (
                                <div className="source-preview">
                                  "{src.chunk_preview.substring(0, 160)}..."
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <span className="chat-bubble-time">
                    {new Date(msg.created_at).toLocaleTimeString(undefined, { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            ))
          )}

          {/* Pending Response Indicator */}
          {isSending && (
            <div className="chat-bubble-row assistant">
              <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SpinnerIcon size={16} style={{ color: 'var(--primary)' }} />
                <span>Consulting record index...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          {/* Quick Prompt Chips */}
          <div className="prompt-chips">
            {suggestionChips.map((chip, idx) => (
              <button 
                key={idx} 
                className="prompt-chip"
                onClick={() => handleChipClick(chip)}
                disabled={isSending || !hasFiles}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Form */}
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder={
                !hasFiles 
                  ? 'Please upload files to enable RAG chat...' 
                  : 'Ask a question about this case...'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isSending || !hasFiles}
            />
            <button 
              type="submit" 
              className="btn-send"
              disabled={isSending || !inputValue.trim() || !hasFiles}
            >
              <SendIcon size={18} />
            </button>
          </form>
          {!hasFiles && (
            <p style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '6px', textAlign: 'left' }}>
              ⚠️ RAG Q&A requires at least one uploaded document in this segment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

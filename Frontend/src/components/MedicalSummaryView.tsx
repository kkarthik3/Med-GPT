import React, { useState } from 'react';
import type { SummarizeResponse } from '../api';
import { 
  CopyIcon, 
  DownloadIcon, 
  RefreshIcon, 
  CheckIcon 
} from '../icons';

interface MedicalSummaryViewProps {
  segmentId: string;
  summary: SummarizeResponse | null;
  onGenerateSummary: () => Promise<void>;
  isGenerating: boolean;
  hasFiles: boolean;
}

export const MedicalSummaryView: React.FC<MedicalSummaryViewProps> = ({
  segmentId,
  summary,
  onGenerateSummary,
  isGenerating,
  hasFiles,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    if (!summary) return;
    const blob = new Blob([summary.summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Clinical_Summary_${segmentId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatBoldText = (str: string) => {
    const parts = str.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        return <strong key={idx} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong>;
      }
      return part;
    });
  };

  const parseSummaryContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentSectionTitle: string | null = null;
    let currentSectionBullets: string[] = [];

    const flushSection = (key: number) => {
      if (currentSectionTitle || currentSectionBullets.length > 0) {
        elements.push(
          <div key={`sec-${key}`} className="clinical-section">
            {currentSectionTitle && (
              <h3 className="clinical-section-title">{currentSectionTitle}</h3>
            )}
            {currentSectionBullets.map((bullet, idx) => (
              <div key={`bullet-${idx}`} className="clinical-bullet">
                {formatBoldText(bullet)}
              </div>
            ))}
          </div>
        );
        currentSectionTitle = null;
        currentSectionBullets = [];
      }
    };

    let elementKey = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('#')) {
        flushSection(elementKey++);
        currentSectionTitle = trimmed.replace(/^#+\s*/, '');
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
        const bulletText = trimmed.replace(/^[-*•]\s*/, '');
        currentSectionBullets.push(bulletText);
      } else {
        if (!currentSectionTitle && currentSectionBullets.length === 0) {
          elements.push(
            <p key={`p-${elementKey++}`} style={{ marginBottom: '16px', color: '#cbd5e1' }}>
              {formatBoldText(trimmed)}
            </p>
          );
        } else {
          currentSectionBullets.push(trimmed);
        }
      }
    }
    flushSection(elementKey++);

    return elements;
  };

  // Rendering Loading Skeleton
  const renderSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="clinical-section" style={{ borderLeftColor: 'rgba(20, 184, 166, 0.2)' }}>
        <div className="skeleton skeleton-text medium" style={{ height: '20px', marginBottom: '16px' }} />
        <div className="skeleton skeleton-text long" />
        <div className="skeleton skeleton-text long" />
        <div className="skeleton skeleton-text short" />
      </div>
      <div className="clinical-section" style={{ borderLeftColor: 'rgba(20, 184, 166, 0.2)' }}>
        <div className="skeleton skeleton-text short" style={{ height: '20px', marginBottom: '16px' }} />
        <div className="skeleton skeleton-text long" />
        <div className="skeleton skeleton-text medium" />
      </div>
      <div className="clinical-section" style={{ borderLeftColor: 'rgba(20, 184, 166, 0.2)' }}>
        <div className="skeleton skeleton-text medium" style={{ height: '20px', marginBottom: '16px' }} />
        <div className="skeleton skeleton-text long" />
        <div className="skeleton skeleton-text long" />
      </div>
    </div>
  );

  return (
    <div className="summary-panel">
      {/* Summary Toolbar */}
      <div className="summary-header">
        <div className="summary-meta">
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            <span>📝</span> Clinical Case Summary
          </h2>
          {summary && !isGenerating && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Powered by {summary.model_used}
            </span>
          )}
        </div>
        
        {summary && !isGenerating && (
          <div className="summary-actions">
            <button className="btn-action" onClick={handleCopy}>
              {copied ? <CheckIcon size={16} style={{ color: 'var(--success)' }} /> : <CopyIcon size={16} />}
              {copied ? 'Copied!' : 'Copy Raw'}
            </button>
            <button className="btn-action" onClick={handleDownload}>
              <DownloadIcon size={16} />
              Download Report
            </button>
            <button className="btn-action" onClick={onGenerateSummary}>
              <RefreshIcon size={16} />
              Re-generate
            </button>
          </div>
        )}
      </div>

      {/* Summary Content */}
      <div className="summary-content-scroll">
        {isGenerating ? (
          renderSkeleton()
        ) : summary ? (
          <div className="clinical-report">
            {parseSummaryContent(summary.summary)}
            
            <div style={{ 
              marginTop: '32px', 
              paddingTop: '16px', 
              borderTop: '1px solid var(--border-color)', 
              fontSize: '12px', 
              color: 'var(--text-muted)' 
            }}>
              <strong>Processed files:</strong> {summary.files_processed.join(', ')}
            </div>
          </div>
        ) : (
          <div className="summary-empty">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <h3>No Summary Generated Yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '360px', marginTop: '8px', marginBottom: '24px' }}>
              Compile all case files into a single structured clinical report.
            </p>
            <button 
              className="btn-action primary" 
              onClick={onGenerateSummary}
              disabled={!hasFiles}
              style={{ padding: '12px 24px', fontSize: '14px' }}
            >
              Generate Structured Report
            </button>
            {!hasFiles && (
              <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '12px' }}>
                ⚠️ You must upload at least one document first.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

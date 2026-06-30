import React, { useState } from 'react';
import type { SegmentInfo } from '../api';
import { 
  PulseIcon, 
  PlusIcon, 
  SearchIcon, 
  DatabaseIcon, 
  SettingsIcon 
} from '../icons';

interface SegmentSidebarProps {
  segments: SegmentInfo[];
  activeSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  onCreateSegmentClick: () => void;
  isConnected: boolean;
  onSettingsClick: () => void;
}

export const SegmentSidebar: React.FC<SegmentSidebarProps> = ({
  segments,
  activeSegmentId,
  onSelectSegment,
  onCreateSegmentClick,
  isConnected,
  onSettingsClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSegments = segments.filter((seg) =>
    seg.segment_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusClass = (seg: SegmentInfo) => {
    if (seg.file_count === 0) return 'empty';
    return seg.parsed_count === seg.file_count ? 'ready' : 'pending';
  };

  const getStatusText = (seg: SegmentInfo) => {
    if (seg.file_count === 0) return 'No documents';
    return seg.parsed_count === seg.file_count 
      ? 'All files parsed' 
      : `${seg.parsed_count}/${seg.file_count} parsed`;
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="brand">
        <div className="brand-icon">
          <PulseIcon size={22} />
        </div>
        <div>
          <span className="brand-name">MedGPT</span>
          <span className="brand-badge" style={{ marginLeft: '8px' }}>RAG</span>
        </div>
      </div>

      {/* New Segment Button */}
      <button className="btn-new-segment" onClick={onCreateSegmentClick}>
        <PlusIcon size={16} />
        New Patient Case
      </button>

      {/* Search Input */}
      <div className="sidebar-search">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search patient or case ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Segments List */}
      <div className="segments-list">
        {filteredSegments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
            {searchQuery ? 'No cases match search' : 'No active cases'}
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const statusClass = getStatusClass(seg);
            return (
              <div
                key={seg.segment_id}
                className={`segment-item ${activeSegmentId === seg.segment_id ? 'active' : ''}`}
                onClick={() => onSelectSegment(seg.segment_id)}
              >
                <div className="segment-item-header">
                  <span className="segment-title" title={seg.segment_id}>
                    {seg.segment_id}
                  </span>
                  <span className="segment-date">{formatDate(seg.created_at)}</span>
                </div>
                
                <div className="segment-info-badges">
                  <div className="file-badge">
                    <span>📁</span>
                    <span>{seg.file_count} {seg.file_count === 1 ? 'doc' : 'docs'}</span>
                  </div>
                  <div 
                    className={`status-indicator ${statusClass}`} 
                    title={getStatusText(seg)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="connection-status">
          <DatabaseIcon 
            style={{ 
              color: isConnected ? 'var(--success)' : 'var(--danger)',
              filter: isConnected ? 'drop-shadow(0 0 4px var(--success))' : 'none'
            }} 
          />
          <span>{isConnected ? 'Backend Connected' : 'Disconnected'}</span>
        </div>
        <button className="btn-settings" onClick={onSettingsClick} title="Connection Settings">
          <SettingsIcon size={18} />
        </button>
      </div>
    </aside>
  );
};

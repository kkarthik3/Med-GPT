// API Client and TypeScript Definitions for MedGPT

export interface FileOut {
  id: number;
  filename: string;
  file_type: string;
  is_parsed: boolean;
}

export interface UploadResponse {
  segment_id: string;
  files: FileOut[];
}

export interface SummarizeResponse {
  segment_id: string;
  summary: string;
  files_processed: string[];
  model_used: string;
}

export interface SourceInfo {
  filename: string;
  chunk_preview: string;
}

export interface ChatResponse {
  segment_id: string;
  answer: string;
  sources: SourceInfo[];
  model_used: string;
}

export interface ChatHistoryItem {
  role: string;
  content: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  segment_id: string;
  messages: ChatHistoryItem[];
}

export interface SegmentInfo {
  segment_id: string;
  file_count: number;
  parsed_count: number;
  created_at: string | null;
}

const DEFAULT_API_BASE = 'http://localhost:8000';
const STORAGE_KEY = 'medgpt_api_base';

export function getApiBaseUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_BASE;
}

export function setApiBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        }
      } catch {
        // Response wasn't JSON or didn't have detail field
      }
      throw new Error(errorMessage);
    }
    
    return await response.json() as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`Unable to connect to backend at ${baseUrl}. Please ensure the server is running and CORS is enabled.`);
    }
    throw error;
  }
}

export const api = {
  // Test connection to backend
  async testConnection(): Promise<{ status: string; service: string }> {
    return request<{ status: string; service: string }>('/');
  },

  // List all segments
  async fetchSegments(): Promise<SegmentInfo[]> {
    return request<SegmentInfo[]>('/api/upload/segments');
  },

  // Upload files to a segment
  async uploadFiles(
    segmentId: string, 
    files: File[], 
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/upload/`;
    
    return new Promise<UploadResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      
      // Setup progress tracking
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        };
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as UploadResponse;
            resolve(data);
          } catch (e) {
            reject(new Error('Failed to parse upload response.'));
          }
        } else {
          let errorMessage = `Upload failed with status ${xhr.status}`;
          try {
            const errorData = JSON.parse(xhr.responseText);
            if (errorData?.detail) {
              errorMessage = typeof errorData.detail === 'string'
                ? errorData.detail
                : JSON.stringify(errorData.detail);
            }
          } catch {
            // Ignore parse failure for error response
          }
          reject(new Error(errorMessage));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error(`Network error during upload to ${url}`));
      };
      
      const formData = new FormData();
      formData.append('segment_id', segmentId);
      for (const file of files) {
        formData.append('files', file);
      }
      
      xhr.send(formData);
    });
  },

  // Get all files for a segment
  async fetchSegmentFiles(segmentId: string): Promise<FileOut[]> {
    return request<FileOut[]>(`/api/upload/segments/${encodeURIComponent(segmentId)}/files`);
  },

  // Generate medical summary
  async generateSummary(segmentId: string): Promise<SummarizeResponse> {
    return request<SummarizeResponse>('/api/summarize/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ segment_id: segmentId }),
    });
  },

  // Chat with RAG pipeline
  async sendChatMessage(segmentId: string, query: string): Promise<ChatResponse> {
    return request<ChatResponse>('/api/chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ segment_id: segmentId, query }),
    });
  },

  // Fetch full chat history
  async fetchChatHistory(segmentId: string): Promise<ChatHistoryResponse> {
    return request<ChatHistoryResponse>(`/api/chat/history/${encodeURIComponent(segmentId)}`);
  },

  // Clear chat history
  async clearChatHistory(segmentId: string): Promise<{ segment_id: string; messages_deleted: number }> {
    return request<{ segment_id: string; messages_deleted: number }>(`/api/chat/history/${encodeURIComponent(segmentId)}`, {
      method: 'DELETE',
    });
  },
};

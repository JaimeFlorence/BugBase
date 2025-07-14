import api from './api';
import type {
  Attachment,
  ApiResponse,
  FileStatistics
} from '../types';

class AttachmentService {
  // Upload attachments
  async uploadAttachments(
    files: File[],
    bugId?: string,
    commentId?: string
  ): Promise<Attachment[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    if (bugId) formData.append('bugId', bugId);
    if (commentId) formData.append('commentId', commentId);

    const response = await api.post<ApiResponse<{ attachments: Attachment[]; count: number }>>(
      '/attachments/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data!.attachments;
  }

  // Get attachment info
  async getAttachment(id: string): Promise<Attachment> {
    const response = await api.get<ApiResponse<{ attachment: Attachment }>>(
      `/attachments/${id}`
    );
    return response.data.data!.attachment;
  }

  // Download attachment
  async downloadAttachment(id: string, filename: string): Promise<void> {
    const response = await api.get(`/attachments/${id}/download`, {
      responseType: 'blob',
    });
    
    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  // Delete attachment
  async deleteAttachment(id: string): Promise<void> {
    await api.delete(`/attachments/${id}`);
  }

  // Get bug attachments
  async getBugAttachments(bugId: string): Promise<Attachment[]> {
    const response = await api.get<ApiResponse<{ attachments: Attachment[]; count: number }>>(
      `/attachments/bugs/${bugId}/attachments`
    );
    return response.data.data!.attachments;
  }

  // Get comment attachments
  async getCommentAttachments(commentId: string): Promise<Attachment[]> {
    const response = await api.get<ApiResponse<{ attachments: Attachment[]; count: number }>>(
      `/attachments/comments/${commentId}/attachments`
    );
    return response.data.data!.attachments;
  }

  // Get storage info
  async getStorageInfo(): Promise<{
    allowedFileTypes: Record<string, string>;
    allowedExtensions: string[];
    maxFileSize: number;
    maxFileSizeMB: number;
    maxFilesPerUpload: number;
  }> {
    const response = await api.get<ApiResponse<{ 
      allowedFileTypes: Record<string, string>;
      allowedExtensions: string[];
      maxFileSize: number;
      maxFileSizeMB: number;
      maxFilesPerUpload: number;
    }>>('/attachments/storage-info');
    return response.data.data!;
  }

  // Get project file statistics
  async getProjectFileStats(projectId: string): Promise<FileStatistics> {
    const response = await api.get<ApiResponse<{ stats: FileStatistics }>>(
      `/attachments/projects/${projectId}/file-stats`
    );
    return response.data.data!.stats;
  }

  // Upload bug attachment
  async uploadBugAttachment(bugId: string, formData: FormData): Promise<Attachment> {
    const response = await api.post<ApiResponse<{ attachments: Attachment[]; count: number }>>(
      '/attachments/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params: { bugId }
      }
    );
    return response.data.data!.attachments[0];
  }

  // Upload comment attachment
  async uploadCommentAttachment(commentId: string, formData: FormData): Promise<Attachment> {
    const response = await api.post<ApiResponse<{ attachments: Attachment[]; count: number }>>(
      '/attachments/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params: { commentId }
      }
    );
    return response.data.data!.attachments[0];
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get file icon based on mime type
  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'file-text';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'file-spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('zip') || mimeType.includes('compress') || mimeType.includes('archive')) return 'file-archive';
    if (mimeType.includes('text') || mimeType.includes('document')) return 'file-text';
    return 'file';
  }
}

export default new AttachmentService();
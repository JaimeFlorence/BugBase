import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock the api before importing the attachment service
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../api';
import attachmentService from '../attachment.service';
import type { Attachment, FileStatistics } from '../../types';

const mockApi = api as any;

// Mock global objects
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-blob-url'),
    revokeObjectURL: vi.fn(),
  },
});

// Mock document methods
Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    setAttribute: vi.fn(),
    click: vi.fn(),
    remove: vi.fn(),
  })),
});

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn(),
});

describe('AttachmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAttachment: Attachment = {
    id: '1',
    filename: 'test-file.txt',
    originalName: 'test-file.txt',
    mimeType: 'text/plain',
    size: 1024,
    uploadedBy: 'user-1',
    bugId: 'bug-1',
    commentId: null,
    filePath: '/uploads/test-file.txt',
    createdAt: new Date('2023-01-01')
  };

  const mockFile = new File(['test content'], 'test-file.txt', { type: 'text/plain' });

  describe('uploadAttachments', () => {
    it('should upload attachments for a bug', async () => {
      const files = [mockFile];
      const mockResponse = {
        data: {
          success: true,
          data: {
            attachments: [mockAttachment],
            count: 1
          }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await attachmentService.uploadAttachments(files, 'bug-1');

      expect(mockApi.post).toHaveBeenCalledWith(
        '/attachments/upload',
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      expect(result).toEqual([mockAttachment]);
    });

    it('should upload attachments for a comment', async () => {
      const files = [mockFile];
      const mockResponse = {
        data: {
          success: true,
          data: {
            attachments: [mockAttachment],
            count: 1
          }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await attachmentService.uploadAttachments(files, undefined, 'comment-1');

      expect(mockApi.post).toHaveBeenCalled();
      expect(result).toEqual([mockAttachment]);
    });

    it('should upload multiple attachments', async () => {
      const files = [mockFile, mockFile];
      const attachments = [mockAttachment, { ...mockAttachment, id: '2' }];
      const mockResponse = {
        data: {
          success: true,
          data: {
            attachments,
            count: 2
          }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await attachmentService.uploadAttachments(files, 'bug-1');

      expect(result).toEqual(attachments);
    });

    it('should handle upload errors', async () => {
      const files = [mockFile];
      mockApi.post.mockRejectedValue(new Error('Upload failed'));

      await expect(attachmentService.uploadAttachments(files, 'bug-1'))
        .rejects.toThrow('Upload failed');
    });
  });

  describe('getAttachment', () => {
    it('should get attachment info successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { attachment: mockAttachment }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await attachmentService.getAttachment('1');

      expect(mockApi.get).toHaveBeenCalledWith('/attachments/1');
      expect(result).toEqual(mockAttachment);
    });

    it('should handle get attachment errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Attachment not found'));

      await expect(attachmentService.getAttachment('999'))
        .rejects.toThrow('Attachment not found');
    });
  });

  describe('downloadAttachment', () => {
    it('should download attachment successfully', async () => {
      const mockBlob = new Blob(['file content'], { type: 'text/plain' });
      mockApi.get.mockResolvedValue({ data: mockBlob });

      const mockLink = {
        href: '',
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn(),
      };
      vi.mocked(document.createElement).mockReturnValue(mockLink as any);

      await attachmentService.downloadAttachment('1', 'test-file.txt');

      expect(mockApi.get).toHaveBeenCalledWith('/attachments/1/download', {
        responseType: 'blob',
      });
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test-file.txt');
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.remove).toHaveBeenCalled();
      expect(window.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should handle download errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Download failed'));

      await expect(attachmentService.downloadAttachment('1', 'test-file.txt'))
        .rejects.toThrow('Download failed');
    });
  });

  describe('deleteAttachment', () => {
    it('should delete attachment successfully', async () => {
      mockApi.delete.mockResolvedValue({});

      await attachmentService.deleteAttachment('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/attachments/1');
    });

    it('should handle delete errors', async () => {
      mockApi.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(attachmentService.deleteAttachment('1'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('getBugAttachments', () => {
    it('should get bug attachments successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            attachments: [mockAttachment],
            count: 1
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await attachmentService.getBugAttachments('bug-1');

      expect(mockApi.get).toHaveBeenCalledWith('/attachments/bugs/bug-1/attachments');
      expect(result).toEqual([mockAttachment]);
    });
  });

  describe('getCommentAttachments', () => {
    it('should get comment attachments successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            attachments: [mockAttachment],
            count: 1
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await attachmentService.getCommentAttachments('comment-1');

      expect(mockApi.get).toHaveBeenCalledWith('/attachments/comments/comment-1/attachments');
      expect(result).toEqual([mockAttachment]);
    });
  });

  describe('getStorageInfo', () => {
    it('should get storage info successfully', async () => {
      const mockStorageInfo = {
        allowedFileTypes: { 'text/plain': 'txt' },
        allowedExtensions: ['.txt', '.pdf'],
        maxFileSize: 10485760,
        maxFileSizeMB: 10,
        maxFilesPerUpload: 5
      };

      const mockResponse = {
        data: {
          success: true,
          data: mockStorageInfo
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await attachmentService.getStorageInfo();

      expect(mockApi.get).toHaveBeenCalledWith('/attachments/storage-info');
      expect(result).toEqual(mockStorageInfo);
    });
  });

  describe('getProjectFileStats', () => {
    it('should get project file statistics successfully', async () => {
      const mockStats: FileStatistics = {
        totalFiles: 10,
        totalSize: 1048576,
        fileTypes: {
          'text/plain': 5,
          'image/png': 3,
          'application/pdf': 2
        }
      };

      const mockResponse = {
        data: {
          success: true,
          data: { stats: mockStats }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await attachmentService.getProjectFileStats('project-1');

      expect(mockApi.get).toHaveBeenCalledWith('/attachments/projects/project-1/file-stats');
      expect(result).toEqual(mockStats);
    });
  });

  describe('uploadBugAttachment', () => {
    it('should upload bug attachment successfully', async () => {
      const formData = new FormData();
      formData.append('file', mockFile);

      const mockResponse = {
        data: {
          success: true,
          data: {
            attachments: [mockAttachment],
            count: 1
          }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await attachmentService.uploadBugAttachment('bug-1', formData);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/attachments/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: { bugId: 'bug-1' }
        }
      );
      expect(result).toEqual(mockAttachment);
    });
  });

  describe('uploadCommentAttachment', () => {
    it('should upload comment attachment successfully', async () => {
      const formData = new FormData();
      formData.append('file', mockFile);

      const mockResponse = {
        data: {
          success: true,
          data: {
            attachments: [mockAttachment],
            count: 1
          }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await attachmentService.uploadCommentAttachment('comment-1', formData);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/attachments/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: { commentId: 'comment-1' }
        }
      );
      expect(result).toEqual(mockAttachment);
    });
  });

  describe('Helper Methods', () => {
    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(attachmentService.formatFileSize(0)).toBe('0 Bytes');
        expect(attachmentService.formatFileSize(1024)).toBe('1 KB');
        expect(attachmentService.formatFileSize(1048576)).toBe('1 MB');
        expect(attachmentService.formatFileSize(1073741824)).toBe('1 GB');
        expect(attachmentService.formatFileSize(1536)).toBe('1.5 KB');
      });
    });

    describe('getFileIcon', () => {
      it('should return correct icons for different mime types', () => {
        expect(attachmentService.getFileIcon('image/png')).toBe('image');
        expect(attachmentService.getFileIcon('video/mp4')).toBe('video');
        expect(attachmentService.getFileIcon('audio/mp3')).toBe('audio');
        expect(attachmentService.getFileIcon('application/pdf')).toBe('file-text');
        expect(attachmentService.getFileIcon('application/vnd.ms-excel')).toBe('file-spreadsheet');
        expect(attachmentService.getFileIcon('application/vnd.ms-powerpoint')).toBe('presentation');
        expect(attachmentService.getFileIcon('application/zip')).toBe('file-archive');
        expect(attachmentService.getFileIcon('text/plain')).toBe('file-text');
        expect(attachmentService.getFileIcon('unknown/type')).toBe('file');
      });
    });
  });
});
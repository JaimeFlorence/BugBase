import { PrismaClient } from '@prisma/client';
import { AttachmentService } from '../attachment.service';
import { BugService } from '../bug.service';
import { CommentService } from '../comment.service';
import { AppError } from '../../middleware/errorHandler';
import { deleteFile, getFileUrl } from '../../config/storage';

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

// Mock services
jest.mock('../bug.service');
jest.mock('../comment.service');
jest.mock('../../config/storage');

const mockBugService = BugService as jest.Mocked<typeof BugService>;
const mockCommentService = CommentService as jest.Mocked<typeof CommentService>;
const mockDeleteFile = deleteFile as jest.MockedFunction<typeof deleteFile>;
const mockGetFileUrl = getFileUrl as jest.MockedFunction<typeof getFileUrl>;

describe('AttachmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFileUrl.mockReturnValue('http://example.com/file.png');
  });

  describe('createAttachments', () => {
    const mockFiles = [
      {
        filename: 'file1.png',
        originalname: 'original1.png',
        path: '/uploads/file1.png',
        size: 1024,
        mimetype: 'image/png'
      },
      {
        filename: 'file2.pdf',
        originalname: 'original2.pdf',
        path: '/uploads/file2.pdf',
        size: 2048,
        mimetype: 'application/pdf'
      }
    ];

    const mockAttachment = {
      id: 'attachment-1',
      bugId: 'bug-1',
      commentId: null,
      filename: 'file1.png',
      originalName: 'original1.png',
      filePath: '/uploads/file1.png',
      fileSize: 1024,
      mimeType: 'image/png',
      uploadedById: 'user-1',
      uploadedBy: {
        id: 'user-1',
        username: 'testuser',
        fullName: 'Test User'
      }
    };

    it('should successfully create attachments for a bug', async () => {
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1', bugNumber: 1 } as any);
      (mockPrisma.attachment.create as jest.Mock).mockResolvedValue(mockAttachment);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      const result = await AttachmentService.createAttachments(
        [mockFiles[0]], 
        'bug-1', 
        undefined, 
        'user-1'
      );

      expect(mockBugService.getBugById).toHaveBeenCalledWith('bug-1', 'user-1');
      expect(mockPrisma.attachment.create).toHaveBeenCalledWith({
        data: {
          bugId: 'bug-1',
          commentId: undefined,
          filename: 'file1.png',
          originalName: 'original1.png',
          filePath: '/uploads/file1.png',
          fileSize: 1024,
          mimeType: 'image/png',
          uploadedById: 'user-1'
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        }
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('url', 'http://example.com/file.png');
    });

    it('should successfully create attachments for a comment', async () => {
      mockCommentService.getCommentById.mockResolvedValue({ id: 'comment-1' } as any);
      (mockPrisma.attachment.create as jest.Mock).mockResolvedValue({
        ...mockAttachment,
        bugId: null,
        commentId: 'comment-1'
      });

      const result = await AttachmentService.createAttachments(
        [mockFiles[0]], 
        undefined, 
        'comment-1', 
        'user-1'
      );

      expect(mockCommentService.getCommentById).toHaveBeenCalledWith('comment-1', 'user-1');
      expect(mockPrisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bugId: undefined,
          commentId: 'comment-1'
        }),
        include: expect.any(Object)
      });
      expect(result).toHaveLength(1);
    });

    it('should throw error if neither bugId nor commentId provided', async () => {
      await expect(
        AttachmentService.createAttachments(mockFiles, undefined, undefined, 'user-1')
      ).rejects.toThrow(new AppError('Either bugId or commentId must be provided', 400));
    });

    it('should throw error if both bugId and commentId provided', async () => {
      await expect(
        AttachmentService.createAttachments(mockFiles, 'bug-1', 'comment-1', 'user-1')
      ).rejects.toThrow(new AppError('Cannot attach to both bug and comment', 400));
    });

    it('should throw error if bug not found', async () => {
      mockBugService.getBugById.mockResolvedValue(null);

      await expect(
        AttachmentService.createAttachments(mockFiles, 'bug-1', undefined, 'user-1')
      ).rejects.toThrow(new AppError('Bug not found or you do not have permission', 404));
    });

    it('should throw error if comment not found', async () => {
      mockCommentService.getCommentById.mockResolvedValue(null);

      await expect(
        AttachmentService.createAttachments(mockFiles, undefined, 'comment-1', 'user-1')
      ).rejects.toThrow(new AppError('Comment not found or you do not have permission', 404));
    });

    it('should create activity log for bug attachments', async () => {
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1', bugNumber: 1 } as any);
      (mockPrisma.attachment.create as jest.Mock).mockResolvedValue(mockAttachment);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await AttachmentService.createAttachments(mockFiles, 'bug-1', undefined, 'user-1');

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          bugId: 'bug-1',
          userId: 'user-1',
          action: 'ATTACHED_FILE',
          metadata: {
            count: 2,
            filenames: ['original1.png', 'original2.pdf']
          }
        }
      });
    });
  });

  describe('getAttachment', () => {
    const mockAttachment = {
      id: 'attachment-1',
      bugId: 'bug-1',
      commentId: null,
      filename: 'file1.png',
      filePath: '/uploads/file1.png',
      bug: { id: 'bug-1' },
      comment: null,
      uploadedBy: {
        id: 'user-1',
        username: 'testuser',
        fullName: 'Test User'
      }
    };

    it('should successfully get attachment by id', async () => {
      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(mockAttachment);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);

      const result = await AttachmentService.getAttachment('attachment-1', 'user-1');

      expect(mockPrisma.attachment.findUnique).toHaveBeenCalledWith({
        where: { id: 'attachment-1' },
        include: expect.any(Object)
      });
      expect(mockBugService.getBugById).toHaveBeenCalledWith('bug-1', 'user-1');
      expect(result).toHaveProperty('url', 'http://example.com/file.png');
    });

    it('should return null if attachment not found', async () => {
      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await AttachmentService.getAttachment('attachment-1', 'user-1');

      expect(result).toBeNull();
    });

    it('should throw error if user has no permission to view attachment', async () => {
      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(mockAttachment);
      mockBugService.getBugById.mockResolvedValue(null);

      await expect(
        AttachmentService.getAttachment('attachment-1', 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to view this attachment', 403));
    });

    it('should handle comment attachment', async () => {
      const commentAttachment = {
        ...mockAttachment,
        bugId: null,
        commentId: 'comment-1',
        bug: null,
        comment: { bugId: 'bug-1', bug: { id: 'bug-1' } }
      };

      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(commentAttachment);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);

      const result = await AttachmentService.getAttachment('attachment-1', 'user-1');

      expect(mockBugService.getBugById).toHaveBeenCalledWith('bug-1', 'user-1');
      expect(result).toBeDefined();
    });
  });

  describe('getAttachmentsByBug', () => {
    const mockAttachments = [
      {
        id: 'attachment-1',
        bugId: 'bug-1',
        filename: 'file1.png',
        filePath: '/uploads/file1.png',
        uploadedBy: {
          id: 'user-1',
          username: 'testuser',
          fullName: 'Test User'
        }
      }
    ];

    it('should successfully get attachments by bug id', async () => {
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);
      (mockPrisma.attachment.findMany as jest.Mock).mockResolvedValue(mockAttachments);

      const result = await AttachmentService.getAttachmentsByBug('bug-1', 'user-1');

      expect(mockBugService.getBugById).toHaveBeenCalledWith('bug-1', 'user-1');
      expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
        where: { bugId: 'bug-1' },
        include: expect.any(Object),
        orderBy: { uploadedAt: 'desc' }
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('url', 'http://example.com/file.png');
    });

    it('should throw error if bug not found', async () => {
      mockBugService.getBugById.mockResolvedValue(null);

      await expect(
        AttachmentService.getAttachmentsByBug('bug-1', 'user-1')
      ).rejects.toThrow(new AppError('Bug not found or you do not have permission', 404));
    });
  });

  describe('getAttachmentsByComment', () => {
    const mockAttachments = [
      {
        id: 'attachment-1',
        commentId: 'comment-1',
        filename: 'file1.png',
        filePath: '/uploads/file1.png',
        uploadedBy: {
          id: 'user-1',
          username: 'testuser',
          fullName: 'Test User'
        }
      }
    ];

    it('should successfully get attachments by comment id', async () => {
      mockCommentService.getCommentById.mockResolvedValue({ id: 'comment-1' } as any);
      (mockPrisma.attachment.findMany as jest.Mock).mockResolvedValue(mockAttachments);

      const result = await AttachmentService.getAttachmentsByComment('comment-1', 'user-1');

      expect(mockCommentService.getCommentById).toHaveBeenCalledWith('comment-1', 'user-1');
      expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
        where: { commentId: 'comment-1' },
        include: expect.any(Object),
        orderBy: { uploadedAt: 'desc' }
      });
      expect(result).toHaveLength(1);
    });

    it('should throw error if comment not found', async () => {
      mockCommentService.getCommentById.mockResolvedValue(null);

      await expect(
        AttachmentService.getAttachmentsByComment('comment-1', 'user-1')
      ).rejects.toThrow(new AppError('Comment not found or you do not have permission', 404));
    });
  });

  describe('deleteAttachment', () => {
    const mockAttachment = {
      id: 'attachment-1',
      bugId: 'bug-1',
      commentId: null,
      filename: 'file1.png',
      originalName: 'original1.png',
      filePath: '/uploads/file1.png',
      uploadedById: 'user-1',
      bug: {
        id: 'bug-1',
        project: {
          members: [
            { userId: 'user-1', user: { id: 'user-1', role: 'ADMIN' } }
          ]
        }
      },
      comment: null
    };

    it('should successfully delete attachment as uploader', async () => {
      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(mockAttachment);
      mockDeleteFile.mockResolvedValue(undefined);
      (mockPrisma.attachment.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await AttachmentService.deleteAttachment('attachment-1', 'user-1');

      expect(mockDeleteFile).toHaveBeenCalledWith('/uploads/file1.png');
      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'attachment-1' }
      });
      expect(mockPrisma.activityLog.create).toHaveBeenCalled();
    });

    it('should throw error if attachment not found', async () => {
      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        AttachmentService.deleteAttachment('attachment-1', 'user-1')
      ).rejects.toThrow(new AppError('Attachment not found', 404));
    });

    it('should allow admin to delete any attachment', async () => {
      const attachmentByOtherUser = {
        ...mockAttachment,
        uploadedById: 'user-2'
      };

      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(attachmentByOtherUser);
      mockDeleteFile.mockResolvedValue(undefined);
      (mockPrisma.attachment.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await AttachmentService.deleteAttachment('attachment-1', 'user-1');

      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'attachment-1' }
      });
    });

    it('should throw error if regular user tries to delete someone else\'s attachment', async () => {
      const attachmentByOtherUser = {
        ...mockAttachment,
        uploadedById: 'user-2',
        bug: {
          ...mockAttachment.bug,
          project: {
            members: [
              { userId: 'user-1', user: { id: 'user-1', role: 'REPORTER' } }
            ]
          }
        }
      };

      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(attachmentByOtherUser);

      await expect(
        AttachmentService.deleteAttachment('attachment-1', 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to delete this attachment', 403));
    });

    it('should handle comment attachment deletion', async () => {
      const commentAttachment = {
        ...mockAttachment,
        bugId: null,
        commentId: 'comment-1',
        bug: null,
        comment: {
          bug: mockAttachment.bug
        }
      };

      (mockPrisma.attachment.findUnique as jest.Mock).mockResolvedValue(commentAttachment);
      mockDeleteFile.mockResolvedValue(undefined);
      (mockPrisma.attachment.delete as jest.Mock).mockResolvedValue({});

      await AttachmentService.deleteAttachment('attachment-1', 'user-1');

      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'attachment-1' }
      });
      // Should not create activity log for comment attachments
      expect(mockPrisma.activityLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getFileStats', () => {
    const mockAttachments = [
      {
        fileSize: 1024,
        mimeType: 'image/png'
      },
      {
        fileSize: 2048,
        mimeType: 'image/jpeg'
      },
      {
        fileSize: 4096,
        mimeType: 'application/pdf'
      }
    ];

    it('should successfully get file stats for project', async () => {
      (mockPrisma.projectMember.findFirst as jest.Mock).mockResolvedValue({ projectId: 'project-1' });
      (mockPrisma.bug.findMany as jest.Mock).mockResolvedValue([
        { id: 'bug-1' },
        { id: 'bug-2' }
      ]);
      (mockPrisma.attachment.findMany as jest.Mock).mockResolvedValue(mockAttachments);

      const result = await AttachmentService.getFileStats('project-1', 'user-1');

      expect(mockPrisma.projectMember.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          userId: 'user-1'
        }
      });
      expect(result).toEqual({
        totalFiles: 3,
        totalSize: 7168,
        filesByType: {
          image: 2,
          application: 1
        }
      });
    });

    it('should throw error if user has no access to project', async () => {
      (mockPrisma.projectMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        AttachmentService.getFileStats('project-1', 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to view this project', 403));
    });
  });
});
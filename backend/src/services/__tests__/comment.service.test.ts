import { PrismaClient } from '@prisma/client';
import { CommentService } from '../comment.service';
import { BugService } from '../bug.service';
import { AppError } from '../../middleware/errorHandler';

const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

// Mock BugService
jest.mock('../bug.service');
const mockBugService = BugService as jest.Mocked<typeof BugService>;

describe('CommentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createComment', () => {
    const mockBug = {
      id: 'bug-1',
      bugNumber: 1,
      title: 'Test Bug'
    };

    const mockCommentData = {
      bugId: 'bug-1',
      content: 'This is a test comment'
    };

    const mockComment = {
      id: 'comment-1',
      bugId: 'bug-1',
      userId: 'user-1',
      content: 'This is a test comment',
      user: {
        id: 'user-1',
        username: 'testuser',
        fullName: 'Test User',
        avatarUrl: null
      },
      attachments: [],
      mentions: [],
      _count: { replies: 0 }
    };

    it('should successfully create a comment', async () => {
      mockBugService.getBugById.mockResolvedValue(mockBug as any);
      (mockPrisma.comment.create as jest.Mock).mockResolvedValue(mockComment);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.bugWatcher.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.notification.createMany as jest.Mock).mockResolvedValue({});

      const result = await CommentService.createComment(mockCommentData, 'user-1');

      expect(mockBugService.getBugById).toHaveBeenCalledWith('bug-1', 'user-1');
      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: {
          bugId: 'bug-1',
          userId: 'user-1',
          content: 'This is a test comment',
          parentId: undefined
        },
        include: expect.any(Object)
      });
      expect(result).toEqual(mockComment);
    });

    it('should throw error if bug not found', async () => {
      mockBugService.getBugById.mockResolvedValue(null);

      await expect(
        CommentService.createComment(mockCommentData, 'user-1')
      ).rejects.toThrow(new AppError('Bug not found or you do not have permission', 404));
    });

    it('should create a reply comment with valid parent', async () => {
      const replyData = {
        ...mockCommentData,
        parentId: 'parent-comment-1'
      };

      const mockParentComment = {
        id: 'parent-comment-1',
        bugId: 'bug-1'
      };

      mockBugService.getBugById.mockResolvedValue(mockBug as any);
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(mockParentComment);
      (mockPrisma.comment.create as jest.Mock).mockResolvedValue(mockComment);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findUnique as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.notification.createMany as jest.Mock).mockResolvedValue({});

      await CommentService.createComment(replyData, 'user-1');

      expect(mockPrisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 'parent-comment-1' }
      });
      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId: 'parent-comment-1'
        }),
        include: expect.any(Object)
      });
    });

    it('should throw error if parent comment not found', async () => {
      const replyData = {
        ...mockCommentData,
        parentId: 'invalid-parent-id'
      };

      mockBugService.getBugById.mockResolvedValue(mockBug as any);
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        CommentService.createComment(replyData, 'user-1')
      ).rejects.toThrow(new AppError('Parent comment not found', 404));
    });

    it('should throw error if parent comment belongs to different bug', async () => {
      const replyData = {
        ...mockCommentData,
        parentId: 'parent-comment-1'
      };

      const mockParentComment = {
        id: 'parent-comment-1',
        bugId: 'different-bug-id'
      };

      mockBugService.getBugById.mockResolvedValue(mockBug as any);
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(mockParentComment);

      await expect(
        CommentService.createComment(replyData, 'user-1')
      ).rejects.toThrow(new AppError('Parent comment does not belong to this bug', 400));
    });

    it('should extract and create mentions', async () => {
      const commentWithMentions = {
        ...mockCommentData,
        content: 'Hello @testuser and @anotheruser, please check this'
      };

      const mockUsers = [
        { id: 'user-2', username: 'testuser' },
        { id: 'user-3', username: 'anotheruser' }
      ];

      mockBugService.getBugById.mockResolvedValue(mockBug as any);
      (mockPrisma.comment.create as jest.Mock).mockResolvedValue(mockComment);
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (mockPrisma.mention.createMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.notification.createMany as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findUnique as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findMany as jest.Mock).mockResolvedValue([]);

      await CommentService.createComment(commentWithMentions, 'user-1');

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          username: {
            in: ['testuser', 'anotheruser']
          }
        }
      });
      expect(mockPrisma.mention.createMany).toHaveBeenCalledWith({
        data: [
          { commentId: 'comment-1', mentionedUserId: 'user-2' },
          { commentId: 'comment-1', mentionedUserId: 'user-3' }
        ]
      });
    });

    it('should add commenter as watcher if not already watching', async () => {
      mockBugService.getBugById.mockResolvedValue(mockBug as any);
      (mockPrisma.comment.create as jest.Mock).mockResolvedValue(mockComment);
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.bugWatcher.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.bugWatcher.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.notification.createMany as jest.Mock).mockResolvedValue({});

      await CommentService.createComment(mockCommentData, 'user-1');

      expect(mockPrisma.bugWatcher.create).toHaveBeenCalledWith({
        data: {
          bugId: 'bug-1',
          userId: 'user-1'
        }
      });
    });
  });

  describe('getComments', () => {
    const mockBug = {
      id: 'bug-1',
      bugNumber: 1
    };

    const mockComments = [
      {
        id: 'comment-1',
        content: 'First comment',
        user: { id: 'user-1', username: 'user1' },
        replies: []
      }
    ];

    it('should successfully get comments for a bug', async () => {
      mockBugService.getBugById.mockResolvedValue(mockBug as any);
      (mockPrisma.comment.findMany as jest.Mock).mockResolvedValue(mockComments);

      const result = await CommentService.getComments('bug-1', 'user-1');

      expect(mockBugService.getBugById).toHaveBeenCalledWith('bug-1', 'user-1');
      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith({
        where: {
          bugId: 'bug-1',
          parentId: null
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' }
      });
      expect(result).toEqual(mockComments);
    });

    it('should throw error if bug not found', async () => {
      mockBugService.getBugById.mockResolvedValue(null);

      await expect(
        CommentService.getComments('bug-1', 'user-1')
      ).rejects.toThrow(new AppError('Bug not found or you do not have permission', 404));
    });
  });

  describe('getCommentById', () => {
    const mockComment = {
      id: 'comment-1',
      bugId: 'bug-1',
      content: 'Test comment',
      bug: { id: 'bug-1' }
    };

    it('should successfully get comment by id', async () => {
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(mockComment);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);

      const result = await CommentService.getCommentById('comment-1', 'user-1');

      expect(mockPrisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        include: expect.any(Object)
      });
      expect(mockBugService.getBugById).toHaveBeenCalledWith('bug-1', 'user-1');
      expect(result).toEqual(mockComment);
    });

    it('should return null if comment not found', async () => {
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await CommentService.getCommentById('comment-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('updateComment', () => {
    const mockCurrentComment = {
      id: 'comment-1',
      bugId: 'bug-1',
      userId: 'user-1',
      content: 'Original content',
      bug: { bugNumber: 1 }
    };

    const updateData = {
      content: 'Updated content'
    };

    it('should successfully update own comment', async () => {
      const mockUpdatedComment = {
        ...mockCurrentComment,
        content: 'Updated content',
        isEdited: true
      };

      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(mockCurrentComment);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);
      (mockPrisma.comment.update as jest.Mock).mockResolvedValue(mockUpdatedComment);
      (mockPrisma.mention.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.mention.deleteMany as jest.Mock).mockResolvedValue({});

      const result = await CommentService.updateComment('comment-1', updateData, 'user-1');

      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: {
          content: 'Updated content',
          isEdited: true
        },
        include: expect.any(Object)
      });
      expect(result).toEqual(mockUpdatedComment);
    });

    it('should throw error if comment not found', async () => {
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        CommentService.updateComment('comment-1', updateData, 'user-1')
      ).rejects.toThrow(new AppError('Comment not found', 404));
    });

    it('should throw error if user tries to update someone else\'s comment', async () => {
      const commentByOtherUser = {
        ...mockCurrentComment,
        userId: 'user-2'
      };

      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(commentByOtherUser);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);

      await expect(
        CommentService.updateComment('comment-1', updateData, 'user-1')
      ).rejects.toThrow(new AppError('You can only edit your own comments', 403));
    });
  });

  describe('deleteComment', () => {
    const mockCurrentComment = {
      id: 'comment-1',
      bugId: 'bug-1',
      userId: 'user-1',
      bug: {
        project: {
          members: [
            { userId: 'user-1', user: { id: 'user-1', role: 'ADMIN' } }
          ]
        }
      }
    };

    it('should successfully delete own comment', async () => {
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(mockCurrentComment);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);
      (mockPrisma.comment.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await CommentService.deleteComment('comment-1', 'user-1');

      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' }
      });
      expect(mockPrisma.activityLog.create).toHaveBeenCalled();
    });

    it('should throw error if comment not found', async () => {
      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        CommentService.deleteComment('comment-1', 'user-1')
      ).rejects.toThrow(new AppError('Comment not found', 404));
    });

    it('should allow admin to delete any comment', async () => {
      const commentByOtherUser = {
        ...mockCurrentComment,
        userId: 'user-2'
      };

      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(commentByOtherUser);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);
      (mockPrisma.comment.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue({});

      await CommentService.deleteComment('comment-1', 'user-1');

      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' }
      });
    });

    it('should throw error if regular user tries to delete someone else\'s comment', async () => {
      const commentByOtherUser = {
        ...mockCurrentComment,
        userId: 'user-2',
        bug: {
          project: {
            members: [
              { userId: 'user-1', user: { id: 'user-1', role: 'REPORTER' } }
            ]
          }
        }
      };

      (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(commentByOtherUser);
      mockBugService.getBugById.mockResolvedValue({ id: 'bug-1' } as any);

      await expect(
        CommentService.deleteComment('comment-1', 'user-1')
      ).rejects.toThrow(new AppError('You do not have permission to delete this comment', 403));
    });
  });

  describe('extractMentions', () => {
    it('should extract mentions from content', () => {
      const content = 'Hello @user1 and @user2, please check @user1 again';
      // Access private method through type assertion
      const extractMentions = (CommentService as any).extractMentions;
      
      const mentions = extractMentions(content);
      
      expect(mentions).toEqual(['user1', 'user2']);
    });

    it('should return empty array if no mentions', () => {
      const content = 'Hello everyone, please check this';
      const extractMentions = (CommentService as any).extractMentions;
      
      const mentions = extractMentions(content);
      
      expect(mentions).toEqual([]);
    });
  });
});
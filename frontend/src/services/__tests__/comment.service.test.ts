import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock the api before importing the comment service
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../api';
import commentService from '../comment.service';
import type { Comment, CreateCommentData, UpdateCommentData } from '../../types';

const mockApi = api as any;

describe('CommentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockComment: Comment = {
    id: '1',
    content: 'Test comment',
    authorId: 'user-1',
    bugId: 'bug-1',
    parentId: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    author: {
      id: 'user-1',
      username: 'testuser',
      fullName: 'Test User',
      email: 'test@example.com'
    },
    replies: [],
    mentions: []
  };

  describe('createComment', () => {
    it('should create a comment successfully', async () => {
      const createData: CreateCommentData = {
        content: 'New comment',
        parentId: null
      };

      const mockResponse = {
        data: {
          success: true,
          data: { comment: mockComment }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await commentService.createComment('bug-1', createData);

      expect(mockApi.post).toHaveBeenCalledWith('/bugs/bug-1/comments', createData);
      expect(result).toEqual(mockComment);
    });

    it('should create a reply comment successfully', async () => {
      const createData: CreateCommentData = {
        content: 'Reply comment',
        parentId: 'parent-1'
      };

      const replyComment = { ...mockComment, parentId: 'parent-1' };
      const mockResponse = {
        data: {
          success: true,
          data: { comment: replyComment }
        }
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await commentService.createComment('bug-1', createData);

      expect(mockApi.post).toHaveBeenCalledWith('/bugs/bug-1/comments', createData);
      expect(result).toEqual(replyComment);
    });

    it('should handle creation errors', async () => {
      const createData: CreateCommentData = {
        content: 'New comment',
        parentId: null
      };

      mockApi.post.mockRejectedValue(new Error('Creation failed'));

      await expect(commentService.createComment('bug-1', createData))
        .rejects.toThrow('Creation failed');
    });
  });

  describe('getComments', () => {
    it('should get comments for a bug successfully', async () => {
      const mockComments = [mockComment];
      const mockResponse = {
        data: {
          success: true,
          data: {
            comments: mockComments,
            count: 1
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await commentService.getComments('bug-1');

      expect(mockApi.get).toHaveBeenCalledWith('/bugs/bug-1/comments');
      expect(result).toEqual(mockComments);
    });

    it('should return empty array when no comments exist', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            comments: [],
            count: 0
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await commentService.getComments('bug-1');

      expect(result).toEqual([]);
    });

    it('should handle get comments errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Failed to fetch comments'));

      await expect(commentService.getComments('bug-1'))
        .rejects.toThrow('Failed to fetch comments');
    });
  });

  describe('getCommentById', () => {
    it('should get a single comment by ID', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { comment: mockComment }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await commentService.getCommentById('1');

      expect(mockApi.get).toHaveBeenCalledWith('/comments/1');
      expect(result).toEqual(mockComment);
    });

    it('should handle get comment errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Comment not found'));

      await expect(commentService.getCommentById('999'))
        .rejects.toThrow('Comment not found');
    });
  });

  describe('updateComment', () => {
    it('should update a comment successfully', async () => {
      const updateData: UpdateCommentData = {
        content: 'Updated comment content'
      };

      const updatedComment = { ...mockComment, content: 'Updated comment content' };
      const mockResponse = {
        data: {
          success: true,
          data: { comment: updatedComment }
        }
      };

      mockApi.put.mockResolvedValue(mockResponse);

      const result = await commentService.updateComment('1', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/comments/1', updateData);
      expect(result).toEqual(updatedComment);
    });

    it('should handle update errors', async () => {
      const updateData: UpdateCommentData = {
        content: 'Updated comment'
      };

      mockApi.put.mockRejectedValue(new Error('Update failed'));

      await expect(commentService.updateComment('1', updateData))
        .rejects.toThrow('Update failed');
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment successfully', async () => {
      mockApi.delete.mockResolvedValue({});

      await commentService.deleteComment('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/comments/1');
    });

    it('should handle delete errors', async () => {
      mockApi.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(commentService.deleteComment('1'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('getCommentReplies', () => {
    it('should get replies for a comment successfully', async () => {
      const mockReplies = [
        { ...mockComment, id: '2', parentId: '1', content: 'Reply 1' },
        { ...mockComment, id: '3', parentId: '1', content: 'Reply 2' }
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            replies: mockReplies,
            count: 2
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await commentService.getCommentReplies('1');

      expect(mockApi.get).toHaveBeenCalledWith('/comments/1/replies');
      expect(result).toEqual(mockReplies);
    });

    it('should return empty array when no replies exist', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            replies: [],
            count: 0
          }
        }
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await commentService.getCommentReplies('1');

      expect(result).toEqual([]);
    });

    it('should handle get replies errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Failed to fetch replies'));

      await expect(commentService.getCommentReplies('1'))
        .rejects.toThrow('Failed to fetch replies');
    });
  });
});
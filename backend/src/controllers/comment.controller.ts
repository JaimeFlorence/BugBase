import { Request, Response, NextFunction } from 'express';
import { CommentService } from '../services/comment.service';
import { AppError } from '../middleware/errorHandler';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class CommentController {
  static async createComment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bugId } = req.params;
      const { content, parentId } = req.body;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      if (!content || !content.trim()) {
        throw new AppError('Comment content is required', 400);
      }

      const commentData = {
        bugId,
        content: content.trim(),
        parentId
      };

      const comment = await CommentService.createComment(commentData, req.user.id);

      res.status(201).json({
        success: true,
        data: { comment }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getComments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bugId } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const comments = await CommentService.getComments(bugId, req.user.id);

      res.json({
        success: true,
        data: { 
          comments,
          count: comments.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCommentById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const comment = await CommentService.getCommentById(id, req.user.id);

      if (!comment) {
        throw new AppError('Comment not found', 404);
      }

      res.json({
        success: true,
        data: { comment }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateComment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { content } = req.body;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      if (!content || !content.trim()) {
        throw new AppError('Comment content is required', 400);
      }

      const updateData = {
        content: content.trim()
      };

      const comment = await CommentService.updateComment(id, updateData, req.user.id);

      res.json({
        success: true,
        data: { comment }
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteComment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      await CommentService.deleteComment(id, req.user.id);

      res.json({
        success: true,
        message: 'Comment deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCommentReplies(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      // Get the comment with its replies
      const comment = await CommentService.getCommentById(id, req.user.id);

      if (!comment) {
        throw new AppError('Comment not found', 404);
      }

      res.json({
        success: true,
        data: { 
          replies: comment.replies || [],
          count: comment.replies?.length || 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
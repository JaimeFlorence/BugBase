import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { AttachmentService } from '../services/attachment.service';
import { AppError } from '../middleware/errorHandler';
import { storageConfig } from '../config/storage';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class AttachmentController {
  static async uploadAttachments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        throw new AppError('No files uploaded', 400);
      }

      const { bugId, commentId } = req.body;

      // Ensure files is array of Express.Multer.File
      const files = req.files as Express.Multer.File[];

      const attachments = await AttachmentService.createAttachments(
        files,
        bugId,
        commentId,
        req.user.id
      );

      res.status(201).json({
        success: true,
        data: { 
          attachments,
          count: attachments.length
        }
      });
    } catch (error) {
      // Clean up uploaded files on error
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            console.error('Error deleting file:', err);
          }
        }
      }
      next(error);
    }
  }

  static async getAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const attachment = await AttachmentService.getAttachment(id, req.user.id);

      if (!attachment) {
        throw new AppError('Attachment not found', 404);
      }

      res.json({
        success: true,
        data: { attachment }
      });
    } catch (error) {
      next(error);
    }
  }

  static async downloadAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const attachment = await AttachmentService.getAttachment(id, req.user.id);

      if (!attachment) {
        throw new AppError('Attachment not found', 404);
      }

      // Check if file exists
      try {
        await fs.access(attachment.filePath);
      } catch (error) {
        throw new AppError('File not found on server', 404);
      }

      // Set appropriate headers
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Length', attachment.fileSize.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);

      // Stream the file
      const fileStream = require('fs').createReadStream(attachment.filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  static async getBugAttachments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bugId } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const attachments = await AttachmentService.getAttachmentsByBug(bugId, req.user.id);

      res.json({
        success: true,
        data: { 
          attachments,
          count: attachments.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCommentAttachments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const attachments = await AttachmentService.getAttachmentsByComment(commentId, req.user.id);

      res.json({
        success: true,
        data: { 
          attachments,
          count: attachments.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAttachment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      await AttachmentService.deleteAttachment(id, req.user.id);

      res.json({
        success: true,
        message: 'Attachment deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProjectFileStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const stats = await AttachmentService.getFileStats(projectId, req.user.id);

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStorageInfo(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new AppError('User not authenticated', 401);
      }

      const allowedExtensions = Object.keys(storageConfig.ALLOWED_FILE_TYPES);
      const maxFileSizeMB = storageConfig.MAX_FILE_SIZE / (1024 * 1024);

      res.json({
        success: true,
        data: {
          allowedFileTypes: storageConfig.ALLOWED_FILE_TYPES,
          allowedExtensions,
          maxFileSize: storageConfig.MAX_FILE_SIZE,
          maxFileSizeMB,
          maxFilesPerUpload: 10
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
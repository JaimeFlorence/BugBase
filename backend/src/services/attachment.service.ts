import { PrismaClient } from '@prisma/client';
import { Attachment } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { BugService } from './bug.service';
import { CommentService } from './comment.service';
import { deleteFile, getFileUrl } from '../config/storage';

const prisma = new PrismaClient();

interface UploadedFile {
  filename: string;
  originalname: string;
  path: string;
  size: number;
  mimetype: string;
}

interface AttachmentWithDetails extends Attachment {
  uploadedBy: {
    id: string;
    username: string;
    fullName: string;
  };
  url?: string;
}

export class AttachmentService {
  static async createAttachments(
    files: UploadedFile[], 
    bugId: string | undefined,
    commentId: string | undefined,
    userId: string
  ): Promise<AttachmentWithDetails[]> {
    // Validate that either bugId or commentId is provided
    if (!bugId && !commentId) {
      throw new AppError('Either bugId or commentId must be provided', 400);
    }

    if (bugId && commentId) {
      throw new AppError('Cannot attach to both bug and comment', 400);
    }

    // Verify permissions
    if (bugId) {
      const bug = await BugService.getBugById(bugId, userId);
      if (!bug) {
        throw new AppError('Bug not found or you do not have permission', 404);
      }
    }

    if (commentId) {
      const comment = await CommentService.getCommentById(commentId, userId);
      if (!comment) {
        throw new AppError('Comment not found or you do not have permission', 404);
      }
    }

    // Create attachment records
    const attachments = await Promise.all(
      files.map(async (file) => {
        const attachment = await prisma.attachment.create({
          data: {
            bugId,
            commentId,
            filename: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedById: userId
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

        // Add URL for convenience
        return {
          ...attachment,
          url: getFileUrl(attachment.filePath)
        };
      })
    );

    // Create activity log
    if (bugId) {
      await prisma.activityLog.create({
        data: {
          bugId,
          userId,
          action: 'ATTACHED_FILE',
          metadata: {
            count: files.length,
            filenames: files.map(f => f.originalname)
          }
        }
      });
    }

    return attachments as AttachmentWithDetails[];
  }

  static async getAttachment(id: string, userId: string): Promise<AttachmentWithDetails | null> {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        bug: true,
        comment: {
          include: {
            bug: true
          }
        },
        uploadedBy: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      }
    });

    if (!attachment) {
      return null;
    }

    // Verify user has permission to view this attachment
    const bugId = attachment.bugId || attachment.comment?.bugId;
    if (bugId) {
      const bug = await BugService.getBugById(bugId, userId);
      if (!bug) {
        throw new AppError('You do not have permission to view this attachment', 403);
      }
    }

    return {
      ...attachment,
      url: getFileUrl(attachment.filePath)
    } as AttachmentWithDetails;
  }

  static async getAttachmentsByBug(bugId: string, userId: string): Promise<AttachmentWithDetails[]> {
    // Verify user has permission to view this bug
    const bug = await BugService.getBugById(bugId, userId);
    if (!bug) {
      throw new AppError('Bug not found or you do not have permission', 404);
    }

    const attachments = await prisma.attachment.findMany({
      where: { bugId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    return attachments.map(attachment => ({
      ...attachment,
      url: getFileUrl(attachment.filePath)
    })) as AttachmentWithDetails[];
  }

  static async getAttachmentsByComment(commentId: string, userId: string): Promise<AttachmentWithDetails[]> {
    // Verify user has permission to view this comment
    const comment = await CommentService.getCommentById(commentId, userId);
    if (!comment) {
      throw new AppError('Comment not found or you do not have permission', 404);
    }

    const attachments = await prisma.attachment.findMany({
      where: { commentId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    return attachments.map(attachment => ({
      ...attachment,
      url: getFileUrl(attachment.filePath)
    })) as AttachmentWithDetails[];
  }

  static async deleteAttachment(id: string, userId: string): Promise<void> {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        bug: {
          include: {
            project: {
              include: {
                members: {
                  where: { userId },
                  include: { user: true }
                }
              }
            }
          }
        },
        comment: {
          include: {
            bug: {
              include: {
                project: {
                  include: {
                    members: {
                      where: { userId },
                      include: { user: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    // Determine which bug this attachment belongs to
    const bug = attachment.bug || attachment.comment?.bug;
    if (!bug) {
      throw new AppError('Could not determine bug ownership', 500);
    }

    const userMember = bug.project.members.find((m: any) => m.userId === userId);
    if (!userMember) {
      throw new AppError('You do not have permission to delete this attachment', 403);
    }

    // Only allow deletion by uploader, project managers, or admins
    const canDelete = attachment.uploadedById === userId ||
                     userMember.user.role === 'ADMIN' ||
                     userMember.user.role === 'PROJECT_MANAGER';

    if (!canDelete) {
      throw new AppError('You do not have permission to delete this attachment', 403);
    }

    // Delete file from storage
    await deleteFile(attachment.filePath);

    // Delete record from database
    await prisma.attachment.delete({
      where: { id }
    });

    // Create activity log
    if (attachment.bugId) {
      await prisma.activityLog.create({
        data: {
          bugId: attachment.bugId,
          userId,
          action: 'REMOVED_FILE',
          metadata: {
            filename: attachment.originalName,
            attachmentId: id
          }
        }
      });
    }
  }

  static async getFileStats(projectId: string, userId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
  }> {
    // Verify user has access to project
    const projectMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      }
    });

    if (!projectMember) {
      throw new AppError('You do not have permission to view this project', 403);
    }

    // Get all bugs in project
    const bugs = await prisma.bug.findMany({
      where: { projectId },
      select: { id: true }
    });

    const bugIds = bugs.map(b => b.id);

    // Get all attachments for these bugs
    const attachments = await prisma.attachment.findMany({
      where: {
        OR: [
          { bugId: { in: bugIds } },
          {
            comment: {
              bugId: { in: bugIds }
            }
          }
        ]
      },
      select: {
        fileSize: true,
        mimeType: true
      }
    });

    // Calculate stats
    const totalFiles = attachments.length;
    const totalSize = attachments.reduce((sum, att) => sum + att.fileSize, 0);
    
    const filesByType = attachments.reduce((acc, att) => {
      const type = att.mimeType.split('/')[0];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFiles,
      totalSize,
      filesByType
    };
  }
}
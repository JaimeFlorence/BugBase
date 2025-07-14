import { PrismaClient } from '@prisma/client';
import { Comment } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { BugService } from './bug.service';

const prisma = new PrismaClient();

interface CreateCommentData {
  bugId: string;
  content: string;
  parentId?: string;
}

interface UpdateCommentData {
  content: string;
}

interface CommentWithDetails extends Comment {
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
  };
  attachments: any[];
  mentions: any[];
  replies?: CommentWithDetails[];
  _count?: {
    replies: number;
  };
}

export class CommentService {
  static async createComment(data: CreateCommentData, userId: string): Promise<CommentWithDetails> {
    // Verify bug exists and user has permission
    const bug = await BugService.getBugById(data.bugId, userId);
    if (!bug) {
      throw new AppError('Bug not found or you do not have permission', 404);
    }

    // Verify parent comment exists if parentId is provided
    if (data.parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: data.parentId }
      });

      if (!parentComment) {
        throw new AppError('Parent comment not found', 404);
      }

      if (parentComment.bugId !== data.bugId) {
        throw new AppError('Parent comment does not belong to this bug', 400);
      }
    }

    // Extract mentions from content
    const mentions = this.extractMentions(data.content);

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        bugId: data.bugId,
        userId,
        content: data.content,
        parentId: data.parentId
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        attachments: true,
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        _count: {
          select: {
            replies: true
          }
        }
      }
    });

    // Create mentions
    if (mentions.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          username: {
            in: mentions
          }
        }
      });

      const mentionRecords = users.map(user => ({
        commentId: comment.id,
        mentionedUserId: user.id
      }));

      await prisma.mention.createMany({
        data: mentionRecords
      });

      // Create notifications for mentioned users
      const notifications = users
        .filter(user => user.id !== userId) // Don't notify self
        .map(user => ({
          userId: user.id,
          type: 'MENTION' as const,
          title: `You were mentioned in a comment`,
          message: `Someone mentioned you in a comment on bug #${bug.bugNumber}`,
          data: {
            bugId: bug.id,
            commentId: comment.id
          }
        }));

      await prisma.notification.createMany({
        data: notifications
      });
    }

    // Create activity log
    await prisma.activityLog.create({
      data: {
        bugId: data.bugId,
        userId,
        action: 'COMMENTED',
        metadata: { 
          commentId: comment.id,
          isReply: !!data.parentId 
        }
      }
    });

    // Add commenter as watcher if not already watching
    const existingWatcher = await prisma.bugWatcher.findUnique({
      where: {
        bugId_userId: {
          bugId: data.bugId,
          userId
        }
      }
    });

    if (!existingWatcher) {
      await prisma.bugWatcher.create({
        data: {
          bugId: data.bugId,
          userId
        }
      });
    }

    // Send notifications to watchers (except commenter)
    const watchers = await prisma.bugWatcher.findMany({
      where: {
        bugId: data.bugId,
        userId: {
          not: userId
        }
      },
      include: {
        user: true
      }
    });

    const watcherNotifications = watchers.map(watcher => ({
      userId: watcher.userId,
      type: 'COMMENT' as const,
      title: 'New comment on watched bug',
      message: `New comment on bug #${bug.bugNumber}: ${bug.title}`,
      data: {
        bugId: bug.id,
        commentId: comment.id
      }
    }));

    await prisma.notification.createMany({
      data: watcherNotifications
    });

    return comment as CommentWithDetails;
  }

  static async getComments(bugId: string, userId: string): Promise<CommentWithDetails[]> {
    // Verify bug exists and user has permission
    const bug = await BugService.getBugById(bugId, userId);
    if (!bug) {
      throw new AppError('Bug not found or you do not have permission', 404);
    }

    // Get all comments for the bug
    const comments = await prisma.comment.findMany({
      where: { 
        bugId,
        parentId: null // Only get top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true
              }
            },
            attachments: true,
            mentions: {
              include: {
                mentionedUser: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true
                  }
                }
              }
            },
            _count: {
              select: {
                replies: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            replies: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return comments as CommentWithDetails[];
  }

  static async getCommentById(id: string, userId: string): Promise<CommentWithDetails | null> {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        bug: true,
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        attachments: true,
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true
              }
            },
            attachments: true,
            mentions: {
              include: {
                mentionedUser: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true
                  }
                }
              }
            },
            _count: {
              select: {
                replies: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            replies: true
          }
        }
      }
    });

    if (!comment) {
      return null;
    }

    // Verify user has permission to view this comment's bug
    await BugService.getBugById(comment.bugId, userId);

    return comment as CommentWithDetails;
  }

  static async updateComment(id: string, data: UpdateCommentData, userId: string): Promise<CommentWithDetails> {
    // Get current comment
    const currentComment = await prisma.comment.findUnique({
      where: { id },
      include: { bug: true }
    });

    if (!currentComment) {
      throw new AppError('Comment not found', 404);
    }

    // Verify user has permission to view this bug
    await BugService.getBugById(currentComment.bugId, userId);

    // Only comment author can update their comment
    if (currentComment.userId !== userId) {
      throw new AppError('You can only edit your own comments', 403);
    }

    // Update the comment
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content: data.content,
        isEdited: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        attachments: true,
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        },
        _count: {
          select: {
            replies: true
          }
        }
      }
    });

    // Handle new mentions
    const oldMentions = await prisma.mention.findMany({
      where: { commentId: id },
      select: { mentionedUserId: true }
    });

    const oldMentionUserIds = oldMentions.map(m => m.mentionedUserId);
    const newMentions = this.extractMentions(data.content);

    if (newMentions.length > 0) {
      const users = await prisma.user.findMany({
        where: {
          username: {
            in: newMentions
          }
        }
      });

      const newMentionUserIds = users.map(u => u.id);
      const addedMentions = newMentionUserIds.filter(id => !oldMentionUserIds.includes(id));

      // Remove old mentions
      await prisma.mention.deleteMany({
        where: { commentId: id }
      });

      // Create new mentions
      const mentionRecords = users.map(user => ({
        commentId: id,
        mentionedUserId: user.id
      }));

      await prisma.mention.createMany({
        data: mentionRecords
      });

      // Notify newly mentioned users
      if (addedMentions.length > 0) {
        const notifications = addedMentions
          .filter(mentionedUserId => mentionedUserId !== userId)
          .map(mentionedUserId => ({
            userId: mentionedUserId,
            type: 'MENTION' as const,
            title: `You were mentioned in a comment`,
            message: `You were mentioned in an edited comment on bug #${currentComment.bug.bugNumber}`,
            data: {
              bugId: currentComment.bugId,
              commentId: id
            }
          }));

        await prisma.notification.createMany({
          data: notifications
        });
      }
    } else {
      // Remove all mentions if no new mentions
      await prisma.mention.deleteMany({
        where: { commentId: id }
      });
    }

    return updatedComment as CommentWithDetails;
  }

  static async deleteComment(id: string, userId: string): Promise<void> {
    // Get current comment
    const currentComment = await prisma.comment.findUnique({
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
        }
      }
    });

    if (!currentComment) {
      throw new AppError('Comment not found', 404);
    }

    // Verify user has permission to view this bug
    await BugService.getBugById(currentComment.bugId, userId);

    const userMember = currentComment.bug.project.members.find((m: any) => m.userId === userId);

    // Only comment author, project managers, or admins can delete comments
    const canDelete = currentComment.userId === userId ||
                     userMember?.user.role === 'ADMIN' ||
                     userMember?.user.role === 'PROJECT_MANAGER';

    if (!canDelete) {
      throw new AppError('You do not have permission to delete this comment', 403);
    }

    // Delete the comment (cascade will handle replies and related records)
    await prisma.comment.delete({
      where: { id }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        bugId: currentComment.bugId,
        userId,
        action: 'DELETED',
        metadata: { 
          description: 'Comment deleted',
          commentId: id 
        }
      }
    });
  }

  private static extractMentions(content: string): string[] {
    const mentionPattern = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionPattern.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }
}
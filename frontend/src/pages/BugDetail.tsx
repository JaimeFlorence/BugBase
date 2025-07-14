import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Clock,
  User,
  Calendar,
  Hash,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Paperclip,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Comment } from '@/components/Comment';
import bugService from '@/services/bug.service';
import commentService from '@/services/comment.service';
import attachmentService from '@/services/attachment.service';
import { useAuth } from '@/contexts/AuthContext';
import type { Bug, Comment as CommentType } from '@/types';

export default function BugDetail() {
  const { bugId } = useParams<{ bugId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [isWatching, setIsWatching] = useState(false);

  // Fetch bug details
  const { data: bug, isLoading: bugLoading, error: bugError } = useQuery({
    queryKey: ['bug', bugId],
    queryFn: () => bugService.getBugById(bugId!),
    enabled: !!bugId,
  });

  // Fetch comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['bug-comments', bugId],
    queryFn: () => commentService.getComments(bugId!),
    enabled: !!bugId,
  });

  // Fetch attachments
  const { data: attachments = [] } = useQuery({
    queryKey: ['bug-attachments', bugId],
    queryFn: () => attachmentService.getBugAttachments(bugId!),
    enabled: !!bugId,
  });

  // Check if user is watching
  useEffect(() => {
    if (bug && user) {
      setIsWatching(bug.watchers?.some(w => w.userId === user.id) || false);
    }
  }, [bug, user]);

  // Mutations
  const deleteBugMutation = useMutation({
    mutationFn: () => bugService.deleteBug(bugId!),
    onSuccess: () => {
      toast({
        title: 'Bug deleted',
        description: 'The bug has been successfully deleted.',
        type: 'success',
      });
      navigate('/bugs');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete the bug.',
        type: 'error',
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      commentService.createComment(bugId!, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-comments', bugId] });
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
      setNewComment('');
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted.',
        type: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add comment.',
        type: 'error',
      });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      commentService.updateComment(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-comments', bugId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => commentService.deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-comments', bugId] });
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
    },
  });

  const toggleWatchMutation = useMutation({
    mutationFn: () => {
      if (isWatching) {
        return bugService.removeWatcher(bugId!, user!.id);
      } else {
        return bugService.addWatcher(bugId!, user!.id);
      }
    },
    onSuccess: () => {
      setIsWatching(!isWatching);
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
    },
  });

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  const handleEditComment = async (id: string, content: string) => {
    await updateCommentMutation.mutateAsync({ id, content });
  };

  const handleDeleteComment = async (id: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      await deleteCommentMutation.mutateAsync(id);
    }
  };

  const handleReplyComment = async (parentId: string, content: string) => {
    await commentService.createComment(bugId!, { content, parentId });
    queryClient.invalidateQueries({ queryKey: ['bug-comments', bugId] });
  };

  if (bugLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (bugError || !bug) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load bug details.</p>
        <Button onClick={() => navigate('/bugs')} className="mt-4">
          Back to Bugs
        </Button>
      </div>
    );
  }

  const bugReference = `${bug.project?.key || 'BUG'}-${bug.bugNumber}`;
  const canEdit = user?.id === bug.reporterId || user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/bugs"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bugs
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-gray-500">{bugReference}</span>
              <StatusBadge status={bug.status} />
            </div>
            <h1 className="text-2xl font-bold">{bug.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleWatchMutation.mutate()}
              disabled={toggleWatchMutation.isPending}
            >
              {isWatching ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Unwatch
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Watch
                </>
              )}
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/bugs/${bugId}/edit`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this bug?')) {
                    deleteBugMutation.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">Description</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {bug.description}
            </div>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Attachments ({attachments.length})
              </h2>
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium">{attachment.originalName}</p>
                        <p className="text-xs text-gray-500">
                          {attachmentService.formatFileSize(attachment.fileSize)} •{' '}
                          {formatDistanceToNow(new Date(attachment.uploadedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        attachmentService.downloadAttachment(attachment.id, attachment.originalName)
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">
              Comments ({comments.length})
            </h2>

            {/* Add comment form */}
            <div className="mb-6">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="mb-2"
              />
              <div className="flex justify-end gap-2">
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Comment
                </Button>
              </div>
            </div>

            {/* Comments list */}
            {commentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No comments yet</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <Comment
                    key={comment.id}
                    comment={comment}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                    onReply={handleReplyComment}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <dl className="space-y-4">
              {/* Priority */}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Priority
                </dt>
                <dd>
                  <PriorityBadge priority={bug.priority} showIcon />
                </dd>
              </div>

              {/* Severity */}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Severity
                </dt>
                <dd>
                  <SeverityBadge severity={bug.severity} showIcon />
                </dd>
              </div>

              {/* Reporter */}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Reporter
                </dt>
                <dd className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {bug.reporter?.fullName || bug.reporter?.username}
                  </span>
                </dd>
              </div>

              {/* Assignee */}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Assignee
                </dt>
                <dd className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {bug.assignee
                      ? bug.assignee.fullName || bug.assignee.username
                      : 'Unassigned'}
                  </span>
                </dd>
              </div>

              {/* Created */}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Created
                </dt>
                <dd className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}
                  </span>
                </dd>
              </div>

              {/* Due Date */}
              {bug.dueDate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Due Date
                  </dt>
                  <dd className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {new Date(bug.dueDate).toLocaleDateString()}
                    </span>
                  </dd>
                </div>
              )}

              {/* Estimated Hours */}
              {bug.estimatedHours && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Estimated Hours
                  </dt>
                  <dd className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{bug.estimatedHours}h</span>
                  </dd>
                </div>
              )}

              {/* Environment */}
              {bug.environment && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Environment
                  </dt>
                  <dd className="text-sm">{bug.environment}</dd>
                </div>
              )}

              {/* Version Found */}
              {bug.versionFound && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Version Found
                  </dt>
                  <dd className="text-sm">{bug.versionFound}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Watchers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Watchers ({bug._count?.watchers || 0})
            </h2>
            {bug.watchers && bug.watchers.length > 0 ? (
              <div className="space-y-2">
                {bug.watchers.map((watcher) => (
                  <div key={watcher.userId} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {watcher.user?.fullName?.charAt(0) || watcher.user?.username?.charAt(0) || '?'}
                      </span>
                    </div>
                    <span className="text-sm">
                      {watcher.user?.fullName || watcher.user?.username}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No watchers yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
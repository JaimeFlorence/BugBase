import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Edit2, Trash2, Paperclip, MoreVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import type { Comment as CommentType } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface CommentProps {
  comment: CommentType;
  onEdit?: (id: string, content: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onReply?: (parentId: string, content: string) => Promise<void>;
  level?: number;
  maxLevel?: number;
}

export function Comment({
  comment,
  onEdit,
  onDelete,
  onReply,
  level = 0,
  maxLevel = 3
}: CommentProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const canEdit = user?.id === comment.userId;
  const canDelete = canEdit || user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
  const canReply = level < maxLevel;

  const handleEdit = async () => {
    if (onEdit && editContent.trim() !== comment.content) {
      await onEdit(comment.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleReply = async () => {
    if (onReply && replyContent.trim()) {
      await onReply(comment.id, replyContent.trim());
      setReplyContent('');
      setIsReplying(false);
    }
  };

  const renderContent = (text: string) => {
    // Simple mention highlighting
    return text.split(/(@\w+)/g).map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-primary font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn('flex gap-3', level > 0 && 'ml-12')}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-medium">
            {comment.user?.fullName?.charAt(0) || comment.user?.username?.charAt(0) || '?'}
          </span>
        </div>
      </div>

      {/* Comment body */}
      <div className="flex-1 space-y-2">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {comment.user?.fullName || comment.user?.username}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
              {comment.isEdited && (
                <span className="text-gray-500 dark:text-gray-400 italic">(edited)</span>
              )}
            </div>

            {/* Actions menu */}
            {(canEdit || canDelete) && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {showMenu && (
                  <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                    {canEdit && (
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                    )}
                    {canDelete && onDelete && (
                      <button
                        onClick={() => {
                          onDelete(comment.id);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEdit}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap">{renderContent(comment.content)}</div>
          )}

          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Paperclip className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-500">
                {comment.attachments.length} attachment{comment.attachments.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Reply button */}
        {canReply && onReply && (
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <MessageSquare className="h-3 w-3" />
            Reply
          </button>
        )}

        {/* Reply form */}
        {isReplying && (
          <div className="space-y-2 mt-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleReply}>
                Reply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsReplying(false);
                  setReplyContent('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-3 mt-3">
            {comment.replies.map((reply) => (
              <Comment
                key={reply.id}
                comment={reply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                level={level + 1}
                maxLevel={maxLevel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
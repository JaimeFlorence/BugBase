import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Clock, MessageSquare, Paperclip, Eye, User } from 'lucide-react';
import type { Bug } from '../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { SeverityBadge } from './SeverityBadge';
import { cn } from '../lib/utils';

interface BugCardProps {
  bug: Bug;
  projectKey?: string;
  className?: string;
}

export function BugCard({ bug, projectKey, className }: BugCardProps) {
  const bugReference = `${projectKey || bug.project?.key || 'BUG'}-${bug.bugNumber}`;
  
  return (
    <Link
      to={`/bugs/${bug.id}`}
      className={cn(
        'block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
        'hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow',
        className
      )}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span className="font-mono font-medium">{bugReference}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true })}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {bug.title}
            </h3>
          </div>
          <StatusBadge status={bug.status} />
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {bug.description}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={bug.priority} />
          <SeverityBadge severity={bug.severity} />
          {bug.labels?.map((bugLabel) => (
            <span
              key={bugLabel.labelId}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${bugLabel.label?.color}20`,
                color: bugLabel.label?.color
              }}
            >
              {bugLabel.label?.name}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
            {/* Reporter */}
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>{bug.reporter?.fullName || bug.reporter?.username}</span>
            </div>

            {/* Assignee */}
            {bug.assignee && (
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>{bug.assignee.fullName || bug.assignee.username}</span>
              </div>
            )}

            {/* Due date */}
            {bug.dueDate && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(bug.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Counts */}
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            {bug._count?.comments ? (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{bug._count.comments}</span>
              </div>
            ) : null}
            
            {bug._count?.attachments ? (
              <div className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                <span>{bug._count.attachments}</span>
              </div>
            ) : null}
            
            {bug._count?.watchers ? (
              <div className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                <span>{bug._count.watchers}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
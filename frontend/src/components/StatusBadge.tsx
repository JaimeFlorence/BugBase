import { cn } from '../lib/utils';
import { BugStatus } from '../types';

interface StatusBadgeProps {
  status: BugStatus;
  className?: string;
}

const statusConfig = {
  [BugStatus.NEW]: {
    label: 'New',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  },
  [BugStatus.IN_PROGRESS]: {
    label: 'In Progress',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  [BugStatus.TESTING]: {
    label: 'Testing',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  },
  [BugStatus.RESOLVED]: {
    label: 'Resolved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  [BugStatus.CLOSED]: {
    label: 'Closed',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  },
  [BugStatus.REOPENED]: {
    label: 'Reopened',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
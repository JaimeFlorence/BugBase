import { cn } from '../lib/utils';
import { BugPriority } from '../types';
import { AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface PriorityBadgeProps {
  priority: BugPriority;
  showIcon?: boolean;
  className?: string;
}

const priorityConfig = {
  [BugPriority.CRITICAL]: {
    label: 'Critical',
    icon: AlertCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  [BugPriority.HIGH]: {
    label: 'High',
    icon: ArrowUp,
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
  },
  [BugPriority.MEDIUM]: {
    label: 'Medium',
    icon: Minus,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  [BugPriority.LOW]: {
    label: 'Low',
    icon: ArrowDown,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  }
};

export function PriorityBadge({ priority, showIcon = false, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
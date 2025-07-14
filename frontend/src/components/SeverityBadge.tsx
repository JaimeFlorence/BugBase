import { cn } from '../lib/utils';
import { BugSeverity } from '../types';
import { Ban, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface SeverityBadgeProps {
  severity: BugSeverity;
  showIcon?: boolean;
  className?: string;
}

const severityConfig = {
  [BugSeverity.BLOCKER]: {
    label: 'Blocker',
    icon: Ban,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  },
  [BugSeverity.MAJOR]: {
    label: 'Major',
    icon: AlertTriangle,
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
  },
  [BugSeverity.MINOR]: {
    label: 'Minor',
    icon: AlertCircle,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  },
  [BugSeverity.TRIVIAL]: {
    label: 'Trivial',
    icon: Info,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  }
};

export function SeverityBadge({ severity, showIcon = false, className }: SeverityBadgeProps) {
  const config = severityConfig[severity];
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
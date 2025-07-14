// User types
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  timezone: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const UserRole = {
  ADMIN: 'ADMIN',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  DEVELOPER: 'DEVELOPER',
  QA_TESTER: 'QA_TESTER',
  REPORTER: 'REPORTER',
  GUEST: 'GUEST'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

// Project types
export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  icon?: string;
  isPublic: boolean;
  ownerId: string;
  owner?: User;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
  _count?: {
    bugs: number;
    members: number;
  };
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user?: User;
  role: ProjectRole;
  joinedAt: string;
}

export const ProjectRole = {
  ADMIN: 'ADMIN',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  DEVELOPER: 'DEVELOPER',
  QA_TESTER: 'QA_TESTER',
  VIEWER: 'VIEWER'
} as const;

export type ProjectRole = typeof ProjectRole[keyof typeof ProjectRole];

// Bug types
export interface Bug {
  id: string;
  projectId: string;
  project?: Project;
  bugNumber: number;
  title: string;
  description: string;
  status: BugStatus;
  priority: BugPriority;
  severity: BugSeverity;
  reporterId: string;
  reporter?: User;
  assigneeId?: string;
  assignee?: User;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  versionFound?: string;
  versionFixed?: string;
  environment?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  milestoneId?: string;
  milestone?: Milestone;
  labels?: BugLabel[];
  watchers?: BugWatcher[];
  _count?: {
    comments: number;
    attachments: number;
    watchers: number;
  };
}

export const BugStatus = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  TESTING: 'TESTING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED'
} as const;

export type BugStatus = typeof BugStatus[keyof typeof BugStatus];

export const BugPriority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
} as const;

export type BugPriority = typeof BugPriority[keyof typeof BugPriority];

export const BugSeverity = {
  BLOCKER: 'BLOCKER',
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  TRIVIAL: 'TRIVIAL'
} as const;

export type BugSeverity = typeof BugSeverity[keyof typeof BugSeverity];

// Comment types
export interface Comment {
  id: string;
  bugId: string;
  bug?: Bug;
  userId: string;
  user?: User;
  content: string;
  parentId?: string;
  parent?: Comment;
  replies?: Comment[];
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  mentions?: Mention[];
  _count?: {
    replies: number;
  };
}

// Attachment types
export interface Attachment {
  id: string;
  bugId?: string;
  bug?: Bug;
  commentId?: string;
  comment?: Comment;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedBy?: User;
  uploadedAt: string;
  url?: string;
}

// Label types
export interface Label {
  id: string;
  name: string;
  color: string;
  projectId: string;
  project?: Project;
  createdAt: string;
}

export interface BugLabel {
  bugId: string;
  labelId: string;
  label?: Label;
}

// Milestone types
export interface Milestone {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  project?: Project;
  dueDate?: string;
  status: MilestoneStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    bugs: number;
  };
}

export const MilestoneStatus = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;

export type MilestoneStatus = typeof MilestoneStatus[keyof typeof MilestoneStatus];

// Notification types
export interface Notification {
  id: string;
  userId: string;
  user?: User;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export const NotificationType = {
  BUG_ASSIGNED: 'BUG_ASSIGNED',
  BUG_STATUS_CHANGED: 'BUG_STATUS_CHANGED',
  COMMENT: 'COMMENT',
  MENTION: 'MENTION',
  BUG_DUE: 'BUG_DUE',
  PROJECT_INVITE: 'PROJECT_INVITE'
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

// Activity Log types
export interface ActivityLog {
  id: string;
  bugId?: string;
  bug?: Bug;
  projectId?: string;
  project?: Project;
  userId: string;
  user?: User;
  action: ActivityAction;
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const ActivityAction = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  ASSIGNED: 'ASSIGNED',
  COMMENTED: 'COMMENTED',
  ATTACHED_FILE: 'ATTACHED_FILE',
  REMOVED_FILE: 'REMOVED_FILE',
  LABELED: 'LABELED',
  UNLABELED: 'UNLABELED',
  MILESTONE_SET: 'MILESTONE_SET',
  MILESTONE_REMOVED: 'MILESTONE_REMOVED'
} as const;

export type ActivityAction = typeof ActivityAction[keyof typeof ActivityAction];

// Mention types
export interface Mention {
  id: string;
  commentId: string;
  comment?: Comment;
  mentionedUserId: string;
  mentionedUser?: User;
  createdAt: string;
}

// Bug Watcher types
export interface BugWatcher {
  bugId: string;
  userId: string;
  user?: User;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

// Filter types
export interface BugFilters {
  projectId?: string;
  status?: BugStatus;
  priority?: BugPriority;
  severity?: BugSeverity;
  assigneeId?: string;
  reporterId?: string;
  search?: string;
  milestoneId?: string;
  labels?: string[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Statistics types
export interface BugStatistics {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
  closed: number;
  open: number;
}

export interface FileStatistics {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
}

// Form types
export interface CreateBugData {
  projectId: string;
  title: string;
  description: string;
  priority?: BugPriority;
  severity?: BugSeverity;
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  versionFound?: string;
  environment?: string;
  customFields?: Record<string, any>;
}

export interface UpdateBugData {
  title?: string;
  description?: string;
  status?: BugStatus;
  priority?: BugPriority;
  severity?: BugSeverity;
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  versionFound?: string;
  versionFixed?: string;
  environment?: string;
  customFields?: Record<string, any>;
}

export interface CreateCommentData {
  content: string;
  parentId?: string;
}

export interface UpdateCommentData {
  content: string;
}
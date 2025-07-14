-- Performance optimization indexes for BugBase

-- Composite index for common bug filtering patterns
CREATE INDEX IF NOT EXISTS "Bug_projectId_status_priority_assigneeId_idx" 
ON "Bug" ("projectId", "status", "priority", "assigneeId");

-- Index for comment queries with parent/child relationships
CREATE INDEX IF NOT EXISTS "Comment_bugId_parentId_createdAt_idx" 
ON "Comment" ("bugId", "parentId", "createdAt");

-- Composite index for activity log queries
CREATE INDEX IF NOT EXISTS "ActivityLog_bugId_action_createdAt_idx" 
ON "ActivityLog" ("bugId", "action", "createdAt");

-- Index for notification queries by user and read status
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" 
ON "Notification" ("userId", "isRead", "createdAt");

-- Index for bug text search (if not using full-text search)
CREATE INDEX IF NOT EXISTS "Bug_title_idx" 
ON "Bug" USING gin(to_tsvector('english', "title"));

CREATE INDEX IF NOT EXISTS "Bug_description_idx" 
ON "Bug" USING gin(to_tsvector('english', "description"));

-- Index for project member lookups
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_projectId_idx" 
ON "ProjectMember" ("userId", "projectId");

-- Index for bug watcher lookups
CREATE INDEX IF NOT EXISTS "BugWatcher_userId_bugId_idx" 
ON "BugWatcher" ("userId", "bugId");

-- Analyze tables to update statistics after adding indexes
ANALYZE "Bug";
ANALYZE "Comment";
ANALYZE "ActivityLog";
ANALYZE "Notification";
ANALYZE "ProjectMember";
ANALYZE "BugWatcher";
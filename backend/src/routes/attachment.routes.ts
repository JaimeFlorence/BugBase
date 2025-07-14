import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AttachmentController } from '../controllers/attachment.controller';
import { upload } from '../config/storage';

const router = Router();

router.use(authenticate);

// Upload attachments
router.post('/upload', upload.array('files', 10), AttachmentController.uploadAttachments);

// Get attachment info
router.get('/storage-info', AttachmentController.getStorageInfo);
router.get('/:id', AttachmentController.getAttachment);
router.get('/:id/download', AttachmentController.downloadAttachment);

// Delete attachment
router.delete('/:id', AttachmentController.deleteAttachment);

// Bug attachments
router.get('/bugs/:bugId/attachments', AttachmentController.getBugAttachments);

// Comment attachments
router.get('/comments/:commentId/attachments', AttachmentController.getCommentAttachments);

// Project file stats
router.get('/projects/:projectId/file-stats', AttachmentController.getProjectFileStats);

export default router;
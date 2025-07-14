import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CommentController } from '../controllers/comment.controller';

const router = Router();

router.use(authenticate);

// Comment CRUD operations
router.post('/bugs/:bugId/comments', CommentController.createComment);
router.get('/bugs/:bugId/comments', CommentController.getComments);
router.get('/comments/:id', CommentController.getCommentById);
router.put('/comments/:id', CommentController.updateComment);
router.delete('/comments/:id', CommentController.deleteComment);

// Comment replies
router.get('/comments/:id/replies', CommentController.getCommentReplies);

export default router;
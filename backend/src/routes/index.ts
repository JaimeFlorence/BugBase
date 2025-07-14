import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import projectRoutes from './project.routes';
import bugRoutes from './bug.routes';
import commentRoutes from './comment.routes';
import attachmentRoutes from './attachment.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/bugs', bugRoutes);
router.use('/', commentRoutes); // Comment routes are nested under bugs
router.use('/attachments', attachmentRoutes);

export default router;
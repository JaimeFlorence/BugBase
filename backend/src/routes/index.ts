import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import projectRoutes from './project.routes';
import bugRoutes from './bug.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/bugs', bugRoutes);

export default router;
import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// TODO: Implement project routes
router.get('/', (req, res) => {
  res.json({ message: 'Projects list' });
});

export default router;
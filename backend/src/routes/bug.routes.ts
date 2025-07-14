import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// TODO: Implement bug routes
router.get('/', (req, res) => {
  res.json({ message: 'Bugs list' });
});

export default router;
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { BugController } from '../controllers/bug.controller';

const router = Router();

router.use(authenticate);

// Bug CRUD operations
router.post('/', BugController.createBug);
router.get('/', BugController.getBugs);
router.get('/statistics', BugController.getBugStatistics);
router.get('/:id', BugController.getBugById);
router.put('/:id', BugController.updateBug);
router.delete('/:id', BugController.deleteBug);

// Bug watchers
router.post('/:id/watchers', BugController.addWatcher);
router.delete('/:id/watchers', BugController.removeWatcher);

export default router;
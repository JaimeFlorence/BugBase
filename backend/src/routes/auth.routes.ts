import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { strictRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', strictRateLimiter, AuthController.register);
router.post('/login', strictRateLimiter, AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh', AuthController.refreshToken);
router.post('/reset-password-request', strictRateLimiter, AuthController.resetPasswordRequest);
router.post('/reset-password', strictRateLimiter, AuthController.resetPassword);

export default router;
import { Router } from 'express';
import { login, changePassword } from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/login', loginRateLimiter, asyncHandler(login));
router.post('/change-password', auth(), asyncHandler(changePassword));

export default router;

import express from 'express';
import { loginAdmin, logoutAdmin, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/login', authLimiter, loginAdmin);
router.post('/logout', protect, logoutAdmin);
router.get('/me', protect, getMe);

export default router;

import express from 'express';
import {
  submitContact,
  getContacts,
  markAsRead,
  deleteContact,
  testEmail,
} from '../controllers/contactController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// 🧪 DEBUG — remove this line after email works
router.get('/test-email', testEmail);

// Public — client submits form (rate-limited to prevent spam)
router.post('/', authLimiter, submitContact);

// Private — admin reads messages
router.get('/', protect, getContacts);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteContact);

export default router;
import express from 'express';
import {
  submitContact,
  getContacts,
  markAsRead,
  deleteContact,
  testNotifications,
} from '../controllers/contactController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Admin-only diagnostics: sends test messages through both configured providers.
router.post('/test-notifications', protect, testNotifications);

// Public — client submits form (rate-limited to prevent spam)
router.post('/', authLimiter, submitContact);

// Private — admin reads messages
router.get('/', protect, getContacts);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteContact);

export default router;
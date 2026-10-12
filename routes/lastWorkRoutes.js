import express from 'express';
import {
  getLastWorks, getLastWorkById, createLastWork, updateLastWork, deleteLastWork,
} from '../controllers/lastWorkController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadLastWorkImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getLastWorks);
router.get('/:id', protect, getLastWorkById);
router.post('/', protect, uploadLastWorkImage.single('image'), createLastWork);
router.put('/:id', protect, uploadLastWorkImage.single('image'), updateLastWork);
router.delete('/:id', protect, deleteLastWork);

export default router;

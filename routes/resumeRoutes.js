import express from 'express';
import { getResume, getResumeFile, uploadResume, updateResume, deleteResume } from '../controllers/resumeController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadResume as uploadResumeMiddleware } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getResume);
router.get('/:id/file', getResumeFile);
router.post('/upload', protect, uploadResumeMiddleware.single('resume'), uploadResume);
router.put('/:id', protect, uploadResumeMiddleware.single('resume'), updateResume);
router.delete('/:id', protect, deleteResume);

export default router;

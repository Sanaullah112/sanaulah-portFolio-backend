import express from 'express';
import {
  getTestimonials, getTestimonialById, createTestimonial, updateTestimonial, deleteTestimonial,
} from '../controllers/testimonialController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadTestimonialImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getTestimonials);
router.get('/:id', protect, getTestimonialById);
router.post('/', protect, uploadTestimonialImage.single('image'), createTestimonial);
router.put('/:id', protect, uploadTestimonialImage.single('image'), updateTestimonial);
router.delete('/:id', protect, deleteTestimonial);

export default router;

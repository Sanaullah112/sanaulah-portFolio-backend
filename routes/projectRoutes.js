import express from 'express';
import {
  getProjects, getProjectById, getProjectImage, createProject, updateProject, deleteProject,
  getAllProjects,
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadProjectImage } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// router.get('/all', getAllProjects);
router.get('/', getProjects);
router.get('/:id/image', getProjectImage);
router.get('/:id', protect, getProjectById);
router.post('/', protect, uploadProjectImage.single('image'), createProject);
router.put('/:id', protect, uploadProjectImage.single('image'), updateProject);
router.delete('/:id', protect, deleteProject);

export default router;

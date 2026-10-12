import mongoose from 'mongoose';
import { PROJECT_CATEGORIES } from '../config/constants.js';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: PROJECT_CATEGORIES },
    description: { type: String, required: true, maxlength: 1000 },
    technologies: { type: [String], default: [] },
    imageUrl: { type: String, required: true },
    imagePath: { type: String, required: true },
    githubUrl: { type: String, default: '' },
    liveUrl: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

projectSchema.index({ name: 'text', description: 'text' });

const Project = mongoose.model('Project', projectSchema);
export default Project;

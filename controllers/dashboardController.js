import asyncHandler from 'express-async-handler';
import Project from '../models/Project.js';
import Testimonial from '../models/Testimonial.js';
import LastWork from '../models/LastWork.js';
import Resume from '../models/Resume.js';

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [projectsCount, testimonialsCount, lastWorkCount, resume] = await Promise.all([
    Project.countDocuments(),
    Testimonial.countDocuments(),
    LastWork.countDocuments(),
    Resume.findOne(),
  ]);

  res.status(200).json({
    success: true,
    projectsCount,
    testimonialsCount,
    lastWorkCount,
    resumeUploaded: !!resume,
  });
});

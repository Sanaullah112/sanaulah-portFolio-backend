import asyncHandler from 'express-async-handler';
import Project from '../models/Project.js';
import { buildFileUrl, deleteFileIfExists } from '../utils/fileHelper.js';

// @desc    Get all projects (search, category filter, pagination)
// @route   GET /api/projects
// @access  Private

export const getAllProjects = async (req, res) => {
  try {
     
    const projects = await Project.find();
    res.status(200).json({ success: true, data: projects });
  }catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }

}

export const getProjects = asyncHandler(async (req, res) => {
  const { search = '', category = '', page = 1, limit = 10 } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  if (category) query.category = category;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [data, totalCount] = await Promise.all([
    Project.find(query).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limitNum),
    Project.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data,
    page: pageNum,
    totalPages: Math.ceil(totalCount / limitNum) || 1,
    totalCount,
  });
});

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }
  res.status(200).json({ success: true, data: project });
});

// @desc    Create project
// @route   POST /api/projects
// @access  Private
export const createProject = asyncHandler(async (req, res) => {
  const { name, category, description, technologies, githubUrl, liveUrl, featured, displayOrder } = req.body;

  if (!req.file) {
    res.status(400);
    throw new Error('Project image is required');
  }
  if (!name || !category || !description) {
    res.status(400);
    throw new Error('Name, category and description are required');
  }

  const project = await Project.create({
    name,
    category,
    description,
    technologies: technologies ? technologies.split(',').map((t) => t.trim()).filter(Boolean) : [],
    githubUrl,
    liveUrl,
    featured: featured === 'true' || featured === true,
    displayOrder: Number(displayOrder) || 0,
    imageUrl: buildFileUrl(req, req.file.path),
    imagePath: req.file.path,
  });

  res.status(201).json({ success: true, message: 'Project added successfully', data: project });
});

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
export const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const { name, category, description, technologies, githubUrl, liveUrl, featured, displayOrder } = req.body;

  if (name) project.name = name;
  if (category) project.category = category;
  if (description) project.description = description;
  if (technologies !== undefined) {
    project.technologies = technologies.split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (githubUrl !== undefined) project.githubUrl = githubUrl;
  if (liveUrl !== undefined) project.liveUrl = liveUrl;
  if (featured !== undefined) project.featured = featured === 'true' || featured === true;
  if (displayOrder !== undefined) project.displayOrder = Number(displayOrder);

  if (req.file) {
    deleteFileIfExists(project.imagePath);
    project.imageUrl = buildFileUrl(req, req.file.path);
    project.imagePath = req.file.path;
  }

  await project.save();

  res.status(200).json({ success: true, message: 'Project updated successfully', data: project });
});

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
export const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  deleteFileIfExists(project.imagePath);
  await project.deleteOne();

  res.status(200).json({ success: true, message: 'Project deleted successfully' });
});

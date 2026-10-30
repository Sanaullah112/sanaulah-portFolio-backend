import asyncHandler from 'express-async-handler';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Project from '../models/Project.js';
import { deleteFileIfExists, getUploadsDir } from '../utils/fileHelper.js';

const sanitizeProject = (project) => {
  if (!project) return project;
  const p = project.toObject ? project.toObject() : { ...project };
  p.imageUrl = `/api/projects/${p._id}/image`;
  delete p.imageData;
  return p;
};

const readLegacyProjectImage = async (imagePath) => {
  if (typeof imagePath !== 'string' || !imagePath) return null;

  const match = imagePath.replace(/\\/g, '/').match(
    /(?:^|\/)uploads\/projects\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif))$/i
  );
  if (!match) return null;

  const filename = match[1];
  const candidates = new Set([
    path.join(getUploadsDir(), 'projects', filename),
    path.resolve(process.cwd(), 'uploads', 'projects', filename),
    path.resolve(getUploadsDir(), '..', '..', 'uploads', 'projects', filename),
  ]);

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return null;
};

const getImageMimeType = (project) => {
  if (project.imageMimeType) return project.imageMimeType;
  const extension = path.extname(project.imagePath || '').toLowerCase();
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[extension] || 'application/octet-stream';
};

export const getProjectImage = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).select('+imageData');
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const imageData = project.imageData || await readLegacyProjectImage(project.imagePath);
  if (!imageData) {
    res.status(404);
    throw new Error('Project image is unavailable. Please upload it again from the admin panel.');
  }

  res
    .type(getImageMimeType(project))
    .set('Cache-Control', 'no-store')
    .send(imageData);
});

// @desc    Get all projects (search, category filter, pagination)
// @route   GET /api/projects
// @access  Private

export const getAllProjects = async (req, res) => {
  try {
     
    const projects = await Project.find();
    res.status(200).json({ success: true, data: projects.map(sanitizeProject) });
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
    data: data.map(sanitizeProject),
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
  res.status(200).json({ success: true, data: sanitizeProject(project) });
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

  const project = new Project({
    name,
    category,
    description,
    technologies: technologies ? technologies.split(',').map((t) => t.trim()).filter(Boolean) : [],
    githubUrl,
    liveUrl,
    featured: featured === 'true' || featured === true,
    displayOrder: Number(displayOrder) || 0,
    imageUrl: '',
    imagePath: '',
    imageData: req.file.buffer,
    imageMimeType: req.file.mimetype,
  });
  project.imageUrl = `/api/projects/${project._id}/image`;
  await project.save();

  res.status(201).json({ success: true, message: 'Project added successfully', data: sanitizeProject(project) });
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

  const previousImagePath = req.file ? project.imagePath : '';
  if (req.file) {
    project.imageData = req.file.buffer;
    project.imageMimeType = req.file.mimetype;
    project.imagePath = '';
    project.imageUrl = `/api/projects/${project._id}/image`;
  }

  await project.save();
  if (previousImagePath) deleteFileIfExists(previousImagePath);

  res.status(200).json({ success: true, message: 'Project updated successfully', data: sanitizeProject(project) });
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

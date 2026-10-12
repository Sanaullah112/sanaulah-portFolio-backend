import asyncHandler from 'express-async-handler';
import LastWork from '../models/LastWork.js';
import { buildFileUrl, deleteFileIfExists } from '../utils/fileHelper.js';

// @desc    Get all last work items (search, pagination)
// @route   GET /api/last-work
// @access  Private
export const getLastWorks = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 10 } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [data, totalCount] = await Promise.all([
    LastWork.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    LastWork.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data,
    page: pageNum,
    totalPages: Math.ceil(totalCount / limitNum) || 1,
    totalCount,
  });
});

// @desc    Get single last work item
// @route   GET /api/last-work/:id
// @access  Private
export const getLastWorkById = asyncHandler(async (req, res) => {
  const item = await LastWork.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Last work item not found');
  }
  res.status(200).json({ success: true, data: item });
});

// @desc    Create last work item
// @route   POST /api/last-work
// @access  Private
export const createLastWork = asyncHandler(async (req, res) => {
  const { title, category, description, githubLink } = req.body;

  if (!req.file) {
    res.status(400);
    throw new Error('Image is required');
  }
  if (!title || !category || !description) {
    res.status(400);
    throw new Error('Title, category and description are required');
  }

  const item = await LastWork.create({
    title,
    category,
    description,
    githubLink,
    imageUrl: buildFileUrl(req, req.file.path),
    imagePath: req.file.path,
  });

  res.status(201).json({ success: true, message: 'Last work added successfully', data: item });
});

// @desc    Update last work item
// @route   PUT /api/last-work/:id
// @access  Private
export const updateLastWork = asyncHandler(async (req, res) => {
  const item = await LastWork.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Last work item not found');
  }

  const { title, category, description, githubLink } = req.body;

  if (title) item.title = title;
  if (category) item.category = category;
  if (description) item.description = description;
  if (githubLink) item.githubLink = githubLink;

  if (req.file) {
    deleteFileIfExists(item.imagePath);
    item.imageUrl = buildFileUrl(req, req.file.path);
    item.imagePath = req.file.path;
  }

  await item.save();

  res.status(200).json({ success: true, message: 'Last work updated successfully', data: item });
});

// @desc    Delete last work item
// @route   DELETE /api/last-work/:id
// @access  Private
export const deleteLastWork = asyncHandler(async (req, res) => {
  const item = await LastWork.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Last work item not found');
  }

  deleteFileIfExists(item.imagePath);
  await item.deleteOne();

  res.status(200).json({ success: true, message: 'Last work deleted successfully' });
});

import asyncHandler from 'express-async-handler';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import LastWork from '../models/LastWork.js';
import { deleteFileIfExists, getUploadsDir } from '../utils/fileHelper.js';

const sanitizeLastWork = (item) => {
  if (!item) return item;
  const i = item.toObject ? item.toObject() : { ...item };
  i.imageUrl = `/api/last-work/${i._id}/image`;
  delete i.imageData;
  return i;
};

const readLegacyImage = async (imagePath) => {
  if (typeof imagePath !== 'string' || !imagePath) return null;

  const match = imagePath.replace(/\\/g, '/').match(
    /(?:^|\/)lastwork\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif))$/i
  );
  if (!match) return null;

  const filename = match[1];
  const candidates = new Set([
    path.join(getUploadsDir(), 'lastwork', filename),
    path.resolve(process.cwd(), 'uploads', 'lastwork', filename),
    path.resolve(getUploadsDir(), '..', '..', 'uploads', 'lastwork', filename),
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

const getImageMimeType = (item) => {
  if (item.imageMimeType) return item.imageMimeType;
  const extension = path.extname(item.imagePath || '').toLowerCase();
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[extension] || 'application/octet-stream';
};

export const getLastWorkImage = asyncHandler(async (req, res) => {
  const item = await LastWork.findById(req.params.id).select('+imageData');
  if (!item) {
    res.status(404);
    throw new Error('Last work item not found');
  }

  const imageData = item.imageData || await readLegacyImage(item.imagePath);
  if (!imageData) {
    res.status(404);
    throw new Error('Last work image is unavailable. Please upload it again from the admin panel.');
  }

  res
    .type(getImageMimeType(item))
    .set('Cache-Control', 'no-store')
    .send(imageData);
});

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
    data: data.map(sanitizeLastWork),
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
  res.status(200).json({ success: true, data: sanitizeLastWork(item) });
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

  const item = new LastWork({
    title,
    category,
    description,
    githubLink,
    imageUrl: '',
    imagePath: '',
    imageData: req.file.buffer,
    imageMimeType: req.file.mimetype,
  });
  item.imageUrl = `/api/last-work/${item._id}/image`;
  await item.save();

  res.status(201).json({ success: true, message: 'Last work added successfully', data: sanitizeLastWork(item) });
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

  const previousImagePath = req.file ? item.imagePath : '';
  if (req.file) {
    item.imageData = req.file.buffer;
    item.imageMimeType = req.file.mimetype;
    item.imagePath = '';
    item.imageUrl = `/api/last-work/${item._id}/image`;
  }

  await item.save();
  if (previousImagePath) deleteFileIfExists(previousImagePath);

  res.status(200).json({ success: true, message: 'Last work updated successfully', data: sanitizeLastWork(item) });
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

import asyncHandler from 'express-async-handler';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Testimonial from '../models/Testimonial.js';
import { deleteFileIfExists, getUploadsDir } from '../utils/fileHelper.js';

const sanitizeTestimonial = (testimonial) => {
  if (!testimonial) return testimonial;
  const t = testimonial.toObject ? testimonial.toObject() : { ...testimonial };
  t.imageUrl = `/api/testimonials/${t._id}/image`;
  delete t.imageData;
  return t;
};

const readLegacyImage = async (imagePath) => {
  if (typeof imagePath !== 'string' || !imagePath) return null;

  const match = imagePath.replace(/\\/g, '/').match(
    /(?:^|\/)testimonials\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif))$/i
  );
  if (!match) return null;

  const filename = match[1];
  const candidates = new Set([
    path.join(getUploadsDir(), 'testimonials', filename),
    path.resolve(process.cwd(), 'uploads', 'testimonials', filename),
    path.resolve(getUploadsDir(), '..', '..', 'uploads', 'testimonials', filename),
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

const getImageMimeType = (testimonial) => {
  if (testimonial.imageMimeType) return testimonial.imageMimeType;
  const extension = path.extname(testimonial.imagePath || '').toLowerCase();
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[extension] || 'application/octet-stream';
};

export const getTestimonialImage = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id).select('+imageData');
  if (!testimonial) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  const imageData = testimonial.imageData || await readLegacyImage(testimonial.imagePath);
  if (!imageData) {
    res.status(404);
    throw new Error('Testimonial image is unavailable. Please upload it again from the admin panel.');
  }

  res
    .type(getImageMimeType(testimonial))
    .set('Cache-Control', 'no-store')
    .send(imageData);
});

// @desc    Get all testimonials (search, pagination)
// @route   GET /api/testimonials
// @access  Private
export const getTestimonials = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 10 } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [data, totalCount] = await Promise.all([
    Testimonial.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Testimonial.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: data.map(sanitizeTestimonial),
    page: pageNum,
    totalPages: Math.ceil(totalCount / limitNum) || 1,
    totalCount,
  });
});

// @desc    Get single testimonial
// @route   GET /api/testimonials/:id
// @access  Private
export const getTestimonialById = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  res.status(200).json({ success: true, data: sanitizeTestimonial(testimonial) });
});

// @desc    Create testimonial
// @route   POST /api/testimonials
// @access  Private
export const createTestimonial = asyncHandler(async (req, res) => {
  const { name, jobTitle, company, review, rating, linkedin } = req.body;

  if (!req.file) {
    res.status(400);
    throw new Error('Testimonial photo is required');
  }
  if (!name || !jobTitle || !review || !rating) {
    res.status(400);
    throw new Error('Name, job title, review and rating are required');
  }

  const testimonial = new Testimonial({
    name,
    jobTitle,
    company,
    review,
    rating: Number(rating),
    linkedin,
    imageUrl: '',
    imagePath: '',
    imageData: req.file.buffer,
    imageMimeType: req.file.mimetype,
  });
  testimonial.imageUrl = `/api/testimonials/${testimonial._id}/image`;
  await testimonial.save();

  res.status(201).json({ success: true, message: 'Testimonial added successfully', data: sanitizeTestimonial(testimonial) });
});

// @desc    Update testimonial
// @route   PUT /api/testimonials/:id
// @access  Private
export const updateTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  const { name, jobTitle, company, review, rating, linkedin } = req.body;

  if (name) testimonial.name = name;
  if (jobTitle) testimonial.jobTitle = jobTitle;
  if (company !== undefined) testimonial.company = company;
  if (review) testimonial.review = review;
  if (rating) testimonial.rating = Number(rating);
  if (linkedin !== undefined) testimonial.linkedin = linkedin;

  const previousImagePath = req.file ? testimonial.imagePath : '';
  if (req.file) {
    testimonial.imageData = req.file.buffer;
    testimonial.imageMimeType = req.file.mimetype;
    testimonial.imagePath = '';
    testimonial.imageUrl = `/api/testimonials/${testimonial._id}/image`;
  }

  await testimonial.save();
  if (previousImagePath) deleteFileIfExists(previousImagePath);

  res.status(200).json({ success: true, message: 'Testimonial updated successfully', data: sanitizeTestimonial(testimonial) });
});

// @desc    Delete testimonial
// @route   DELETE /api/testimonials/:id
// @access  Private
export const deleteTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  deleteFileIfExists(testimonial.imagePath);
  await testimonial.deleteOne();

  res.status(200).json({ success: true, message: 'Testimonial deleted successfully' });
});

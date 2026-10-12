import asyncHandler from 'express-async-handler';
import Testimonial from '../models/Testimonial.js';
import { buildFileUrl, deleteFileIfExists } from '../utils/fileHelper.js';

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
    data,
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
  res.status(200).json({ success: true, data: testimonial });
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

  const testimonial = await Testimonial.create({
    name,
    jobTitle,
    company,
    review,
    rating: Number(rating),
    linkedin,
    imageUrl: buildFileUrl(req, req.file.path),
    imagePath: req.file.path,
  });

  res.status(201).json({ success: true, message: 'Testimonial added successfully', data: testimonial });
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

  if (req.file) {
    deleteFileIfExists(testimonial.imagePath);
    testimonial.imageUrl = buildFileUrl(req, req.file.path);
    testimonial.imagePath = req.file.path;
  }

  await testimonial.save();

  res.status(200).json({ success: true, message: 'Testimonial updated successfully', data: testimonial });
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

import asyncHandler from 'express-async-handler';
import Resume from '../models/Resume.js';
import { deleteFileIfExists, normalizeFileUrl } from '../utils/fileHelper.js';

// @desc    Get current resume
// @route   GET /api/resume
// @access  Private
export const getResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne().sort({ createdAt: -1 });

  if (!resume) {
    res.status(404);
    throw new Error('No resume found');
  }

  const normalizedFileUrl = normalizeFileUrl(resume.fileUrl);
  if (normalizedFileUrl !== resume.fileUrl) {
    resume.fileUrl = normalizedFileUrl;
    await resume.save();
  }

  res.status(200).json({ success: true, resume });
});

// @desc    Serve the current resume PDF stored in MongoDB
// @route   GET /api/resume/:id/file
// @access  Public
export const getResumeFile = asyncHandler(async (req, res) => {
  const resume = await Resume.findById(req.params.id).select('+fileData');

  if (!resume || !resume.fileData) {
    res.status(404);
    throw new Error('Resume file is unavailable. Please upload the resume again.');
  }

  res
    .type('application/pdf')
    .set('Content-Disposition', 'inline')
    .send(resume.fileData);
});

// @desc    Upload a new resume (only one resume kept at a time)
// @route   POST /api/resume/upload
// @access  Private
export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    res.status(400);
    throw new Error('Please upload a PDF file');
  }

  // Remove any existing resume(s) before saving the new one
  const existing = await Resume.find();
  for (const r of existing) {
    deleteFileIfExists(r.filePath);
  }
  await Resume.deleteMany();

  const resume = new Resume({
    fileName: req.file.originalname,
    fileUrl: '',
    fileSize: req.file.size,
    fileData: req.file.buffer,
  });
  resume.fileUrl = `/api/resume/${resume._id}/file`;
  await resume.save();

  res.status(201).json({ success: true, message: 'Resume uploaded successfully', resume });
});

// @desc    Replace existing resume
// @route   PUT /api/resume/:id
// @access  Private
export const updateResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findById(req.params.id);

  if (!resume) {
    res.status(404);
    throw new Error('Resume not found');
  }

  resume.fileUrl = normalizeFileUrl(resume.fileUrl);

  if (req.file?.buffer) {
    deleteFileIfExists(resume.filePath);
    resume.fileName = req.file.originalname;
    resume.fileUrl = `/api/resume/${resume._id}/file`;
    resume.filePath = '';
    resume.fileSize = req.file.size;
    resume.fileData = req.file.buffer;
  }

  await resume.save();

  res.status(200).json({ success: true, message: 'Resume updated successfully', resume });
});

// @desc    Delete resume
// @route   DELETE /api/resume/:id
// @access  Private
export const deleteResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findById(req.params.id);

  if (!resume) {
    res.status(404);
    throw new Error('Resume not found');
  }

  deleteFileIfExists(resume.filePath);
  await resume.deleteOne();

  res.status(200).json({ success: true, message: 'Resume deleted successfully' });
});

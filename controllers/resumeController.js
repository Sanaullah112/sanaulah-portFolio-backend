import asyncHandler from 'express-async-handler';
import Resume from '../models/Resume.js';
import { buildFileUrl, deleteFileIfExists } from '../utils/fileHelper.js';

// @desc    Get current resume
// @route   GET /api/resume
// @access  Private
export const getResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne().sort({ createdAt: -1 });

  if (!resume) {
    res.status(404);
    throw new Error('No resume found');
  }

  res.status(200).json({ success: true, resume });
});

// @desc    Upload a new resume (only one resume kept at a time)
// @route   POST /api/resume/upload
// @access  Private
export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a PDF file');
  }

  // Remove any existing resume(s) before saving the new one
  const existing = await Resume.find();
  for (const r of existing) {
    deleteFileIfExists(r.filePath);
  }
  await Resume.deleteMany();

  const resume = await Resume.create({
    fileName: req.file.originalname,
    fileUrl: buildFileUrl(req, req.file.path),
    filePath: req.file.path,
    fileSize: req.file.size,
  });

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

  if (req.file) {
    deleteFileIfExists(resume.filePath);
    resume.fileName = req.file.originalname;
    resume.fileUrl = buildFileUrl(req, req.file.path);
    resume.filePath = req.file.path;
    resume.fileSize = req.file.size;
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

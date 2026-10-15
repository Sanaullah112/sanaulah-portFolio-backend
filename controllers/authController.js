import asyncHandler from 'express-async-handler';
import Admin from '../models/Admin.js';
import generateToken from '../utils/generateToken.js';

// @desc    Login admin
// @route   POST /api/auth/login
// @access  Public
export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');

  if (!admin || !(await admin.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const token = generateToken(admin._id);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    token,
    user: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      avatar: admin.avatar,
    },
  });
});

// @desc    Logout admin (client clears token; endpoint kept for parity)
// @route   POST /api/auth/logout
// @access  Private
export const logoutAdmin = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @desc    Get current logged-in admin
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.admin._id,
      name: req.admin.name,
      email: req.admin.email,
      avatar: req.admin.avatar,
    },
  });
});

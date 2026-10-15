import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Admin from '../models/Admin.js';
import mongoose from 'mongoose';

dotenv.config();

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the backend environment before seeding.');
  }
  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD must be at least 6 characters long.');
  }

  await connectDB();

  const admin = await Admin.findOne({ email }).select('+password');
  if (admin) {
    admin.name = 'Admin';
    admin.password = password;
    await admin.save();
    console.log('Configured admin password reset successfully.');
  } else {
    await Admin.create({ name: 'Admin', email, password });
    console.log('Configured admin account created successfully.');
  }
};

try {
  await seedAdmin();
} catch (err) {
  console.error('Admin setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

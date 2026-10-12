import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Admin from '../models/Admin.js';
import mongoose from 'mongoose';

dotenv.config();

const seedAdmin = async () => {
  await connectDB();

  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    process.exit(0);
  }

  await Admin.create({ name: 'Admin', email, password });
  console.log(`Admin created successfully -> email: ${email} | password: ${password}`);
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error('Seeding failed:', err.message);
  mongoose.connection.close();
  process.exit(1);
});

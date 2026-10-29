import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    filePath: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    fileData: { type: Buffer, select: false },
  },
  { timestamps: true }
);

const Resume = mongoose.model('Resume', resumeSchema);
export default Resume;

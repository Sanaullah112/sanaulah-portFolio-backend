import mongoose from 'mongoose';

const lastWorkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    githubLink : { type: String, trim: true },
    description: { type: String, required: true, maxlength: 800 },
    imageUrl: { type: String, required: true },
    imagePath: { type: String, required: true },
  },
  { timestamps: true }
);

lastWorkSchema.index({ title: 'text', category: 'text' });

const LastWork = mongoose.model('LastWork', lastWorkSchema);
export default LastWork;

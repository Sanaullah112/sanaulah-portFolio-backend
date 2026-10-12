import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    jobTitle: { type: String, required: true },
    company: { type: String, default: '' },
    review: { type: String, required: true, maxlength: 600 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    linkedin: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    imagePath: { type: String, required: true },
  },
  { timestamps: true }
);

testimonialSchema.index({ name: 'text', company: 'text' });

const Testimonial = mongoose.model('Testimonial', testimonialSchema);
export default Testimonial;

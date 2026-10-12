import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    fullName:    { type: String, required: true, trim: true },
    yourEmail:   { type: String, required: true, trim: true, lowercase: true },
    phoneNumber: { type: String, default: '' },
    budget:      { type: String, default: '' },
    message:     { type: String, required: true },
    isRead:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;

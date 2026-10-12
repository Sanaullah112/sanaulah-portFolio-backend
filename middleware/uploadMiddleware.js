import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOAD_LIMITS } from '../config/constants.js';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const makeStorage = (folder) => {
  const dest = path.join('uploads', folder);
  ensureDir(dest);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });
};

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files (jpg, png, webp, gif) are allowed'), false);
};

const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files are allowed'), false);
};

export const uploadResume = multer({
  storage: makeStorage('resume'),
  fileFilter: pdfFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.PDF_MAX_SIZE },
});

export const uploadProjectImage = multer({
  storage: makeStorage('projects'),
  fileFilter: imageFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.IMAGE_MAX_SIZE },
});

export const uploadTestimonialImage = multer({
  storage: makeStorage('testimonials'),
  fileFilter: imageFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.IMAGE_MAX_SIZE },
});

export const uploadLastWorkImage = multer({
  storage: makeStorage('lastwork'),
  fileFilter: imageFileFilter,
  limits: { fileSize: UPLOAD_LIMITS.IMAGE_MAX_SIZE },
});

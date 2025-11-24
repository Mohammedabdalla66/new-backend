import multer from 'multer';
import path from 'path';

// Use memory storage for Cloudinary (files will be uploaded directly from memory)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Allow documents: PDF, images, etc.
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (Cloudinary supports larger files)
  fileFilter,
});

export const uploadMultiple = upload.array('documents', 10); // Max 10 files
export const uploadRequestFiles = upload.array('documents', 10); // For request attachments
export const uploadSingle = upload.single('avatar'); // Single file upload for avatar


import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

// Helper function to upload file to Cloudinary
export async function uploadToCloudinary(file, folder = 'accountax', options = {}) {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Default upload options
    const uploadOptions = {
      folder: folder,
      resource_type: options.resource_type || 'auto', // auto-detect image, video, raw, or use specified type
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
      ...options,
      public_id: `${Date.now()}_${file.originalname}` // Allow overriding any options (including upload_preset)
    };

    // If file is a buffer (from multer memory storage)
    if (file.buffer) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log('✅ Cloudinary upload successful:', result.secure_url);
              resolve(result);
            }
          }
        );
        uploadStream.end(file.buffer);
      });
    }
    
    // If file has a path (from multer disk storage)
    if (file.path) {
      const result = await cloudinary.uploader.upload(file.path, uploadOptions);
      console.log('✅ Cloudinary upload successful:', result.secure_url);
      return result;
    }

    throw new Error('Invalid file format');
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

// Helper function to delete file from Cloudinary
export async function deleteFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
}


import { User } from '../models/User.js';

// Get logged-in user profile
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.sub).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) { 
    console.error('Error in getMe:', err);
    next(err); 
  }
}

// Update user profile
export async function updateProfile(req, res, next) {
  try {
    const userId = req.user.sub;
    const allowedUpdates = ['name', 'phone', 'address', 'nationality', 'taxId', 'licenseNumber'];
    const updates = {};
    
    // Only allow specific fields to be updated
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    // Don't allow email or role changes through this endpoint
    if (req.body.email || req.body.role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and role cannot be changed through this endpoint' 
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId, 
      updates, 
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, data: user, message: 'Profile updated successfully' });
  } catch (err) { 
    console.error('Error in updateProfile:', err);
    next(err); 
  }
}

// Upload avatar
export async function uploadAvatar(req, res, next) {
  try {
    const userId = req.user.sub;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ 
        success: false, 
        message: 'File upload service not configured' 
      });
    }
    
    const { uploadToCloudinary } = await import('../config/cloudinary.js');
    
    // Upload to Cloudinary
    const result = await uploadToCloudinary(file, 'accountax/avatars');
    
    // Get current user to delete old avatar if exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Delete old avatar from Cloudinary if it exists
    if (user.avatar) {
      try {
        const { v2: cloudinary } = await import('cloudinary');
        // Extract public_id from old avatar URL if it's a Cloudinary URL
        const oldUrl = user.avatar;
        if (oldUrl.includes('cloudinary.com')) {
          const urlParts = oldUrl.split('/');
          const publicIdIndex = urlParts.findIndex(part => part === 'accountax');
          if (publicIdIndex !== -1) {
            const publicId = urlParts.slice(publicIdIndex).join('/').replace(/\.[^/.]+$/, '');
            await cloudinary.uploader.destroy(publicId);
          }
        }
      } catch (deleteError) {
        console.error('Error deleting old avatar:', deleteError);
        // Continue even if deletion fails
      }
    }
    
    // Update user with new avatar URL
    user.avatar = result.secure_url;
    await user.save();
    
    res.json({ 
      success: true, 
      data: { avatar: result.secure_url },
      message: 'Avatar uploaded successfully' 
    });
  } catch (err) { 
    console.error('Error in uploadAvatar:', err);
    next(err); 
  }
}



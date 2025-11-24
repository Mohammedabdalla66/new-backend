import { Router } from 'express';
import { getMe, updateProfile, uploadAvatar } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/auth.js';
import { uploadSingle } from '../middlewares/upload.js';

const router = Router();

// Test route to verify user routes are registered
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'User routes are working' });
});

// Get logged-in user profile (all roles)
router.get('/me', requireAuth, async (req, res, next) => {
  console.log('📥 GET /api/users/me - User:', req.user?.sub, 'Role:', req.user?.role);
  try {
    await getMe(req, res, next);
  } catch (err) {
    console.error('Error in getMe route:', err);
    next(err);
  }
});

// Update user profile (all roles)
router.put('/update-profile', requireAuth, updateProfile);

// Upload avatar (all roles)
router.post('/upload-avatar', requireAuth, uploadSingle, uploadAvatar);

export default router;



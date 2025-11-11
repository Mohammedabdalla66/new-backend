import { Router } from 'express';
import { getMe, updateMe } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();
router.get('/', requireAuth, requireRole('client', 'admin'), getMe);
router.put('/me', requireAuth, requireRole('client', 'admin'), updateMe);
export default router;



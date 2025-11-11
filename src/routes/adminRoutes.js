import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { listUsers, updateUserRole, listAllRequests, listAllBookings, sendAdminNotification } from '../controllers/adminController.js';

const router = Router();

router.get('/users', requireAuth, requireRole('admin'), listUsers);
router.patch('/users/:id/role', requireAuth, requireRole('admin'), updateUserRole);

router.get('/requests', requireAuth, requireRole('admin'), listAllRequests);
router.get('/bookings', requireAuth, requireRole('admin'), listAllBookings);

router.post('/notifications/send', requireAuth, requireRole('admin'), sendAdminNotification);

export default router;



import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { myBookings, getBooking, cancelBooking } from '../controllers/bookingController.js';

const router = Router();
router.get('/my', requireAuth, requireRole('client'), myBookings);
router.get('/:id', requireAuth, requireRole('client'), getBooking);
router.patch('/:id/cancel', requireAuth, requireRole('client'), cancelBooking);
export default router;



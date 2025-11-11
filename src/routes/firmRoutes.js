import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { listRequests, getRequestForFirm, listMyBookings, transitionBooking } from '../controllers/firmController.js';
import { listMyProposals, createProposal, updateProposal, cancelProposal } from '../controllers/proposalController.js';

const router = Router();

// Requests visible to firms
router.get('/requests', requireAuth, requireRole('company'), listRequests);
router.get('/requests/:id', requireAuth, requireRole('company'), getRequestForFirm);

// Proposals
router.get('/proposals/my', requireAuth, requireRole('company'), listMyProposals);
router.post('/requests/:id/proposals', requireAuth, requireRole('company'), createProposal);
router.patch('/proposals/:id', requireAuth, requireRole('company'), updateProposal);
router.delete('/proposals/:id', requireAuth, requireRole('company'), cancelProposal);

// Bookings for firm
router.get('/bookings/my', requireAuth, requireRole('company'), listMyBookings);
router.patch('/bookings/:id/:action', requireAuth, requireRole('company'), transitionBooking);

export default router;



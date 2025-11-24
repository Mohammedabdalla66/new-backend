import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { listRequests, getRequestForServiceProvider, listMyBookings, transitionBooking, getDashboardStats } from '../controllers/serviceProviderController.js';
import { listMyProposals, createProposal, updateProposal, cancelProposal, getProposal, listProposalsByRequest } from '../controllers/proposalController.js';
import { getServiceProviderWallet } from '../controllers/walletController.js';
import { uploadMultiple } from '../middlewares/upload.js';

const router = Router();

// Dashboard stats endpoint
router.get('/dashboard/stats', requireAuth, requireRole('serviceProvider'), async (req, res, next) => {
  console.log('📊 GET /api/service-provider/dashboard/stats - User:', req.user?.sub, 'Role:', req.user?.role);
  try {
    await getDashboardStats(req, res, next);
  } catch (err) {
    console.error('Error in getDashboardStats route:', err);
    next(err);
  }
});

// Wallet endpoint for service providers (must come before dynamic routes)
router.get('/wallet', requireAuth, requireRole('serviceProvider'), getServiceProviderWallet);

// Requests visible to service providers
router.get('/requests', requireAuth, requireRole('serviceProvider'), listRequests);
router.get('/requests/:id', requireAuth, requireRole('serviceProvider'), getRequestForServiceProvider);

// Proposals
router.get('/proposals/my', requireAuth, requireRole('serviceProvider'), listMyProposals);
router.get('/proposals/:id', requireAuth, requireRole('serviceProvider'), getProposal);
router.post('/requests/:id/proposals', requireAuth, requireRole('serviceProvider'), uploadMultiple, createProposal);
router.patch('/proposals/:id', requireAuth, requireRole('serviceProvider'), uploadMultiple, updateProposal);
router.delete('/proposals/:id', requireAuth, requireRole('serviceProvider'), cancelProposal);

// Bookings for service provider
router.get('/bookings/my', requireAuth, requireRole('serviceProvider'), listMyBookings);
router.patch('/bookings/:id/:action', requireAuth, requireRole('serviceProvider'), transitionBooking);

export default router;



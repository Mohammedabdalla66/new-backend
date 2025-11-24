import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import {
  listUsers,
  updateUserRole,
  updateUser,
  updateUserStatus,
  listAllRequests,
  listAllBookings,
  sendAdminNotification,
  listServiceProviders,
  getServiceProvider,
  listClients,
  getClient,
  listTransactions,
  dailyReport,
  createSubAdmin,
  approveProposal,
  rejectProposal,
  listPendingProposals,
  getRequestForAdmin,
  approveRequest,
  rejectRequest,
} from '../controllers/adminController.js';
import rateLimit from 'express-rate-limit';

const router = Router();

console.log('✅ Admin routes module loaded');

// Rate limiter for admin routes (prevent brute force)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

router.use(adminLimiter);

// Test route to verify admin routes are loaded
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes are working!', timestamp: new Date().toISOString() });
});

// User management
router.get('/users', requireAuth, requireRole('admin'), listUsers);
router.patch('/users/:id/role', requireAuth, requireRole('admin'), updateUserRole);
router.patch('/users/:id', requireAuth, requireRole('admin'), updateUser);
router.patch('/users/:id/status', requireAuth, requireRole('admin'), updateUserStatus);

// Service Providers (renamed from firms)
router.get('/service-providers', requireAuth, requireRole('admin'), listServiceProviders);
router.get('/service-providers/:id', requireAuth, requireRole('admin'), getServiceProvider);
router.get('/companies', requireAuth, requireRole('admin'), listServiceProviders); // Legacy endpoint
router.get('/companies/:id', requireAuth, requireRole('admin'), getServiceProvider); // Legacy endpoint

// Clients
router.get('/clients', requireAuth, requireRole('admin'), listClients);
router.get('/clients/:id', requireAuth, requireRole('admin'), getClient);

// Transactions
router.get('/transactions', requireAuth, requireRole('admin'), listTransactions);

// Reports
router.get('/reports/daily', requireAuth, requireRole('admin'), dailyReport);

// Requests and Bookings
router.get('/requests', requireAuth, requireRole('admin'), listAllRequests);
router.get('/requests/:id', requireAuth, requireRole('admin'), getRequestForAdmin);
router.patch('/requests/:id/approve', requireAuth, requireRole('admin'), approveRequest);
router.patch('/requests/:id/reject', requireAuth, requireRole('admin'), rejectRequest);
router.get('/bookings', requireAuth, requireRole('admin'), listAllBookings);

// Proposal management
router.get('/proposals/pending', requireAuth, requireRole('admin'), listPendingProposals);
router.patch('/proposals/:id/approve', requireAuth, requireRole('admin'), approveProposal);
router.patch('/proposals/:id/reject', requireAuth, requireRole('admin'), rejectProposal);

// Sub-admins
router.post('/subadmins', requireAuth, requireRole('admin'), createSubAdmin);

// Notifications
router.post('/notifications/send', requireAuth, requireRole('admin'), sendAdminNotification);

export default router;



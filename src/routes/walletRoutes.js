import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { getWallet, deposit, hold, release, refund } from '../controllers/walletController.js';

const router = Router();
// Allow both clients and service providers to access their wallets
// Note: Also support 'firm' and 'company' for backward compatibility
router.get('/', requireAuth, requireRole('client', 'serviceProvider', 'firm', 'company'), getWallet);
router.post('/deposit', requireAuth, requireRole('client', 'serviceProvider', 'firm', 'company'), deposit);
router.post('/hold', requireAuth, requireRole('client'), hold); // Only clients can hold (escrow)
router.post('/release', requireAuth, requireRole('client', 'admin'), release); // Clients or admin can release
router.post('/refund', requireAuth, requireRole('client', 'admin'), refund); // Clients or admin can refund
export default router;



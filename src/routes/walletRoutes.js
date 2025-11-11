import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { getWallet, deposit, hold, release, refund } from '../controllers/walletController.js';

const router = Router();
router.get('/', requireAuth, requireRole('client'), getWallet);
router.post('/deposit', requireAuth, requireRole('client'), deposit);
router.post('/hold', requireAuth, requireRole('client'), hold);
router.post('/release', requireAuth, requireRole('client'), release);
router.post('/refund', requireAuth, requireRole('client'), refund);
export default router;



import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { sendMessage, getConversation } from '../controllers/messageController.js';

const router = Router();
router.post('/:companyId', requireAuth, requireRole('client'), sendMessage);
router.get('/:companyId', requireAuth, requireRole('client'), getConversation);
export default router;



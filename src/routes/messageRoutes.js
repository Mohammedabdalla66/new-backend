import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { sendMessage, getConversation, sendMessageFromServiceProvider, getConversationForServiceProvider } from '../controllers/messageController.js';

const router = Router();

// Client routes - handle both serviceProviderId and companyId (legacy)
// Note: These routes must come before /service-provider/:clientId to avoid conflicts
router.post('/:serviceProviderId', requireAuth, requireRole('client'), sendMessage);
router.get('/:serviceProviderId', requireAuth, requireRole('client'), getConversation);

// Service Provider routes
router.post('/service-provider/:clientId', requireAuth, requireRole('serviceProvider'), sendMessageFromServiceProvider);
router.get('/service-provider/:clientId', requireAuth, requireRole('serviceProvider'), getConversationForServiceProvider);
// Legacy routes for backward compatibility
router.post('/firm/:clientId', requireAuth, requireRole('serviceProvider', 'company'), sendMessageFromServiceProvider);
router.get('/firm/:clientId', requireAuth, requireRole('serviceProvider', 'company'), getConversationForServiceProvider);

export default router;



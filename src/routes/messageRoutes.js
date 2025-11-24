import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { 
  sendMessage, 
  getConversation, 
  sendMessageFromServiceProvider, 
  getConversationForServiceProvider,
  listClientConversations,
  listServiceProviderConversations,
  createChatForProposal,
  getMessagesByConversation,
  sendMessageToConversation
} from '../controllers/messageController.js';

const router = Router();

// Debug: Log route registration
console.log('✅ Message routes module loaded');

// Test route to verify routing works
router.get('/test', (req, res) => {
  res.json({ message: 'Message routes are working!', timestamp: new Date().toISOString() });
});

// IMPORTANT: Specific routes must come BEFORE dynamic routes to avoid conflicts
// List conversations - must come before /:serviceProviderId
// Note: These routes use req.user.sub from requireAuth, so no need for :clientId or :providerId in URL
router.get('/conversations/client', requireAuth, requireRole('client'), async (req, res, next) => {
  console.log('📥 GET /api/messages/conversations/client - User:', req.user?.sub, 'Role:', req.user?.role);
  try {
    await listClientConversations(req, res, next);
  } catch (err) {
    console.error('Error in listClientConversations:', err);
    next(err);
  }
});
router.get('/conversations/service-provider', requireAuth, requireRole('serviceProvider'), async (req, res, next) => {
  console.log('📥 GET /api/messages/conversations/service-provider - User:', req.user?.sub, 'Role:', req.user?.role);
  try {
    await listServiceProviderConversations(req, res, next);
  } catch (err) {
    console.error('Error in listServiceProviderConversations:', err);
    next(err);
  }
});

// Create chat for active proposal - must come before /:serviceProviderId
router.post('/proposals/:proposalId/chat', requireAuth, createChatForProposal);

// Conversation-based routes (using conversationId)
router.get('/conversation/:conversationId', requireAuth, async (req, res, next) => {
  console.log('📥 GET /api/messages/conversation/:conversationId - ID:', req.params.conversationId, 'User:', req.user?.sub);
  try {
    await getMessagesByConversation(req, res, next);
  } catch (err) {
    console.error('Error in getMessagesByConversation:', err);
    next(err);
  }
});
router.post('/conversation/:conversationId', requireAuth, async (req, res, next) => {
  console.log('📤 POST /api/messages/conversation/:conversationId - ID:', req.params.conversationId, 'User:', req.user?.sub);
  try {
    await sendMessageToConversation(req, res, next);
  } catch (err) {
    console.error('Error in sendMessageToConversation:', err);
    next(err);
  }
});

// Service Provider routes - must come before dynamic routes
router.post('/service-provider/:clientId', requireAuth, requireRole('serviceProvider'), sendMessageFromServiceProvider);
router.get('/service-provider/:clientId', requireAuth, requireRole('serviceProvider'), getConversationForServiceProvider);
// Legacy routes for backward compatibility
router.post('/firm/:clientId', requireAuth, requireRole('serviceProvider', 'company'), sendMessageFromServiceProvider);
router.get('/firm/:clientId', requireAuth, requireRole('serviceProvider', 'company'), getConversationForServiceProvider);

// Client routes - handle both serviceProviderId and companyId (legacy)
// These dynamic routes must come LAST to avoid matching /conversations/client
router.post('/:serviceProviderId', requireAuth, requireRole('client'), sendMessage);
router.get('/:serviceProviderId', requireAuth, requireRole('client'), getConversation);

export default router;



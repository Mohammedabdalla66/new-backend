import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { createRequest, myRequests, getRequest, updateRequest, deleteRequest } from '../controllers/requestController.js';

const router = Router();
router.post('/create', requireAuth, requireRole('client'), createRequest);
router.get('/my', requireAuth, requireRole('client'), myRequests);
router.get('/:id', requireAuth, requireRole('client'), getRequest);
router.patch('/:id', requireAuth, requireRole('client'), updateRequest);
router.delete('/:id', requireAuth, requireRole('client'), deleteRequest);
export default router;



import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { createRequest, myRequests, getRequest, getRequestWithProposals, updateRequest, deleteRequest } from '../controllers/requestController.js';
import { listProposalsByRequest } from '../controllers/proposalController.js';
import { uploadMultiple } from '../middlewares/upload.js';

const router = Router();

// Log route registration
console.log('📋 Registering request routes:');
console.log('  GET /:id/proposals - List proposals for a request');
console.log('  GET /:id - Get request details');
console.log('  GET /my - List my requests');
console.log('  POST /create - Create request');

// Wrapper to handle multer errors
const handleFileUpload = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: 'File too large', 
          error: 'File size exceeds 10MB limit' 
        });
      }
      if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ 
          message: 'Invalid file type', 
          error: err.message 
        });
      }
      return res.status(400).json({ 
        message: 'File upload error', 
        error: err.message || 'Failed to process files' 
      });
    }
    next();
  });
};

router.post('/create', requireAuth, requireRole('client'), handleFileUpload, createRequest);
router.get('/my', requireAuth, requireRole('client'), myRequests);
// IMPORTANT: More specific routes must come before generic :id routes
// Debug middleware to log route hits
router.get('/:id/proposals', (req, res, next) => {
  console.log('🔍 Route /:id/proposals hit! ID:', req.params.id);
  next();
}, requireAuth, requireRole('client'), listProposalsByRequest);
router.get('/:id', requireAuth, requireRole('client'), getRequest);
router.patch('/:id', requireAuth, requireRole('client'), handleFileUpload, updateRequest);
router.delete('/:id', requireAuth, requireRole('client'), deleteRequest);
export default router;



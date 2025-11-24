import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { uploadMultiple } from '../middlewares/upload.js';
import {
  createPortfolioItem,
  getMyPortfolioItems,
  getPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  deletePortfolioFile
} from '../controllers/portfolioController.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Create new portfolio item (with file uploads)
router.post('/', uploadMultiple, createPortfolioItem);

// Get all portfolio items for logged-in user (optionally filtered by type)
router.get('/my-items', getMyPortfolioItems);

// Get single portfolio item
router.get('/:id', getPortfolioItem);

// Update portfolio item (with optional new file uploads)
router.put('/:id', uploadMultiple, updatePortfolioItem);

// Delete portfolio item
router.delete('/:id', deletePortfolioItem);

// Delete a specific file from a portfolio item
router.delete('/:id/files/:fileIndex', deletePortfolioFile);

export default router;


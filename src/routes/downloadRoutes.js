import { Router } from 'express';
import { downloadFile } from '../controllers/downloadController.js';

const router = Router();

// Download file from Cloudinary through backend
// Query params:
//   - url: Cloudinary URL (secure_url) - will extract public_id from it
//   - publicId: Direct public_id of the file
//   - filename: Optional custom filename for download
//   - resourceType: Resource type (default: 'raw')
router.get('/download', downloadFile);

export default router;


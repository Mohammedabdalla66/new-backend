import { Router } from 'express';
import { register, registerClient, registerServiceProvider, registerAdmin, login, logout, refresh, sendPhoneVerification, verifyPhoneCode } from '../controllers/authController.js';
import { uploadMultiple } from '../middlewares/upload.js';

const router = Router();
router.post('/register', register);
router.post('/register/client', registerClient);
router.post('/register/service-provider', uploadMultiple, registerServiceProvider);
router.post('/register/company', uploadMultiple, registerServiceProvider); // Legacy endpoint for backward compatibility
router.post('/register/admin', registerAdmin);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/verify/send', sendPhoneVerification);
router.post('/verify/check', verifyPhoneCode);
export default router;



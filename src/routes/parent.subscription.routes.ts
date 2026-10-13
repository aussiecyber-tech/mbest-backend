import express, { Router } from 'express';
import { getPackages, getPackage, getMySubscription, submitPayment } from '../controllers/parent.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router: ReturnType<typeof Router> = Router();

// Routes for /api/v1/parent/subscription
router.get('/packages', authenticateToken, requireRole('PARENT', 'ADMIN'), getPackages);
router.get('/packages/:id', authenticateToken, requireRole('PARENT', 'ADMIN'), getPackage);
router.get('/my-subscription', authenticateToken, requireRole('PARENT', 'ADMIN'), getMySubscription);
router.post('/payment', authenticateToken, requireRole('PARENT', 'ADMIN'), express.raw({ type: 'multipart/form-data', limit: '5mb' }), submitPayment);

export default router;

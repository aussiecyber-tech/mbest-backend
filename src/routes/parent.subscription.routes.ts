import { Router } from 'express';
import { getPackages, getMySubscription, submitPayment } from '../controllers/parent.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// Routes for /api/v1/parent/subscription
router.get('/packages', authenticateToken, requireRole('PARENT', 'ADMIN'), getPackages);
router.get('/my-subscription', authenticateToken, requireRole('PARENT', 'ADMIN'), getMySubscription);
router.post('/payment', authenticateToken, requireRole('PARENT', 'ADMIN'), submitPayment);

export default router;

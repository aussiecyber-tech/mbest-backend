import { Router } from 'express';
import { getChildren, getChildGrades, getChildClasses, getChildSessions } from '../controllers/parent.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/children', authenticateToken, requireRole('PARENT', 'ADMIN'), getChildren);
router.get('/children/:id/grades', authenticateToken, requireRole('PARENT', 'ADMIN'), getChildGrades);
router.get('/children/:id/classes', authenticateToken, requireRole('PARENT', 'ADMIN'), getChildClasses);
router.get('/children/:id/sessions', authenticateToken, requireRole('PARENT', 'ADMIN'), getChildSessions);

export default router;

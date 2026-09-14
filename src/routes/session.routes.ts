import { Router } from 'express';
import { getSessions, createSession, updateSession, deleteSession } from '../controllers/session.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createSessionSchema, updateSessionSchema } from '../schemas/session.schema';

const router = Router();

const optionalAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    return authenticateToken(req, res, next);
  }
  next();
};

router.get('/', optionalAuth, getSessions);
router.post('/', authenticateToken, requireRole('ADMIN', 'TUTOR'), validateBody(createSessionSchema), createSession);
router.put('/:id', authenticateToken, requireRole('ADMIN', 'TUTOR'), validateBody(updateSessionSchema), updateSession);
router.delete('/:id', authenticateToken, requireRole('ADMIN', 'TUTOR'), deleteSession);

export default router;

import { Router } from 'express';
import { getClasses, getClassById, createClass, updateClass, deleteClass } from '../controllers/class.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createClassSchema, updateClassSchema } from '../schemas/class.schema';

const router = Router();

// Middleware to extract token if present, but allow public listing if not
const optionalAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    return authenticateToken(req, res, next);
  }
  next();
};

router.get('/', optionalAuth, getClasses);
router.get('/:id', getClassById);
router.post('/', authenticateToken, requireRole('ADMIN'), validateBody(createClassSchema), createClass);
router.put('/:id', authenticateToken, requireRole('ADMIN', 'TUTOR'), validateBody(updateClassSchema), updateClass);
router.delete('/:id', authenticateToken, requireRole('ADMIN'), deleteClass);

export default router;

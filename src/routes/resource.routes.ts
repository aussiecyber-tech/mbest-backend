import express, { Router } from 'express';
import {
  createResource,
  deleteResource,
  downloadResource,
  getResource,
  listResources,
  updateResource
} from '../controllers/resource.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router: ReturnType<typeof Router> = Router();

router.use(authenticateToken);
router.get('/', listResources);
router.get('/:id/download', downloadResource);
router.get('/:id', getResource);
router.post('/', requireRole('ADMIN', 'TUTOR'), express.raw({ type: 'multipart/form-data', limit: '10mb' }), createResource);
router.put('/:id', requireRole('ADMIN', 'TUTOR'), updateResource);
router.delete('/:id', requireRole('ADMIN', 'TUTOR'), deleteResource);

export default router;

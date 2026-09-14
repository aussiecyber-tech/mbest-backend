import { Router } from 'express';
import { getDashboard, getUsers, getUserStats, createUser, deleteUser, getCalendarFilterOptions } from '../controllers/admin.controller';
import { getPackages, getPackage, createPackage, updatePackage, deletePackage } from '../controllers/package.controller';
import { getClasses, getClassById, createClass, updateClass, deleteClass, getClassOptions } from '../controllers/class.controller';
import { getSessions, createSession, updateSession, deleteSession } from '../controllers/session.controller';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { createClassSchema, updateClassSchema } from '../schemas/class.schema';
import { createSessionSchema, updateSessionSchema } from '../schemas/session.schema';

const router = Router();

// Dashboard & User Analytics
router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.get('/users/stats', getUserStats);
router.post('/users', authenticateToken, requireRole('ADMIN'), createUser);
router.delete('/users/:id', authenticateToken, requireRole('ADMIN'), deleteUser);

// Admin Class Management Aliases
router.get('/classes/options', getClassOptions);
router.get('/classes', getClasses);
router.get('/classes/:id', getClassById);
router.post('/classes', authenticateToken, requireRole('ADMIN'), validateBody(createClassSchema), createClass);
router.put('/classes/:id', authenticateToken, requireRole('ADMIN'), validateBody(updateClassSchema), updateClass);
router.delete('/classes/:id', authenticateToken, requireRole('ADMIN'), deleteClass);

// Admin Calendar / Sessions Aliases
router.get('/calendar/sessions', getSessions);
router.get('/calendar/filter-options', authenticateToken, requireRole('ADMIN'), getCalendarFilterOptions);
router.get('/sessions', getSessions);
router.post('/sessions', authenticateToken, requireRole('ADMIN'), validateBody(createSessionSchema), createSession);
router.put('/sessions/:id', authenticateToken, requireRole('ADMIN'), validateBody(updateSessionSchema), updateSession);
router.delete('/sessions/:id', authenticateToken, requireRole('ADMIN'), deleteSession);

// Admin Packages
router.get('/packages', authenticateToken, requireRole('ADMIN'), getPackages);
router.get('/packages/:id', authenticateToken, requireRole('ADMIN'), getPackage);
router.post('/packages', authenticateToken, requireRole('ADMIN'), createPackage);
router.put('/packages/:id', authenticateToken, requireRole('ADMIN'), updatePackage);
router.delete('/packages/:id', authenticateToken, requireRole('ADMIN'), deletePackage);

export default router;

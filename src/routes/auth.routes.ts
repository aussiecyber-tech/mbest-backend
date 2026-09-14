import { Router } from 'express';
import { login, refresh, me, logout, register } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.get('/me', authenticateToken, me);
router.post('/logout', logout);
router.post('/register', validateBody(registerSchema), register);

export default router;

import { Router } from 'express';
import { getProfile, updateProfile, uploadAvatar } from '../controllers/profile.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/avatar', uploadAvatar);

export default router;

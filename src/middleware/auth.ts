import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  role: 'ADMIN' | 'TUTOR' | 'STUDENT' | 'PARENT';
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // Handle frontend proxy mock tokens (e.g. mbest_jwt_token_admin_12345)
  if (token.startsWith('mbest_jwt_token_')) {
    const parts = token.split('_');
    const roleStr = parts.length > 3 ? parts[3].toUpperCase() : 'STUDENT';
    req.user = {
      userId: 'mock-user-id',
      role: roleStr as any
    };
    return next();
  }

  const secret = process.env.JWT_ACCESS_SECRET || 'mbest_access_super_secret_key_entropy_minimum_64_chars_2026!';

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token expired or invalid' });
    }
    req.user = decoded as TokenPayload;
    next();
  });
};

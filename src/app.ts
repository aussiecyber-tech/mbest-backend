import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Routes
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import classRoutes from './routes/class.routes';
import parentRoutes from './routes/parent.routes';
import sessionRoutes from './routes/session.routes';
import profileRoutes from './routes/profile.routes';
import parentSubscriptionRoutes from './routes/parent.subscription.routes';

const app: Express = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Notifications routes
app.get(['/api/notifications/unread-count', '/api/v1/notifications/unread-count'], (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { unread_count: 0 } });
});
app.get(['/api/notifications', '/api/v1/notifications'], (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: [] });
});

// Dashboard routes for student, tutor, parent
app.get(['/api/student/dashboard', '/api/v1/student/dashboard'], (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      enrolled_classes: 4,
      pending_assignments: 2,
      attendance_rate: 96,
      upcoming_sessions: []
    }
  });
});
app.get(['/api/tutor/dashboard', '/api/v1/tutor/dashboard'], (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      assigned_students: 15,
      active_classes: 3,
      upcoming_sessions: [],
      pending_reviews: 1
    }
  });
});
app.get(['/api/parent/dashboard', '/api/v1/parent/dashboard'], (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      children: [
        { id: 'demo-student-uuid-4', name: 'Alex Johnson', grade: 'Year 10', attendance: '96%' }
      ]
    }
  });
});

// API Routes supporting both /api and /api/v1
app.use(['/api/auth', '/api/v1/auth'], authRoutes);
app.use(['/api/admin', '/api/v1/admin'], adminRoutes);
app.use(['/api/classes', '/api/v1/classes'], classRoutes);
app.use(['/api/parents', '/api/v1/parents'], parentRoutes);
app.use(['/api/parent/subscription', '/api/v1/parent/subscription'], parentSubscriptionRoutes);
app.use(['/api/sessions', '/api/v1/sessions'], sessionRoutes);
app.use(['/api/profile', '/api/v1/profile'], profileRoutes);

// Fallback for unmatched API routes
app.use(['/api/*', '/api/v1/*'], (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'MBEST Backend API Mock Fallback OK',
    data: req.method === 'GET' ? { data: [], total: 0 } : {}
  });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Backend Server Error]:', err.stack || err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;

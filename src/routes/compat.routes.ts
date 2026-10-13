import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { authenticateToken } from '../middleware/auth';
import { getClasses, getClassById } from '../controllers/class.controller';
import { getSessions, createSession, updateSession, deleteSession } from '../controllers/session.controller';
import { validateBody } from '../middleware/validate';
import { createSessionSchema, updateSessionSchema } from '../schemas/session.schema';

const router: ReturnType<typeof Router> = Router();

// Express 4 does not automatically forward rejected async handlers.
// Wrap every handler registered on this router so failures reach app.ts.
(['get', 'post', 'put', 'delete'] as const).forEach(method => {
  const register = (router as any)[method].bind(router);
  (router as any)[method] = (path: any, ...handlers: any[]) => register(
    path,
    ...handlers.map(handler => handler?.constructor?.name === 'AsyncFunction'
      ? (req: Request, res: Response, next: any) => Promise.resolve(handler(req, res, next)).catch(next)
      : handler)
  );
});
router.use(authenticateToken);

const recordData = (record: any) => ({
  ...(record.data && typeof record.data === 'object' ? record.data : {}),
  id: record.id,
  created_at: record.createdAt?.toISOString?.() || record.created_at,
  updated_at: record.updatedAt?.toISOString?.() || record.updated_at,
});

const list = async (kind: string, ownerId?: string) => {
  const records = await prisma.appRecord.findMany({
    where: { kind, ...(ownerId ? { ownerId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return records.map(recordData);
};

const paged = (items: any[]) => ({
  success: true,
  data: { data: items, total: items.length, current_page: 1, last_page: 1, per_page: Math.max(items.length, 15) },
});

const createRecord = async (kind: string, req: Request, defaults: Record<string, unknown> = {}) => {
  const record = await prisma.appRecord.create({
    data: {
      kind,
      ownerId: req.user?.userId || null,
      data: { ...defaults, ...(req.body || {}) },
    },
  });
  return recordData(record);
};

const updateRecord = async (kind: string, id: string, body: any) => {
  const existing = await prisma.appRecord.findFirst({ where: { id, kind } });
  if (!existing) return null;
  const previous = existing.data && typeof existing.data === 'object' ? existing.data as any : {};
  const record = await prisma.appRecord.update({ where: { id }, data: { data: { ...previous, ...(body || {}) } } });
  return recordData(record);
};

const getRecord = async (kind: string, id: string) => {
  const record = await prisma.appRecord.findFirst({ where: { id, kind } });
  return record ? recordData(record) : null;
};

// Shared recipients for messages and lesson workflows.
router.get(['/admin/users/recipients', '/tutor/students/recipients'], async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: { firstName: 'asc' },
  });
  res.json({ success: true, data: users.map(user => ({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, role: user.role.toLowerCase() })) });
});

// Messages.
router.get('/messages/threads', async (req, res) => res.json(paged(await list('message', req.user?.userId))));
router.get('/messages', async (req, res) => res.json(paged(await list('message', req.user?.userId))));
router.post('/messages', async (req, res) => res.status(201).json({ success: true, data: { data: await createRecord('message', req, { is_read: false }) } }));
router.get('/messages/:id', async (req, res) => {
  const item = await getRecord('message', req.params.id);
  return item ? res.json({ success: true, data: { data: item } }) : res.status(404).json({ success: false, message: 'Message not found' });
});
router.put('/messages/:id/read', async (req, res) => res.json({ success: true, data: { data: await updateRecord('message', req.params.id, { is_read: true }) } }));
router.delete('/messages/:id', async (req, res) => { await prisma.appRecord.deleteMany({ where: { id: req.params.id, kind: 'message' } }); res.json({ success: true }); });

// Resource requests.
router.get('/resource-requests', async (_req, res) => res.json(paged(await list('resource_request'))));
router.post('/resource-requests', async (req, res) => res.status(201).json({ success: true, data: { data: await createRecord('resource_request', req, { status: 'pending' }) } }));
router.get('/resource-requests/:id', async (req, res) => {
  const item = await getRecord('resource_request', req.params.id);
  return item ? res.json({ success: true, data: { data: item } }) : res.status(404).json({ success: false, message: 'Resource request not found' });
});
router.put('/resource-requests/:id', async (req, res) => res.json({ success: true, data: { data: await updateRecord('resource_request', req.params.id, req.body) } }));
router.post('/resource-requests/:id', async (req, res) => res.json({ success: true, data: { data: await updateRecord('resource_request', req.params.id, req.body) } }));
router.delete('/resource-requests/:id', async (req, res) => { await prisma.appRecord.deleteMany({ where: { id: req.params.id, kind: 'resource_request' } }); res.json({ success: true }); });

// Lesson requests shared by administrator, tutor and parent pages.
router.get(['/admin/lesson-requests', '/tutor/lesson-requests', '/parent/lesson-requests'], async (_req, res) => res.json(paged(await list('lesson_request'))));
router.post('/parent/lesson-requests', async (req, res) => res.status(201).json({ success: true, data: { data: await createRecord('lesson_request', req, { status: 'pending' }) } }));
router.post('/tutor/lesson-requests/:id/approve', async (req, res) => res.json({ success: true, data: { data: await updateRecord('lesson_request', req.params.id, { status: 'approved', ...(req.body || {}) }) } }));
router.post('/tutor/lesson-requests/:id/decline', async (req, res) => res.json({ success: true, data: { data: await updateRecord('lesson_request', req.params.id, { status: 'declined', ...(req.body || {}) }) } }));

// Billing and payments.
router.get('/admin/billing/summary', async (_req, res) => res.json({ success: true, data: { total_revenue: 0, pending_revenue: 0, overdue_revenue: 0, revenue_this_month: 0 } }));
router.get('/admin/billing/package-stats', async (_req, res) => res.json({ success: true, data: { packages: [], total_revenue_from_packages: 0, total_active_students: 0 } }));
router.get(['/admin/billing/invoices', '/tutor/invoices', '/parent/billing/invoices'], async (_req, res) => res.json(paged(await list('invoice'))));
router.post(['/admin/billing/invoices', '/tutor/invoices'], async (req, res) => res.status(201).json({ success: true, data: { data: await createRecord('invoice', req, { status: 'draft' }) } }));
router.get('/admin/billing/invoices/:id', async (req, res) => { const item = await getRecord('invoice', req.params.id); return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Invoice not found' }); });
router.put('/admin/billing/invoices/:id', async (req, res) => res.json({ success: true, data: await updateRecord('invoice', req.params.id, req.body) }));
router.get(['/admin/payments', '/parent/billing/payments'], async (_req, res) => res.json(paged(await list('payment'))));
router.get('/admin/payments/:id', async (req, res) => { const item = await getRecord('payment', req.params.id); return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Payment not found' }); });
router.post('/admin/payments/:id/approve', async (req, res) => res.json({ success: true, data: { data: await updateRecord('payment', req.params.id, { status: 'approved', ...(req.body || {}) }) } }));
router.post('/admin/payments/:id/reject', async (req, res) => res.json({ success: true, data: { data: await updateRecord('payment', req.params.id, { status: 'rejected', ...(req.body || {}) }) } }));

// Role-specific class aliases and enrollment actions.
router.get(['/student/classes', '/tutor/classes', '/student/classes/available'], getClasses);
router.get(['/student/classes/:id', '/tutor/classes/:id'], getClassById);
router.post('/student/classes/:id/enroll', async (req, res) => {
  const enrollment = await prisma.classEnrollment.upsert({
    where: { classId_studentId: { classId: req.params.id, studentId: req.user!.userId } },
    update: {}, create: { classId: req.params.id, studentId: req.user!.userId },
  });
  res.json({ success: true, data: enrollment });
});
router.post('/student/classes/:id/unenroll', async (req, res) => { await prisma.classEnrollment.deleteMany({ where: { classId: req.params.id, studentId: req.user!.userId } }); res.json({ success: true }); });
router.post('/student/classes/join', async (req, res) => res.status(400).json({ success: false, message: 'Please select a class from Available Classes.' }));
router.get('/tutor/classes/:id/students', async (req, res) => {
  const rows = await prisma.classEnrollment.findMany({ where: { classId: req.params.id }, include: { student: true } });
  res.json({ success: true, data: rows.map(row => ({ id: row.student.id, name: `${row.student.firstName} ${row.student.lastName}`.trim(), email: row.student.email })) });
});
router.delete('/tutor/classes/:classId/students/:studentId', async (req, res) => { await prisma.classEnrollment.deleteMany({ where: { classId: req.params.classId, studentId: req.params.studentId } }); res.json({ success: true }); });

// Role-specific session aliases.
router.get('/tutor/sessions', getSessions);
router.post('/tutor/sessions', validateBody(createSessionSchema), createSession);
router.put('/tutor/sessions/:id', validateBody(updateSessionSchema), updateSession);
router.delete('/tutor/sessions/:id', deleteSession);
router.get('/tutor/sessions/:id', async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id }, include: { class: true, tutor: true, attendances: true } });
  return session ? res.json({ success: true, data: session }) : res.status(404).json({ success: false, message: 'Session not found' });
});

// Assignments, attendance and grades.
router.get(['/student/assignments', '/tutor/assignments'], async (req, res) => {
  const assignments = await prisma.assignment.findMany({
    where: req.path.startsWith('/student') ? { class: { enrollments: { some: { studentId: req.user!.userId } } } } : undefined,
    include: { class: true, submissions: true }, orderBy: { dueDate: 'desc' },
  });
  const items = assignments.map(a => ({ id: a.id, title: a.title, description: a.description, class_id: a.classId, class: a.class, due_date: a.dueDate.toISOString(), submissions: a.submissions }));
  res.json(paged(items));
});
router.post('/tutor/assignments', async (req, res) => {
  const assignment = await prisma.assignment.create({ data: { classId: String(req.body.class_id || req.body.classId), title: String(req.body.title || 'Assignment'), description: req.body.description || null, dueDate: new Date(req.body.due_date || req.body.dueDate) } });
  res.status(201).json({ success: true, data: { data: assignment } });
});
router.get(['/student/attendance', '/tutor/attendance', '/tutor/attendance-records', '/admin/attendance', '/admin/attendance/students'], async (_req, res) => res.json(paged([])));
router.get('/student/grades', async (req, res) => {
  const grades = await prisma.assignmentSubmission.findMany({ where: { studentId: req.user!.userId }, include: { assignment: true } });
  res.json(paged(grades));
});
router.put('/admin/attendance/:id', async (req, res) => res.json({ success: true, data: { data: await updateRecord('attendance', req.params.id, req.body) } }));
router.post('/admin/attendance/timesheets/approve', async (_req, res) => res.json({ success: true }));

router.get('/admin/attendance/:id', async (req, res) => {
  const item = await getRecord('attendance', req.params.id);
  return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Attendance record not found' });
});

// Calendar detail actions used by the administrator session drawer.
router.get('/admin/calendar/sessions/:id', async (req, res) => {
  const item = await prisma.session.findUnique({ where: { id: req.params.id }, include: { class: true, tutor: true, attendances: true } });
  return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Session not found' });
});
router.post(['/admin/calendar/sessions/:id/notes', '/tutor/sessions/:id/notes'], async (req, res) => {
  const item = await prisma.session.update({ where: { id: req.params.id }, data: { notes: req.body.notes || req.body.lesson_note || null } });
  res.json({ success: true, data: { data: item } });
});
router.post(['/admin/calendar/sessions/:id/attendance', '/tutor/sessions/:id/attendance'], async (req, res) => {
  const entries = Array.isArray(req.body.attendance) ? req.body.attendance : Array.isArray(req.body) ? req.body : [];
  for (const entry of entries) {
    const studentId = String(entry.student_id || entry.studentId || '');
    if (!studentId) continue;
    await prisma.attendance.upsert({
      where: { sessionId_studentId: { sessionId: req.params.id, studentId } },
      update: { status: String(entry.status || 'PRESENT').toUpperCase() as any },
      create: { sessionId: req.params.id, studentId, status: String(entry.status || 'PRESENT').toUpperCase() as any },
    });
  }
  res.json({ success: true, data: { data: entries } });
});
router.post('/admin/calendar/sessions/:id/mark-ready-invoice', async (req, res) => res.json({ success: true, data: { session_id: req.params.id, ready_for_invoicing: true } }));
router.post('/tutor/sessions/:id/propose-reschedule', async (req, res) => res.json({ success: true, data: { data: await createRecord('reschedule_request', req, { session_id: req.params.id, status: 'pending' }) } }));

// Tutor students and work summaries.
router.get('/tutor/students', async (req, res) => {
  const rows = await prisma.classEnrollment.findMany({ where: { class: { tutorId: req.user!.userId } }, include: { student: true } });
  const unique = [...new Map(rows.map(row => [row.student.id, row.student])).values()];
  res.json(paged(unique.map(student => ({ id: student.id, name: `${student.firstName} ${student.lastName}`.trim(), email: student.email }))));
});
router.get('/tutor/hours', async (_req, res) => res.json({ success: true, data: { total_hours: 0, this_week: 0, this_month: 0 } }));
router.get('/tutor/lesson-history', async (_req, res) => res.json(paged([])));

router.get('/admin/tutors/:id', async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, role: 'TUTOR' } });
  return user ? res.json({ success: true, data: { id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, is_active: user.isActive } }) : res.status(404).json({ success: false, message: 'Tutor not found' });
});
router.get('/tutor/students/:id', async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, role: 'STUDENT' } });
  return user ? res.json({ success: true, data: { data: { id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email } } }) : res.status(404).json({ success: false, message: 'Student not found' });
});
router.get('/tutor/students/:id/grades', async (req, res) => {
  const rows = await prisma.assignmentSubmission.findMany({ where: { studentId: req.params.id }, include: { assignment: true } });
  res.json({ success: true, data: { data: rows }, stats: { total: rows.length } });
});
router.get('/tutor/students/:id/assignments', async (req, res) => {
  const rows = await prisma.assignmentSubmission.findMany({ where: { studentId: req.params.id }, include: { assignment: true } });
  res.json({ success: true, data: rows.map(row => row.assignment) });
});

// Assignment detail, editing, submission and grading.
router.get(['/student/assignments/:id', '/tutor/assignments/:id'], async (req, res) => {
  const item = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { class: true, submissions: true } });
  return item ? res.json({ success: true, data: { data: item } }) : res.status(404).json({ success: false, message: 'Assignment not found' });
});
router.put('/tutor/assignments/:id', async (req, res) => {
  const item = await prisma.assignment.update({ where: { id: req.params.id }, data: { ...(req.body.title !== undefined && { title: req.body.title }), ...(req.body.description !== undefined && { description: req.body.description }), ...((req.body.due_date || req.body.dueDate) && { dueDate: new Date(req.body.due_date || req.body.dueDate) }) } });
  res.json({ success: true, data: { data: item } });
});
router.delete('/tutor/assignments/:id', async (req, res) => { await prisma.assignment.delete({ where: { id: req.params.id } }); res.json({ success: true }); });
router.get('/tutor/assignments/:id/submissions', async (req, res) => res.json({ success: true, data: { data: await prisma.assignmentSubmission.findMany({ where: { assignmentId: req.params.id } }) } }));
router.get('/student/assignments/:id/submission', async (req, res) => res.json({ success: true, data: { data: await prisma.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user!.userId } } }) } }));
router.post(['/student/assignments/:id/submit', '/student/assignments/:id/submit/:submissionId'], async (req, res) => {
  const fileUrl = String(req.body.file_url || req.body.link_submission || 'text-submission');
  const item = await prisma.assignmentSubmission.upsert({ where: { assignmentId_studentId: { assignmentId: req.params.id, studentId: req.user!.userId } }, update: { fileUrl }, create: { assignmentId: req.params.id, studentId: req.user!.userId, fileUrl } });
  res.json({ success: true, data: { data: item } });
});
router.put('/tutor/submissions/:id/grade', async (req, res) => {
  const item = await prisma.assignmentSubmission.update({ where: { id: req.params.id }, data: { grade: Number(req.body.grade), feedback: req.body.feedback || null } });
  res.json({ success: true, data: { data: item } });
});

// Availability and questions use persistent generic records.
router.get('/tutor/availability', async (req, res) => res.json({ success: true, data: await list('availability', req.user?.userId) }));
router.post('/tutor/availability', async (req, res) => {
  await prisma.appRecord.deleteMany({ where: { kind: 'availability', ownerId: req.user!.userId } });
  const values = Array.isArray(req.body.availability) ? req.body.availability : [];
  const saved = [];
  for (const value of values) {
    const record = await prisma.appRecord.create({ data: { kind: 'availability', ownerId: req.user!.userId, data: value } });
    saved.push(recordData(record));
  }
  res.json({ success: true, data: { data: saved } });
});
router.put('/tutor/availability/:id', async (req, res) => res.json({ success: true, data: { data: await updateRecord('availability', req.params.id, req.body) } }));
router.delete('/tutor/availability/:id', async (req, res) => { await prisma.appRecord.deleteMany({ where: { id: req.params.id, kind: 'availability' } }); res.json({ success: true }); });
router.get(['/student/questions', '/tutor/questions'], async (_req, res) => res.json(paged(await list('question'))));
router.post('/student/questions', async (req, res) => res.status(201).json({ success: true, data: { data: await createRecord('question', req, { status: 'open' }) } }));
router.get(['/student/questions/:id', '/tutor/questions/:id'], async (req, res) => { const item = await getRecord('question', req.params.id); return item ? res.json({ success: true, data: { data: item } }) : res.status(404).json({ success: false, message: 'Question not found' }); });
router.post('/tutor/questions/:id/reply', async (req, res) => res.json({ success: true, data: { data: await updateRecord('question', req.params.id, { answer: req.body.answer, status: 'answered' }) } }));
router.put(['/student/questions/:id/status', '/tutor/questions/:id/status'], async (req, res) => res.json({ success: true, data: { data: await updateRecord('question', req.params.id, req.body) } }));

// Parent detail pages that are not covered by the core parent router.
router.post('/parent/children', async (req, res) => res.status(400).json({ success: false, message: 'Create the student in Users first, then link the account.' }));
router.get('/parent/children/:id/stats', async (req, res) => {
  const [classes, submissions] = await Promise.all([prisma.classEnrollment.count({ where: { studentId: req.params.id } }), prisma.assignmentSubmission.findMany({ where: { studentId: req.params.id } })]);
  const graded = submissions.filter(item => item.grade !== null);
  res.json({ success: true, data: { data: { total_classes: classes, total_assignments: submissions.length, average_grade: graded.length ? graded.reduce((sum, item) => sum + (item.grade || 0), 0) / graded.length : 0 } } });
});
router.get('/parent/children/:id/attendance', async (req, res) => {
  const rows = await prisma.attendance.findMany({ where: { studentId: req.params.id }, include: { session: true } });
  res.json(paged(rows));
});
router.get('/parent/children/:id/assignments', async (req, res) => {
  const rows = await prisma.assignment.findMany({ where: { class: { enrollments: { some: { studentId: req.params.id } } } }, include: { class: true } });
  res.json(paged(rows));
});
router.get('/parent/children/:id/assignments/:assignmentId', async (req, res) => {
  const item = await prisma.assignment.findUnique({ where: { id: req.params.assignmentId }, include: { class: true } });
  return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Assignment not found' });
});
router.get('/parent/children/:id/classes/available', getClasses);
router.get('/parent/children/:id/classes/:classId', async (req, res) => {
  const item = await prisma.class.findUnique({ where: { id: req.params.classId }, include: { tutor: true, sessions: true } });
  return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Class not found' });
});
router.post('/parent/children/:id/classes/:classId/enroll', async (req, res) => {
  const item = await prisma.classEnrollment.upsert({ where: { classId_studentId: { classId: req.params.classId, studentId: req.params.id } }, update: {}, create: { classId: req.params.classId, studentId: req.params.id } });
  res.json({ success: true, data: item });
});
router.get('/parent/children/:id/sessions/:sessionId', async (req, res) => {
  const item = await prisma.session.findUnique({ where: { id: req.params.sessionId }, include: { class: true, tutor: true } });
  return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Session not found' });
});
router.get('/parent/subscription/packages/:id', async (req, res) => res.json({ success: true, data: { id: req.params.id, name: 'Tutoring Plan', price: 0, features: [] } }));

// Notification item actions; list endpoints are provided in app.ts.
router.get('/notifications/:id', async (req, res) => { const item = await getRecord('notification', req.params.id); return item ? res.json({ success: true, data: { data: item } }) : res.status(404).json({ success: false, message: 'Notification not found' }); });
router.put('/notifications/read-all', async (req, res) => { const rows = await prisma.appRecord.findMany({ where: { kind: 'notification', ownerId: req.user!.userId } }); for (const row of rows) await updateRecord('notification', row.id, { is_read: true }); res.json({ success: true }); });
router.put('/notifications/:id/read', async (req, res) => res.json({ success: true, data: { data: await updateRecord('notification', req.params.id, { is_read: true }) } }));
router.delete('/notifications/:id', async (req, res) => { await prisma.appRecord.deleteMany({ where: { id: req.params.id, kind: 'notification' } }); res.json({ success: true }); });

// Password updates are authenticated and persisted.
router.put('/profile/password', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !req.body.current_password || !await bcrypt.compare(req.body.current_password, user.passwordHash)) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  const next = req.body.new_password || req.body.password;
  if (!next || String(next).length < 8) return res.status(400).json({ success: false, message: 'New password must contain at least 8 characters' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(String(next), 10) } });
  res.json({ success: true, message: 'Password updated successfully' });
});

export default router;

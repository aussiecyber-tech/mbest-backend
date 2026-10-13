import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../config/prisma';
import { findPackage, formatRecord, listPackages } from '../services/subscription.service';

export const getChildren = async (req: Request, res: Response) => {
  try {
    const parentId = req.user?.userId;
    const links = await prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            createdAt: true,
          }
        }
      }
    });

    const children = links.map(l => ({
      id: l.student.id,
      name: `${l.student.firstName} ${l.student.lastName}`.trim(),
      email: l.student.email,
      avatar: l.student.avatarUrl,
      relationship: l.relationship,
      year_level: 'Year 10',
    }));

    return res.status(200).json({
      success: true,
      data: children
    });
  } catch (error: any) {
    console.error('getChildren error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve children' });
  }
};

export const getChildGrades = async (req: Request, res: Response) => {
  try {
    const parentId = req.user?.userId;
    const { id: childId } = req.params;

    // RBAC & Ownership Boundary: Parent can ONLY access grades for their linked child
    const link = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId: parentId!,
          studentId: childId,
        }
      }
    });

    if (!link && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view grades for this student.'
      });
    }

    // Fetch submissions for this student
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { studentId: childId },
      include: {
        assignment: {
          include: { class: true }
        }
      }
    });

    const grades = submissions.map(s => ({
      id: s.id,
      assignment_title: s.assignment.title,
      subject: s.assignment.class.subject,
      class_name: s.assignment.class.name,
      grade: s.grade,
      score: s.grade,
      feedback: s.feedback,
      submitted_at: s.submittedAt.toISOString()
    }));

    const stats = {
      average_grade: grades.length > 0 ? (grades.reduce((acc, g) => acc + (g.grade || 0), 0) / grades.length).toFixed(1) : 'N/A',
      total_assignments: grades.length,
      completion_rate: '100%'
    };

    return res.status(200).json({
      success: true,
      data: {
        data: grades,
        grades: grades,
        statistics: stats,
        stats: stats
      }
    });
  } catch (error: any) {
    console.error('getChildGrades error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve child grades' });
  }
};

export const getChildClasses = async (req: Request, res: Response) => {
  try {
    const parentId = req.user?.userId;
    const { id: childId } = req.params;

    const link = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId: parentId!,
          studentId: childId,
        }
      }
    });

    if (!link && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied to this student' });
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId: childId },
      include: {
        class: {
          include: {
            tutor: true,
            sessions: true
          }
        }
      }
    });

    const classes = enrollments.map(e => ({
      id: e.class.id,
      name: e.class.name,
      subject: e.class.subject,
      tutor: e.class.tutor ? `${e.class.tutor.firstName} ${e.class.tutor.lastName}`.trim() : 'TBA',
    }));

    return res.status(200).json({
      success: true,
      data: { data: classes }
    });
  } catch (error: any) {
    console.error('getChildClasses error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve child classes' });
  }
};

export const getChildSessions = async (req: Request, res: Response) => {
  try {
    const parentId = req.user?.userId;
    const { id: childId } = req.params;

    const link = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId: parentId!,
          studentId: childId,
        }
      }
    });

    if (!link && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const sessions = await prisma.session.findMany({
      where: {
        class: {
          enrollments: { some: { studentId: childId } }
        }
      },
      include: {
        class: true,
        tutor: true
      }
    });

    const formatted = sessions.map(s => ({
      id: s.id,
      title: s.class.name,
      subject: s.class.subject,
      start_time: s.startTime.toISOString(),
      end_time: s.endTime.toISOString(),
      status: s.status.toLowerCase(),
      tutor: `${s.tutor.firstName} ${s.tutor.lastName}`.trim(),
    }));

    return res.status(200).json({
      success: true,
      data: { data: formatted }
    });
  } catch (error: any) {
    console.error('getChildSessions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sessions' });
  }
};

export const getPackages = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: await listPackages(true)
    });
  } catch (error: any) {
    console.error('getPackages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve packages' });
  }
};

export const getPackage = async (req: Request, res: Response) => {
  try {
    const pkg = await findPackage(req.params.id);
    if (!pkg || pkg.is_active === false) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    return res.json({ success: true, data: { data: pkg } });
  } catch (error: any) {
    console.error('getPackage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve package' });
  }
};

export const getMySubscription = async (req: Request, res: Response) => {
  try {
    const parentId = req.user!.userId;
    const latest = await prisma.appRecord.findFirst({
      where: { kind: 'payment', ownerId: parentId },
      orderBy: { createdAt: 'desc' },
    });
    const payment = latest ? formatRecord(latest) : null;
    const pkg = payment?.package_id ? await findPackage(String(payment.package_id)) : null;
    const active = payment?.status === 'approved';
    const studentCount = await prisma.parentStudent.count({ where: { parentId } });
    return res.status(200).json({
      success: true,
      data: {
        package: active ? pkg : null,
        status: active ? 'active' : payment?.status || 'none',
        current_student_count: studentCount,
        limits: active && pkg ? { students: pkg.student_limit || 0, allows_one_on_one: !!pkg.allows_one_on_one } : null,
        pending_payment: payment?.status === 'pending' ? payment : null
      }
    });
  } catch (error: any) {
    console.error('getMySubscription error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve subscription' });
  }
};

const parseMultipart = (req: Request) => {
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match || !Buffer.isBuffer(req.body)) return null;
  const boundary = `--${match[1] || match[2]}`;
  const raw = req.body.toString('latin1');
  const fields: Record<string, string> = {};
  let file: { name: string; type: string; data: Buffer } | null = null;
  for (const part of raw.split(boundary)) {
    const divider = part.indexOf('\r\n\r\n');
    if (divider < 0) continue;
    const headers = part.slice(0, divider);
    const name = headers.match(/name="([^"]+)"/i)?.[1];
    if (!name) continue;
    let body = part.slice(divider + 4);
    if (body.endsWith('\r\n')) body = body.slice(0, -2);
    const filename = headers.match(/filename="([^"]*)"/i)?.[1];
    if (filename !== undefined) {
      file = {
        name: filename,
        type: headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || 'application/octet-stream',
        data: Buffer.from(body, 'latin1'),
      };
    } else {
      fields[name] = body;
    }
  }
  return { fields, file };
};

export const submitPayment = async (req: Request, res: Response) => {
  try {
    const parsed = parseMultipart(req);
    const packageId = parsed?.fields.package_id || req.body?.package_id;
    const pkg = packageId ? await findPackage(String(packageId)) : null;
    if (!pkg || pkg.is_active === false) {
      return res.status(400).json({ success: false, message: 'Please select a valid active package' });
    }
    if (!parsed?.file?.data.length) {
      return res.status(400).json({ success: false, message: 'Payment slip file is required' });
    }
    if (parsed.file.data.length > 5 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Payment slip must be 5 MB or smaller' });
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(parsed.file.type) && parsed.file.type !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Payment slip must be a PNG, JPG, WEBP, or PDF file' });
    }

    const parent = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const now = new Date().toISOString();
    const slipToken = randomBytes(24).toString('hex');
    const data = {
      package_id: pkg.id,
      package: pkg,
      parent_id: req.user!.userId,
      parent: parent ? { id: parent.id, name: `${parent.firstName} ${parent.lastName}`.trim(), email: parent.email } : null,
      amount: Number(pkg.price || 0),
      status: 'pending',
      payment_slip_name: parsed.file.name,
      payment_slip_type: parsed.file.type,
      payment_slip_data: parsed.file.data.toString('base64'),
      payment_slip_token: slipToken,
      submitted_at: now,
    };
    const record = await prisma.appRecord.create({
      data: { kind: 'payment', ownerId: req.user!.userId, data },
    });
    const saved = await prisma.appRecord.update({
      where: { id: record.id },
      data: { data: { ...data, payment_slip_url: `/api/v1/payment-slips/${record.id}?token=${slipToken}` } },
    });

    return res.status(201).json({
      success: true,
      message: 'Payment slip submitted successfully! Awaiting admin approval.',
      data: { data: formatRecord(saved) }
    });
  } catch (error: any) {
    console.error('submitPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit payment' });
  }
};

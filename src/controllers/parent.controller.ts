import { Request, Response } from 'express';
import prisma from '../config/prisma';

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
    const packages = [
      { id: 'pkg_1', name: 'Basic Plan', price: 99.00, billing_cycle: 'monthly', features: ['1 Student', 'Math & English', 'Basic Support'] },
      { id: 'pkg_2', name: 'Premium Plan', price: 149.00, billing_cycle: 'monthly', features: ['Unlimited Students', 'All Subjects', '24/7 Support'] }
    ];
    
    return res.status(200).json({
      success: true,
      data: packages
    });
  } catch (error: any) {
    console.error('getPackages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve packages' });
  }
};

export const getMySubscription = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        package: null, // null means no active subscription
        status: 'pending',
        current_student_count: 0,
        limits: null,
        pending_payment: null
      }
    });
  } catch (error: any) {
    console.error('getMySubscription error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve subscription' });
  }
};

export const submitPayment = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Payment slip submitted successfully! Awaiting admin approval.',
      data: { status: 'pending' }
    });
  } catch (error: any) {
    console.error('submitPayment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit payment' });
  }
};

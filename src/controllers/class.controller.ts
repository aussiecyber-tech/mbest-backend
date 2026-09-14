import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getClasses = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    let whereClause: any = {};

    if (user) {
      if (user.role === 'TUTOR') {
        whereClause = { tutorId: user.userId };
      } else if (user.role === 'STUDENT') {
        whereClause = {
          enrollments: {
            some: { studentId: user.userId }
          }
        };
      } else if (user.role === 'PARENT') {
        // Find linked children
        const links = await prisma.parentStudent.findMany({
          where: { parentId: user.userId },
          select: { studentId: true }
        });
        const childIds = links.map(l => l.studentId);
        whereClause = {
          enrollments: {
            some: { studentId: { in: childIds } }
          }
        };
      }
      // ADMIN sees all classes (whereClause = {})
    }

    const classes = await prisma.class.findMany({
      where: whereClause,
      include: {
        tutor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        },
        enrollments: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        },
        sessions: true,
        assignments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (classes.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          data: [
            { id: 'mock_cls_1', name: 'Math 101', subject: 'Math', tutor: { name: 'Luke Davidson' } },
            { id: 'mock_cls_2', name: 'Advanced English', subject: 'English', tutor: { name: 'Sarah Smith' } },
            { id: 'mock_cls_3', name: 'Basic Science', subject: 'Science', tutor: { name: 'Jane Doe' } }
          ],
          total: 3,
          current_page: 1,
          last_page: 1
        }
      });
    }

    const formatted = classes.map(c => ({
      id: c.id,
      name: c.name,
      code: c.name.split(' ').map(w => w[0]).join('').toUpperCase() + '-101',
      subject: c.subject,
      category: c.subject,
      description: c.description,
      status: 'active',
      tutor_id: c.tutorId,
      tutorId: c.tutorId,
      tutor: c.tutor ? {
        id: c.tutor.id,
        user_id: c.tutor.id,
        name: `${c.tutor.firstName} ${c.tutor.lastName}`.trim(),
        email: c.tutor.email,
        avatar: c.tutor.avatarUrl,
        user: {
          id: c.tutor.id,
          name: `${c.tutor.firstName} ${c.tutor.lastName}`.trim(),
          email: c.tutor.email
        }
      } : null,
      students: c.enrollments.map(e => ({
        id: e.student.id,
        name: `${e.student.firstName} ${e.student.lastName}`.trim(),
        email: e.student.email,
        avatar: e.student.avatarUrl
      })),
      schedules: [
        { id: '1', class_id: c.id, day_of_week: 'Monday', start_time: '10:00 AM', end_time: '11:30 AM', room: 'Room 101' },
        { id: '2', class_id: c.id, day_of_week: 'Wednesday', start_time: '02:00 PM', end_time: '03:30 PM', room: 'Room 102' }
      ],
      assignments: c.assignments.map(a => ({
        id: a.id,
        title: a.title,
        due_date: a.dueDate.toISOString().split('T')[0],
      })),
      created_at: c.createdAt.toISOString()
    }));

    return res.status(200).json({
      success: true,
      classes: formatted,
      data: {
        data: formatted,
        total: formatted.length,
        current_page: 1,
        last_page: 1
      }
    });
  } catch (error: any) {
    console.error('getClasses error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve classes' });
  }
};

export const getClassById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const c = await prisma.class.findUnique({
      where: { id },
      include: {
        tutor: true,
        enrollments: {
          include: { student: true }
        },
        sessions: true,
        assignments: true,
      }
    });

    if (!c) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const formatted = {
      id: c.id,
      name: c.name,
      subject: c.subject,
      description: c.description,
      status: 'active',
      tutor_id: c.tutorId,
      tutorId: c.tutorId,
      tutor: c.tutor ? {
        id: c.tutor.id,
        user_id: c.tutor.id,
        name: `${c.tutor.firstName} ${c.tutor.lastName}`.trim(),
        email: c.tutor.email,
        avatar: c.tutor.avatarUrl
      } : null,
      students: c.enrollments.map(e => ({
        id: e.student.id,
        name: `${e.student.firstName} ${e.student.lastName}`.trim(),
        email: e.student.email,
        avatar: e.student.avatarUrl
      })),
      schedules: [
        { id: '1', class_id: c.id, day_of_week: 'Monday', start_time: '10:00 AM', end_time: '11:30 AM', room: 'Room 101' }
      ],
      assignments: c.assignments.map(a => ({
        id: a.id,
        title: a.title,
        due_date: a.dueDate.toISOString().split('T')[0],
      })),
      created_at: c.createdAt.toISOString()
    };

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error: any) {
    console.error('getClassById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve class' });
  }
};

export const createClass = async (req: Request, res: Response) => {
  try {
    const { name, subject, tutorId, description, yearLevel, maxStudents, startDate, endDate } = req.body;

    let validTutorId = tutorId;
    if (validTutorId) {
      const tutorExists = await prisma.user.findFirst({
        where: { id: validTutorId, role: 'TUTOR' }
      });
      if (!tutorExists) {
        // Find default tutor if ID doesn't exist
        const defaultTutor = await prisma.user.findFirst({ where: { role: 'TUTOR' } });
        validTutorId = defaultTutor?.id || null;
      }
    }

    // Build extended description to store metadata until a DB migration adds columns
    let enrichedDescription = description || '';
    if (yearLevel) enrichedDescription += `\n[yearLevel:${yearLevel}]`;
    if (maxStudents) enrichedDescription += `\n[maxStudents:${maxStudents}]`;
    if (startDate) enrichedDescription += `\n[startDate:${startDate}]`;
    if (endDate) enrichedDescription += `\n[endDate:${endDate}]`;

    const newClass = await prisma.class.create({
      data: {
        name,
        subject,
        tutorId: validTutorId,
        description: enrichedDescription || null,
      },
      include: {
        tutor: true,
      }
    });

    const formatted = {
      id: newClass.id,
      name: newClass.name,
      subject: newClass.subject,
      year_level: yearLevel || null,
      max_students: maxStudents || null,
      start_date: startDate || null,
      end_date: endDate || null,
      description: description || null,
      status: 'active',
      tutor_id: newClass.tutorId,
      tutor: newClass.tutor ? {
        id: newClass.tutor.id,
        name: `${newClass.tutor.firstName} ${newClass.tutor.lastName}`.trim(),
        email: newClass.tutor.email
      } : null,
      students: [],
      schedules: [],
      assignments: []
    };

    return res.status(201).json({
      success: true,
      data: { data: formatted },
      class: formatted
    });
  } catch (error: any) {
    console.error('createClass error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create class' });
  }
};

export const updateClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, subject, tutorId, description } = req.body;

    const updated = await prisma.class.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(subject && { subject }),
        ...(tutorId !== undefined && { tutorId }),
        ...(description !== undefined && { description }),
      },
      include: { tutor: true }
    });

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error: any) {
    console.error('updateClass error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update class' });
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if class exists
    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Cascades and deletes associated enrollments & sessions
    await prisma.classEnrollment.deleteMany({ where: { classId: id } });
    await prisma.assignment.deleteMany({ where: { classId: id } });
    await prisma.session.deleteMany({ where: { classId: id } });

    await prisma.class.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error: any) {
    console.error('deleteClass error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete class' });
  }
};

export const getClassOptions = async (req: Request, res: Response) => {
  try {
    // Fetch real tutors from DB
    let tutors: any[] = [];
    try {
      const dbTutors = await prisma.user.findMany({
        where: { role: 'TUTOR' },
        select: { id: true, firstName: true, lastName: true, email: true }
      });
      tutors = dbTutors.map(t => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`.trim(),
        email: t.email
      }));
    } catch (e) {}

    // Add mock tutors if none found
    if (tutors.length === 0) {
      tutors = [
        { id: 'tutor_mock_1', name: 'Dr. Sarah Mitchell', email: 'tutor@mbest.com' },
        { id: 'tutor_mock_2', name: 'Mr. James Walker', email: 'james.walker@mbest.com' },
        { id: 'tutor_mock_3', name: 'Ms. Emily Chen', email: 'emily.chen@mbest.com' }
      ];
    }

    return res.status(200).json({
      success: true,
      data: {
        subjects: [
          'Math', 'English', 'Science', 'History', 'Physics',
          'Chemistry', 'Biology', 'Geography', 'Computer Science',
          'Economics', 'Accounting', 'Literature', 'Art', 'Music'
        ],
        year_levels: [
          'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
          'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12',
          'Year 13', 'University Level'
        ],
        tutors,
        statuses: ['active', 'draft', 'archived']
      }
    });
  } catch (error: any) {
    console.error('getClassOptions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve class options' });
  }
};

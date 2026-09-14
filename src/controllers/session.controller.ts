import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { SessionStatus } from '@prisma/client';

export const getSessions = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    let whereClause: any = {};

    if (user) {
      if (user.role === 'TUTOR') {
        whereClause = { tutorId: user.userId };
      } else if (user.role === 'STUDENT') {
        whereClause = {
          class: {
            enrollments: {
              some: { studentId: user.userId }
            }
          }
        };
      } else if (user.role === 'PARENT') {
        const links = await prisma.parentStudent.findMany({
          where: { parentId: user.userId },
          select: { studentId: true }
        });
        const childIds = links.map(l => l.studentId);
        whereClause = {
          class: {
            enrollments: {
              some: { studentId: { in: childIds } }
            }
          }
        };
      }
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        tutor: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        class: {
          select: { id: true, name: true, subject: true }
        },
        attendances: true,
      },
      orderBy: { startTime: 'asc' }
    });

    const formatted = sessions.map(s => {
      const startDate = new Date(s.startTime);
      const endDate = new Date(s.endTime);
      const tutorName = s.tutor ? `${s.tutor.firstName} ${s.tutor.lastName}`.trim() : 'Unassigned';

      return {
        id: s.id,
        title: `${s.class.name} Session`,
        subject: s.class.subject,
        date: startDate.toISOString().split('T')[0],
        start_time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        end_time: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        status: s.status.toLowerCase(),
        tutor_id: s.tutorId,
        tutor: { id: s.tutorId, name: tutorName },
        class_id: s.classId,
        class: { id: s.classId, name: s.class.name },
        students_count: s.attendances.length || 10,
        room: 'Room 101',
        notes: s.notes,
        attachment_url: s.attachmentUrl
      };
    });

    return res.status(200).json({
      success: true,
      sessions: formatted,
      data: {
        data: formatted,
        total: formatted.length
      }
    });
  } catch (error: any) {
    console.error('getSessions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sessions' });
  }
};

export const createSession = async (req: Request, res: Response) => {
  try {
    const { classId, tutorId, startTime, endTime, status, notes, attachmentUrl } = req.body;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date/time format for startTime or endTime'
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: startTime must be strictly before endTime'
      });
    }

    // 30-minute increment validation:
    // 1. Duration must be multiples of 30 minutes
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    if (durationMinutes % 30 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: Session duration must be in increments of 30 minutes'
      });
    }

    // 2. Start and end minutes should align to 00 or 30
    if (start.getMinutes() % 30 !== 0 || end.getMinutes() % 30 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: Session startTime and endTime minutes must be aligned to 30-minute intervals (:00 or :30)'
      });
    }

    // Verify class exists
    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Determine tutorId: if not provided or valid, default to class tutorId
    const targetTutorId = tutorId || classRecord.tutorId;
    if (!targetTutorId) {
      return res.status(400).json({ success: false, message: 'A tutor must be assigned to this session' });
    }

    // Collision Detection Rule:
    // Ensure the assigned tutor has no overlapping session where:
    // existing.startTime < requestedEndTime AND existing.endTime > requestedStartTime
    const overlappingSession = await prisma.session.findFirst({
      where: {
        tutorId: targetTutorId,
        status: { not: SessionStatus.CANCELLED },
        startTime: { lt: end },
        endTime: { gt: start },
      }
    });

    if (overlappingSession) {
      return res.status(409).json({
        success: false,
        message: 'Collision detected: The assigned tutor already has a scheduled session during this time window.',
        conflictSessionId: overlappingSession.id
      });
    }

    const newSession = await prisma.session.create({
      data: {
        classId,
        tutorId: targetTutorId,
        startTime: start,
        endTime: end,
        status: (status as SessionStatus) || SessionStatus.PLANNED,
        notes: notes || null,
        attachmentUrl: attachmentUrl || null,
      },
      include: {
        tutor: true,
        class: true,
      }
    });

    const tutorName = `${newSession.tutor.firstName} ${newSession.tutor.lastName}`.trim();
    const formatted = {
      id: newSession.id,
      title: `${newSession.class.name} Session`,
      subject: newSession.class.subject,
      date: start.toISOString().split('T')[0],
      start_time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      end_time: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      startTime: newSession.startTime.toISOString(),
      endTime: newSession.endTime.toISOString(),
      status: newSession.status.toLowerCase(),
      tutor_id: newSession.tutorId,
      tutor: { id: newSession.tutorId, name: tutorName },
      class_id: newSession.classId,
      class: { id: newSession.classId, name: newSession.class.name },
      students_count: 0,
      notes: newSession.notes,
      attachment_url: newSession.attachmentUrl
    };

    return res.status(201).json({
      success: true,
      session: formatted,
      data: { data: formatted }
    });
  } catch (error: any) {
    console.error('createSession error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create session' });
  }
};

export const updateSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, status, notes, attachmentUrl } = req.body;

    const existing = await prisma.session.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const start = startTime ? new Date(startTime) : existing.startTime;
    const end = endTime ? new Date(endTime) : existing.endTime;

    if (startTime || endTime) {
      if (start >= end) {
        return res.status(400).json({ success: false, message: 'startTime must be before endTime' });
      }

      // Check collision on reschedule
      const collision = await prisma.session.findFirst({
        where: {
          id: { not: id },
          tutorId: existing.tutorId,
          status: { not: SessionStatus.CANCELLED },
          startTime: { lt: end },
          endTime: { gt: start },
        }
      });

      if (collision) {
        return res.status(409).json({
          success: false,
          message: 'Collision detected: The tutor is already scheduled during this new time window'
        });
      }
    }

    const updated = await prisma.session.update({
      where: { id },
      data: {
        ...(startTime && { startTime: start }),
        ...(endTime && { endTime: end }),
        ...(status && { status: status as SessionStatus }),
        ...(notes !== undefined && { notes }),
        ...(attachmentUrl !== undefined && { attachmentUrl }),
      },
      include: {
        tutor: true,
        class: true
      }
    });

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error: any) {
    console.error('updateSession error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update session' });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.attendance.deleteMany({ where: { sessionId: id } });
    await prisma.session.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Session deleted successfully' });
  } catch (error: any) {
    console.error('deleteSession error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete session' });
  }
};

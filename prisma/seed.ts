import { PrismaClient, Role, SessionStatus, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const tutorPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mbest.com' },
    update: {},
    create: {
      email: 'admin@mbest.com',
      passwordHash,
      role: Role.ADMIN,
      firstName: 'Super',
      lastName: 'Admin',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    },
  });

  // 2. Tutor 1
  const tutor = await prisma.user.upsert({
    where: { email: 'tutor@mbest.com' },
    update: {},
    create: {
      email: 'tutor@mbest.com',
      passwordHash: tutorPasswordHash,
      role: Role.TUTOR,
      firstName: 'Alex',
      lastName: 'Smith',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    },
  });

  // 3. Tutor 2
  const tutor2 = await prisma.user.upsert({
    where: { email: 'robert@example.com' },
    update: {},
    create: {
      email: 'robert@example.com',
      passwordHash: tutorPasswordHash,
      role: Role.TUTOR,
      firstName: 'Robert',
      lastName: 'Davies',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
  });

  // 4. Student 1
  const student = await prisma.user.upsert({
    where: { email: 'student@mbest.com' },
    update: {},
    create: {
      email: 'student@mbest.com',
      passwordHash: tutorPasswordHash, // allow Password123!
      role: Role.STUDENT,
      firstName: 'Jordan',
      lastName: 'Lee',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  });

  // 5. Student 2
  const student2 = await prisma.user.upsert({
    where: { email: 'emily@example.com' },
    update: {},
    create: {
      email: 'emily@example.com',
      passwordHash: tutorPasswordHash,
      role: Role.STUDENT,
      firstName: 'Emily',
      lastName: 'Watson',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  });

  // 6. Parent
  const parent = await prisma.user.upsert({
    where: { email: 'parent@mbest.com' },
    update: {},
    create: {
      email: 'parent@mbest.com',
      passwordHash: tutorPasswordHash,
      role: Role.PARENT,
      firstName: 'Morgan',
      lastName: 'Lee',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
  });

  // Link Parent to Student
  await prisma.parentStudent.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      parentId: parent.id,
      studentId: student.id,
      relationship: 'Mother',
    },
  });

  // Seed Initial Classes
  let mathClass = await prisma.class.findFirst({ where: { name: 'Year 10 Advanced Mathematics' } });
  if (!mathClass) {
    mathClass = await prisma.class.create({
      data: {
        name: 'Year 10 Advanced Mathematics',
        subject: 'Mathematics',
        description: 'Comprehensive algebra, trigonometry, and calculus preparation.',
        tutorId: tutor.id,
      },
    });
  }

  let physicsClass = await prisma.class.findFirst({ where: { name: 'Year 11 Physics & Mechanics' } });
  if (!physicsClass) {
    physicsClass = await prisma.class.create({
      data: {
        name: 'Year 11 Physics & Mechanics',
        subject: 'Physics',
        description: 'Kinematics, dynamics, energy, momentum, and circular motion.',
        tutorId: tutor2.id,
      },
    });
  }

  // Seed Enrollments
  await prisma.classEnrollment.upsert({
    where: { classId_studentId: { classId: mathClass.id, studentId: student.id } },
    update: {},
    create: { classId: mathClass.id, studentId: student.id },
  });

  await prisma.classEnrollment.upsert({
    where: { classId_studentId: { classId: mathClass.id, studentId: student2.id } },
    update: {},
    create: { classId: mathClass.id, studentId: student2.id },
  });

  await prisma.classEnrollment.upsert({
    where: { classId_studentId: { classId: physicsClass.id, studentId: student2.id } },
    update: {},
    create: { classId: physicsClass.id, studentId: student2.id },
  });

  // Seed Initial Sessions
  const session1Start = new Date();
  session1Start.setHours(10, 0, 0, 0);
  const session1End = new Date();
  session1End.setHours(11, 30, 0, 0);

  const existingSession = await prisma.session.findFirst({ where: { classId: mathClass.id } });
  if (!existingSession) {
    const session = await prisma.session.create({
      data: {
        classId: mathClass.id,
        tutorId: tutor.id,
        startTime: session1Start,
        endTime: session1End,
        status: SessionStatus.CONFIRMED,
        notes: 'Introduction to polynomial functions and graphs.',
      },
    });

    await prisma.attendance.create({
      data: {
        sessionId: session.id,
        studentId: student.id,
        status: AttendanceStatus.PRESENT,
      },
    });
  }

  // Seed Initial Assignment
  const existingAssignment = await prisma.assignment.findFirst({ where: { classId: mathClass.id } });
  if (!existingAssignment) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const assignment = await prisma.assignment.create({
      data: {
        classId: mathClass.id,
        title: 'Algebra Problem Set 1',
        description: 'Solve problems 1-25 on page 42 of the course text.',
        dueDate,
      },
    });

    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id,
        fileUrl: 'https://example.com/submissions/jordan_lee_hw1.pdf',
        grade: 95.0,
        feedback: 'Excellent work on quadratic equations!',
      },
    });
  }

  // Seed Initial Resources
  const existingResource = await prisma.resource.findFirst({ where: { title: 'Year 10 Advanced Math Formulas' } });
  if (!existingResource) {
    await prisma.resource.create({
      data: {
        uploaderId: admin.id,
        title: 'Year 10 Advanced Math Formulas',
        category: 'Mathematics',
        fileUrl: 'https://example.com/resources/math_formulas_year10.pdf',
        isPublic: true,
      },
    });
  }

  console.log('Database seeded successfully with MBEST demo accounts and initial records.');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

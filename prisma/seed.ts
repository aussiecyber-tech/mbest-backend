import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const demoUsers = [
  { email: 'admin@mbest.com', password: 'password123', role: Role.ADMIN, firstName: 'Super', lastName: 'Administrator' },
  { email: 'tutor@mbest.com', password: 'Password123!', role: Role.TUTOR, firstName: 'Sarah', lastName: 'Mitchell' },
  { email: 'parent@mbest.com', password: 'Password123!', role: Role.PARENT, firstName: 'David', lastName: 'Miller' },
  { email: 'student@mbest.com', password: 'Password123!', role: Role.STUDENT, firstName: 'Alex', lastName: 'Johnson' },
];

async function main() {
  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      create: {
        email: user.email,
        passwordHash,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: true,
      },
    });
  }

  console.log('Database seeded successfully.');
}

main()
  .catch(error => {
    console.error('Database seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

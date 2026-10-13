import { PrismaClient } from '@prisma/client';
// import * as bcrypt from 'bcrypt'; // Uncomment if your backend hashes passwords

const prisma = new PrismaClient();

async function main() {
  // --- ADD THESE DEMO USERS TO YOUR EXISTING SEED.TS ---
  const demoUsers = [
    {
      id: "1",
      name: "Super Administrator",
      email: "admin@mbest.com",
      password: "password123", // Matches frontend demo credentials
      role: "admin",
    },
    {
      id: "201",
      name: "Dr. Sarah Mitchell",
      email: "tutor@mbest.com",
      password: "Password123!",
      role: "tutor",
    },
    {
      id: "301",
      name: "David Miller",
      email: "parent@mbest.com",
      password: "Password123!",
      role: "parent",
    },
    {
      id: "101",
      name: "Alex Johnson",
      email: "student@mbest.com",
      password: "Password123!",
      role: "student",
    }
  ];

  console.log('🌱 Seeding demo users...');

  for (const user of demoUsers) {
    // const hashedPassword = await bcrypt.hash(user.password, 10);
    
    const upsertedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        id: user.id, // Forces the ID to match the frontend session
        role: user.role
      },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password, // Use hashedPassword here if your backend expects it
        role: user.role,
      },
    });
    console.log(`✅ Upserted user: ${upsertedUser.email} (ID: ${upsertedUser.id})`);
  }
  // --- END OF DEMO USERS ---

  // ... your existing seed logic here
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

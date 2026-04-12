const { PrismaClient } = require('@prisma/client');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { PrismaNeon } = require('@prisma/adapter-neon');
const ws = require('ws');
const dotenv = require('dotenv');

dotenv.config();

neonConfig.webSocketConstructor = ws;
const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'receiver@example.com';
  const upsertUser = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Receiver',
      password: 'password123', // In real app should be hashed, but for seeding maybe bypass or hash if needed. 
      // Server 'login' compares hash. I should hash it if I want to login as him. 
      // But I only need him to exist to be searchable. Search doesn't check password.
    },
  });
  console.log('Seeded Receiver:', upsertUser);
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

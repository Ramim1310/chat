const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('password', 10);

    const sender = await prisma.user.upsert({
        where: { email: 'sender@test.com' },
        update: { password: hashedPassword },
        create: { name: 'Sender', email: 'sender@test.com', password: hashedPassword, image: '' }
    });

    const receiver = await prisma.user.upsert({
        where: { email: 'final@test.com' },
        update: { password: hashedPassword },
        create: { name: 'FinalReceiver', email: 'final@test.com', password: hashedPassword, image: '' }
    });

    console.log(`Sender ID: ${sender.id}`);
    console.log(`Receiver ID: ${receiver.id}`);

    // Ensure they are friends
    // Check if already friends
    const s = await prisma.user.findUnique({ where: { id: sender.id }, include: { friends: true }});
    const alreadyFriends = s.friends.some(f => f.id === receiver.id);

    if (!alreadyFriends) {
        console.log("Connecting friends...");
        await prisma.user.update({
            where: { id: sender.id },
            data: { friends: { connect: { id: receiver.id } } }
        });
        await prisma.user.update({
            where: { id: receiver.id },
            data: { friends: { connect: { id: sender.id } } }
        });
        console.log("Connected.");
    } else {
        console.log("Already friends.");
    }

    // Ensure request is accepted (optional, but good for consistency)
    // Clean up old requests first?
    // Let's just rely on the 'friends' relation which is what the app checks.
}

main().catch(console.error).finally(() => prisma.$disconnect());

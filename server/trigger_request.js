const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

dotenv.config();

const socket = io('http://localhost:5000');
const prisma = new PrismaClient();

async function main() {
    console.log("Waiting 40s for client to connect...");
    await new Promise(r => setTimeout(r, 40000));

    const hashedPassword = await bcrypt.hash('password', 10);

    // 1. Ensure users exist
    const receiver = await prisma.user.upsert({
        where: { email: 'final@test.com' },
        update: { password: hashedPassword },
        create: { name: 'FinalReceiver', email: 'final@test.com', password: hashedPassword, image: '' }
    });

    const sender = await prisma.user.upsert({
        where: { email: 'sender@test.com' },
        update: { password: hashedPassword },
        create: { name: 'Sender', email: 'sender@test.com', password: hashedPassword, image: '' }
    });

    console.log(`Users ready: Sender(${sender.id}) -> Receiver(${receiver.id})`);

    // 2. Clean up old requests (Global wipe for testing reliability)
    console.log("Cleaning up all friend requests...");
    const deleted = await prisma.friendRequest.deleteMany({});
    console.log(`Deleted ${deleted.count} old requests.`);

    // 3. Connect socket
    socket.on('connect', () => {
        console.log('Connected to server');
        
        // 4. Send Request
        console.log('Sending friend request...');
        socket.emit('sendFriendRequest', { 
            senderId: sender.id, 
            receiverId: receiver.id 
        }, (response) => {
            console.log('Response:', response);
            process.exit(0);
        });
    });
}

main().catch(console.error);

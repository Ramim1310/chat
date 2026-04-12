const io = require('socket.io-client');

const BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = 'final@test.com';
const TEST_PASS = 'password';
const TEST_ROOM = 'general'; // Using general to be safe/visible
const TEST_MSG = 'Backend Verification ' + Date.now();

async function main() {
    console.log(`1. Logging in user: ${TEST_EMAIL}`);
    const loginRes = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
        console.error("Login failed:", loginData);
        process.exit(1);
    }
    console.log("Login success. User ID:", loginData.user.id);
    console.log("User Email from Server:", loginData.user.email); // CRITICAL: Check this

    console.log("2. Connecting Socket...");
    const socket = io(BASE_URL);

    socket.on('connect', () => {
        console.log("Socket Connected.");
        
        socket.emit('user_connected', loginData.user);
        socket.emit('join_room', TEST_ROOM);

        console.log("3. Sending Message...");
        socket.emit('send_message', {
            room: TEST_ROOM,
            author: loginData.user.name,
            message: TEST_MSG,
            email: loginData.user.email, // Using the email from fresh login
            image: loginData.user.image,
            time: 'Now',
            isOptimistic: false
        });

        // Verify after delay
        setTimeout(async () => {
            console.log("4. Verifying persistence via API...");
            try {
                const apiRes = await fetch(`${BASE_URL}/api/messages?room=${TEST_ROOM}`);
                const messages = await apiRes.json();
                
                const found = messages.find(m => m.content === TEST_MSG);
                
                if (found) {
                    console.log("SUCCESS: Message found in database!");
                    process.exit(0);
                } else {
                    console.error("FAILURE: Message NOT found.");
                    process.exit(1);
                }
            } catch (err) {
                console.error("Verification failed:", err);
                process.exit(1);
            }
        }, 2000);
    });
}

main().catch(err => console.error(err));

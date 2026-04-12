const io = require('socket.io-client');

const BASE_URL = 'http://localhost:5000';
// Use a fixed email to allow re-runs testing persistence across restarts if needed, 
// OR random to ensure fresh state. Let's use fixed first to test login fallback.
const TEST_EMAIL = `persist_test_user@example.com`; 
const TEST_PASS = 'password123';
const TEST_NAME = 'PersistTester_' + Date.now();
const TEST_ROOM = 'persistence-test-room';
const TEST_MSG = 'Persistence Check ' + Date.now();

async function main() {
    console.log(`1. Authenticating user: ${TEST_EMAIL}`);
    let user;
    let token;

    // Try Register
    const regRes = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASS, image: '' })
    });
    
    const regData = await regRes.json();
    if (regRes.ok) {
        console.log("Registration success");
        user = regData.user;
        token = regData.token;
    } else {
        console.log("Registration failed, trying login...", regData);
        // Try Login
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) {
            console.error("Login also failed:", loginData);
            process.exit(1);
        }
        console.log("Login success");
        user = loginData.user;
        token = loginData.token;
    }

    if (!user || !user.id) {
        console.error("No user ID found");
        process.exit(1);
    }

    console.log(`User ID: ${user.id}`);

    console.log("2. Connecting Socket...");
    const socket = io(BASE_URL);

    socket.on('connect', () => {
        console.log("Socket Connected. ID:", socket.id);
        
        // Emulate Dashboard.jsx behavior
        socket.emit('user_connected', user);
        socket.emit('join_room', TEST_ROOM); // Legacy
        socket.emit('join_chat', TEST_ROOM); // New

        console.log(`3. Sending Message: "${TEST_MSG}"`);
        socket.emit('send_message', {
            room: TEST_ROOM,
            author: user.name,
            content: TEST_MSG, // Correct field name per my update
            email: user.email,
            senderId: user.id, // Added this field in my update
            image: '',
            time: 'Now',
            isOptimistic: false
        });

        // Verify after delay
        setTimeout(async () => {
            console.log("4. Verifying persistence via API...");
            try {
                const apiRes = await fetch(`${BASE_URL}/api/messages?room=${TEST_ROOM}`);
                const messages = await apiRes.json();
                
                console.log(`Fetched ${messages.length} messages for room ${TEST_ROOM}`);
                const found = messages.find(m => m.content === TEST_MSG);
                
                if (found) {
                    console.log("SUCCESS: Message found in database!");
                    console.log(JSON.stringify(found, null, 2));
                    process.exit(0);
                } else {
                    console.error("FAILURE: Message NOT found.");
                    if (messages.length > 0) {
                        console.log("Last message:", JSON.stringify(messages[messages.length-1], null, 2));
                    }
                    process.exit(1);
                }
            } catch (err) {
                console.error("Verification failed:", err);
                process.exit(1);
            }
        }, 3000);
    });
}

main().catch(err => console.error("Main Error:", err));

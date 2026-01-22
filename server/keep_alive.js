const io = require('socket.io-client');

const socket = io('http://localhost:5000');

// Simulating Sender (ID 25)
const user = {
    id: 25, 
    name: 'Sender',
    email: 'sender@test.com',
    image: ''
};

socket.on('connect', () => {
    console.log('Sender (ID 25) connected');
    socket.emit('user_connected', user);
    
    // Join the expected room (24-25 sorted) -> "24-25"
    // Assumption: Receiver ID is 24. 
    // If IDs are different, this might fail, but for now we assume setup_friends.js output.
    const room = "24-25"; 
    socket.emit('join_room', room);
    console.log(`Joined room: ${room}`);
});

socket.on('receive_message', (data) => {
    console.log("RECEIVED_MESSAGE:", data.content, "from", data.author);
    
    // Auto-reply if it's not from self
    if (data.senderId !== user.id) {
        setTimeout(() => {
            console.log("Sending reply...");
            socket.emit('send_message', {
                room: "24-25",
                author: user.name,
                message: "I got your message: " + data.content,
                email: user.email,
                image: user.image,
                time: "now",
                isOptimistic: false
            });
        }, 2000);
    }
});

setInterval(() => {}, 1000); // Keep process alive
